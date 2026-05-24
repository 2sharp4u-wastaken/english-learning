import type { GameDefinition, GameUnlockEntry, ContinueTarget } from './types'
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
  return (window as any).gameRegistry ?? null
}

function getGameManager(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
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

/**
 * Determine the "continue" target — the most logical next game to play.
 * Returns null if no suggestion can be made.
 */
export function getContinueTarget(): ContinueTarget | null {
  const registry = getGameRegistry()
  if (!registry) return null

  const progress = getUserProgress()
  if (!progress) return null

  // Default to word-journey for new users
  const learnedCount = Object.keys(progress.learnedWords ?? {}).length
  if (learnedCount === 0) {
    return { gameId: 'word-journey', label: 'מסע המילים', icon: '🗺️' }
  }

  // If user has been playing, suggest word-journey to continue learning
  return { gameId: 'word-journey', label: 'מסע המילים', icon: '🗺️' }
}

/**
 * Launch a legacy game by type ID.
 */
export function launchGame(gameId: string): void {
  const mgr = getGameManager()
  if (!mgr) return
  // switchGame activates the legacy #${gameId}-game container, manages the
  // header, then invokes startGame internally. Calling startGame directly
  // leaves the legacy game DOM display:none so nothing renders.
  // Note: legacy performGameSwitch overwrites window.location.hash with
  // `#${gameId}` (its old hub-style routing). Restore the React Router
  // path so reloads / back-forward keep working.
  const reactHash = window.location.hash
  if (typeof mgr.switchGame === 'function') {
    mgr.switchGame(gameId)
  } else {
    mgr.startGame(gameId)
  }
  if (window.location.hash !== reactHash) {
    history.replaceState(null, '', reactHash)
  }
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
