import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'

export interface VocabularyQuestion {
  word: string
  hebrew?: string
  translation?: string
  category: string
  options: string[]
  correct: number
  image?: string
  imageUrl?: string
}

export interface VocabularySessionReady {
  kind: 'ready'
  questions: VocabularyQuestion[]
  total: number
  /** When > 0, the session was restored mid-game — jump straight to this index. */
  resumeIndex: number
  /** Score carried from the resumed session. */
  resumeScore: number
}

export type VocabularySessionResult =
  | VocabularySessionReady
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
  shuffledQuestions: VocabularyQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getScopedQuestionPool(gameType: string): VocabularyQuestion[]
  smartQuestionSelection(pool: VocabularyQuestion[]): VocabularyQuestion[]
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: VocabularyQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
    selectedCategories?: string[]
  } | null
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
}

const LEGACY_GAME_CONTAINER_ID = 'vocabulary-game'

function getLearnedCount(): number {
  return Object.keys((window as any).app?.userProgress?.learnedWords ?? {}).length
}

export interface BeginOptions {
  /** Skip the saved-state check (used by reset). */
  fresh?: boolean
}

export function beginVocabularySession(opts: BeginOptions = {}): VocabularySessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext('vocabulary')

  // Attempt resume — only when caller didn't ask for a fresh session.
  if (!opts.fresh) {
    const saved = mgr.loadGameState?.('vocabulary')
    if (
      saved &&
      Array.isArray(saved.shuffledQuestions) &&
      saved.shuffledQuestions.length > 0 &&
      typeof saved.currentQuestionIndex === 'number' &&
      saved.currentQuestionIndex < saved.shuffledQuestions.length
    ) {
      mgr.currentGame = 'vocabulary'
      mgr.isResuming = true
      mgr.shuffledQuestions = saved.shuffledQuestions
      mgr.currentQuestionIndex = saved.currentQuestionIndex
      mgr.totalQuestions = saved.totalQuestions ?? saved.shuffledQuestions.length
      mgr.gameElapsedMs = saved.gameElapsedMs ?? 0
      mgr.gameSessionStartAt = Date.now()
      mgr.gameCoinHistoryStartIndex =
        (window as any).app?.userProgress?.coinHistory?.length ?? 0
      mgr.isGameActive = true
      const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.('vocabulary') ?? 0
      // Make sure the scoreManager reflects the resumed score (legacy does this
      // on resume so subsequent addPoints() builds on it).
      mgr.scoreManager?.resetScore('vocabulary')
      if (resumeScore > 0) mgr.scoreManager?.addPoints('vocabulary', resumeScore)
      if (mgr.lastPersistedScores) mgr.lastPersistedScores['vocabulary'] = resumeScore
      return {
        kind: 'ready',
        questions: saved.shuffledQuestions,
        total: mgr.totalQuestions,
        resumeIndex: saved.currentQuestionIndex,
        resumeScore,
      }
    }
  } else {
    // Reset path — wipe any stale save so the fresh session doesn't get
    // overwritten and re-resumed next time.
    mgr.deleteGameState?.('vocabulary')
  }

  // Reset session state (mirror gameLogic.js startGame for non-resume path).
  mgr.isResuming = false
  mgr.currentGame = 'vocabulary'
  mgr.currentQuestionIndex = 0
  mgr.scoreManager?.resetScore('vocabulary')
  if (mgr.lastPersistedScores) mgr.lastPersistedScores['vocabulary'] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex =
    (window as any).app?.userProgress?.coinHistory?.length ?? 0

  // V2 gating (mirrors gameLogic.js:2244–2257).
  let pool = mgr.getScopedQuestionPool('vocabulary') ?? []
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
  // Read the cap directly from settings each session so we don't drift from
  // user-visible state when something inside legacy mutates mgr.totalQuestions
  // (some game branches assign mgr.totalQuestions = shuffledQuestions.length).
  // settings.questionsPerGame is the slider value the user sees in /settings.
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

export function recordVocabularyAnswer(
  question: VocabularyQuestion,
  selectedIndex: number,
): AnswerOutcome {
  const mgr = getMgr()
  const isCorrect = selectedIndex === question.correct
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, 'vocabulary')

  if (isCorrect) {
    mgr.scoreManager?.addPoints('vocabulary', 10)
  }
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy already logs */
  }
  return { isCorrect, pointsAwarded: isCorrect ? 10 : 0 }
}

export interface FinishOptions {
  /**
   * Strip the legacy completion HTML that endGame injects into the hidden
   * `#vocabulary-game` container, so it never re-appears if the legacy DOM is
   * ever revealed again before Slice 4.4 retires it.
   */
  cleanupLegacyDom?: boolean
}

export function finishVocabularySession(opts: FinishOptions = {}): void {
  const mgr = getMgr()
  if (!mgr) return

  // endGame reads gameSessionStartAt for elapsed-time accounting; keep it set.
  Promise.resolve(mgr.endGame('vocabulary')).catch(() => {
    /* legacy already logs */
  })
  mgr.isGameActive = false

  if (opts.cleanupLegacyDom !== false) {
    const container = document.getElementById(LEGACY_GAME_CONTAINER_ID)
    container?.querySelector('.game-complete')?.remove()
  }
}

export function abortVocabularySession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
