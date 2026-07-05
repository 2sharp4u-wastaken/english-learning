import { describe, it, expect, beforeEach } from 'vitest'
import { createParentAccount, getUser, verifyAdminPassword, hasParentPassword } from '../auth'

/**
 * M12 Slice B — the parent/admin account born in the first-run wizard. Pins that
 * the account is created with role `parent` AND that its password becomes the
 * device parent credential (one secret), plus the "only one parent" guard.
 */

beforeEach(() => {
  localStorage.clear()
})

describe('createParentAccount', () => {
  it('creates a parent-role user with a salted SHA-256 password hash', () => {
    const r = createParentAccount('parent', 'אבא', 'pw1234')
    expect(r.success).toBe(true)
    const user = getUser('parent')
    expect(user?.role).toBe('parent')
    expect(user?.name).toBe('אבא')
    expect(user?.password).toMatch(/^sha256\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(user?.password).not.toContain('pw1234')
  })

  it('mirrors the password into the device parent credential (same hash string)', () => {
    createParentAccount('parent', 'אבא', 'pw1234')
    expect(hasParentPassword()).toBe(true)
    expect(verifyAdminPassword('pw1234')).toBe(true)
    expect(verifyAdminPassword('nope')).toBe(false)
    expect(localStorage.getItem('parentPassword')).toBe(getUser('parent')?.password)
  })

  it('refuses when a parent already exists', () => {
    expect(createParentAccount('parent', 'אבא', 'pw1234').success).toBe(true)
    const r = createParentAccount('parent2', 'אמא', 'pw5678')
    expect(r.success).toBe(false)
    expect(getUser('parent2')).toBeNull()
  })

  it('rejects an invalid (non-Latin) id', () => {
    const r = createParentAccount('שם', 'אבא', 'pw1234')
    expect(r.success).toBe(false)
  })
})
