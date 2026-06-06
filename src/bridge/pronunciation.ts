import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'
import { getSettings } from './settings'

// ─── Question shape (from data/converters.js convertToPronunciation) ────────

export interface PronunciationQuestion {
  word: string
  hebrew?: string
  phonetic?: string
  picture?: string
  imageUrl?: string
  category: string
  difficulty?: string
}

export interface PronunciationSessionReady {
  kind: 'ready'
  questions: PronunciationQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type PronunciationSessionResult =
  | PronunciationSessionReady
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
  shuffledQuestions: PronunciationQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getScopedQuestionPool(gameType: string): PronunciationQuestion[]
  smartQuestionSelection(pool: PronunciationQuestion[]): PronunciationQuestion[]
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    responseTime: number,
    gameType: string,
  ): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: PronunciationQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
  } | null
  deleteGameState(gameType: string): void
}

interface LegacySpeechRecognizer {
  isRecording: boolean
  isSpeechRecognitionSupported(): boolean
  startRecording(): Promise<{ transcript: string; confidence: number }>
  stopRecording(): Promise<void>
  comparePronunciation(
    target: string,
    spoken: string,
  ): { accuracy: number; feedback: string; audioFeedback: string }
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

function getSpeech(): LegacySpeechRecognizer | null {
  return (window as any).speechManager ?? null
}

const GAME_TYPE = 'pronunciation'
// Legacy threshold (gameLogic.js:2214): correct answer is accuracy >= 0.7.
export const CORRECT_THRESHOLD = 0.7

function getLearnedCount(): number {
  return Object.keys(getApp()?.userProgress?.learnedWords ?? {}).length
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginPronunciationSession(
  opts: BeginOptions = {},
): PronunciationSessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext(GAME_TYPE)

  if (!opts.fresh) {
    const saved = mgr.loadGameState?.(GAME_TYPE)
    if (
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number' &&
      typeof saved.shuffledQuestions[saved.currentQuestionIndex]?.word === 'string'
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

  // V2 gating (mirrors gameLogic.js:2212 — pronunciation is in VOCAB_GATED_GAMES).
  let pool = mgr.getScopedQuestionPool(GAME_TYPE) ?? []
  if (!mgr.settings?.gameUnlockOverride) {
    const learned = mgr._getLearnedWordSet()
    pool = pool.filter((w) =>
      learned.has(`${w.word?.toLowerCase()}_${w.category}`),
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

export interface PronunciationOutcome {
  isCorrect: boolean
  accuracy: number
  pointsAwarded: number
  feedback: string
  audioFeedback: string
  transcript: string
}

/**
 * Mirrors legacy `processPronunciationResult` (games/pronunciation-game.js):
 * - point award = round(accuracy * 10), only on correct answers (>= 0.7)
 * - records word attempt and advances index regardless of correctness
 * - persists immediately so a retry exploit cannot grant extra points
 */
export function recordPronunciationAttempt(
  question: PronunciationQuestion,
  result: { transcript: string },
): PronunciationOutcome {
  const sm = getSpeech()
  const transcript = result.transcript ?? ''
  const comparison = sm
    ? sm.comparePronunciation(question.word, transcript)
    : { accuracy: 0, feedback: '', audioFeedback: '' }
  const isCorrect = comparison.accuracy >= CORRECT_THRESHOLD
  const pointsAwarded = isCorrect ? Math.round(comparison.accuracy * 10) : 0

  const mgr = getMgr()
  if (mgr) {
    mgr.recordWordAttempt(
      question.word,
      question.category,
      isCorrect,
      0,
      GAME_TYPE,
    )
    if (pointsAwarded > 0) {
      mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
    }
    mgr.currentQuestionIndex += 1
    try {
      mgr.saveGameState()
    } catch {
      /* legacy logs */
    }
  }

  return {
    isCorrect,
    accuracy: comparison.accuracy,
    pointsAwarded,
    feedback: comparison.feedback,
    audioFeedback: comparison.audioFeedback,
    transcript,
  }
}

/**
 * Map numeral tokens the recognizer returns to their English words, so a spoken
 * "nineteen" (which Chrome transcribes as "19") matches a target word like
 * "nineteen". Mirrors the legacy SpeechManager.normalizeSpokenText used by
 * comparePronunciation — needed separately here for callers that do their own
 * comparison (Word Journey's say-word stage). Token-wise so "the 19" also works.
 */
const NUMERAL_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven',
  '12': 'twelve', '13': 'thirteen', '14': 'fourteen', '15': 'fifteen', '16': 'sixteen',
  '17': 'seventeen', '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
  '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy', '80': 'eighty',
  '90': 'ninety', '100': 'hundred', '1000': 'thousand',
}

export function normalizeSpokenNumerals(text: string): string {
  return text
    .split(/\s+/)
    .map((t) => NUMERAL_WORDS[t] ?? t)
    .join(' ')
}

export function isSpeechRecognitionAvailable(): boolean {
  const sm = getSpeech()
  return !!sm && sm.isSpeechRecognitionSupported()
}

export function isCurrentlyRecording(): boolean {
  return !!getSpeech()?.isRecording
}

export async function startPronunciationRecording(): Promise<{
  transcript: string
  confidence: number
}> {
  const sm = getSpeech()
  if (!sm) throw new Error('Speech recognition not available')
  return sm.startRecording()
}

export async function stopPronunciationRecording(): Promise<void> {
  const sm = getSpeech()
  if (!sm) return
  await sm.stopRecording()
}

export function finishPronunciationSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortPronunciationSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
