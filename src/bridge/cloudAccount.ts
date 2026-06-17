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
    const body = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>
    if (!res.ok) {
      // 503 = backend not provisioned yet (graceful, expected pre-go-live).
      const error = res.status === 503 ? 'שירות הענן עדיין אינו פעיל' : body.error ?? 'שגיאת שרת'
      return { ok: false, error }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, error: 'אין חיבור לאינטרנט' }
  }
}

async function authenticate(kind: 'register' | 'login', email: string, password: string): Promise<CloudResult> {
  const r = await api<{ token: string; family: { email: string } }>(`/api/auth/${kind}`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  if (r.ok && r.data) setSession(r.data.token, r.data.family.email)
  return { ok: r.ok, error: r.error }
}

export function cloudRegister(email: string, password: string): Promise<CloudResult> {
  return authenticate('register', email, password)
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

/** Subscribe to sign-in/out changes (fires immediately + on every change). */
export function subscribeCloudAccount(cb: (signedIn: boolean) => void): () => void {
  const handler = () => cb(isCloudSignedIn())
  cb(isCloudSignedIn())
  window.addEventListener('cloud-account-changed', handler)
  return () => window.removeEventListener('cloud-account-changed', handler)
}
