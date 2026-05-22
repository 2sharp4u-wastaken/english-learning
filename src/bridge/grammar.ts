import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'

// ─── Question shape (mirrors data/grammarQuestions.js) ─────────────────────

export interface GrammarQuestion {
  sentence: string
  hebrewSentence?: string
  options: string[]
  /** Hebrew gloss per option, same index order as `options`. Added 2026-05-23
   *  (Slice 3.10 polish) so the React grammar game can fill the Hebrew blank
   *  with the meaning of the correct answer and show bilingual option labels. */
  hebrewOptions?: string[]
  correct: number
  category: string
  explanation?: string
  hebrewExplanation?: string
  difficulty?: string
}

// ─── Session ────────────────────────────────────────────────────────────────

export interface GrammarSessionReady {
  kind: 'ready'
  questions: GrammarQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type GrammarSessionResult = GrammarSessionReady

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
  shuffledQuestions: GrammarQuestion[]
  scoreManager: LegacyScoreManager
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getFilteredGrammarQuestions?: () => GrammarQuestion[]
  smartQuestionSelection?: (qs: GrammarQuestion[]) => GrammarQuestion[]
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: GrammarQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
  } | null
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
}

const GAME_TYPE = 'grammar'

export interface BeginOptions {
  fresh?: boolean
}

export function beginGrammarSession(opts: BeginOptions = {}): GrammarSessionResult {
  const mgr = getMgr()
  setGameContext(GAME_TYPE)

  // Resume path — mirrors legacy gameLogic.js:2072 (only if questions look valid).
  if (mgr && !opts.fresh) {
    const saved = mgr.loadGameState?.(GAME_TYPE)
    const looksValid =
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number' &&
      typeof saved.shuffledQuestions[saved.currentQuestionIndex]?.options?.[0] === 'string'
    if (saved && looksValid) {
      const currentCap = getSettings().questionsPerGame || 10
      const newTotal = Math.min(
        saved.totalQuestions ?? saved.shuffledQuestions!.length,
        currentCap,
      )
      if (saved.currentQuestionIndex! >= newTotal) {
        mgr.deleteGameState?.(GAME_TYPE)
      } else {
        // Re-hydrate saved questions against current gameData.grammar — saves
        // written before `hebrewOptions` was added (2026-05-23) lack the
        // field, so look up the canonical entry by sentence text and merge.
        const current = ((window as any).gameData?.grammar as GrammarQuestion[] | undefined) ?? []
        const bySentence = new Map<string, GrammarQuestion>(
          current.map((q) => [q.sentence, q]),
        )
        const rehydrated = saved.shuffledQuestions!.map((sq) => {
          const fresh = bySentence.get(sq.sentence)
          return fresh ? { ...fresh, ...sq, hebrewOptions: sq.hebrewOptions ?? fresh.hebrewOptions } : sq
        })
        mgr.currentGame = GAME_TYPE
        mgr.isResuming = true
        mgr.shuffledQuestions = rehydrated
        mgr.currentQuestionIndex = saved.currentQuestionIndex!
        mgr.totalQuestions = newTotal
        mgr.gameElapsedMs = saved.gameElapsedMs ?? 0
        mgr.gameSessionStartAt = Date.now()
        mgr.gameCoinHistoryStartIndex =
          (window as any).app?.userProgress?.coinHistory?.length ?? 0
        mgr.isGameActive = true
        const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.(GAME_TYPE) ?? 0
        mgr.scoreManager?.resetScore(GAME_TYPE)
        if (resumeScore > 0) mgr.scoreManager?.addPoints(GAME_TYPE, resumeScore)
        if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = resumeScore
        return {
          kind: 'ready',
          questions: rehydrated.slice(0, newTotal),
          total: newTotal,
          resumeIndex: saved.currentQuestionIndex!,
          resumeScore,
        }
      }
    } else if (saved) {
      // Stale grammar-beginner-shape data — drop it.
      mgr.deleteGameState?.(GAME_TYPE)
    }
  } else if (mgr && opts.fresh) {
    mgr.deleteGameState?.(GAME_TYPE)
  }

  // Fresh: filter + smart-select via legacy helpers, then cap.
  const all =
    mgr?.getFilteredGrammarQuestions?.() ??
    ((window as any).gameData?.grammar as GrammarQuestion[] | undefined) ??
    []
  const ordered = mgr?.smartQuestionSelection
    ? mgr.smartQuestionSelection([...all])
    : [...all]
  const cap = getSettings().questionsPerGame || 10
  const total = Math.min(ordered.length, cap)
  const questions = ordered.slice(0, total)

  if (mgr) {
    mgr.isResuming = false
    mgr.currentGame = GAME_TYPE
    mgr.currentQuestionIndex = 0
    mgr.shuffledQuestions = ordered
    mgr.totalQuestions = total
    mgr.scoreManager?.resetScore(GAME_TYPE)
    if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
    mgr.gameElapsedMs = 0
    mgr.gameSessionStartAt = Date.now()
    mgr.gameCoinHistoryStartIndex =
      (window as any).app?.userProgress?.coinHistory?.length ?? 0
    mgr.isGameActive = true
  }

  return {
    kind: 'ready',
    questions,
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
 * Legacy grammar-game.js gives 10 pts/correct, advances index after every
 * answer (correct OR incorrect — lines 151 & 199).
 */
export function recordGrammarAnswer(
  question: GrammarQuestion,
  selected: string,
): AnswerOutcome {
  const correct = question.options[question.correct]
  const isCorrect = selected === correct
  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  const pointsAwarded = isCorrect ? 10 : 0
  if (pointsAwarded > 0) {
    mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
  }
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy logs */
  }
  return { isCorrect, pointsAwarded }
}

export function finishGrammarSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortGrammarSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

