import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'

// Legacy data module — generatePhonicsQuestions reads
// window.app.userProgress.wordMastery directly to filter mastered sounds.
// @ts-expect-error — legacy .js import without a .d.ts
import { generatePhonicsQuestions } from '../../data/phonicsData.js'

// ─── Question shape (mirrors data/phonicsData.js generators) ───────────────────

export type PhonicsQuestionType = 'hear-pick-word' | 'see-pick-sound' | 'say-sound'

export interface PhonicsOption {
  /** hear-pick-word: a picture-word option. */
  word?: string
  emoji?: string
  /** see-pick-sound: a sound-label option + Hebrew gloss. */
  label?: string
  sublabel?: string
}

export interface PhonicsQuestion {
  type: PhonicsQuestionType
  questionType: 'phonics'
  /** The sound key, also the displayed grapheme + mastery base. */
  sound: string
  display: string
  hebrewSound: string
  /** Word voiced for this question (lowercase, TTS-safe). */
  sayWord: string
  /** Word shown alongside the prompt (original case) — not on hear-pick-word. */
  promptWord?: string
  /** Emoji for the prompt (see/say) or the correct option (hear). */
  emoji?: string
  /** Present on MC types (hear-pick-word, see-pick-sound). */
  options?: PhonicsOption[]
  correct?: number
  category: string
  /** Equals `sound`; used for `<sound>_phonics` mastery tracking. */
  word: string
  instruction: string
  instructionEn: string
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface PhonicsSessionReady {
  kind: 'ready'
  questions: PhonicsQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

/** All sounds mastered (generator returned []) → congratulations. */
export interface PhonicsAllMastered {
  kind: 'all-mastered'
}

export type PhonicsSessionResult = PhonicsSessionReady | PhonicsAllMastered

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
  shuffledQuestions: PhonicsQuestion[]
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
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: PhonicsQuestion[]
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

const GAME_TYPE = 'phonics'
/** Flat per-session count (like ABC's 20) — sized for 3 subtypes × ~5 sounds. */
const PHONICS_QUESTION_COUNT = 15

export interface BeginOptions {
  fresh?: boolean
}

/**
 * Start (or resume) a Phonics run. Fresh questions are mastery-driven: the
 * generator filters out sounds at mastery ≥ 0.8 and returns [] once all sounds
 * are mastered — surfaced here as `all-mastered` so the page shows congrats.
 * Questions are pre-ordered for variety, so we never reshuffle. Resume mirrors
 * the ABC bridge.
 */
export function beginPhonicsSession(opts: BeginOptions = {}): PhonicsSessionResult {
  const mgr = getMgr()
  setGameContext(GAME_TYPE)

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
        PHONICS_QUESTION_COUNT,
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
    } else if (saved) {
      mgr.deleteGameState?.(GAME_TYPE)
    }
  } else if (mgr && opts.fresh) {
    mgr.deleteGameState?.(GAME_TYPE)
  }

  const fresh = (generatePhonicsQuestions as (n: number) => PhonicsQuestion[])(
    PHONICS_QUESTION_COUNT,
  )

  if (fresh.length === 0) {
    if (mgr) mgr.isGameActive = false
    return { kind: 'all-mastered' }
  }

  const total = Math.min(PHONICS_QUESTION_COUNT, fresh.length)

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

export interface PhonicsAnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/**
 * Record a multiple-choice answer (hear-pick-word / see-pick-sound). Tracks the
 * sound attempt for `<sound>_phonics` mastery, awards 10 pts on correct, and
 * advances the index regardless of correctness (ABC parity).
 */
export function recordPhonicsAnswer(
  question: PhonicsQuestion,
  selectedIndex: number,
): PhonicsAnswerOutcome {
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

export interface PhonicsSpeechOutcome extends PhonicsAnswerOutcome {
  transcript: string
}

/**
 * Score a say-sound recording. Lenient match (ABC say-letter parity): accept if
 * the transcript contains the target word, the target contains the transcript,
 * or the two are within a Levenshtein distance of 2. Same mastery + scoring +
 * index advance as a multiple-choice answer.
 */
export function recordPhonicsSpeechAttempt(
  question: PhonicsQuestion,
  result: { transcript: string },
): PhonicsSpeechOutcome {
  const transcript = (result.transcript || '').toLowerCase().trim()
  const expected = (question.sayWord || '').toLowerCase()
  const isCorrect =
    !!transcript &&
    !!expected &&
    (transcript.includes(expected) ||
      expected.includes(transcript) ||
      levenshtein(transcript, expected) <= 2)

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

// ─── Speech recognition (say-sound) — re-uses the shared speechManager ─────────

export function isSpeechRecognitionAvailable(): boolean {
  const sm = getSpeech()
  return !!sm && sm.isSpeechRecognitionSupported()
}

export function isCurrentlyRecording(): boolean {
  return !!getSpeech()?.isRecording
}

export async function startPhonicsRecording(): Promise<{
  transcript: string
  confidence: number
}> {
  const sm = getSpeech()
  if (!sm) throw new Error('Speech recognition not available')
  return sm.startRecording()
}

export async function stopPhonicsRecording(): Promise<void> {
  await getSpeech()?.stopRecording()
}

/**
 * Wipe all `<sound>_phonics` mastery entries so the next fresh session
 * re-includes every sound. Used by the all-mastered screen's "start over". The
 * legacy gameManager has no phonics-specific reset (this game is React-only), so
 * we edit wordMastery directly through the app object and persist — staying
 * inside the bridge layer (the only place allowed to touch legacy state).
 */
export function resetPhonicsMastery(): void {
  const app = getApp()
  const wm = app?.userProgress?.wordMastery
  if (!wm) return
  for (const key of Object.keys(wm)) {
    if (key.endsWith('_phonics')) delete wm[key]
  }
  app?.saveUserProgress?.()
}

export function finishPhonicsSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortPhonicsSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
