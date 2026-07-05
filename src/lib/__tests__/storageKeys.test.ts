import { describe, it, expect, beforeEach } from 'vitest'
import { isPerUserKey, listPerUserKeys, removeAllUserData, GLOBAL_KEYS } from '../storageKeys'

/**
 * Storage-key manifest (design-flaws fix, 2026-07-05): deletion must remove
 * EVERY key belonging to a user — the old adminDeleteUser only removed the
 * legacy unprefixed keys, orphaning v2_userProgress_<id> etc. and resurrecting
 * a deleted child's progress when the same id was re-created.
 */
describe('storageKeys manifest', () => {
  const seed = () => {
    // user "omer" — every per-user key shape the app writes
    localStorage.setItem('v2_userProgress_omer', '{}')
    localStorage.setItem('v2_playerPrefs_omer', '{}')
    localStorage.setItem('v2_playerUnlocks_omer', '{}')
    localStorage.setItem('v2_vocab_audio_omer', '{}')
    localStorage.setItem('v2_wordbuilder_audio_omer', '{}')
    localStorage.setItem('savedGame_omer_vocabulary', '{}')
    localStorage.setItem('memoryBest_omer', '3')
    localStorage.setItem('userProgress_omer', '{}') // legacy
    localStorage.setItem('scoreHistory_omer_vocabulary', '[]') // legacy
    localStorage.setItem('omer_vocabulary_history', '[]') // legacy
    // another user — must be untouched
    localStorage.setItem('v2_userProgress_zohar', '{}')
    localStorage.setItem('savedGame_zohar_reading', '{}')
    // globals — must be untouched
    localStorage.setItem('users', '{}')
    localStorage.setItem('v2_englishLearningSettings', '{}')
  }

  beforeEach(seed)

  it('matches every per-user key shape and no globals', () => {
    expect(listPerUserKeys('omer').sort()).toEqual(
      [
        'v2_userProgress_omer',
        'v2_playerPrefs_omer',
        'v2_playerUnlocks_omer',
        'v2_vocab_audio_omer',
        'v2_wordbuilder_audio_omer',
        'savedGame_omer_vocabulary',
        'memoryBest_omer',
        'userProgress_omer',
        'scoreHistory_omer_vocabulary',
        'omer_vocabulary_history',
      ].sort(),
    )
    for (const key of GLOBAL_KEYS) {
      expect(isPerUserKey(key, 'omer')).toBe(false)
    }
  })

  it('removeAllUserData removes only that user, other users + globals survive', () => {
    const removed = removeAllUserData('omer')
    expect(removed).toHaveLength(10)
    expect(localStorage.getItem('v2_userProgress_omer')).toBeNull()
    expect(localStorage.getItem('v2_playerPrefs_omer')).toBeNull()
    expect(localStorage.getItem('savedGame_omer_vocabulary')).toBeNull()
    // untouched:
    expect(localStorage.getItem('v2_userProgress_zohar')).not.toBeNull()
    expect(localStorage.getItem('savedGame_zohar_reading')).not.toBeNull()
    expect(localStorage.getItem('users')).not.toBeNull()
    expect(localStorage.getItem('v2_englishLearningSettings')).not.toBeNull()
  })

  it('does not cross-match users whose id is a prefix of another', () => {
    localStorage.setItem('v2_userProgress_om', '{}')
    expect(listPerUserKeys('om')).toEqual(['v2_userProgress_om'])
    expect(isPerUserKey('v2_userProgress_omer', 'om')).toBe(false)
  })
})
