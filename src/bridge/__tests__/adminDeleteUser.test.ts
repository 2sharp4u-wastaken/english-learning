import { describe, it, expect, beforeEach } from 'vitest'
import { adminDeleteUser, getUsers } from '../auth'

/**
 * User deletion must remove ALL of the user's localStorage keys (design-flaws
 * fix, 2026-07-05) — previously only the legacy unprefixed keys were removed,
 * so re-creating a profile with the same id resurrected the deleted child's
 * v2_userProgress blob.
 */
describe('adminDeleteUser', () => {
  beforeEach(() => {
    localStorage.setItem(
      'users',
      JSON.stringify({
        omer: { id: 'omer', name: 'Omer', displayName: 'Omer', initial: 'O', password: null, created: '', lastLogin: null },
        zohar: { id: 'zohar', name: 'Zohar', displayName: 'Zohar', initial: 'Z', password: null, created: '', lastLogin: null },
      }),
    )
    localStorage.setItem('v2_userProgress_omer', '{}')
    localStorage.setItem('v2_playerPrefs_omer', '{}')
    localStorage.setItem('v2_playerUnlocks_omer', '{}')
    localStorage.setItem('savedGame_omer_vocabulary', '{}')
    localStorage.setItem('v2_vocab_audio_omer', '{}')
    localStorage.setItem('userProgress_omer', '{}')
    localStorage.setItem('v2_userProgress_zohar', '{}')
  })

  it('removes the user and every per-user key, leaving other users intact', () => {
    const result = adminDeleteUser('omer')
    expect(result.success).toBe(true)
    expect(getUsers()?.omer).toBeUndefined()
    expect(getUsers()?.zohar).toBeDefined()
    expect(localStorage.getItem('v2_userProgress_omer')).toBeNull()
    expect(localStorage.getItem('v2_playerPrefs_omer')).toBeNull()
    expect(localStorage.getItem('v2_playerUnlocks_omer')).toBeNull()
    expect(localStorage.getItem('savedGame_omer_vocabulary')).toBeNull()
    expect(localStorage.getItem('v2_vocab_audio_omer')).toBeNull()
    expect(localStorage.getItem('userProgress_omer')).toBeNull()
    expect(localStorage.getItem('v2_userProgress_zohar')).not.toBeNull()
  })

  it('refuses unknown users and the manager account', () => {
    expect(adminDeleteUser('nobody').success).toBe(false)
    expect(adminDeleteUser('manager').success).toBe(false)
  })
})
