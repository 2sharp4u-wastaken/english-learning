import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'
import { queuePendingUnlocks } from './games'

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface MemoryWord {
  word: string
  hebrew: string
  translation: string
  category: string
  /** Emoji/icon shown on the card (only when it looks like an emoji, not a URL). */
  visual?: string
}

export interface MemoryCard {
  id: string
  pairId: number
  type: 'word' | 'translation'
  /** What the card face shows (English word or Hebrew translation). */
  content: string
  word: MemoryWord
}

export interface MemoryLevelConfig {
  level: number
  pairs: number
  columns: number
  /** Time limit (seconds) under which a 4th "speed" star is awarded. */
  speedThresholdSeconds: number
}

/** 3 fixed levels — parity with legacy memory-game.js levelConfigs. */
export const MEMORY_LEVELS: MemoryLevelConfig[] = [
  { level: 1, pairs: 6, columns: 4, speedThresholdSeconds: 45 },
  { level: 2, pairs: 9, columns: 6, speedThresholdSeconds: 75 },
  { level: 3, pairs: 12, columns: 8, speedThresholdSeconds: 110 },
]

/** Minimum introduced words to play level 1 (needs 6 pairs). */
export const MEMORY_MIN_WORDS = 6

export interface MemorySessionReady {
  kind: 'ready'
  pool: MemoryWord[]
  levels: MemoryLevelConfig[]
}

export type MemorySessionResult =
  | MemorySessionReady
  | { kind: 'learn-first'; introducedCount: number }

export interface MemoryLevelMetrics {
  /** Points earned this level (combo + first-try bonuses included). */
  score: number
  stars: number
  mistakes: number
  accuracyPct: number
  maxCombo: number
  timeSeconds: number
  coins: number
  isNewBest: boolean
}

export interface MemoryPersonalBest {
  score: number
  timeSeconds: number | null
  moves: number
  stars: number
  maxCombo: number
  date: string
}

export interface MemoryGameResult {
  totalScore: number
  newlyUnlocked: string[]
}

// ─── Scoring constants (parity with legacy handleMatch / awardLevelRewards) ────

export const MEMORY_POINTS = {
  base: 10,
  /** comboBonus = comboMultiplier * currentCombo when combo >= 2. */
  comboMultiplier: 5,
  firstTryBonus: 10,
} as const

// ─── Legacy globals ────────────────────────────────────────────────────────────

interface LegacyScoreManager {
  resetScore(gameType: string): void
  addPoints(gameType: string, points: number): number
  getScore(gameType: string): number
}

interface LegacyProgressManager {
  getCompletedTopicCount?(): number
  checkAndUnlockGames(learnedCount: number, topicsDone: number, abcMastery: number): string[]
  getProgressData(): {
    learnedWords: Record<string, unknown>
    wordJourneyProgress: Record<string, unknown>
    gameUnlocks: Record<string, unknown>
  }
}

interface LegacyCoinManager {
  awardCoins(amount: number, reason: string): void
}

interface LegacyGameManager {
  isGameActive: boolean
  isResuming: boolean
  currentGame: string | null
  currentQuestionIndex: number
  totalQuestions: number
  shuffledQuestions: unknown[]
  scoreManager: LegacyScoreManager
  coinManager?: LegacyCoinManager
  progressManager?: LegacyProgressManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    responseTime: number,
    gameType: string,
  ): void
  saveGameScoreToHistory?(gameType: string, value: number): void
  updateTotalScoreDisplay?(): void
  deleteGameState?(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
}

function getApp(): any {
  return (window as any).app ?? null
}

function getBank(): any[] {
  return ((window as any).vocabularyBank as any[]) ?? []
}

const GAME_TYPE = 'memory'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentUserId(): string {
  try {
    const svc = (window as any).authService
    const id = svc?.getCurrentUserId?.()
    if (id) return id
  } catch {
    /* ignore */
  }
  return localStorage.getItem('currentUser') || 'default'
}

/** Only treat an `image` field as a card emoji when it isn't a path/URL. */
function asEmoji(image: unknown): string | undefined {
  if (typeof image !== 'string') return undefined
  const trimmed = image.trim()
  if (!trimmed || trimmed.includes('/') || trimmed.includes('.') || trimmed.length > 6) {
    return undefined
  }
  return trimmed
}

