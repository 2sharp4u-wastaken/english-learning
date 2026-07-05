import { setGameContext, cancelSpeech } from './audio'
import { getApp as getEngineApp, getGameManager } from '../engine/instances'
import { getSettings } from './settings'
import { queuePendingUnlocks } from './games'
import {
  CORRECT_THRESHOLD,
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  startPronunciationRecording,
  stopPronunciationRecording,
  type PronunciationQuestion,
} from './pronunciation'
import { wordKey } from '../lib/wordKey'

// Practice reuses the Pronunciation mechanic (record → compare), so its question
// shape is identical. What differs is the *pool*: under the learning-flow redesign
// Practice is the dedicated review surface and draws from **Learned ∪ Due** words,
// with Due words first (see docs/learning-flow-redesign.md §5/§6). Legacy practice
// drew "struggling" words (mastery < 0.5) and never persisted the session — we keep
// the no-resume behaviour (gameLogic.js saveGameState/loadGameState special-case
// `practice`) and replace the pool with the redesign's Due-first Learned set.

export type PracticeQuestion = PronunciationQuestion

export interface PracticeSessionReady {
  kind: 'ready'
  questions: PracticeQuestion[]
  total: number
  /** How many of the questions are currently Due (front of the list). */
  dueCount: number
}

export type PracticeSessionResult =
  | PracticeSessionReady
  | { kind: 'learn-first'; learnedCount: number }

// Re-export the GAME_TYPE-agnostic speech helpers so the page imports one bridge.
export {
  CORRECT_THRESHOLD,
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  startPronunciationRecording,
  stopPronunciationRecording,
}

interface LegacyScoreManager {
  resetScore(gameType: string): void
  addPoints(gameType: string, points: number): number
  getScore(gameType: string): number
}

interface WordKey {
  word: string
  category: string
}

interface LegacyProgressManager {
  getDueWords(categories?: string[] | null): WordKey[]
  getWordsByStatus(status: string, categories?: string[] | null): WordKey[]
  getCompletedTopicCount?(): number
  checkAndUnlockGames(learnedCount: number, topicsDone: number, abcMastery: number): string[]
  getProgressData(): {
    learnedWords: Record<string, unknown>
    wordJourneyProgress: Record<string, unknown>
    gameUnlocks: Record<string, unknown>
  }
}

interface LegacyGameManager {
  isGameActive: boolean
  isResuming: boolean
  currentGame: string | null
  currentQuestionIndex: number
  totalQuestions: number
  shuffledQuestions: PracticeQuestion[]
  scoreManager: LegacyScoreManager
  progressManager?: LegacyProgressManager
  settings?: { gameUnlockOverride?: boolean } | null
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
  saveGameScoreToHistory?(gameType: string, value: number): void
  updateTotalScoreDisplay?(): void
  deleteGameState?(gameType: string): void
}

interface LegacySpeechRecognizer {
  comparePronunciation(
    target: string,
    spoken: string,
  ): { accuracy: number; feedback: string; audioFeedback: string }
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

function getApp(): any {
  return getEngineApp()
}

function getSpeech(): LegacySpeechRecognizer | null {
  return (window as any).speechManager ?? null
}

const GAME_TYPE = 'practice'

function key(word: string, category: string): string {
  return wordKey(word, category)
}

function getLearnedCount(): number {
  return Object.keys(getApp()?.userProgress?.learnedWords ?? {}).length
}

/** Full pronunciation-shaped question objects, keyed by `word_category`. */
function questionIndex(): Map<string, PracticeQuestion> {
  const pool = ((window as any).gameData?.pronunciation as PracticeQuestion[]) ?? []
  const map = new Map<string, PracticeQuestion>()
  for (const q of pool) {
    if (q?.word && q.category) map.set(key(q.word, q.category), q)
  }
  return map
}

/**
 * Start a Practice run. Pool = Due words first, then the rest of the child's
 * Learned words (Due is an overlay on Learned, so `getWordsByStatus('learned')`
 * already contains them — we front-load the Due ones). Capped at the
 * `questionsPerGame` setting. No resume (parity with legacy practice).
 * `gameUnlockOverride` (parent bypass) practices the entire pronunciation bank.
 */
export function beginPracticeSession(): PracticeSessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext(GAME_TYPE)
  mgr.deleteGameState?.(GAME_TYPE)

