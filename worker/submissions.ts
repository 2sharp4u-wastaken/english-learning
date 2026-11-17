/**
 * worker/submissions.ts — Content submission pipeline, Phase 1
 * (docs/content-submission-pipeline.md).
 *
 * The parent-facing SUBMIT half of "crowdsource better vocab pictures + words,
 * owner-reviewed before they reach prod". A parent sets a picture/word locally
 * (already works), taps "share", and it lands in the private "locked drawer":
 *   image bytes → R2 (REPORTS_BUCKET, `submissions/` prefix)
 *   metadata    → D1 `submissions` table, status='pending'  (migrations/0003)
 * Nothing here is public. The daily review agent (Phase 4) reads the drawer via
 * admin endpoints (Phase 3), vision-screens, and bakes approved items into the
 * repo via a PR the owner merges.
 *
 * Endpoints (mounted under /api by worker/index.ts):
 *   POST /api/submit-image  (multipart: payload JSON + `image` file) → {ok, id}
 *   POST /api/submit-word   (JSON {word, category, translation, submitter?}) → {ok, id}
 *
 * Hardening (mirrors the /api/report fixes): content-type allowlist, size cap,
 * random unguessable R2 keys (no submitter/word in the key), per-IP rate limit
 * (reuses the auth rate_limits table), and pending caps so the drawer can't be
 * flooded. FAILS CLOSED (503) when DB/bucket are unconfigured, so a submission is
 * never silently dropped.
 */

import { rateLimit, clientIp, type D1Database } from './auth'

// Minimal R2 shape (matches worker/index.ts; avoids a workers-types dependency).
interface R2BucketLike {
  put: (key: string, value: ArrayBuffer | ReadableStream, opts?: unknown) => Promise<unknown>
}

export interface SubmissionsEnv {
  DB?: D1Database
  // Reuses the bug-report bucket under a `submissions/` key prefix — no new R2
  // bucket to provision. Can be split into its own bucket later without changing
  // the handlers (only the binding).
  REPORTS_BUCKET?: R2BucketLike
}

// Word icons are small; the client downscales before upload, so cap well under
// the 5 MB report limit. jpeg/png/webp only — don't let an unauthenticated
// endpoint stash arbitrary bytes.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_WORD_LEN = 40
const MAX_CATEGORY_LEN = 40
const MAX_TRANSLATION_LEN = 80

