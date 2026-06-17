import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  cloudRegister,
  cloudLogin,
  cloudSignOut,
  isCloudSignedIn,
  getCloudEmail,
  cloudListPlayers,
} from '../cloudAccount'

/**
 * Optional cloud account client (Tier-3 Phase A). Mocks fetch — pins token
 * storage on success, the Bearer header, sign-out, and graceful 503 handling
 * (backend not provisioned yet).
 */

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('cloudAccount', () => {
  it('register stores the token + email on success', async () => {
    globalThis.fetch = mockFetch(200, { token: 'jwt-123', family: { email: 'p@t.com' } })
    expect(isCloudSignedIn()).toBe(false)
    const r = await cloudRegister('P@T.com', 'secret123')
    expect(r.ok).toBe(true)
    expect(isCloudSignedIn()).toBe(true)
    expect(localStorage.getItem('cloudToken')).toBe('jwt-123')
    expect(getCloudEmail()).toBe('p@t.com')
  })

  it('login failure surfaces the server error and stores nothing', async () => {
    globalThis.fetch = mockFetch(401, { error: 'invalid email or password' })
    const r = await cloudLogin('p@t.com', 'wrong')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid email or password')
    expect(isCloudSignedIn()).toBe(false)
  })

  it('503 (backend not provisioned) degrades gracefully', async () => {
    globalThis.fetch = mockFetch(503, { error: 'backend not configured' })
    const r = await cloudLogin('p@t.com', 'secret123')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('הענן')
  })

  it('sends the Bearer token on authed calls + signOut clears it', async () => {
    localStorage.setItem('cloudToken', 'jwt-xyz')
    const fetchMock = mockFetch(200, { players: [] })
    globalThis.fetch = fetchMock
    await cloudListPlayers()
    const init = (fetchMock as any).mock.calls[0][1]
    expect(init.headers.authorization).toBe('Bearer jwt-xyz')

    cloudSignOut()
    expect(isCloudSignedIn()).toBe(false)
    expect(localStorage.getItem('cloudToken')).toBeNull()
  })
})
