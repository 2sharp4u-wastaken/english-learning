/**
 * src/bridge/cloudAccount.ts — OPTIONAL cloud account layer (Tier-3 Phase A).
 *
 * Deliberately SEPARATE from the local-first `bridge/auth.ts`: the app works
 * fully offline with on-device profiles regardless of this. A cloud family
 * account (parent email + password) is what enables cross-device use + the
 * progress/prefs backup that lands in Phase B. The JWT is stored at
 * `cloudToken` and sent as a Bearer to the Worker's /api/auth + /api/players.
 *
 * Until the backend is provisioned (D1 + AUTH_SECRET — see wrangler.jsonc /
 * docs/cloud-backend.md) the endpoints return 503 and `result.error` reflects
 * that; the UI degrades gracefully.
 */

const TOKEN_KEY = 'cloudToken'
const EMAIL_KEY = 'cloudEmail'

export interface CloudPlayer {
  id: string
  name: string
  initial?: string
}

export interface CloudResult<T = void> {
  ok: boolean
  error?: string
  /** Machine-readable error code from the Worker (e.g. 'invite-required'). */
  code?: string
  data?: T
}

export function getCloudToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function isCloudSignedIn(): boolean {
  return getCloudToken() !== null
}

export function getCloudEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

function setSession(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EMAIL_KEY, email)
  window.dispatchEvent(new CustomEvent('cloud-account-changed'))
}

export function cloudSignOut(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
  window.dispatchEvent(new CustomEvent('cloud-account-changed'))
}

/**
 * Authed fetch wrapper (adds the Bearer token, parses JSON, maps 503/429 to
 * friendly Hebrew). Exported as `cloudApi` for the other cloud bridges
 * (Phase B `bridge/cloudSync.ts`) so they share one place that owns the token
 * header + error translation.
 */
async function api<T>(path: string, init?: RequestInit): Promise<CloudResult<T>> {
  const token = getCloudToken()
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & Record<string, unknown>
    if (!res.ok) {
      // 503 = backend not provisioned yet (graceful, expected pre-go-live);
      // 429 = the Phase C rate limiter — friendlier than the raw English error.
      const error =
        res.status === 503
          ? 'שירות הענן עדיין אינו פעיל'
          : res.status === 429
            ? 'יותר מדי ניסיונות — נסו שוב מאוחר יותר'
            : body.error ?? 'שגיאת שרת'
      return { ok: false, error, code: body.code }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, error: 'אין חיבור לאינטרנט' }
  }
}

async function authenticate(
  kind: 'register' | 'login',
  email: string,
  password: string,
  inviteCode?: string,
): Promise<CloudResult> {
  const r = await api<{ token: string; family: { email: string } }>(`/api/auth/${kind}`, {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      ...(inviteCode ? { inviteCode: inviteCode.trim() } : {}),
    }),
  })
  if (r.ok && r.data) setSession(r.data.token, r.data.family.email)
  return { ok: r.ok, error: r.error, code: r.code }
}

/** `inviteCode` is required only while the Worker's SIGNUP_INVITE_CODE secret is
 *  set (closed beta) — the panel shows the field when `code === 'invite-required'`. */
export function cloudRegister(email: string, password: string, inviteCode?: string): Promise<CloudResult> {
  return authenticate('register', email, password, inviteCode)
}

export function cloudLogin(email: string, password: string): Promise<CloudResult> {
  return authenticate('login', email, password)
}

export async function cloudListPlayers(): Promise<CloudResult<CloudPlayer[]>> {
  const r = await api<{ players: CloudPlayer[] }>('/api/players')
  return { ok: r.ok, error: r.error, data: r.data?.players }
}

export async function cloudCreatePlayer(name: string, initial?: string): Promise<CloudResult<CloudPlayer>> {
  const r = await api<{ player: CloudPlayer }>('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name, initial }),
  })
  return { ok: r.ok, error: r.error, data: r.data?.player }
}

export async function cloudDeletePlayer(id: string): Promise<CloudResult> {
  const r = await api(`/api/players/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { ok: r.ok, error: r.error }
}

// ── Data rights (design-flaws Phase C, 2026-07-05) — it's kids' data ──────────

/** Download the family's full cloud data (family + players + backup blobs) as a
 *  JSON file — the take-your-data-out half of the data-rights pair. */
export async function cloudExportFamilyData(): Promise<CloudResult> {
  const r = await api<Record<string, unknown>>('/api/family/export')
  if (!r.ok || !r.data) return { ok: false, error: r.error, code: r.code }
  const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `english-learning-cloud-export-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
  return { ok: true }
}

/** Permanently erase the cloud family account (players + backups + the account
 *  itself; the Worker requires the account email echoed as confirmation), then
 *  sign this device out. Local on-device profiles are untouched. */
export async function cloudDeleteFamily(): Promise<CloudResult> {
  const email = getCloudEmail()
  if (!email) return { ok: false, error: 'לא מחוברים לחשבון ענן' }
  const r = await api('/api/family', {
    method: 'DELETE',
    body: JSON.stringify({ confirmEmail: email }),
  })
  if (r.ok) cloudSignOut()
  return { ok: r.ok, error: r.error, code: r.code }
}

/** Shared authed fetch wrapper for the other cloud bridges (Phase B sync). */
export { api as cloudApi }

/** Subscribe to sign-in/out changes (fires immediately + on every change). */
export function subscribeCloudAccount(cb: (signedIn: boolean) => void): () => void {
  const handler = () => cb(isCloudSignedIn())
  cb(isCloudSignedIn())
  window.addEventListener('cloud-account-changed', handler)
  return () => window.removeEventListener('cloud-account-changed', handler)
}
