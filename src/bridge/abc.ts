import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'

// Legacy data module — same one gameLogic.js imports. generateABCQuestions reads
// window.app.userProgress.wordMastery directly to filter mastered letters.
// @ts-expect-error — legacy .js import without a .d.ts
import { generateABCQuestions } from '../../data/abcData.js'

// ─── Question shape (mirrors data/abcData.js generators) ───────────────────────

export type ABCQuestionType =
  | 'match-case'
  | 'letter-sound'
  | 'identify-case'
  | 'say-letter'
  | 'alphabet-order'
  | 'word-picture'

export interface ABCQuestion {
  type: ABCQuestionType
  questionType: 'abc'
  /** Glyph shown in the big display: single letter, "Aa", or "?" (set in page). */
  letter: string
  letterUpper: string
  letterLower?: string
  letterBoth?: string
  phonetic: string
  /** match-case / identify-case only. */
  isUppercase?: boolean
  /** alphabet-order only. */
  askAfter?: boolean
  /** word-picture only. */
  displayWord?: string
  displayWordLower?: string
  emoji?: string
  /** Present on every type except say-letter (which has no options grid). */
  options?: string[]
  correct?: number
  category: string
  /** Single letter, used for `<letter>_abc` mastery tracking. */
  word: string
  instruction: string
  instructionEn: string
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface ABCSessionReady {
  kind: 'ready'
  questions: ABCQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

/** All 26 letters mastered (generateABCQuestions returned []) → congratulations. */
export interface ABCAllMastered {
  kind: 'all-mastered'
}

export type ABCSessionResult = ABCSessionReady | ABCAllMastered

interface LegacyScoreManager {
  resetScore(gameType: string): void
  addPoints(gameType: string, points: number): number
  getScore(gameType: string): number
}

interface LegacySpeechRecognizer {
  isRecording: boolean
  isSpeechRecognitionSupported(): boolean
  startRecording(): Promise<{ transcript: string; confidence: number }>
  stopRecording(): Promise<void>
}

interface LegacyGameManager {
  isGameActive: boolean
  isResuming: boolean
  currentGame: string | null
  currentQuestionIndex: number
  totalQuestions: number
  shuffledQuestions: ABCQuestion[]
  scoreManager: LegacyScoreManager
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    responseTime: number,
    gameType: string,
  ): void
  resetABCMastery?(): boolean
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: ABCQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
  } | null
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

function getSpeech(): LegacySpeechRecognizer | null {
  return (window as any).speechManager ?? null
}

const GAME_TYPE = 'abc'
/** Legacy ABC config (gameLogic.js:382) is a flat 20 per session, NOT the
 *  global questionsPerGame setting — 6 types × ~3 rounds for full variety. */
const ABC_QUESTION_COUNT = 20

export interface BeginOptions {
  fresh?: boolean
}

/**
 * Start (or resume) an ABC run. Fresh questions are mastery-driven: the legacy
 * generator filters out letters at mastery ≥ 0.8 and returns [] once all 26 are
 * mastered — surfaced here as `all-mastered` so the page shows congratulations.
 * Questions are pre-ordered by the generator for variety, so we never reshuffle.
 */
export function beginABCSession(opts: BeginOptions = {}): ABCSessionResult {
  const mgr = getMgr()
  setGameContext(GAME_TYPE)

  // Resume path — legacy gameLogic.js:1973 regenerates only when !isResuming.
  if (mgr && !opts.fresh) {
    const saved = mgr.loadGameState?.(GAME_TYPE)
    if (
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number' &&
      typeof saved.shuffledQuestions[saved.currentQuestionIndex]?.type === 'string'
    ) {
      const newTotal = Math.min(
        saved.totalQuestions ?? saved.shuffledQuestions.length,
        ABC_QUESTION_COUNT,
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
        const resumeScore =
          saved.score ?? mgr.scoreManager?.getScore?.(GAME_TYPE) ?? 0
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
    } else if (saved) {
      mgr.deleteGameState?.(GAME_TYPE)
    }
  } else if (mgr && opts.fresh) {
    mgr.deleteGameState?.(GAME_TYPE)
  }

  // Fresh: regenerate each game so mastery-based selection uses current levels.
  const fresh = (generateABCQuestions as (n: number) => ABCQuestion[])(
    ABC_QUESTION_COUNT,
  )

  if (fresh.length === 0) {
    if (mgr) mgr.isGameActive = false
    return { kind: 'all-mastered' }
  }

  const total = Math.min(ABC_QUESTION_COUNT, fresh.length)

  if (mgr) {
    mgr.isResuming = false
    mgr.currentGame = GAME_TYPE
    mgr.currentQuestionIndex = 0
    mgr.shuffledQuestions = fresh
    mgr.totalQuestions = total
    mgr.scoreManager?.resetScore(GAME_TYPE)
    if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
    mgr.gameElapsedMs = 0
    mgr.gameSessionStartAt = Date.now()
    mgr.gameCoinHistoryStartIndex =
      getApp()?.userProgress?.coinHistory?.length ?? 0
    mgr.isGameActive = true
  }

  return {
    kind: 'ready',
    questions: fresh.slice(0, total),
    total,
    resumeIndex: 0,
    resumeScore: 0,
  }
}

export interface ABCAnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/**
 * Record a multiple-choice answer (every type except say-letter). Tracks the
 * letter attempt for `<letter>_abc` mastery, awards 10 pts on correct, and
 * advances the index regardless of correctness (legacy abc-game.js:675/713).
 */
export function recordABCAnswer(
  question: ABCQuestion,
  selectedIndex: number,
): ABCAnswerOutcome {
  const isCorrect = selectedIndex === question.correct
  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  if (question.word && question.category) {
    mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, GAME_TYPE)
  }
  const pointsAwarded = isCorrect ? 10 : 0
  if (pointsAwarded > 0) mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy logs */
  }
  return { isCorrect, pointsAwarded }
}