function normalize(w: any): MemoryWord {
  const hebrew = String(w.hebrew ?? w.translation ?? '').trim()
  return {
    word: String(w.word ?? '').trim(),
    hebrew,
    translation: String(w.translation ?? w.hebrew ?? '').trim() || hebrew,
    category: String(w.category ?? '').trim(),
    visual: asEmoji(w.image ?? w.picture ?? w.icon ?? w.emoji),
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Daily Challenge: deterministic per-day, per-level word selection ───────────
// Mirrors legacy getDailySeed/seededSelectPairs so scores are comparable across
// kids on the same day.

function dailySeed(levelIndex: number): number {
  try {
    const today = new Date()
    const key = [
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate(),
      'L',
      levelIndex + 1,
    ].join('-')
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
    return hash || 1
  } catch {
    return Math.floor(Math.random() * 0xffffffff) || 1
  }
}

function seededRandom(seed: number): () => number {
  let x = seed || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 0xffffffff
  }
}

function seededSelectPairs(pool: MemoryWord[], count: number, seed: number): MemoryWord[] {
  const arr = [...pool]
  const rand = seededRandom(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.max(0, count))
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * Start a Memory run. Pool = *introduced* words (the words the child has met),
 * gated on introduced count — divergence from legacy (which used the full bank).
 * Aligns Memory with the learning-flow redesign. No mid-run resume (each entry
 * starts at level 1), following the Word Journey precedent.
 */
export function beginMemory(): MemorySessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', introducedCount: 0 }

  setGameContext(GAME_TYPE)
  mgr.deleteGameState?.(GAME_TYPE)

  const selected = getSettings().selectedCategories ?? []
  let pool = getBank()
    .filter((w) => !selected.length || selected.includes(w.category))
    .map(normalize)
    .filter((w) => w.word && w.word !== '—' && w.translation)

  if (!mgr.settings?.gameUnlockOverride) {
    const introduced = mgr._getLearnedWordSet()
    pool = pool.filter((w) => introduced.has(`${w.word.toLowerCase()}_${w.category}`))
  }

  if (pool.length < MEMORY_MIN_WORDS) {
    mgr.isGameActive = false
    return { kind: 'learn-first', introducedCount: pool.length }
  }

  mgr.isResuming = false
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = 0
  mgr.shuffledQuestions = MEMORY_LEVELS.map((l) => ({ ...l }))
  mgr.totalQuestions = MEMORY_LEVELS.length
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex = getApp()?.userProgress?.coinHistory?.length ?? 0
  mgr.isGameActive = true

  return { kind: 'ready', pool, levels: MEMORY_LEVELS.map((l) => ({ ...l })) }
}

/** Build the shuffled card deck for a level (daily-seeded pair selection). */
export function buildLevelCards(pool: MemoryWord[], levelIndex: number): MemoryCard[] {
  const config = MEMORY_LEVELS[levelIndex]
  if (!config) return []
  const pairCount = Math.min(config.pairs, pool.length)
  const words = seededSelectPairs(pool, pairCount, dailySeed(levelIndex))

  const cards: MemoryCard[] = []
  words.forEach((w, index) => {
    cards.push({ id: `word-${index}`, pairId: index, type: 'word', content: w.word, word: w })
    cards.push({
      id: `translation-${index}`,
      pairId: index,
      type: 'translation',
      content: w.hebrew || w.translation,
      word: w,
    })
  })
  return shuffle(cards)
}

/** Record a found pair as a correct attempt (so it feeds mastery / practice). */
export function recordMemoryMatch(word: MemoryWord): void {
  getMgr()?.recordWordAttempt(word.word, word.category, true, 0, GAME_TYPE)
}

/** Record both word-cards of a mismatch as incorrect attempts (parity). */
export function recordMemoryMismatch(a: MemoryCard, b: MemoryCard): void {
  const mgr = getMgr()
  if (!mgr) return
  for (const c of [a, b]) {
    if (c.type === 'word' && c.word.word && c.word.category) {
      mgr.recordWordAttempt(c.word.word, c.word.category, false, 0, GAME_TYPE)
    }
  }
}

// ── Personal best ──────────────────────────────────────────────────────────────

function pbKey(): string {
  return `memoryBest_${currentUserId()}`
}

export function loadMemoryBests(): Record<string, MemoryPersonalBest> {
  try {
    const raw = localStorage.getItem(pbKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveMemoryBests(all: Record<string, MemoryPersonalBest>): void {
  try {
    localStorage.setItem(pbKey(), JSON.stringify(all))
  } catch {
    /* never crash the game on storage failure */
  }
}

function isBetter(prev: MemoryPersonalBest | undefined, next: MemoryPersonalBest): boolean {
  if (!prev) return true
  if (next.score !== prev.score) return next.score > prev.score
  if (next.timeSeconds != null && prev.timeSeconds != null) {
    if (next.timeSeconds !== prev.timeSeconds) return next.timeSeconds < prev.timeSeconds
  }
  if (next.moves !== prev.moves) return next.moves < prev.moves
  return false
}

// ── Level + game completion ─────────────────────────────────────────────────────

/**
 * Finish one level: compute stars (mistakes + speed), award coins, update the
 * per-level personal best, and bank the level score into the cumulative
 * `memory` score. Returns the metrics for the level summary screen.
 */
export function finishMemoryLevel(
  levelIndex: number,
  moves: number,
  timeSeconds: number,
  levelScore: number,
  maxCombo: number,
): MemoryLevelMetrics {
  const mgr = getMgr()
  const config = MEMORY_LEVELS[levelIndex]
  const totalPairs = config?.pairs ?? 0

  const mistakes = Math.max(0, moves - totalPairs)
  const accuracyPct =
    totalPairs > 0 ? Math.round(Math.min(1, totalPairs / Math.max(moves, totalPairs)) * 100) : 0

  // Generous thresholds for kids — completion always earns at least 1 star.
  let stars =
    mistakes <= Math.ceil(totalPairs * 0.3) ? 3 : mistakes <= Math.ceil(totalPairs * 0.6) ? 2 : 1
  const speedThreshold = config?.speedThresholdSeconds
  if (speedThreshold && timeSeconds <= speedThreshold && stars >= 2) stars = Math.max(stars, 4)

  // Coins (parity with awardLevelRewards).
  const levelNum = config?.level ?? levelIndex + 1
  let coins = levelNum * 5 + totalPairs * 2
  coins += stars >= 3 ? 15 : stars === 2 ? 8 : 3
  if (maxCombo >= 3) coins += 5
  mgr?.coinManager?.awardCoins(coins, `memory level ${levelNum}`)

  // Bank level score into cumulative memory score.
  mgr?.scoreManager?.addPoints(GAME_TYPE, levelScore)

  // Personal best.
  const levelKey = String(levelNum)
  const all = loadMemoryBests()
  const candidate: MemoryPersonalBest = {
    score: levelScore,
    timeSeconds,
    moves,
    stars,
    maxCombo,
    date: new Date().toISOString().slice(0, 10),
  }
  const isNewBest = isBetter(all[levelKey], candidate)
  if (isNewBest) {
    all[levelKey] = candidate
    saveMemoryBests(all)
  }

  return { score: levelScore, stars, mistakes, accuracyPct, maxCombo, timeSeconds, coins, isNewBest }
}

/**
 * Finish the whole run (after level 3). Persists history + totalPoints
 * (reconciled so a replay can't double-count), then re-checks unlocks. Mirrors
 * the legacy memory `handleGameComplete` last-level branch + the Word Journey
 * self-contained finish — never calls legacy `endGame`.
 */
export function finishMemoryGame(): MemoryGameResult {
  const mgr = getMgr()
  const app = getApp()
  if (!mgr) return { totalScore: 0, newlyUnlocked: [] }

  mgr.deleteGameState?.(GAME_TYPE)
  const totalScore = mgr.scoreManager?.getScore(GAME_TYPE) ?? 0

  try {
    app?.updateProgress?.(GAME_TYPE, totalScore)
  } catch {
    /* legacy logs */
  }
  try {
    mgr.saveGameScoreToHistory?.(GAME_TYPE, totalScore)
  } catch {
    /* legacy logs */
  }

  if (app?.userProgress) {
    const alreadyCounted = mgr.lastPersistedScores?.[GAME_TYPE] ?? 0
    const delta = Math.max(0, totalScore - alreadyCounted)
    if (delta > 0) {
      app.userProgress.totalPoints = (app.userProgress.totalPoints || 0) + delta
    }
    if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = totalScore
  }
  mgr.updateTotalScoreDisplay?.()

  let newlyUnlocked: string[] = []
  const pm = mgr.progressManager ?? app?.progressManager
  if (pm) {
    newlyUnlocked =
      pm.checkAndUnlockGames(0, pm.getCompletedTopicCount?.() ?? 0, abcMasteryPercent()) ?? []
    queuePendingUnlocks(newlyUnlocked)
    const data = pm.getProgressData()
    if (app?.userProgress) {
      app.userProgress.learnedWords = data.learnedWords
      app.userProgress.wordJourneyProgress = data.wordJourneyProgress
      app.userProgress.gameUnlocks = data.gameUnlocks
    }
  }
  app?.saveUserProgress?.()

  mgr.isGameActive = false
  return { totalScore, newlyUnlocked }
}

function abcMasteryPercent(): number {
  const wm = getApp()?.userProgress?.wordMastery ?? {}
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const mastered = [...letters].filter((l) => (wm[`${l}_abc`]?.masteryLevel ?? 0) >= 0.8).length
  return Math.round((mastered / 26) * 100)
}

export function abortMemory(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
