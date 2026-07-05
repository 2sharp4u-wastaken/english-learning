import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasParentPassword,
  setParentPassword,
  changeParentPassword,
  verifyAdminPassword,
  createParentAccount,
  getUser,
  getAllUsers,
  factoryReset,
} from '../auth'

/**
 * Tier-2 per-device parent password (backlog §4). Pins the bridge contract the
 * ParentPasswordModal create/verify/forgot flows depend on. Since the Phase C
 * hash migration (2026-07-05) the stored format is `sha256$<salt>$<digest>`
 * (random per-hash salt, non-reversible); the old `btoa(SALT+pw+SALT)` scheme
 * the Playwright suite still seeds is verified via the legacy fallback and
 * lazily re-hashed — covered below.
 */

const KEY = 'parentPassword'
const LEGACY_SALT = 'englishlearning2024'

beforeEach(() => {
  localStorage.clear()
})

describe('parent password lifecycle', () => {
  it('starts absent: hasParentPassword false, every verify fails', () => {
    expect(hasParentPassword()).toBe(false)
    expect(verifyAdminPassword('')).toBe(false)
    expect(verifyAdminPassword('anything')).toBe(false)
  })

  it('setParentPassword stores a salted SHA-256 hash (never plaintext, not reversible)', () => {
    setParentPassword('my-secret')
    expect(hasParentPassword()).toBe(true)
    const stored = localStorage.getItem(KEY)!
    expect(stored).toMatch(/^sha256\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(stored).not.toContain('my-secret')
    // NOT the old reversible btoa scheme
    expect(stored).not.toBe(btoa(LEGACY_SALT + 'my-secret' + LEGACY_SALT))
  })

  it('a legacy btoa hash still verifies and is upgraded to SHA-256 on success', () => {
    localStorage.setItem(KEY, btoa(LEGACY_SALT + 'old-pass' + LEGACY_SALT))
    expect(verifyAdminPassword('wrong')).toBe(false)
    // wrong guesses must NOT upgrade/replace the stored hash
    expect(localStorage.getItem(KEY)).toBe(btoa(LEGACY_SALT + 'old-pass' + LEGACY_SALT))

    expect(verifyAdminPassword('old-pass')).toBe(true)
    expect(localStorage.getItem(KEY)).toMatch(/^sha256\$/)
    // and the upgraded hash keeps verifying the same password
    expect(verifyAdminPassword('old-pass')).toBe(true)
    expect(verifyAdminPassword('wrong')).toBe(false)
  })

  it('verifyAdminPassword accepts the set password and rejects others', () => {
    setParentPassword('my-secret')
    expect(verifyAdminPassword('my-secret')).toBe(true)
    expect(verifyAdminPassword('wrong')).toBe(false)
    expect(verifyAdminPassword('')).toBe(false)
  })

  it('changeParentPassword updates the device credential AND the parent user (issue #10)', () => {
    createParentAccount('parent', 'אבא', 'old-pass')
    expect(verifyAdminPassword('old-pass')).toBe(true)

    changeParentPassword('new-pass')
    expect(verifyAdminPassword('old-pass')).toBe(false)
    expect(verifyAdminPassword('new-pass')).toBe(true)
    // The parent account's own password is kept in sync (one credential —
    // byte-identical hash string in both places).
    expect(getUser('parent')?.password).toBe(localStorage.getItem(KEY))
    expect(getUser('parent')?.password).toMatch(/^sha256\$/)
  })

  it('factoryReset wipes every profile + the parent password (fresh device)', () => {
    createParentAccount('parent', 'אבא', 'pw1234')
    localStorage.setItem('v2_userProgress_player1', '{"version":4}')
    expect(getAllUsers().length).toBeGreaterThan(0)

    factoryReset(false) // no reload in the test

    expect(hasParentPassword()).toBe(false)
    expect(getAllUsers()).toEqual([])
    expect(localStorage.getItem('v2_userProgress_player1')).toBeNull()
  })
})
