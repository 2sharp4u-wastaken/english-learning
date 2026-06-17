import { setGameContext, cancelSpeech } from './audio'
import { getApp as getEngineApp, getGameManager } from '../engine/instances'
import { queuePendingUnlocks } from './games'

// ─── Word shape ──────────────────────────────────────────────────────────────

export interface WJWord {
  word: string
  hebrew: string
  translation: string
  category: string
  picture?: string
  imageUrl?: string
}

export type WJStageId =
  | 'discover'
  | 'listen-match'
  | 'spell-tiles'
  | 'say-word'
  | 'recall'

export interface WJListenMatchItem {
  word: WJWord
  options: WJWord[]
}

export interface WJSpellItem {
  word: WJWord
  tiles: string[]
}

export interface WordJourneyReady {
  kind: 'ready'
  words: WJWord[]
  /** Pre-built per-stage data so the page stays presentational. */
  listenMatch: WJListenMatchItem[]
  spell: WJSpellItem[]
  recall: WJWord[]
}

export type WordJourneyResult = WordJourneyReady | { kind: 'no-words' }

/**
 * Persisted mid-journey state so leaving and returning continues the same
 * journey instead of reshuffling a brand-new one (the reported "resets on
 * exit" bug). Stage-level granularity: the current stage restarts, earlier
 * stages stay done. The whole built session is stored so the words + per-stage
 * options stay identical on return.
 */
export interface WJSavedProgress {
  session: WordJourneyReady
  stageIndex: number
  score: number
  correct: number
  totalScored: number
  timestamp: number
}

export type WJStatus = 'new' | 'learning' | 'learned'

export interface WJSummaryEntry extends WJWord {
  status: WJStatus
}

export interface WJFinishResult {
  percentage: number
  newlyUnlocked: string[]
  summary: WJSummaryEntry[]
}

// ─── Legacy globals ──────────────────────────────────────────────────────────

interface LegacyScoreManager {
  resetScore(gameType: string): void
  addPoints(gameType: string, points: number): number
  getScore(gameType: string): number
}

interface LegacyProgressManager {
  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    gameType: string,
    responseTime?: number | null,
  ): void
  getWordStatus(word: string, category: string): WJStatus
  getCompletedTopicCount(): number
  checkAndUnlockGames(
    learnedCount: number,
    topicsDone: number,
    abcMastery: number,
  ): string[]
  getProgressData(): {
    learnedWords: Record<string, unknown>
    wordJourneyProgress: Record<string, unknown>
    gameUnlocks: Record<string, unknown>
  }
}

