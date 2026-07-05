/**
 * src/lib/storageKeys.ts — single manifest of every localStorage key the app
 * owns (design-flaws fix, 2026-07-05).
 *
 * WHY: keys used to be invented ad-hoc per feature (some `v2_`-prefixed, some
 * not), and nothing owned the list — so `adminDeleteUser` only removed the
 * legacy unprefixed keys and left `v2_userProgress_<id>` behind, orphaning data
 * and silently RESURRECTING a deleted child's progress when a profile with the
 * same id was re-created. Deletion (`removeAllUserData`) and the local backup
 * (`src/bridge/backup.ts`) both drive off this manifest now.
 *
 * RULE: any NEW localStorage key must be registered here — global keys in
 * `GLOBAL_KEYS`, per-user keys as a matcher in `isPerUserKey`.
 */

/** Device-global keys (not scoped to one player). */
export const GLOBAL_KEYS: readonly string[] = [
  // auth (unprefixed — legacy byte-compat, see bridge/auth.ts)
  'users',
  'currentSession',
  'currentUser',
  'parentPassword',
  // app settings
  'v2_englishLearningSettings',
  'englishLearningSettings', // legacy
  'globalLetterCase',
  // parent-authored content (unprefixed — read at boot by data/_loader.js)
  'customWords_global',
  'wordImageOverrides',
  'wordTranslationOverrides',
  'expressionMeaningOverrides',
  'nikudCache',
  // cloud account (Tier 3 Phase A)
  'cloudToken',
  'cloudEmail',
  // misc device-local
  'bugReports_local',
  'microphonePermissionState',
]

/** Keys never included in a backup export (secrets that must not leave the device). */
export const BACKUP_EXCLUDE: ReadonlySet<string> = new Set(['cloudToken'])

/**
 * Whether `key` belongs to the player `userId`. Covers every per-user key the
 * app writes, current and legacy:
 *   v2_userProgress_<id> / v2_playerPrefs_<id> / v2_playerUnlocks_<id>
 *   v2_<game>_audio_<id>          (per-game audio-gate state, e.g. v2_vocab_audio_O)
 *   savedGame_<id>_<gameType>     (mid-game resume)
 *   memoryBest_<id>
 *   userProgress_<id>, scoreHistory_<id>_<game>, <id>_<game>_history   (legacy)
 */
export function isPerUserKey(key: string, userId: string): boolean {
  if (!userId) return false
  return (
    key === `v2_userProgress_${userId}` ||
    key === `v2_playerPrefs_${userId}` ||
    key === `v2_playerUnlocks_${userId}` ||
    key === `memoryBest_${userId}` ||
    key === `userProgress_${userId}` ||
    key.startsWith(`savedGame_${userId}_`) ||
    key.startsWith(`scoreHistory_${userId}_`) ||
    (key.startsWith('v2_') && key.endsWith(`_audio_${userId}`)) ||
    (key.startsWith(`${userId}_`) && key.endsWith('_history'))
  )
}

/** Every key currently in localStorage (uses length/key(i) — works on the test polyfill too). */
export function listAllKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k !== null) keys.push(k)
  }
  return keys
}

/** All keys in localStorage that belong to `userId`. */
export function listPerUserKeys(userId: string): string[] {
  return listAllKeys().filter((k) => isPerUserKey(k, userId))
}

/**
 * Remove every localStorage key belonging to `userId`. Returns the removed
 * keys. Used by user deletion (bridge/auth.ts `adminDeleteUser`).
 */
export function removeAllUserData(userId: string): string[] {
  const keys = listPerUserKeys(userId)
  keys.forEach((k) => localStorage.removeItem(k))
  return keys
}