// Per-IP submit throttle (reuses the D1 fixed-window limiter + rate_limits table).
const RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 } // 20/hour/IP
// Pending-queue caps so the drawer can't be flooded (R2 storage + review load).
const MAX_PENDING_GLOBAL = 1000
const MAX_PENDING_PER_SUBMITTER = 20

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function clean(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

/** Count pending rows globally and for this submitter. A missing table throws →
 *  the caller FAILS CLOSED (503), consistent with "never drop a submission". */
async function pendingCounts(
  db: D1Database,
  submitter: string,
): Promise<{ global: number; mine: number }> {
  const global = await db
    .prepare("SELECT COUNT(*) AS c FROM submissions WHERE status = 'pending'")
    .first<{ c: number }>()
  const mine = submitter
    ? await db
        .prepare("SELECT COUNT(*) AS c FROM submissions WHERE status = 'pending' AND submitter = ?")
        .bind(submitter)
        .first<{ c: number }>()
    : { c: 0 }
  return { global: global?.c ?? 0, mine: mine?.c ?? 0 }
}

async function insertSubmission(
  db: D1Database,
  row: {
    id: string
    kind: 'image' | 'word'
    word: string
    category: string
    translation: string | null
    imageKey: string | null
    submitter: string | null
    familyId: string | null
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO submissions
         (id, kind, word, category, translation, image_key, submitter, family_id, status, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(
      row.id,
      row.kind,
      row.word,
      row.category,
      row.translation,
      row.imageKey,
      row.submitter,
      row.familyId,
      new Date().toISOString(),
    )
    .run()
}

async function submitImage(request: Request, env: SubmissionsEnv): Promise<Response> {
  if (!env.DB || !env.REPORTS_BUCKET) return json({ error: 'submissions not configured' }, 503)
  if (!(await rateLimit(env, `submit:${clientIp(request)}`, RATE_LIMIT))) {
    return json({ error: 'too many submissions, try again later' }, 429)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'expected multipart/form-data' }, 400)
  }

  let payload: { word?: string; category?: string; submitter?: string; familyId?: string } = {}
  try {
    payload = JSON.parse(String(form.get('payload') ?? '{}'))
  } catch {
    return json({ error: 'bad payload json' }, 400)
  }

  const word = clean(payload.word, MAX_WORD_LEN)
  const category = clean(payload.category, MAX_CATEGORY_LEN)
  if (!word || !category) return json({ error: 'word and category required' }, 400)
  const submitter = clean(payload.submitter, 64) || null
  const familyId = clean(payload.familyId, 64) || null

  const file = form.get('image')
  if (!file || typeof file === 'string') return json({ error: 'image file required' }, 400)
  const blob = file as unknown as Blob
  if (blob.size > MAX_IMAGE_BYTES) return json({ error: 'image too large' }, 413)
  const contentType = ALLOWED_IMAGE_TYPES.has(blob.type) ? blob.type : ''
  if (!contentType) return json({ error: 'unsupported image type' }, 415)

  // Pending caps (fail closed on a missing table — don't silently accept).
  let counts: { global: number; mine: number }
  try {
    counts = await pendingCounts(env.DB, submitter ?? '')
  } catch {
    return json({ error: 'submissions not configured' }, 503)
  }
  if (counts.global >= MAX_PENDING_GLOBAL) return json({ error: 'submission queue full' }, 429)
  if (submitter && counts.mine >= MAX_PENDING_PER_SUBMITTER) {
    return json({ error: 'too many pending submissions' }, 429)
  }

  // Random, unguessable key — no submitter/word leaking into the R2 path.
  const imageKey = `submissions/${crypto.randomUUID()}.${EXT_BY_TYPE[contentType]}`
  const buf = await blob.arrayBuffer()
  await env.REPORTS_BUCKET.put(imageKey, buf, { httpMetadata: { contentType } })

  const id = crypto.randomUUID()
  await insertSubmission(env.DB, {
    id,
    kind: 'image',
    word,
    category,
    translation: null,
    imageKey,
    submitter,
    familyId,
  })
  return json({ ok: true, id })
}

async function submitWord(request: Request, env: SubmissionsEnv): Promise<Response> {
  if (!env.DB) return json({ error: 'submissions not configured' }, 503)
  if (!(await rateLimit(env, `submit:${clientIp(request)}`, RATE_LIMIT))) {
    return json({ error: 'too many submissions, try again later' }, 429)
  }

  const body = (await readJson(request)) as {
    word?: string
    category?: string
    translation?: string
    submitter?: string
    familyId?: string
  }
  const word = clean(body.word, MAX_WORD_LEN)
  const category = clean(body.category, MAX_CATEGORY_LEN)
  const translation = clean(body.translation, MAX_TRANSLATION_LEN)
  if (!word || !category) return json({ error: 'word and category required' }, 400)
  if (!translation) return json({ error: 'translation required' }, 400)
  const submitter = clean(body.submitter, 64) || null
  const familyId = clean(body.familyId, 64) || null

  let counts: { global: number; mine: number }
  try {
    counts = await pendingCounts(env.DB, submitter ?? '')
  } catch {
    return json({ error: 'submissions not configured' }, 503)
  }
  if (counts.global >= MAX_PENDING_GLOBAL) return json({ error: 'submission queue full' }, 429)
  if (submitter && counts.mine >= MAX_PENDING_PER_SUBMITTER) {
    return json({ error: 'too many pending submissions' }, 429)
  }

  const id = crypto.randomUUID()
  await insertSubmission(env.DB, {
    id,
    kind: 'word',
    word,
    category,
    translation,
    imageKey: null,
    submitter,
    familyId,
  })
  return json({ ok: true, id })
}

/**
 * Route /api/submit-*. Returns null if `path` isn't one of ours (so worker/index.ts
 * can fall through). Admin list/review endpoints are Phase 3.
 */
export async function handleSubmissions(
  request: Request,
  env: SubmissionsEnv,
  path: string,
): Promise<Response | null> {
  if (request.method !== 'POST') return null
  if (path === '/api/submit-image') return submitImage(request, env)
  if (path === '/api/submit-word') return submitWord(request, env)
  return null
}
