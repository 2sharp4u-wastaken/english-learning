import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'
import { getSettings } from './settings'
import { wordKey } from '../lib/wordKey'

export interface ReadingQuestion {
  /** Target word — legacy stores uppercase (see data/converters.js convertToReading). */
  word: string
  hebrew?: string
  /** Emoji fallback for the picture. */
  picture?: string
  imageUrl?: string
  phonics?: string
  /** Extra distractor letters appended to the bank. */
  extraLetters: string[]
  category: string
}

export interface ReadingSessionReady {
  kind: 'ready'
  questions: ReadingQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type ReadingSessionResult =
  | ReadingSessionReady
  | { kind: 'learn-first'; learnedCount: number }

interface LegacyScoreManager {
  resetScore(gameType: string): void
  addPoints(gameType: string, points: number): number
  getScore(gameType: string): number
}

interface LegacyGameManager {
  isGameActive: boolean
  isResuming: boolean
  currentGame: string | null
  currentQuestionIndex: number
  totalQuestions: number
  shuffledQuestions: ReadingQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getScopedQuestionPool(gameType: string): ReadingQuestion[]
  smartQuestionSelection(pool: ReadingQuestion[]): ReadingQuestion[]
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: ReadingQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
    selectedCategories?: string[]
  } | null
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

const LEGACY_GAME_CONTAINER_ID = 'reading-game'
const GAME_TYPE = 'reading'

function getLearnedCount(): number {
  return Object.keys(getApp()?.userProgress?.learnedWords ?? {}).length
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginReadingSession(opts: BeginOptions = {}): ReadingSessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext(GAME_TYPE)

  if (!opts.fresh) {
    const saved = mgr.loadGameState?.(GAME_TYPE)
    if (
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number'
    ) {
      const currentCap = getSettings().questionsPerGame || 10
      const newTotal = Math.min(
        saved.totalQuestions ?? saved.shuffledQuestions.length,
        currentCap,
      )
      if (saved.currentQuestionIndex >= newTotal) {
        mgr.deleteGameState?.(GAME_TYPE)
      } else {
        mgr.currentGame = GAME_TYPE
        mgr.isResuming = true
        mgr.shuffledQuestions = saved.shuffledQuestions
        mgr.currentQuestionIndex = saved.currentQuestionIndex
        mgr.totalQuestions = newTotal
        mgr.gameElapsedMs = saved.gameElapsedMs ?? 0
        mgr.gameSessionStartAt = Date.now()
        mgr.gameCoinHistoryStartIndex =
          getApp()?.userProgress?.coinHistory?.length ?? 0
        mgr.isGameActive = true
        const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.(GAME_TYPE) ?? 0
        mgr.scoreManager?.resetScore(GAME_TYPE)
        if (resumeScore > 0) mgr.scoreManager?.addPoints(GAME_TYPE, resumeScore)
        if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = resumeScore
        return {
          kind: 'ready',
          questions: saved.shuffledQuestions.slice(0, newTotal),
          total: newTotal,
          resumeIndex: saved.currentQuestionIndex,
          resumeScore,
        }
      }
    }
  } else {
    mgr.deleteGameState?.(GAME_TYPE)
  }

  mgr.isResuming = false
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = 0
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex =
    getApp()?.userProgress?.coinHistory?.length ?? 0

  // V2 gating mirrors gameLogic.js:2244–2257 — reading is in VOCAB_GATED_GAMES.
  let pool = mgr.getScopedQuestionPool(GAME_TYPE) ?? []
  if (!mgr.settings?.gameUnlockOverride) {
    const learned = mgr._getLearnedWordSet()
    pool = pool.filter((w) =>
      learned.has(wordKey(w.word, w.category)),
    )
  }
  if (pool.length < 4) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

  const shuffled = mgr.smartQuestionSelection(pool) ?? []
  mgr.shuffledQuestions = shuffled
  const settingsCap = getSettings().questionsPerGame || 10
  const total = Math.min(shuffled.length, settingsCap)
  mgr.totalQuestions = total
  mgr.isGameActive = true

  return {
    kind: 'ready',
    questions: shuffled.slice(0, total),
    total,
    resumeIndex: 0,
    resumeScore: 0,
  }
}

export interface AnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/**
 * Records the user's built-word submission against the target.
 *
 * Legacy reading-game.js awards `max(0, 10 - attempts)` for a correct answer;
 * on first-try correct that's 10. Subsequent wrong-then-correct cannot happen
 * here because the React page mirrors legacy behavior — a wrong answer
 * advances immediately (no retry to reach 10 points after a miss).
 */
export function recordReadingAnswer(
  question: ReadingQuestion,
  builtWord: string,
  attempts: number,
): AnswerOutcome {
  const mgr = getMgr()
  const isCorrect = builtWord === question.word
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, GAME_TYPE)

  const pointsAwarded = isCorrect ? Math.max(0, 10 - attempts) : 0
  if (pointsAwarded > 0) {
    mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
  }
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy already logs */
  }
  return { isCorrect, pointsAwarded }
}

export interface FinishOptions {
  cleanupLegacyDom?: boolean
}

export function finishReadingSession(opts: FinishOptions = {}): void {
  const mgr = getMgr()
  if (!mgr) return

  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy already logs */
  })
  mgr.isGameActive = false

  if (opts.cleanupLegacyDom !== false) {
    const container = document.getElementById(LEGACY_GAME_CONTAINER_ID)
    container?.querySelector('.game-complete')?.remove()
  }
}

export function abortReadingSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ── Per-question audio counters (persisted across refresh) ──────────────────

interface ReadingAudioState {
  questionIndex: number
  playsSoFar: number
  audioPlaysLeft: number
}

function audioKey(): string {
  const userId = localStorage.getItem('currentUser') || 'default'
  return `v2_reading_audio_${userId}`
}

export function loadReadingAudioState(forIndex: number): ReadingAudioState | null {
  try {
    const raw = localStorage.getItem(audioKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReadingAudioState
    if (parsed.questionIndex !== forIndex) return null
    return parsed
  } catch {
    return null
  }
}

export function saveReadingAudioState(state: ReadingAudioState): void {
  try {
    localStorage.setItem(audioKey(), JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearReadingAudioState(): void {
  try {
    localStorage.removeItem(audioKey())
  } catch {
    /* ignore */
  }
}
