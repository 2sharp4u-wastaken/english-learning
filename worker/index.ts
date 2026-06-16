/**
 * Cloudflare Worker — the first backend seam for this app (the M5/M13 seam the
 * backlog flags). Today it serves ONE job: the beta bug/feedback report queue.
 *
 *   POST /api/report          ← the BugReportWidget posts here (multipart)
 *   GET  /api/report-image/:k ← serves a stored screenshot back (for the issue)
 *   *                         ← everything else falls through to the static SPA
 *
 * A report is stored as: screenshot → R2 (REPORTS_BUCKET), and a GitHub Issue
 * (label `beta-report`) created via the REST API that links to the screenshot.
 * GitHub Issues is the queue we triage (`gh issue list` / the Issues tab); R2
 * holds the image because the Issues API can't reliably attach binaries.
 *
 * NOT YET WIRED into wrangler.jsonc — declaring the R2 binding + secret before
 * they exist would break the live auto-deploy. Provision them first (see
 * docs/bug-report.md), then add `main` + the bindings to wrangler.jsonc.
 *
 * Every handler is defensive: a missing binding returns a clean 5xx for /api
 * while static assets keep serving, so a half-configured deploy never bricks
 * the site.
 */

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  REPORTS_BUCKET?: R2Bucket
  GITHUB_TOKEN?: string
  /** "owner/repo", e.g. "2sharp4u-wastaken/english-learning". */
  GITHUB_REPO?: string
}

// Minimal R2 shape (avoids depending on @cloudflare/workers-types here).
interface R2Bucket {
  put: (key: string, value: ArrayBuffer | ReadableStream, opts?: unknown) => Promise<unknown>
  get: (key: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_DESC_CHARS = 4000

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function safeKeySegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
}

async function handleReport(request: Request, env: Env, origin: string): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'expected multipart/form-data' }, 400)
  }

  let payload: { description?: string; context?: Record<string, unknown> } = {}
  try {
    payload = JSON.parse(String(form.get('payload') ?? '{}'))
  } catch {
    return json({ error: 'bad payload json' }, 400)
  }

  const description = String(payload.description ?? '').trim().slice(0, MAX_DESC_CHARS)
  if (!description) return json({ error: 'description required' }, 400)

  const context = (payload.context ?? {}) as Record<string, unknown>

  // 1) Store the screenshot in R2 (optional).
  let imageUrl: string | null = null
  const file = form.get('screenshot')
  if (file && typeof file !== 'string') {
    const blob = file as unknown as Blob
    if (blob.size > MAX_IMAGE_BYTES) return json({ error: 'screenshot too large' }, 413)
    if (!env.REPORTS_BUCKET) return json({ error: 'storage not configured' }, 503)
    const key = `reports/${Date.now()}-${safeKeySegment(String(context.userId ?? 'anon'))}-${crypto.randomUUID().slice(0, 8)}.jpg`
    const buf = await blob.arrayBuffer()
    await env.REPORTS_BUCKET.put(key, buf, {
      httpMetadata: { contentType: blob.type || 'image/jpeg' },
    })
    imageUrl = `${origin}/api/report-image/${key.slice('reports/'.length)}`
  }

  // 2) Create a GitHub issue (the queue). If the token isn't set, still 200 so
  //    the client's local buffer is the source of truth and the user isn't
  //    blocked — but flag it so we know triage isn't wired yet.
  let issueUrl: string | null = null
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    // Version + platform in the title so the Issues list shows them at a glance.
    const version = String(context.appVersion ?? '?')
    const sha = String(context.gitSha ?? '')
    const platform = String(context.platform ?? '')
    const tag = [platform, `v${version}${sha && sha !== 'dev' ? `+${sha}` : ''}`]
      .filter(Boolean)
      .join(' ')
    const title = `[beta] ${tag ? `(${tag}) ` : ''}${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`

    // Recent console logs (optional) → collapsed block so the issue stays readable.
    const logs = String(context.recentLogs ?? '').trim()
    const logsBlock = logs
      ? ['', '<details><summary>recent logs</summary>', '', '```', logs, '```', '', '</details>']
      : []

    const body = [
      description,
      '',
      '---',
      imageUrl ? `![screenshot](${imageUrl})` : '_(no screenshot)_',
      '',
      '| field | value |',
      '| --- | --- |',
      `| version | \`v${version}${sha ? ` (${sha})` : ''}\` |`,
      `| built | ${String(context.buildTime ?? '')} |`,
      `| platform | ${platform} |`,
      `| route | \`${String(context.route ?? '')}\` |`,
      `| user | \`${String(context.userId ?? 'anon')}\` |`,
      `| viewport | ${String(context.viewport ?? '')} |`,
      `| language | ${String(context.language ?? '')} |`,
      `| build | ${String(context.buildMode ?? '')} |`,
      `| at | ${String(context.createdAt ?? '')} |`,
      `| UA | ${String(context.userAgent ?? '')} |`,
      ...logsBlock,
    ].join('\n')

    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'english-learning-bug-report',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['beta-report'] }),
    })
    if (res.ok) {
      const issue = (await res.json()) as { html_url?: string }
      issueUrl = issue.html_url ?? null
    } else {
      return json({ error: 'github issue failed', status: res.status, imageUrl }, 502)
    }
  }

  return json({ ok: true, issueUrl, imageUrl, queued: !issueUrl })
}

async function handleReportImage(key: string, env: Env): Promise<Response> {
  if (!env.REPORTS_BUCKET) return json({ error: 'storage not configured' }, 503)
  const obj = await env.REPORTS_BUCKET.get(`reports/${key}`)
  if (!obj) return json({ error: 'not found' }, 404)
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/api/report') return handleReport(request, env, url.origin)
    if (path.startsWith('/api/report-image/')) {
      return handleReportImage(decodeURIComponent(path.slice('/api/report-image/'.length)), env)
    }
    if (path.startsWith('/api/')) return json({ error: 'unknown endpoint' }, 404)

    // Everything else is the static SPA.
    return env.ASSETS.fetch(request)
  },
}
