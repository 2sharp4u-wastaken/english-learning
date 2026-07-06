/**
 * worker/auth.ts — Cloud accounts, Phase A (backlog §6 "Tier-3").
 *
 * The first REAL backend identity: a **family account** (parent email + password)
 * that owns N player profiles, on Cloudflare D1. This is the non-bypassable
 * password secrecy the client-only M12 gate can't provide, and the foundation
 * for cross-device progress sync (Phase B) + leaderboards (Phase D).
 *
 * Endpoints (mounted under /api/auth + /api/players + /api/family by worker/index.ts):
 *   POST /api/auth/register {email,password,inviteCode?} → {token, family}
 *   POST /api/auth/login    {email,password} → {token, family}
 *   GET  /api/auth/me        (Bearer)        → {family}
 *   GET    /api/players      (Bearer)        → Player[]
 *   POST   /api/players      (Bearer) {name,initial} → Player
 *   DELETE /api/players/:id  (Bearer)        → {ok}
 *   GET    /api/family/export (Bearer)       → full family data dump (data rights)
 *   DELETE /api/family        (Bearer) {confirmEmail} → {ok} (erase everything)
 *   GET    /api/progress/:playerId (Bearer)  → {blob, updated} (null if none) — Phase B
 *   PUT    /api/progress/:playerId (Bearer) {blob} → {ok, updated}            — Phase B
 *   GET    /api/prefs/:playerId    (Bearer)  → {blob, updated}                — Phase B
 *   PUT    /api/prefs/:playerId    (Bearer) {blob} → {ok, updated}            — Phase B
 *
 * Security: passwords hashed server-side with PBKDF2-SHA256 (per-account salt,
 * 100k iters) via Web Crypto; sessions are HMAC-SHA256-signed JWTs (AUTH_SECRET).
 * Guardrails (design-flaws Phase C, 2026-07-05): register/login are rate-limited
 * (D1 fixed-window, fail-open — migrations/0002_rate_limits.sql) and registration
 * can be invite-gated via the SIGNUP_INVITE_CODE secret. Remaining known gap:
 * no email verification (needs an email provider) — docs/cloud-backend.md.
 * Offline-first is preserved on the client: this is an OPTIONAL account/backup
 * layer (bridge/cloudAccount.ts), never required to play.
 *
 * Privacy: the only PII is the parent email; players are pseudonymous names under
 * the family. Progress/prefs blobs (Phase B) are opaque per-player JSON.
 */

// ─── Minimal D1 shape (avoids depending on @cloudflare/workers-types here) ─────
export interface D1PreparedStatement {
  bind(...vals: unknown[]): D1PreparedStatement
  first<T = unknown>(col?: string): Promise<T | null>
  run(): Promise<unknown>
  all<T = unknown>(): Promise<{ results: T[] }>
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement
}

export interface AuthEnv {
  DB?: D1Database
  AUTH_SECRET?: string
  /** Optional invite code (wrangler secret). When set, /api/auth/register
   *  requires a matching `inviteCode` — closes the previously OPEN public
   *  signup (design-flaws Phase C). Unset = open signup (rate-limited only). */
  SIGNUP_INVITE_CODE?: string
}

const PASSWORD_MIN = 6
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const PBKDF2_ITERS = 100_000

// Fixed-window rate limits (design-flaws Phase C, 2026-07-05): the auth
// endpoints were completely unthrottled on a public URL — free credential
// stuffing + junk-family spam. Counters live in D1 (migrations/0002); the
// check FAILS OPEN so a missing table degrades to "no limiting", never to
// broken auth for real families.
const RATE_LIMITS = {
  register: { max: 5, windowMs: 60 * 60 * 1000 }, // per IP
  login: { max: 20, windowMs: 15 * 60 * 1000 }, // per IP
  loginEmail: { max: 10, windowMs: 15 * 60 * 1000 }, // per target email
} as const

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// ─── Hex / base64url helpers ───────────────────────────────────────────────────
const enc = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlStr(s: string): string {
  return b64url(enc.encode(s))
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

// ─── Password hashing (PBKDF2) ─────────────────────────────────────────────────
async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await pbkdf2(password, salt), salt: toHex(salt) }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  return timingSafeEqual(await pbkdf2(password, fromHex(salt)), hash)
}

