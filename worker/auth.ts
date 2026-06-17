/**
 * worker/auth.ts — Cloud accounts, Phase A (backlog §6 "Tier-3").
 *
 * The first REAL backend identity: a **family account** (parent email + password)
 * that owns N player profiles, on Cloudflare D1. This is the non-bypassable
 * password secrecy the client-only M12 gate can't provide, and the foundation
 * for cross-device progress sync (Phase B) + leaderboards (Phase D).
 *
 * Endpoints (mounted under /api/auth + /api/players by worker/index.ts):
 *   POST /api/auth/register {email,password} → {token, family}
 *   POST /api/auth/login    {email,password} → {token, family}
 *   GET  /api/auth/me        (Bearer)        → {family}
 *   GET    /api/players      (Bearer)        → Player[]
 *   POST   /api/players      (Bearer) {name,initial} → Player
 *   DELETE /api/players/:id  (Bearer)        → {ok}
 *
 * Security: passwords hashed server-side with PBKDF2-SHA256 (per-account salt,
 * 100k iters) via Web Crypto; sessions are HMAC-SHA256-signed JWTs (AUTH_SECRET).
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
}

const PASSWORD_MIN = 6
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const PBKDF2_ITERS = 100_000

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

// ─── Handlers ────────────────────────────────────────────────────────────────
async function register(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB || !env.AUTH_SECRET) return json({ error: 'backend not configured' }, 503)
  const { email, password } = (await readJson(request)) as { email?: string; password?: string }
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

  if (path === '/api/players') {
    if (method === 'GET') return listPlayers(request, env)
    if (method === 'POST') return createPlayer(request, env)
  }
  if (path.startsWith('/api/players/') && method === 'DELETE') {
    return deletePlayer(request, env, decodeURIComponent(path.slice('/api/players/'.length)))
  }

  return null
}

// Exported for unit testing the crypto primitives in isolation.
export const __test = { hashPassword, verifyPassword, signToken, verifyToken }