interface LegacyCoinManager {
  rewards: { completeActivity: number; perfectGame: number }
  awardCoins(amount: number, reason: string): void
  awardActivityComplete(): void
  awardPerfectGame(): void
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
  settings?: { learningPace?: string; gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  _wjReplayMode?: boolean
  getWordJourneyWords(): Array<{
    word: string
    translation?: string
    hebrew?: string
    category: string
    image?: string
    imageUrl?: string
  }>
  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    gameType: string,
    responseTime?: number | null,
  ): void
  saveGameScoreToHistory(gameType: string, percentage: number): void
  updateTotalScoreDisplay?(): void
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

function getApp(): any {
  return getEngineApp()
}

function getBank(): any[] {
  return ((window as any).vocabularyBank as any[]) ?? []
}

const GAME_TYPE = 'word-journey'

// Points per stage (parity with legacy word-journey-game.js).
export const POINTS = {
  listenMatch: 10,
  spell: 10,
  say: 10,
  recallPair: 5,
} as const

// ─── Word normalization + per-stage builders ─────────────────────────────────

function normalize(w: {
  word: string
  translation?: string
  hebrew?: string
  category: string
  image?: string
  imageUrl?: string
}): WJWord {
  return {
    word: w.word,
    hebrew: w.hebrew ?? w.translation ?? '',
    translation: w.translation ?? w.hebrew ?? '',
    category: w.category,
    picture: w.image,
    imageUrl: w.imageUrl,
  }
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

/** 4 picture options for listen-match: target + 3 distractors (parity w/ legacy). */
function buildOptions(target: WJWord, journeyWords: WJWord[]): WJWord[] {
  const bank = getBank()
  const selectDistractors = (window as any).selectDistractors as
    | ((w: string, mastery: number, bank: any[]) => string[])
    | undefined
  const wordMastery = getApp()?.userProgress?.wordMastery ?? {}
  const masteryLevel =
    wordMastery[`${target.word}_${target.category}`]?.masteryLevel ?? 0

  let distractors: WJWord[] = []
  if (selectDistractors) {
    const names = selectDistractors(target.word, masteryLevel, bank) ?? []
    distractors = names
      .map((n) => bank.find((b) => b.word?.toLowerCase() === n.toLowerCase()))
      .filter(Boolean)
      .map(normalize)
  }
  if (distractors.length < 3) {
    const used = new Set([target.word, ...distractors.map((d) => d.word)])
    distractors.push(
      ...shuffle(journeyWords.filter((w) => !used.has(w.word))).slice(
        0,
        3 - distractors.length,
      ),
    )
  }
  return shuffle([target, ...distractors.slice(0, 3)])
}

/** Letters of the word + a few distractor letters, shuffled (parity w/ legacy). */
function buildSpellTiles(word: string): string[] {
  const letters = word.toLowerCase().split('')
  const letterSet = new Set(letters)
  const distCount = word.length <= 5 ? 2 : 3
  const distractors = 'etaoinshrdlucmfwypgbvkjxqz'
    .split('')
    .filter((l) => !letterSet.has(l))
    .sort(() => Math.random() - 0.5)
    .slice(0, distCount)
  return shuffle([...letters, ...distractors])
}

function abcMasteryPercent(): number {
  const wm = getApp()?.userProgress?.wordMastery ?? {}
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const mastered = [...letters].filter(
    (l) => (wm[`${l}_abc`]?.masteryLevel ?? 0) >= 0.8,
  ).length
  return Math.round((mastered / 26) * 100)
}

// ─── Resume persistence ──────────────────────────────────────────────────────

const WJ_STAGE_COUNT = 5
const WJ_SAVE_TTL_MS = 24 * 60 * 60 * 1000 // parity with legacy loadGameState

function wjUserId(): string {
  return localStorage.getItem('currentUser') ?? 'default'
}

function wjSaveKey(): string {
  return `savedWJ_${wjUserId()}`
}

export function clearWJProgress(): void {
  try {
    localStorage.removeItem(wjSaveKey())
  } catch {
    /* ignore */
  }
}

/** Persist mid-journey state so re-entering resumes instead of reshuffling. */
export function saveWJProgress(p: Omit<WJSavedProgress, 'timestamp'>): void {
  if (!p.session || p.session.kind !== 'ready') return
  if (p.stageIndex < 0 || p.stageIndex >= WJ_STAGE_COUNT) return
  try {
    localStorage.setItem(wjSaveKey(), JSON.stringify({ ...p, timestamp: Date.now() }))
  } catch {
    /* quota — fall back to no-resume */
  }
}

/** Load a valid in-progress journey, or null (also clears stale/invalid state). */
export function loadWJProgress(): WJSavedProgress | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(wjSaveKey())
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as WJSavedProgress
    const ok =
      p?.session?.kind === 'ready' &&
      Array.isArray(p.session.words) &&
      p.session.words.length >= 3 &&
      typeof p.stageIndex === 'number' &&
      p.stageIndex >= 0 &&
      p.stageIndex < WJ_STAGE_COUNT &&
      typeof p.timestamp === 'number' &&
      Date.now() - p.timestamp <= WJ_SAVE_TTL_MS
    if (!ok) {
      clearWJProgress()
      return null
    }
    return p
  } catch {
    clearWJProgress()
    return null
  }
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * Start a fresh Word Journey. Clears any saved mid-journey state so a new run
 * begins clean. (Resume of an in-progress journey goes through
 * `resumeWordJourney` instead — see `loadWJProgress`.)
 */
export function beginWordJourney(): WordJourneyResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'no-words' }

  setGameContext(GAME_TYPE)
  mgr.deleteGameState?.(GAME_TYPE)
  clearWJProgress()

  const raw = mgr.getWordJourneyWords?.() ?? []
  const words = raw.map(normalize)
  if (words.length < 3) return { kind: 'no-words' }

  mgr.isResuming = false
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = 0
  mgr.shuffledQuestions = ['discover', 'listen-match', 'spell-tiles', 'say-word', 'recall']
  mgr.totalQuestions = 5
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex = getApp()?.userProgress?.coinHistory?.length ?? 0
  mgr.isGameActive = true

  return {
    kind: 'ready',
    words,
    listenMatch: shuffle(words).map((word) => ({
      word,
      options: buildOptions(word, words),
    })),
    spell: shuffle(words).map((word) => ({ word, tiles: buildSpellTiles(word.word) })),
    recall: words,
  }
}

/**
 * Re-establish legacy engine state for an in-progress journey loaded from
 * storage, WITHOUT reshuffling. Restores the saved score so finish-time
 * totalPoints reconciliation stays correct. Returns the saved session, or null
 * if the engine isn't available (caller should fall back to a fresh begin).
 */
