import type { GameDefinition, GameUnlockEntry, ContinueTarget } from './types'
import { getApp, getGameManager as getEngineGameManager } from '../engine/instances'
import { gameRegistry } from '../engine/gameRegistry'
import { getUserProgress } from './progress'

// ─── Legacy global access ────────────────────────────────────────────────────

interface LegacyGameRegistry {
  getAllGames(): Array<{
    type: string
    displayName: string
    displayNameHebrew: string
    icon: string
    config: Record<string, unknown>
  }>
}

interface LegacyGameManager {
  currentGame: string | null
  startGame(gameType: string): void
  switchGame(gameType: string): void
  endGame(): void
}

function getGameRegistry(): LegacyGameRegistry | null {
  return gameRegistry as unknown as LegacyGameRegistry | null
}

function getGameManager(): LegacyGameManager | null {
  return getEngineGameManager() as unknown as LegacyGameManager | null
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * Get all registered game definitions.
 * Reads from the legacy GameRegistry global.
 */
export function getGameCatalog(): GameDefinition[] {
  const registry = getGameRegistry()
  if (!registry) return []

  return registry.getAllGames().map((g) => ({
    type: g.type,
    displayName: g.displayName,
    displayNameHebrew: g.displayNameHebrew,
    icon: g.icon,
    config: {
      questionsPerGame: (g.config.questionsPerGame as number) ?? 10,
      pointsPerCorrect: (g.config.pointsPerCorrect as number) ?? 10,
      categories: (g.config.categories as string[]) ?? [],
      skillLevel: (g.config.skillLevel as string) ?? undefined,
      timeLimit: (g.config.timeLimit as number | null) ?? null,
    },
  }))
}

/**
 * Get the unlock state for a specific game.
 */
export function getGameUnlockState(gameId: string): GameUnlockEntry | null {
  const progress = getUserProgress()
  return progress?.gameUnlocks?.[gameId] ?? null
}

/**
 * Get all game unlock states.
 */
export function getAllGameUnlocks(): Record<string, GameUnlockEntry> {
  const progress = getUserProgress()
  return progress?.gameUnlocks ?? {}
}

// Non-mic recognition/recall review games we rotate through for Due-word
// review, so the daily "review" nudge isn't always the same passive task.
const REVIEW_ROTATION = ['listening', 'picture-match', 'true-or-not', 'reading']
// Remember the last pick (per session) so we avoid immediate repeats.
let lastReviewPick: string | null = null

/**
 * Determine the "continue" target — the most logical next game to play.
 * Returns null if no suggestion can be made.
 */
export function getContinueTarget(): ContinueTarget | null {
  const registry = getGameRegistry()
  if (!registry) return null

  const progress = getUserProgress()
  if (!progress) return null

  // V3 (redesign §8): review words that are slipping (Due) → otherwise
  // introduce/strengthen via Word Journey. (Learning words are already surfaced
  // inside the review games, so they need no separate nudge.) When reviewing,
  // rotate among the unlocked review games rather than always opening Listening.
  const pm = getApp()?.progressManager
  const dueCount: number = pm?.getLifecycleCounts ? pm.getLifecycleCounts().due : 0
  if (dueCount > 0) {
    const unlocks = progress.gameUnlocks ?? {}
    // "Available" uses the SAME rule the home grid uses (`unlocked !== false`, so
    // an absent entry counts as open) — not `?.unlocked` truthiness. This keeps the
    // review-vs-Word-Journey decision aligned with what the cards show and removes a
    // class of in-memory-vs-persisted gameUnlocks mismatch (FU-HOME-continue).
    const open = REVIEW_ROTATION.filter((id) => (unlocks as any)[id]?.unlocked !== false)
    if (open.length > 0) {
      // Prefer a game other than last time so consecutive visits vary.
      const choices = open.length > 1 ? open.filter((id) => id !== lastReviewPick) : open
      const pool = choices.length > 0 ? choices : open
      const pick = pool[Math.floor(Math.random() * pool.length)]
      lastReviewPick = pick
      return { gameId: pick, label: 'תרגול מילים', icon: '🔁' }
    }
  }

  return { gameId: 'word-journey', label: 'מסע המילים', icon: '🗺️' }
}

/**
 * Fallback for an unrecognized game route. As of Slice 4.4 every catalog game
 * renders in React (see REACT_GAME_IDS) and the legacy game-UI layer (games/*.js +
 * gameLogic's DOM launch/render path) is gone, so this only fires for an unknown
 * gameId. There is nothing to launch — warn and let GameHostPage show its shell.
 */
export function launchGame(gameId: string): void {
  console.warn(
    `[bridge/games] launchGame('${gameId}') — no React game registered for this id; ` +
      `the legacy launch path was removed in Slice 4.4.`,
  )
}

/**
 * Exit the current legacy game and return to the hub.
 */
export function exitGame(): void {
  const mgr = getGameManager()
  if (mgr) {
    mgr.endGame()
  }
}

// ─── Newly-unlocked-games queue ──────────────────────────────────────────────
// Games unlocked at the moment a session completes are queued here, then shown
// in an animated modal the next time Home mounts (so the celebration happens on
// the home screen, not layered over the reward/celebration). Survives the
// /game → /home navigation via sessionStorage.

const PENDING_UNLOCKS_KEY = 'v3_pendingUnlocks'

/** Queue game IDs newly unlocked at completion (deduped, merged). */
export function queuePendingUnlocks(ids: string[]): void {
  if (!Array.isArray(ids) || ids.length === 0) return
  try {
    const cur = JSON.parse(sessionStorage.getItem(PENDING_UNLOCKS_KEY) || '[]')
    const merged = Array.from(new Set([...(Array.isArray(cur) ? cur : []), ...ids]))
    sessionStorage.setItem(PENDING_UNLOCKS_KEY, JSON.stringify(merged))
  } catch {
    /* sessionStorage unavailable — skip the celebration, no harm */
  }
}

/** Read and clear the queued newly-unlocked game IDs. */
export function takePendingUnlocks(): string[] {
  try {
    const raw = sessionStorage.getItem(PENDING_UNLOCKS_KEY)
    if (!raw) return []
    sessionStorage.removeItem(PENDING_UNLOCKS_KEY)
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}
