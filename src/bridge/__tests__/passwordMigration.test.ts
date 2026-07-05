import { describe, it, expect, beforeEach } from 'vitest'
import { login, getUser } from '../auth'

/**
 * Phase C hash migration (2026-07-05): stored password hashes move from the
 * reversible `btoa(SALT+pw+SALT)` scheme to `sha256$<salt>$<digest>`. Existing
 * accounts keep their legacy hash until the next successful login, which
 * verifies via the legacy fallback and transparently re-hashes.
 */

const LEGACY_SALT = 'englishlearning2024'
const legacy = (pw: string) => btoa(LEGACY_SALT + pw + LEGACY_SALT)

function seedUser(id: string, password: string | null, role?: string) {
  const users = JSON.parse(localStorage.getItem('users') || '{}')
  users[id] = {
    id,
    name: id,
    displayName: id,
    initial: id[0].toUpperCase(),
    password: password === null ? null : legacy(password),
    created: '2026-01-01T00:00:00.000Z',
    lastLogin: null,
    ...(role ? { role } : {}),
  }
  localStorage.setItem('users', JSON.stringify(users))
}

beforeEach(() => localStorage.clear())

describe('lazy password-hash migration on login', () => {
  it('a kid with a legacy hash logs in and gets re-hashed to sha256', () => {
    seedUser('omer', 'kid-pass')
    expect(getUser('omer')?.password).toBe(legacy('kid-pass'))

    expect(login('omer', 'WRONG').success).toBe(false)
    expect(getUser('omer')?.password).toBe(legacy('kid-pass')) // no upgrade on failure

    expect(login('omer', 'kid-pass').success).toBe(true)
    expect(getUser('omer')?.password).toMatch(/^sha256\$/)

    // the upgraded hash keeps working
    expect(login('omer', 'kid-pass').success).toBe(true)
    expect(login('omer', 'WRONG').success).toBe(false)
  })

  it('a parent with a legacy hash gets BOTH the account and parentPassword upgraded in sync', () => {
    seedUser('parent', 'parent-pass', 'parent')
    localStorage.setItem('parentPassword', legacy('parent-pass'))

    expect(login('parent', 'parent-pass').success).toBe(true)
    const upgraded = getUser('parent')?.password
    expect(upgraded).toMatch(/^sha256\$/)
    expect(localStorage.getItem('parentPassword')).toBe(upgraded)
  })

  it('first-login password adoption stores the new format directly', () => {
    seedUser('dana', null)
    expect(login('dana', 'chosen-pass').success).toBe(true)
    expect(getUser('dana')?.password).toMatch(/^sha256\$/)
    expect(login('dana', 'chosen-pass').success).toBe(true)
  })
})