// ─── JWT (HS256) ────────────────────────────────────────────────────────────────
interface TokenPayload {
  sub: string // family id
  email: string
  exp: number
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const head = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64urlStr(JSON.stringify(payload))
  const data = `${head}.${body}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const data = `${parts[0]}.${parts[1]}`
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    fromHex(b64urlToHex(parts[2])),
    enc.encode(data),
  )
  if (!ok) return null
  try {
    const payload = JSON.parse(b64urlDecode(parts[1])) as TokenPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function b64urlToHex(s: string): string {
  const bin = b64urlDecode(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return toHex(bytes)
}

// ─── Request auth ──────────────────────────────────────────────────────────────
async function familyFromRequest(request: Request, env: AuthEnv): Promise<TokenPayload | null> {
  if (!env.AUTH_SECRET) return null
  const header = request.headers.get('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  return verifyToken(m[1], env.AUTH_SECRET)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Rate limiting (D1 fixed-window, fail-open) ────────────────────────────────

function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown'
}

/** True = allowed. Increments the counter for `key`; a fresh/expired window
 *  resets it (and opportunistically purges day-old rows). Any D1 error —
 *  including the table not existing yet — allows the request (fail-open). */
async function rateLimit(
  env: AuthEnv,
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): Promise<boolean> {
  if (!env.DB) return true
  try {
    const now = Date.now()
    const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ count: number; window_start: number }>()
    if (row && now - row.window_start < windowMs) {
      if (row.count >= max) return false
      await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run()
    } else {
      await env.DB.prepare(
        'INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)',
      )
        .bind(key, now)
        .run()
      await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?')
        .bind(now - 24 * 60 * 60 * 1000)
        .run()
    }
    return true
  } catch {
    return true
  }
}

const RATE_LIMITED = () => json({ error: 'too many attempts, try again later' }, 429)

// ─── Handlers ────────────────────────────────────────────────────────────────
async function register(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB || !env.AUTH_SECRET) return json({ error: 'backend not configured' }, 503)
  if (!(await rateLimit(env, `register:${clientIp(request)}`, RATE_LIMITS.register))) {
    return RATE_LIMITED()
  }
  const { email, password, inviteCode } = (await readJson(request)) as {
    email?: string
    password?: string
    inviteCode?: string
  }
  // Closed-beta gate: when the SIGNUP_INVITE_CODE secret is set, registration
  // requires it. `code` lets the client show an invite field instead of a
  // generic error.
  if (env.SIGNUP_INVITE_CODE && !timingSafeEqual(String(inviteCode ?? ''), env.SIGNUP_INVITE_CODE)) {
    return json({ error: 'invite code required', code: 'invite-required' }, 403)
  }
  const e = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return json({ error: 'invalid email' }, 400)
  if (String(password ?? '').length < PASSWORD_MIN) {
    return json({ error: `password too short (min ${PASSWORD_MIN})` }, 400)
  }
  const existing = await env.DB.prepare('SELECT id FROM families WHERE email = ?').bind(e).first()
  if (existing) return json({ error: 'email already registered' }, 409)

  const id = crypto.randomUUID()
  const { hash, salt } = await hashPassword(String(password))
  await env.DB.prepare('INSERT INTO families (id, email, pw_hash, pw_salt, created) VALUES (?, ?, ?, ?, ?)')
    .bind(id, e, hash, salt, new Date().toISOString())
    .run()

  const token = await mintToken(id, e, env.AUTH_SECRET)
  return json({ token, family: { id, email: e } })
}

async function login(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB || !env.AUTH_SECRET) return json({ error: 'backend not configured' }, 503)
  const { email, password } = (await readJson(request)) as { email?: string; password?: string }
  const e = String(email ?? '').trim().toLowerCase()
  // Per-IP + per-target-email windows: the email one blocks a distributed
  // guessing run against a single account, the IP one blocks bulk stuffing.
  if (
    !(await rateLimit(env, `login:${clientIp(request)}`, RATE_LIMITS.login)) ||
    !(await rateLimit(env, `login-email:${e}`, RATE_LIMITS.loginEmail))
  ) {
    return RATE_LIMITED()
  }
  const row = await env.DB.prepare('SELECT id, pw_hash, pw_salt FROM families WHERE email = ?')
    .bind(e)
    .first<{ id: string; pw_hash: string; pw_salt: string }>()
  if (!row || !(await verifyPassword(String(password ?? ''), row.pw_hash, row.pw_salt))) {
    return json({ error: 'invalid email or password' }, 401)
  }
  const token = await mintToken(row.id, e, env.AUTH_SECRET)
  return json({ token, family: { id: row.id, email: e } })
}

async function mintToken(id: string, email: string, secret: string): Promise<string> {
  return signToken({ sub: id, email, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }, secret)
}

async function me(request: Request, env: AuthEnv): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam) return json({ error: 'unauthorized' }, 401)
  return json({ family: { id: fam.sub, email: fam.email } })
}

async function listPlayers(request: Request, env: AuthEnv): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  const { results } = await env.DB.prepare(
    'SELECT id, name, initial FROM players WHERE family_id = ? ORDER BY created',
  )
    .bind(fam.sub)
    .all()
  return json({ players: results })
}

async function createPlayer(request: Request, env: AuthEnv): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  const { name, initial } = (await readJson(request)) as { name?: string; initial?: string }
  const n = String(name ?? '').trim().slice(0, 40)
  if (!n) return json({ error: 'name required' }, 400)
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM players WHERE family_id = ?')
    .bind(fam.sub)
    .first<{ c: number }>()
  if ((count?.c ?? 0) >= 8) return json({ error: 'too many players' }, 409)
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO players (id, family_id, name, initial, created) VALUES (?, ?, ?, ?, ?)')
    .bind(id, fam.sub, n, String(initial ?? n[0] ?? '?').slice(0, 2), new Date().toISOString())
    .run()
  return json({ player: { id, name: n, initial: String(initial ?? n[0] ?? '?').slice(0, 2) } })
}

async function deletePlayer(request: Request, env: AuthEnv, playerId: string): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  // Scope the delete to the family so one family can't delete another's player.
  await env.DB.prepare('DELETE FROM players WHERE id = ? AND family_id = ?').bind(playerId, fam.sub).run()
  await env.DB.prepare('DELETE FROM progress WHERE player_id = ?').bind(playerId).run()
  await env.DB.prepare('DELETE FROM prefs WHERE player_id = ?').bind(playerId).run()
  return json({ ok: true })
}

// ─── Data rights: export + delete the whole family (design-flaws Phase C) ──────
// It's kids' data — the parent must be able to take it out and to erase it.

async function exportFamily(request: Request, env: AuthEnv): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  const family = await env.DB.prepare('SELECT id, email, created FROM families WHERE id = ?')
    .bind(fam.sub)
    .first()
  const { results: players } = await env.DB.prepare(
    'SELECT id, name, initial, created FROM players WHERE family_id = ? ORDER BY created',
  )
    .bind(fam.sub)
    .all()
  const { results: progress } = await env.DB.prepare(
    'SELECT player_id, blob, updated FROM progress WHERE player_id IN (SELECT id FROM players WHERE family_id = ?)',
  )
    .bind(fam.sub)
    .all()
  const { results: prefs } = await env.DB.prepare(
    'SELECT player_id, blob, updated FROM prefs WHERE player_id IN (SELECT id FROM players WHERE family_id = ?)',
  )
    .bind(fam.sub)
    .all()
  return json({ format: 'english-learning-cloud-export', exportedAt: new Date().toISOString(), family, players, progress, prefs })
}

async function deleteFamily(request: Request, env: AuthEnv): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  // Deliberate friction for an irreversible bulk delete: the client must echo
  // the account email (typo-proof against a stray DELETE with a stale token).
  const { confirmEmail } = (await readJson(request)) as { confirmEmail?: string }
  if (String(confirmEmail ?? '').trim().toLowerCase() !== fam.email) {
    return json({ error: 'confirmation email mismatch', code: 'confirm-required' }, 400)
  }
  await env.DB.prepare(
    'DELETE FROM progress WHERE player_id IN (SELECT id FROM players WHERE family_id = ?)',
  )
    .bind(fam.sub)
    .run()
  await env.DB.prepare(
    'DELETE FROM prefs WHERE player_id IN (SELECT id FROM players WHERE family_id = ?)',
  )
    .bind(fam.sub)
    .run()
  await env.DB.prepare('DELETE FROM players WHERE family_id = ?').bind(fam.sub).run()
  await env.DB.prepare('DELETE FROM families WHERE id = ?').bind(fam.sub).run()
  return json({ ok: true })
}

// ─── Phase B: per-player progress + prefs backup (opaque JSON blobs) ───────────
// The blob is the EXACT per-user JSON the client already stores locally
// (`v2_userProgress_<id>` / `v2_playerPrefs_<id>`) — pass-through, no schema
// churn. `table` is a fixed literal from the router (never user input), so
// interpolating it into the SQL is safe.

// Room for a heavy progress blob (mastery of the whole bank + history) but a
// firm cap so one player can't fill the family's storage.
const MAX_BLOB_BYTES = 512 * 1024

/** Whether `playerId` belongs to `familyId` — scopes every blob op to the family
 *  so a valid token for family A can't read/write family B's player. */
async function playerInFamily(env: AuthEnv, playerId: string, familyId: string): Promise<boolean> {
  const row = await env.DB!.prepare('SELECT id FROM players WHERE id = ? AND family_id = ?')
    .bind(playerId, familyId)
    .first()
  return !!row
}

async function getBlob(
  request: Request,
  env: AuthEnv,
  table: 'progress' | 'prefs',
  playerId: string,
): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  if (!(await playerInFamily(env, playerId, fam.sub))) return json({ error: 'player not found' }, 404)
  const row = await env.DB.prepare(`SELECT blob, updated FROM ${table} WHERE player_id = ?`)
    .bind(playerId)
    .first<{ blob: string; updated: string }>()
  // 200 with a null blob when nothing is backed up yet — simpler for the client
  // than distinguishing a 404 "no backup" from a real error.
  return json({ blob: row?.blob ?? null, updated: row?.updated ?? null })
}

async function putBlob(
  request: Request,
  env: AuthEnv,
  table: 'progress' | 'prefs',
  playerId: string,
): Promise<Response> {
  const fam = await familyFromRequest(request, env)
  if (!fam || !env.DB) return json({ error: 'unauthorized' }, 401)
  if (!(await playerInFamily(env, playerId, fam.sub))) return json({ error: 'player not found' }, 404)
  const { blob } = (await readJson(request)) as { blob?: unknown }
  if (typeof blob !== 'string') return json({ error: 'blob (string) required' }, 400)
  if (blob.length > MAX_BLOB_BYTES) return json({ error: 'blob too large' }, 413)
  const updated = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO ${table} (player_id, blob, updated) VALUES (?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET blob = excluded.blob, updated = excluded.updated`,
  )
    .bind(playerId, blob, updated)
    .run()
  return json({ ok: true, updated })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

