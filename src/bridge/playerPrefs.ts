import { getKey, setKey, v2Key } from './storage'
import { getCurrentUserId } from './auth'

/**
 * src/bridge/playerPrefs.ts — PER-PLAYER customization ("המשחק שלי").
 *
 * Distinct from the parent-controlled, device-global `AppSettings`
 * (`bridge/settings.ts`): these are fun, per-profile look-and-feel choices each
 * child owns (theme, sounds, animations, mascot). Stored as ONE per-user JSON
 * blob at `v2_playerPrefs_<userId>` — deliberately a single opaque blob so the
 * Tier-3 sync (Part 2 Phase B) can back it up / pull it unchanged, exactly like
 * the per-user progress blob.
 *
 * A change dispatches `player-prefs-changed` so live consumers (theme effect,
 * feedback sounds, hero) re-read without a poll.
 */

export type ThemeName = 'dark' | 'ocean' | 'sunset' | 'forest' | 'candy'
export type LoginSound = 'arpeggio' | 'bell' | 'chord' | 'none'
export type CelebrationLevel = 'calm' | 'normal' | 'party'

export interface PlayerPrefs {
  // sounds
  soundOn: boolean
  loginSound: LoginSound
  answerSounds: boolean
  heroSounds: boolean
  coinSounds: boolean
  // colors / theme
  theme: ThemeName
  avatarColor: string // hex; '' = default gradient
  // motion / animation
  confetti: boolean
  sparkles: boolean
  celebration: CelebrationLevel
  reducedMotion: boolean
  // mascot / text
  mascot: boolean
  bigText: boolean
  highContrast: boolean
}

export const THEME_NAMES: ThemeName[] = ['dark', 'ocean', 'sunset', 'forest', 'candy']

export const AVATAR_COLORS = ['', '#63e6c6', '#68a8ff', '#ffb454', '#ff7a66', '#c084fc', '#4ade80']

export const DEFAULT_PLAYER_PREFS: PlayerPrefs = {
  soundOn: true,
  loginSound: 'arpeggio',
  answerSounds: true,
  heroSounds: true,
  coinSounds: true,
  theme: 'dark',
  avatarColor: '',
  confetti: true,
  sparkles: true,
  celebration: 'normal',
  reducedMotion: false,
  mascot: true,
  bigText: false,
  highContrast: false,
}

const PLAYER_PREFS_CHANGED = 'player-prefs-changed'

function prefsKey(userId: string): string {
  return v2Key(`playerPrefs_${userId}`)
}

/** Current player's prefs, merged over defaults. Defaults when no user/blob. */
export function getPlayerPrefs(): PlayerPrefs {
  const userId = getCurrentUserId()
  if (!userId) return { ...DEFAULT_PLAYER_PREFS }
  const stored = getKey<Partial<PlayerPrefs>>(prefsKey(userId))
  return stored ? { ...DEFAULT_PLAYER_PREFS, ...stored } : { ...DEFAULT_PLAYER_PREFS }
}

/** Patch the current player's prefs (no-op if nobody is logged in). */
export function savePlayerPrefs(patch: Partial<PlayerPrefs>): void {
  const userId = getCurrentUserId()
  if (!userId) return
  const merged = { ...getPlayerPrefs(), ...patch }
  setKey(prefsKey(userId), merged)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLAYER_PREFS_CHANGED))
  }
}

/**
 * Subscribe to prefs changes. Fires immediately, then on every save and on
 * `auth-changed` (the active player — hence the blob — may have changed).
 */
export function subscribePlayerPrefs(cb: (prefs: PlayerPrefs) => void): () => void {
  const handler = () => cb(getPlayerPrefs())
  cb(getPlayerPrefs())
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PLAYER_PREFS_CHANGED, handler)
  window.addEventListener('auth-changed', handler)
  return () => {
    window.removeEventListener(PLAYER_PREFS_CHANGED, handler)
    window.removeEventListener('auth-changed', handler)
  }
}
