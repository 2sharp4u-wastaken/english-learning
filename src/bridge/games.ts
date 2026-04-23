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
  if (mgr) {
    mgr.startGame(gameId)
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