/**
 * Route /api/auth/* and /api/players[/:id]. Returns null if `path` is not one of
 * ours (so worker/index.ts can fall through to the bug-report routes / SPA).
 */
export async function handleCloudApi(request: Request, env: AuthEnv, path: string): Promise<Response | null> {
  const method = request.method

  if (path === '/api/auth/register' && method === 'POST') return register(request, env)
  if (path === '/api/auth/login' && method === 'POST') return login(request, env)
  if (path === '/api/auth/me' && method === 'GET') return me(request, env)

  if (path === '/api/family/export' && method === 'GET') return exportFamily(request, env)
  if (path === '/api/family' && method === 'DELETE') return deleteFamily(request, env)

  if (path === '/api/players') {
    if (method === 'GET') return listPlayers(request, env)
    if (method === 'POST') return createPlayer(request, env)
  }
  if (path.startsWith('/api/players/') && method === 'DELETE') {
    return deletePlayer(request, env, decodeURIComponent(path.slice('/api/players/'.length)))
  }

  // Phase B: per-player progress / prefs backup blobs.
  if (path.startsWith('/api/progress/')) {
    const pid = decodeURIComponent(path.slice('/api/progress/'.length))
    if (method === 'GET') return getBlob(request, env, 'progress', pid)
    if (method === 'PUT') return putBlob(request, env, 'progress', pid)
  }
  if (path.startsWith('/api/prefs/')) {
    const pid = decodeURIComponent(path.slice('/api/prefs/'.length))
    if (method === 'GET') return getBlob(request, env, 'prefs', pid)
    if (method === 'PUT') return putBlob(request, env, 'prefs', pid)
  }

  return null
}

// Exported for unit testing the crypto primitives in isolation.
export const __test = { hashPassword, verifyPassword, signToken, verifyToken }
