import { describe, it, expect, beforeEach } from 'vitest'
import { getPlayerPrefs, savePlayerPrefs, DEFAULT_PLAYER_PREFS } from '../playerPrefs'

/**
 * Per-player customization ("המשחק שלי"). Pins: defaults when absent, per-user
 * isolation (each child's look is their own blob), and no-op without a session.
 */

function setUser(id: string | null) {
  if (id === null) {
    localStorage.removeItem('currentSession')
  } else {
    localStorage.setItem(
      'currentSession',
      JSON.stringify({ userId: id, userName: id, displayName: id, initial: id[0], loginTime: Date.now(), lastActivity: Date.now(), authenticated: true }),
    )
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('playerPrefs', () => {
  it('returns defaults when no user / no blob', () => {
    setUser(null)
    expect(getPlayerPrefs()).toEqual(DEFAULT_PLAYER_PREFS)
    setUser('kid')
    expect(getPlayerPrefs()).toEqual(DEFAULT_PLAYER_PREFS)
  })

  it('merges a saved patch over defaults at the per-user key', () => {
    setUser('kid')
    savePlayerPrefs({ theme: 'ocean', soundOn: false })
    const p = getPlayerPrefs()
    expect(p.theme).toBe('ocean')
    expect(p.soundOn).toBe(false)
    expect(p.confetti).toBe(true) // untouched default
    expect(localStorage.getItem('v2_playerPrefs_kid')).not.toBeNull()
  })

  it('isolates prefs per profile', () => {
    setUser('alice')
    savePlayerPrefs({ theme: 'candy' })
    setUser('bob')
    savePlayerPrefs({ theme: 'forest' })

    setUser('alice')
    expect(getPlayerPrefs().theme).toBe('candy')
    setUser('bob')
    expect(getPlayerPrefs().theme).toBe('forest')
  })

  it('save is a no-op with no logged-in user', () => {
    setUser(null)
    savePlayerPrefs({ theme: 'sunset' })
    setUser('kid')
    expect(getPlayerPrefs().theme).toBe('dark') // nothing was written
  })
})
