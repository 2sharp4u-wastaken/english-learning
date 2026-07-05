import { describe, it, expect, beforeEach } from 'vitest'
import { handleCloudApi, __test, type D1Database } from '../auth'

/**
 * Cloud accounts Phase A — Worker auth handlers against an in-memory mock D1.
 * Pins: PBKDF2 hash/verify, JWT sign/verify, register/login/me, and player
 * CRUD scoped to the authenticated family. No wrangler / network needed.
 */

// ── Tiny in-memory D1 mock (only the queries auth.ts issues) ──────────────────
function mockDB(opts: { rateLimitTable?: boolean } = {}): D1Database {
  const families: any[] = []
  const players: any[] = []
  const progress: any[] = []
  const prefs: any[] = []
  const rateLimits = new Map<string, { count: number; window_start: number }>()
  // Simulate the 0002 migration not being applied: any rate_limits query throws,
  // and the limiter must FAIL OPEN.
  const hasRateTable = opts.rateLimitTable !== false

  const prepare = (sql: string) => {
    let args: unknown[] = []
    const stmt = {
      bind(...a: unknown[]) {
        args = a
        return stmt
      },
      async first<T = unknown>(): Promise<T | null> {
        if (sql.includes('FROM rate_limits')) {
          if (!hasRateTable) throw new Error('no such table: rate_limits')
          return (rateLimits.get(args[0] as string) ?? null) as T | null
        }
        if (sql.includes('FROM families WHERE email')) {
          const f = families.find((x) => x.email === args[0])
          if (!f) return null
          return (sql.includes('pw_hash') ? f : { id: f.id }) as T
        }
        if (sql.includes('FROM families WHERE id')) {
          return (families.find((x) => x.id === args[0]) ?? null) as T | null
        }
        if (sql.includes('COUNT(*)')) {
          return { c: players.filter((p) => p.family_id === args[0]).length } as T
        }
        return null
      },
      async run() {
        if (sql.includes('rate_limits')) {
          if (!hasRateTable) throw new Error('no such table: rate_limits')
          if (sql.startsWith('INSERT OR REPLACE')) {
            rateLimits.set(args[0] as string, { count: 1, window_start: args[1] as number })
          } else if (sql.startsWith('UPDATE')) {
            const row = rateLimits.get(args[0] as string)
            if (row) row.count++
          } else if (sql.startsWith('DELETE')) {
            for (const [k, v] of rateLimits) if (v.window_start < (args[0] as number)) rateLimits.delete(k)
          }
          return {}
        }
        if (sql.startsWith('INSERT INTO families')) {
          families.push({ id: args[0], email: args[1], pw_hash: args[2], pw_salt: args[3], created: args[4] })
        } else if (sql.startsWith('INSERT INTO players')) {
          players.push({ id: args[0], family_id: args[1], name: args[2], initial: args[3] })
        } else if (sql.startsWith('DELETE FROM players WHERE id')) {
          const i = players.findIndex((p) => p.id === args[0] && p.family_id === args[1])
          if (i >= 0) players.splice(i, 1)
        } else if (sql.startsWith('DELETE FROM players WHERE family_id')) {
          for (let i = players.length - 1; i >= 0; i--) if (players[i].family_id === args[0]) players.splice(i, 1)
        } else if (sql.startsWith('DELETE FROM families')) {
          const i = families.findIndex((f) => f.id === args[0])
          if (i >= 0) families.splice(i, 1)
        } else if (sql.startsWith('DELETE FROM progress') || sql.startsWith('DELETE FROM prefs')) {
          // player-scoped and family-scoped variants; both no-op on empty arrays
        }
        return {}
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        if (sql.includes('FROM progress')) return { results: progress as T[] }
        if (sql.includes('FROM prefs')) return { results: prefs as T[] }
        return {
          results: players
            .filter((p) => p.family_id === args[0])
            .map((p) => ({ id: p.id, name: p.name, initial: p.initial })) as T[],
        }
      },
    }
    return stmt
  }
  return { prepare } as unknown as D1Database
}

let env: { DB: D1Database; AUTH_SECRET: string; SIGNUP_INVITE_CODE?: string }
beforeEach(() => {
  env = { DB: mockDB(), AUTH_SECRET: 'test-secret-xyz' }
})

