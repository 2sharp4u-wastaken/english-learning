import { getKey, setKey, v2Key } from './storage'
import { getCurrentUserId } from './auth'

/**
 * src/bridge/playerUnlocks.ts — PER-PLAYER content unlocks set by the PARENT.
 *
 * Distinct from:
 *   - `playerPrefs` (the kid's OWN look-and-feel, current-user-scoped), and
 *   - the device-global `gameUnlockOverride` AppSetting (opens ALL gated content for
 *     EVERY player at once).
 *
 * This is a parent decision scoped to ONE child: e.g. "open ביטויים for דני, but not
 * for the others." Stored as one per-user JSON blob at `v2_playerUnlocks_<userId>`
 * (mirrors `v2_userProgress_<id>` / `v2_playerPrefs_<id>` so the future cloud sync
 * backs it up the same way). The functions are user-id-PARAMETERIZED — the parent
 * sets a child's blob while logged in as the parent — with a current-user
 * convenience read for the gate (which runs in the child's own session).
 *
 * Minimal by design: only `expressions` today. The blob shape is open so per-game
 * unlocks can be added later without a new store (see docs/backlog.md).
 */

export interface PlayerUnlocks {
  /** Parent opened the ביטויים tier for this child, bypassing the 50-word gate. */
  expressions?: boolean
}

const PLAYER_UNLOCKS_CHANGED = 'player-unlocks-changed'

function unlocksKey(userId: string): string {
  return v2Key(`playerUnlocks_${userId}`)
}

/** Read a specific player's unlocks (empty object when none / no id). */
export function getPlayerUnlocks(userId: string | null): PlayerUnlocks {
  if (!userId) return {}
  return getKey<PlayerUnlocks>(unlocksKey(userId)) ?? {}
}

/** Patch a specific player's unlocks (parent sets this for a child). */
export function setPlayerUnlocks(userId: string, patch: Partial<PlayerUnlocks>): void {
  if (!userId) return
  const merged = { ...getPlayerUnlocks(userId), ...patch }
  setKey(unlocksKey(userId), merged)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLAYER_UNLOCKS_CHANGED))
  }
}

/** Whether the CURRENT player has the parent expressions unlock (used by the gate). */
export function isExpressionsUnlockedForCurrentUser(): boolean {
  return getPlayerUnlocks(getCurrentUserId()).expressions === true
}
