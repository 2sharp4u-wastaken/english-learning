import { describe, it, expect, beforeEach } from 'vitest'
import { handleSubmissions, type SubmissionsEnv } from '../submissions'
import type { D1Database } from '../auth'

// ─── Mock D1 (submissions + rate_limits) ───────────────────────────────────────
interface Row {
  id: string
  kind: string
  word: string
  category: string
  translation: string | null
  image_key: string | null
  submitter: string | null
  family_id: string | null
  status: string
}

function mockDB(opts: { hasTable?: boolean } = {}) {
  const hasTable = opts.hasTable ?? true
  const rows: Row[] = []
  const rateLimits = new Map<string, { count: number; window_start: number }>()

  function prepare(sql: string) {
    let args: unknown[] = []
    const stmt = {
      bind(...a: unknown[]) {
        args = a
        return stmt
      },
      async first<T = unknown>(): Promise<T | null> {
        if (sql.includes('rate_limits')) {
          return (rateLimits.get(args[0] as string) ?? null) as T | null
        }
        if (!hasTable) throw new Error('no such table: submissions')
        if (sql.includes('COUNT(*)') && sql.includes('submissions')) {
          const pending = rows.filter((r) => r.status === 'pending')
          if (sql.includes('submitter = ?')) {
            return { c: pending.filter((r) => r.submitter === args[0]).length } as T
          }
          return { c: pending.length } as T
        }
        return null
      },
      async run() {
        if (sql.includes('rate_limits')) {
          if (sql.startsWith('INSERT OR REPLACE')) {
            rateLimits.set(args[0] as string, { count: 1, window_start: args[1] as number })
          } else if (sql.startsWith('UPDATE')) {
            const r = rateLimits.get(args[0] as string)
            if (r) r.count++
          }
          return {}
        }
        if (sql.startsWith('INSERT INTO submissions')) {
          if (!hasTable) throw new Error('no such table: submissions')
          rows.push({
            id: args[0] as string,
            kind: args[1] as string,
            word: args[2] as string,
            category: args[3] as string,
            translation: args[4] as string | null,
            image_key: args[5] as string | null,
            submitter: args[6] as string | null,
            family_id: args[7] as string | null,
            status: 'pending',
          })
        }
        return {}
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: rows as T[] }
      },
    }
    return stmt
  }
  return { prepare, _rows: rows } as unknown as D1Database & { _rows: Row[] }
}

function mockBucket() {
  const puts = new Map<string, { contentType?: string }>()
  return {
    bucket: {
      async put(key: string, _v: ArrayBuffer | ReadableStream, opts?: unknown) {
        puts.set(key, { contentType: (opts as any)?.httpMetadata?.contentType })
        return {}
      },
    },
    puts,
  }
}

let env: SubmissionsEnv & { _rows: Row[] }
let bucket: ReturnType<typeof mockBucket>
beforeEach(() => {
  const db = mockDB()
  bucket = mockBucket()
  env = { DB: db, REPORTS_BUCKET: bucket.bucket, _rows: db._rows }
})

function imageForm(fields: Record<string, string>, image?: { type: string; bytes?: number }): Request {
  const map = new Map<string, unknown>()
  map.set('payload', JSON.stringify(fields))
  if (image) {
    const n = image.bytes ?? 32
    // Duck-typed Blob: jsdom's Blob lacks arrayBuffer(), and request.formData()
    // can't parse a constructed multipart body in this env. The Workers runtime
    // provides both; here we hand the handler exactly what it reads (size/type/
    // arrayBuffer), exercising our logic not the runtime's parser.
    map.set('image', { size: n, type: image.type, arrayBuffer: async () => new ArrayBuffer(n) })
  }
  const form = { get: (k: string) => (map.has(k) ? map.get(k) : null) }
  return {
    method: 'POST',
    headers: new Headers(),
    formData: async () => form,
  } as unknown as Request
}