  const selected = getSettings().selectedCategories ?? []
  const cats = selected.length ? selected : null
  const byKey = questionIndex()

  let ordered: PracticeQuestion[] = []
  let dueCount = 0

  if (mgr.settings?.gameUnlockOverride) {
    // Parent bypass: practice the whole bank (filtered by selected categories).
    ordered = [...byKey.values()].filter((q) => !cats || cats.includes(q.category))
  } else {
    const pm = mgr.progressManager ?? getApp()?.progressManager
    const due = (pm?.getDueWords?.(cats) ?? []) as WordKey[]
    const learned = (pm?.getWordsByStatus?.('learned', cats) ?? []) as WordKey[]
    const dueSet = new Set(due.map((w) => key(w.word, w.category)))
    const rest = learned.filter((w) => !dueSet.has(key(w.word, w.category)))

    const toQuestions = (entries: WordKey[]) =>
      entries
        .map((w) => byKey.get(key(w.word, w.category)))
        .filter((q): q is PracticeQuestion => !!q)

    const dueQuestions = toQuestions(due)
    dueCount = dueQuestions.length
    ordered = [...dueQuestions, ...toQuestions(rest)]
  }

  if (ordered.length === 0) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

  const cap = getSettings().questionsPerGame || 10
  const total = Math.min(ordered.length, cap)
  const questions = ordered.slice(0, total)

  mgr.isResuming = false
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = 0
  mgr.shuffledQuestions = questions
  mgr.totalQuestions = total
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex = getApp()?.userProgress?.coinHistory?.length ?? 0
  mgr.isGameActive = true

  return {
    kind: 'ready',
    questions,
    total,
    dueCount: Math.min(dueCount, total),
  }
}

export interface PracticeOutcome {
  isCorrect: boolean
  accuracy: number
  pointsAwarded: number
  feedback: string
  audioFeedback: string
  transcript: string
}

/**
 * Mirrors the Pronunciation attempt path (point award = round(accuracy * 10) on
 * correct only; records the word attempt and advances regardless of correctness)
 * but does NOT persist a save-state — practice sessions are ephemeral.
 */
export function recordPracticeAttempt(
  question: PracticeQuestion,
  result: { transcript: string },
): PracticeOutcome {
  const sm = getSpeech()
  const transcript = result.transcript ?? ''
  const comparison = sm
    ? sm.comparePronunciation(question.word, transcript)
    : { accuracy: 0, feedback: '', audioFeedback: '' }
  const isCorrect = comparison.accuracy >= CORRECT_THRESHOLD
  const pointsAwarded = isCorrect ? Math.round(comparison.accuracy * 10) : 0

  const mgr = getMgr()
  if (mgr) {
    mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, GAME_TYPE)
    if (pointsAwarded > 0) mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
    mgr.currentQuestionIndex += 1
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

function abcMasteryPercent(): number {
  const wm = getApp()?.userProgress?.wordMastery ?? {}
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const mastered = [...letters].filter((l) => (wm[`${l}_abc`]?.masteryLevel ?? 0) >= 0.8).length
  return Math.round((mastered / 26) * 100)
}

export interface PracticeFinishResult {
  totalScore: number
  newlyUnlocked: string[]
}

/**
 * Self-contained finish (Memory / Word Journey precedent — never calls the
 * legacy DOM `endGame`, which special-cases practice with a custom no-scoring
 * completion screen that assumes legacy markup). Banks the session score into
 * history/totalPoints (reconciled against `lastPersistedScores` so a replay
 * can't double-count) and re-checks unlocks, since practicing can raise mastery
 * enough to unlock a consolidation-tier game.
 */
export function finishPracticeSession(): PracticeFinishResult {
  const mgr = getMgr()
  const app = getApp()
  if (!mgr) return { totalScore: 0, newlyUnlocked: [] }

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

export function abortPracticeSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
