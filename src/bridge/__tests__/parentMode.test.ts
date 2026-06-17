import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setParentPassword } from '../auth'
import { isParentElevated, elevateParent, lockParent, touchElevation } from '../parentMode'

/**
 * M12 Slice B — one-unlock parent mode. Verifies elevation by password (with
 * timeout + lock), and that a parent/manager-role session is auto-elevated.
 */

function seedSession(userId: string, role?: 'parent' | 'manager') {
  localStorage.setItem(
    'users',
    JSON.stringify({
      [userId]: { id: userId, name: 'x', displayName: 'x', initial: 'x', password: 'p', created: '', lastLogin: null, role },
    }),
  )
  localStorage.setItem(
    'currentSession',
    JSON.stringify({ userId, userName: 'x', displayName: 'x', initial: 'x', loginTime: Date.now(), lastActivity: Date.now(), authenticated: true }),
  )
}

beforeEach(() => {
  localStorage.clear()
  lockParent()
})

describe('parent-mode elevation', () => {
  it('starts not elevated with no password and no admin session', () => {
    expect(isParentElevated()).toBe(false)
  })

  it('elevates only with the correct parent password', () => {
    setParentPassword('secret')
    expect(elevateParent('wrong')).toBe(false)
    expect(isParentElevated()).toBe(false)
    expect(elevateParent('secret')).toBe(true)
    expect(isParentElevated()).toBe(true)
  })

  it('lockParent drops a password elevation', () => {
    setParentPassword('secret')
    elevateParent('secret')
    lockParent()
    expect(isParentElevated()).toBe(false)
  })

  it('auto-elevates a parent-role session (no password needed)', () => {
    seedSession('mom', 'parent')
    expect(isParentElevated()).toBe(true)
  })

  it('does NOT auto-elevate a plain kid session', () => {
    seedSession('kid')
    expect(isParentElevated()).toBe(false)
  })
})

describe('parent-mode timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('expires after the timeout window, refreshes on touch', () => {
    setParentPassword('secret')
    elevateParent('secret')
    expect(isParentElevated()).toBe(true)

    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(isParentElevated()).toBe(true)
    touchElevation() // push the window forward

    vi.advanceTimersByTime(10 * 60 * 1000) // 10 min after the touch — still inside
    expect(isParentElevated()).toBe(true)

    vi.advanceTimersByTime(16 * 60 * 1000) // now well past
    expect(isParentElevated()).toBe(false)
  })
})