function wordReq(body: unknown): Request {
  return new Request('https://x/api/submit-word', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('submit-image', () => {
  it('stores a valid image submission in R2 + D1 (pending)', async () => {
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture', submitter: 'Zohar' }, { type: 'image/jpeg' }),
      env,
      '/api/submit-image',
    )
    expect(res!.status).toBe(200)
    const body = (await res!.json()) as { ok: boolean; id: string }
    expect(body.ok).toBe(true)
    expect(env._rows).toHaveLength(1)
    expect(env._rows[0]).toMatchObject({ kind: 'image', word: 'chair', category: 'furniture', status: 'pending', submitter: 'Zohar' })
    // Random key, no word/submitter leaking into the R2 path.
    const key = env._rows[0].image_key!
    expect(key).toMatch(/^submissions\/[0-9a-f-]{36}\.jpg$/)
    expect(key).not.toContain('Zohar')
    expect(key).not.toContain('chair')
    expect(bucket.puts.has(key)).toBe(true)
  })

  it('rejects an unsupported image type (415)', async () => {
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture' }, { type: 'image/gif' }),
      env,
      '/api/submit-image',
    )
    expect(res!.status).toBe(415)
    expect(env._rows).toHaveLength(0)
  })

  it('rejects an oversize image (413)', async () => {
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture' }, { type: 'image/png', bytes: 3 * 1024 * 1024 }),
      env,
      '/api/submit-image',
    )
    expect(res!.status).toBe(413)
  })

  it('requires word + category (400)', async () => {
    const res = await handleSubmissions(
      imageForm({ word: '', category: 'furniture' }, { type: 'image/jpeg' }),
      env,
      '/api/submit-image',
    )
    expect(res!.status).toBe(400)
  })

  it('requires an image file (400)', async () => {
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture' }),
      env,
      '/api/submit-image',
    )
    expect(res!.status).toBe(400)
  })

  it('503s (fails closed) when the submissions table is missing', async () => {
    const db = mockDB({ hasTable: false })
    const e: SubmissionsEnv = { DB: db, REPORTS_BUCKET: mockBucket().bucket }
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture' }, { type: 'image/jpeg' }),
      e,
      '/api/submit-image',
    )
    expect(res!.status).toBe(503)
  })

  it('503s when DB/bucket are not configured', async () => {
    const res = await handleSubmissions(
      imageForm({ word: 'chair', category: 'furniture' }, { type: 'image/jpeg' }),
      {},
      '/api/submit-image',
    )
    expect(res!.status).toBe(503)
  })

  it('caps pending submissions per submitter (429)', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await handleSubmissions(
        imageForm({ word: `w${i}`, category: 'c', submitter: 'spammer' }, { type: 'image/webp' }),
        env,
        '/api/submit-image',
      )
      expect(r!.status).toBe(200)
    }
    const over = await handleSubmissions(
      imageForm({ word: 'w20', category: 'c', submitter: 'spammer' }, { type: 'image/webp' }),
      env,
      '/api/submit-image',
    )
    expect(over!.status).toBe(429)
    expect(env._rows).toHaveLength(20)
  })
})

describe('submit-word', () => {
  it('stores a valid word submission (pending)', async () => {
    const res = await handleSubmissions(
      wordReq({ word: 'duck', category: 'animals', translation: 'ברווז', submitter: 'Omer' }),
      env,
      '/api/submit-word',
    )
    expect(res!.status).toBe(200)
    expect(env._rows).toHaveLength(1)
    expect(env._rows[0]).toMatchObject({ kind: 'word', word: 'duck', translation: 'ברווז', status: 'pending', image_key: null })
  })

  it('requires a translation (400)', async () => {
    const res = await handleSubmissions(
      wordReq({ word: 'duck', category: 'animals' }),
      env,
      '/api/submit-word',
    )
    expect(res!.status).toBe(400)
    expect(env._rows).toHaveLength(0)
  })
})

describe('routing', () => {
  it('returns null for non-submission paths and non-POST', async () => {
    expect(await handleSubmissions(wordReq({}), env, '/api/other')).toBeNull()
    const get = new Request('https://x/api/submit-word', { method: 'GET' })
    expect(await handleSubmissions(get, env, '/api/submit-word')).toBeNull()
  })
})