export interface ABCSpeechOutcome extends ABCAnswerOutcome {
  transcript: string
}

/**
 * Score a say-letter recording. Lenient match (legacy abc-game.js:483): accept
 * if the transcript contains the phonetic OR the letter name, or is within a
 * Levenshtein distance of 2 of the phonetic. Same mastery + scoring + index
 * advance as a multiple-choice answer.
 */
export function recordABCSpeechAttempt(
  question: ABCQuestion,
  result: { transcript: string },
): ABCSpeechOutcome {
  const transcript = (result.transcript || '').toLowerCase().trim()
  const expectedPhonetic = (question.phonetic || '').toLowerCase()
  const expectedLetter = (question.letterUpper || '').toLowerCase()
  const isCorrect =
    !!transcript &&
    (transcript.includes(expectedPhonetic) ||
      transcript.includes(expectedLetter) ||
      expectedPhonetic.includes(transcript) ||
      levenshtein(transcript, expectedPhonetic) <= 2)

  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0, transcript }

  if (question.word && question.category) {
    mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, GAME_TYPE)
  }
  const pointsAwarded = isCorrect ? 10 : 0
  if (pointsAwarded > 0) mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy logs */
  }
  return { isCorrect, pointsAwarded, transcript }
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ─── Speech recognition (say-letter) ───────────────────────────────────────────

export function isSpeechRecognitionAvailable(): boolean {
  const sm = getSpeech()
  return !!sm && sm.isSpeechRecognitionSupported()
}

export function isCurrentlyRecording(): boolean {
  return !!getSpeech()?.isRecording
}

export async function startABCRecording(): Promise<{
  transcript: string
  confidence: number
}> {
  const sm = getSpeech()
  if (!sm) throw new Error('Speech recognition not available')
  return sm.startRecording()
}

export async function stopABCRecording(): Promise<void> {
  await getSpeech()?.stopRecording()
}

/**
 * Wipe all `<letter>_abc` mastery entries (legacy abc-game.js:756) so the next
 * fresh session re-includes every letter. Used by the all-mastered screen's
 * "start over" button.
 */
export function resetABCMastery(): void {
  getMgr()?.resetABCMastery?.()
}

export function finishABCSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortABCSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