export function resumeWordJourney(saved: WJSavedProgress): WordJourneyReady | null {
  const mgr = getMgr()
  if (!mgr) return null

  setGameContext(GAME_TYPE)
  mgr.deleteGameState?.(GAME_TYPE)
  mgr.isResuming = true
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = saved.stageIndex
  mgr.shuffledQuestions = ['discover', 'listen-match', 'spell-tiles', 'say-word', 'recall']
  mgr.totalQuestions = WJ_STAGE_COUNT
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (saved.score > 0) mgr.scoreManager?.addPoints(GAME_TYPE, saved.score)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex = getApp()?.userProgress?.coinHistory?.length ?? 0
  mgr.isGameActive = true

  return saved.session
}

/** Record one word attempt + award stage points on success. */
export function recordWJAttempt(
  word: WJWord,
  isCorrect: boolean,
  points: number,
): void {
  const mgr = getMgr()
  if (!mgr) return
  mgr.recordWordAttempt(word.word, word.category, isCorrect, GAME_TYPE, 0)
  if (isCorrect && points > 0) {
    mgr.scoreManager?.addPoints(GAME_TYPE, points)
  }
}

/** Current live status of a journey word (for the celebration summary). */
export function getWJStatus(word: WJWord): WJStatus {
  return getMgr()?.progressManager?.getWordStatus?.(word.word, word.category) ?? 'new'
}

export function isReplayMode(): boolean {
  return !!getMgr()?._wjReplayMode
}

export function setReplayMode(on: boolean): void {
  const mgr = getMgr()
  if (mgr) mgr._wjReplayMode = on
}

/**
 * Finish the journey. Replicates the essential legacy completion bookkeeping
 * (history, totalPoints reconciliation, coins, unlock re-check) but **does NOT**
 * batch-graduate words — under the redesign words graduate per-word via the
 * mastery recorded during the stages (see docs/learning-flow-redesign.md).
 * Returns the per-word summary + any games newly unlocked.
 */
export function finishWordJourney(
  words: WJWord[],
  correct: number,
  totalScored: number,
): WJFinishResult {
  const mgr = getMgr()
  const app = getApp()
  const replay = !!mgr?._wjReplayMode
  const percentage =
    totalScored > 0 ? Math.min(100, Math.round((correct / totalScored) * 100)) : 0

  const summary: WJSummaryEntry[] = words.map((w) => ({ ...w, status: getWJStatus(w) }))

  clearWJProgress()

  if (!mgr) return { percentage, newlyUnlocked: [], summary }

  mgr.deleteGameState?.(GAME_TYPE)

  const finalScore = mgr.scoreManager?.getScore(GAME_TYPE) ?? 0
  try {
    mgr.saveGameScoreToHistory?.(GAME_TYPE, percentage)
  } catch {
    /* legacy logs */
  }

  // totalPoints only on completion, reconciled so resume can't double-count.
  if (app?.userProgress) {
    const alreadyCounted = mgr.lastPersistedScores?.[GAME_TYPE] ?? 0
    const delta = Math.max(0, finalScore - alreadyCounted)
    if (delta > 0) {
      app.userProgress.totalPoints = (app.userProgress.totalPoints || 0) + delta
    }
    if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = finalScore
  }
  mgr.updateTotalScoreDisplay?.()

  // Coins (half in practice/replay mode — parity with legacy).
  const coins = mgr.coinManager
  if (coins) {
    if (replay) {
      coins.awardCoins(Math.floor(coins.rewards.completeActivity / 2), 'activity complete (practice)')
      if (percentage === 100) {
        coins.awardCoins(Math.floor(coins.rewards.perfectGame / 2), 'perfect game (practice)')
      }
    } else {
      coins.awardActivityComplete()
      if (percentage === 100) coins.awardPerfectGame()
    }
  }

  // Re-evaluate unlocks from the (now mastery-derived) counts. checkAndUnlockGames
  // computes introduced/learned internally; the passed learnedCount is ignored.
  let newlyUnlocked: string[] = []
  const pm = mgr.progressManager ?? app?.progressManager
  if (pm) {
    newlyUnlocked =
      pm.checkAndUnlockGames(0, pm.getCompletedTopicCount?.() ?? 0, abcMasteryPercent()) ?? []
    queuePendingUnlocks(newlyUnlocked) // surfaced by the modal on next Home view
    const data = pm.getProgressData()
    if (app?.userProgress) {
      app.userProgress.learnedWords = data.learnedWords
      app.userProgress.wordJourneyProgress = data.wordJourneyProgress
      app.userProgress.gameUnlocks = data.gameUnlocks
    }
  }
  app?.saveUserProgress?.()

  mgr.isGameActive = false
  return { percentage, newlyUnlocked, summary }
}

export function abortWordJourney(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