function req(path: string, method: string, body?: unknown, token?: string): Request {
  return new Request(`https://x${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('crypto primitives', () => {
  it('PBKDF2 hash verifies the right password and rejects the wrong one', async () => {
    const { hash, salt } = await __test.hashPassword('hunter2')
    expect(await __test.verifyPassword('hunter2', hash, salt)).toBe(true)
    expect(await __test.verifyPassword('nope', hash, salt)).toBe(false)
  })

  it('JWT round-trips and rejects a tampered token / expired token', async () => {
    const tok = await __test.signToken({ sub: 'f1', email: 'a@b.c', exp: Math.floor(Date.now() / 1000) + 100 }, 's')
    expect((await __test.verifyToken(tok, 's'))?.sub).toBe('f1')
    expect(await __test.verifyToken(tok + 'x', 's')).toBeNull()
    expect(await __test.verifyToken(tok, 'wrong-secret')).toBeNull()
    const expired = await __test.signToken({ sub: 'f1', email: 'a@b.c', exp: 1 }, 's')
    expect(await __test.verifyToken(expired, 's')).toBeNull()
  })
})

describe('auth + players API', () => {
  async function register(email = 'parent@test.com', password = 'secret123') {
    const res = await handleCloudApi(req('/api/auth/register', 'POST', { email, password }), env, '/api/auth/register')
    return (await res!.json()) as { token: string; family: { id: string; email: string } }
  }

  it('register issues a token; duplicate email is rejected', async () => {
    const { token, family } = await register()
    expect(token).toBeTruthy()
    expect(family.email).toBe('parent@test.com')
    const dup = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'parent@test.com', password: 'secret123' }),
      env,
      '/api/auth/register',
    )
    expect(dup!.status).toBe(409)
  })

  it('rejects bad email / short password', async () => {
    const badEmail = await handleCloudApi(req('/api/auth/register', 'POST', { email: 'x', password: 'secret123' }), env, '/api/auth/register')
    expect(badEmail!.status).toBe(400)
    const shortPw = await handleCloudApi(req('/api/auth/register', 'POST', { email: 'a@b.co', password: '12' }), env, '/api/auth/register')
    expect(shortPw!.status).toBe(400)
  })

  it('login succeeds with the right password, 401 on wrong', async () => {
    await register()
    const ok = await handleCloudApi(req('/api/auth/login', 'POST', { email: 'parent@test.com', password: 'secret123' }), env, '/api/auth/login')
    expect(ok!.status).toBe(200)
    const bad = await handleCloudApi(req('/api/auth/login', 'POST', { email: 'parent@test.com', password: 'WRONG' }), env, '/api/auth/login')
    expect(bad!.status).toBe(401)
  })

  it('me + players require a valid token', async () => {
    const { token } = await register()
    const me = await handleCloudApi(req('/api/auth/me', 'GET', undefined, token), env, '/api/auth/me')
    expect(me!.status).toBe(200)
    const noAuth = await handleCloudApi(req('/api/players', 'GET'), env, '/api/players')
    expect(noAuth!.status).toBe(401)
  })

  it('a family creates, lists, and deletes its own players', async () => {
    const { token } = await register()
    await handleCloudApi(req('/api/players', 'POST', { name: 'דנה', initial: 'ד' }, token), env, '/api/players')
    let list = await handleCloudApi(req('/api/players', 'GET', undefined, token), env, '/api/players')
    let body = (await list!.json()) as { players: Array<{ id: string; name: string }> }
    expect(body.players).toHaveLength(1)
    expect(body.players[0].name).toBe('דנה')

    const id = body.players[0].id
    await handleCloudApi(req(`/api/players/${id}`, 'DELETE', undefined, token), env, `/api/players/${id}`)
    list = await handleCloudApi(req('/api/players', 'GET', undefined, token), env, '/api/players')
    body = (await list!.json()) as { players: unknown[] }
    expect(body.players).toHaveLength(0)
  })

  it('503s cleanly when the backend is not configured', async () => {
    const res = await handleCloudApi(req('/api/auth/register', 'POST', { email: 'a@b.co', password: 'secret123' }), {}, '/api/auth/register')
    expect(res!.status).toBe(503)
  })
})

// ── Phase C guardrails (2026-07-05) ────────────────────────────────────────────

describe('rate limiting', () => {
  const registerReq = (email: string) =>
    handleCloudApi(req('/api/auth/register', 'POST', { email, password: 'secret123' }), env, '/api/auth/register')

  it('register: 429 after the per-IP window fills, earlier attempts unaffected', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await registerReq(`fam${i}@test.com`)
      expect(res!.status).toBe(200)
    }
    const blocked = await registerReq('fam6@test.com')
    expect(blocked!.status).toBe(429)
  })

  it('login: repeated failures against one email hit the per-email limit', async () => {
    await registerReq('parent@test.com')
    let last = 0
    for (let i = 0; i < 11; i++) {
      const res = await handleCloudApi(
        req('/api/auth/login', 'POST', { email: 'parent@test.com', password: 'WRONG' }),
        env,
        '/api/auth/login',
      )
      last = res!.status
    }
    expect(last).toBe(429)
  })

  it('FAILS OPEN when the rate_limits table is missing (migration not applied)', async () => {
    env.DB = mockDB({ rateLimitTable: false })
    for (let i = 0; i < 7; i++) {
      const res = await registerReq(`fam${i}@test.com`)
      expect(res!.status).toBe(200) // never 429, never 500
    }
  })
})

describe('invite-gated signup', () => {
  it('requires the invite code when SIGNUP_INVITE_CODE is set', async () => {
    env.SIGNUP_INVITE_CODE = 'beta-2026'
    const noCode = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'a@b.co', password: 'secret123' }),
      env,
      '/api/auth/register',
    )
    expect(noCode!.status).toBe(403)
    expect(((await noCode!.json()) as any).code).toBe('invite-required')

    const wrong = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'a@b.co', password: 'secret123', inviteCode: 'nope' }),
      env,
      '/api/auth/register',
    )
    expect(wrong!.status).toBe(403)

    const ok = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'a@b.co', password: 'secret123', inviteCode: 'beta-2026' }),
      env,
      '/api/auth/register',
    )
    expect(ok!.status).toBe(200)
  })

  it('stays open when the secret is unset', async () => {
    const res = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'a@b.co', password: 'secret123' }),
      env,
      '/api/auth/register',
    )
    expect(res!.status).toBe(200)
  })
})

describe('family data rights', () => {
  async function registerAndToken() {
    const res = await handleCloudApi(
      req('/api/auth/register', 'POST', { email: 'parent@test.com', password: 'secret123' }),
      env,
      '/api/auth/register',
    )
    return ((await res!.json()) as { token: string }).token
  }

  it('export returns the family, players, and blobs; requires auth', async () => {
    const token = await registerAndToken()
    await handleCloudApi(req('/api/players', 'POST', { name: 'דנה', initial: 'ד' }, token), env, '/api/players')

    const noAuth = await handleCloudApi(req('/api/family/export', 'GET'), env, '/api/family/export')
    expect(noAuth!.status).toBe(401)

    const res = await handleCloudApi(req('/api/family/export', 'GET', undefined, token), env, '/api/family/export')
    expect(res!.status).toBe(200)
    const body = (await res!.json()) as any
    expect(body.format).toBe('english-learning-cloud-export')
    expect(body.family.email).toBe('parent@test.com')
    expect(body.players).toHaveLength(1)
    expect(body.players[0].name).toBe('דנה')
  })

  it('delete requires the echoed email, then erases the family (login stops working)', async () => {
    const token = await registerAndToken()

    const badConfirm = await handleCloudApi(
      req('/api/family', 'DELETE', { confirmEmail: 'other@test.com' }, token),
      env,
      '/api/family',
    )
    expect(badConfirm!.status).toBe(400)

    const res = await handleCloudApi(
      req('/api/family', 'DELETE', { confirmEmail: 'parent@test.com' }, token),
      env,
      '/api/family',
    )
    expect(res!.status).toBe(200)

    const login = await handleCloudApi(
      req('/api/auth/login', 'POST', { email: 'parent@test.com', password: 'secret123' }),
      env,
      '/api/auth/login',
    )
    expect(login!.status).toBe(401)
  })
})
