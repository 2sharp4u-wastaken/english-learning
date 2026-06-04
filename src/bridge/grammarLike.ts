import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'
import { getSettings } from './settings'

/**
 * Shared "blank-fill" engine for focused grammar-practice games (Articles,
 * Progressive tenses, …). Mirrors `src/bridge/grammar.ts` but is parameterised
 * by game type + the `window.gameData` key it reads from, so one engine backs
 * many small games without duplicating the legacy gameManager plumbing.
 *
 * Each game type must be registered in `gameLogic.js` (no module — React owns
 * the UI) and seeded in the `gameUnlocks` defaults in `app.js`, exactly like
 * the other React games. Scoring / save-resume / coins / progress all flow
 * through the generic, game-type-keyed gameManager methods used here.
 */

export interface BlankFillQuestion {
  sentence: string
  hebrewSentence?: string
  emoji?: string
  options: string[]
  /** Hebrew gloss per option, same index order as `options`. */
  hebrewOptions?: string[]
  correct: number
  category?: string
  explanation?: string
  hebrewExplanation?: string
  difficulty?: string
}

export interface BlankFillSessionReady {
  kind: 'ready'
  questions: BlankFillQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type BlankFillSessionResult = BlankFillSessionReady

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
  shuffledQuestions: BlankFillQuestion[]
  scoreManager: LegacyScoreManager
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: BlankFillQuestion[]
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

function getBank(dataKey: string): BlankFillQuestion[] {
  return ((window as any).gameData?.[dataKey] as BlankFillQuestion[] | undefined) ?? []
}

function shuffle<T>(input: T[]): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginBlankFillSession(
  gameType: string,
  dataKey: string,
  opts: BeginOptions = {},
): BlankFillSessionResult {
  const mgr = getMgr()
  setGameContext(gameType)

  // Resume path — mirrors grammar.ts (only if the saved questions look valid).
  if (mgr && !opts.fresh) {
    const saved = mgr.loadGameState?.(gameType)
    const looksValid =
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number' &&
      typeof saved.shuffledQuestions[saved.currentQuestionIndex]?.options?.[0] === 'string'
    if (saved && looksValid) {
      const cap = getSettings().questionsPerGame || 10
      const newTotal = Math.min(
        saved.totalQuestions ?? saved.shuffledQuestions!.length,
        cap,
      )
      if (saved.currentQuestionIndex! >= newTotal) {
        mgr.deleteGameState?.(gameType)
      } else {
        mgr.currentGame = gameType
        mgr.isResuming = true
        mgr.shuffledQuestions = saved.shuffledQuestions!
        mgr.currentQuestionIndex = saved.currentQuestionIndex!
        mgr.totalQuestions = newTotal
        mgr.gameElapsedMs = saved.gameElapsedMs ?? 0
        mgr.gameSessionStartAt = Date.now()
        mgr.gameCoinHistoryStartIndex =
          getApp()?.userProgress?.coinHistory?.length ?? 0
        mgr.isGameActive = true
        const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.(gameType) ?? 0
        mgr.scoreManager?.resetScore(gameType)
        if (resumeScore > 0) mgr.scoreManager?.addPoints(gameType, resumeScore)
        if (mgr.lastPersistedScores) mgr.lastPersistedScores[gameType] = resumeScore
        return {
          kind: 'ready',
          questions: saved.shuffledQuestions!.slice(0, newTotal),
          total: newTotal,
          resumeIndex: saved.currentQuestionIndex!,
          resumeScore,
        }
      }
    } else if (saved) {
      mgr.deleteGameState?.(gameType)
    }
  } else if (mgr && opts.fresh) {
    mgr.deleteGameState?.(gameType)
  }

  // Fresh: shuffle the bank, then cap to questionsPerGame.
  const ordered = shuffle(getBank(dataKey))
  const cap = getSettings().questionsPerGame || 10
  const total = Math.min(ordered.length, cap)
  const questions = ordered.slice(0, total)

  if (mgr) {
    mgr.isResuming = false
    mgr.currentGame = gameType
    mgr.currentQuestionIndex = 0
    mgr.shuffledQuestions = ordered
    mgr.totalQuestions = total
    mgr.scoreManager?.resetScore(gameType)
    if (mgr.lastPersistedScores) mgr.lastPersistedScores[gameType] = 0
    mgr.gameElapsedMs = 0
    mgr.gameSessionStartAt = Date.now()
    mgr.gameCoinHistoryStartIndex =
      getApp()?.userProgress?.coinHistory?.length ?? 0
    mgr.isGameActive = true
  }

  return { kind: 'ready', questions, total, resumeIndex: 0, resumeScore: 0 }
}

export interface AnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/** 10 pts/correct; advances the index after every answer (correct or not). */
export function recordBlankFillAnswer(
  gameType: string,
  question: BlankFillQuestion,
  selected: string,
): AnswerOutcome {
  const correct = question.options[question.correct]
  const isCorrect = selected === correct
  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  const pointsAwarded = isCorrect ? 10 : 0
  if (pointsAwarded > 0) mgr.scoreManager?.addPoints(gameType, pointsAwarded)
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy logs */
  }
  return { isCorrect, pointsAwarded }
}

export function finishBlankFillSession(gameType: string): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(gameType)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortBlankFillSession(gameType: string): void {
  void gameType // accepted for call-site symmetry with the other lifecycle fns
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
