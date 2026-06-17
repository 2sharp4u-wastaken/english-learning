import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasParentPassword,
  setParentPassword,
  changeParentPassword,
  verifyAdminPassword,
  createParentAccount,
  getUser,
} from '../auth'

/**
 * Tier-2 per-device parent password (backlog §4). Pins the bridge contract the
 * ParentPasswordModal create/verify/forgot flows depend on, and the storage
 * scheme the Playwright suite seeds directly (unprefixed 'parentPassword' key,
 * btoa(SALT + password + SALT) — same scheme as kid passwords).
 */

const KEY = 'parentPassword'
const SALT = 'englishlearning2024'

beforeEach(() => {
  localStorage.clear()
})

describe('parent password lifecycle', () => {
  it('starts absent: hasParentPassword false, every verify fails', () => {
    expect(hasParentPassword()).toBe(false)
    expect(verifyAdminPassword('')).toBe(false)
    expect(verifyAdminPassword('anything')).toBe(false)
  })

  it('setParentPassword stores the hash (never plaintext) at the unprefixed key', () => {
    setParentPassword('my-secret')
    expect(hasParentPassword()).toBe(true)
    const stored = localStorage.getItem(KEY)
    expect(stored).toBe(btoa(SALT + 'my-secret' + SALT))
    expect(stored).not.toContain('my-secret')
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
    // The parent account's own password is kept in sync (one credential).
    expect(getUser('parent')?.password).toBe(btoa(SALT + 'new-pass' + SALT))
  })
})
