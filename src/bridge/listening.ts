import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'

export interface ListeningQuestion {
  word: string
  hebrew?: string
  translation?: string
  category: string
  options: string[]
  correct: number
  picture?: string
  image?: string
  imageUrl?: string
}

export interface ListeningSessionReady {
  kind: 'ready'
  questions: ListeningQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type ListeningSessionResult =
  | ListeningSessionReady
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
  shuffledQuestions: ListeningQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getScopedQuestionPool(gameType: string): ListeningQuestion[]
  smartQuestionSelection(pool: ListeningQuestion[]): ListeningQuestion[]
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: ListeningQuestion[]
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

const LEGACY_GAME_CONTAINER_ID = 'listening-game'

function getLearnedCount(): number {
  return Object.keys((window as any).app?.userProgress?.learnedWords ?? {}).length
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginListeningSession(opts: BeginOptions = {}): ListeningSessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext('listening')

  if (!opts.fresh) {
    const saved = mgr.loadGameState?.('listening')
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
        mgr.deleteGameState?.('listening')
      } else {
        mgr.currentGame = 'listening'
        mgr.isResuming = true
        mgr.shuffledQuestions = saved.shuffledQuestions
        mgr.currentQuestionIndex = saved.currentQuestionIndex
        mgr.totalQuestions = newTotal
        mgr.gameElapsedMs = saved.gameElapsedMs ?? 0
        mgr.gameSessionStartAt = Date.now()
        mgr.gameCoinHistoryStartIndex =
          (window as any).app?.userProgress?.coinHistory?.length ?? 0
        mgr.isGameActive = true
        const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.('listening') ?? 0
        mgr.scoreManager?.resetScore('listening')
        if (resumeScore > 0) mgr.scoreManager?.addPoints('listening', resumeScore)
        if (mgr.lastPersistedScores) mgr.lastPersistedScores['listening'] = resumeScore
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
    mgr.deleteGameState?.('listening')
  }

  mgr.isResuming = false
  mgr.currentGame = 'listening'
  mgr.currentQuestionIndex = 0
  mgr.scoreManager?.resetScore('listening')
  if (mgr.lastPersistedScores) mgr.lastPersistedScores['listening'] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex =
    (window as any).app?.userProgress?.coinHistory?.length ?? 0

  let pool = mgr.getScopedQuestionPool('listening') ?? []
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

export interface AnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

export function recordListeningAnswer(
  question: ListeningQuestion,
  selectedIndex: number,
): AnswerOutcome {
  const mgr = getMgr()
  const isCorrect = selectedIndex === question.correct
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, 'listening')

  if (isCorrect) {
    mgr.scoreManager?.addPoints('listening', 10)
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
  cleanupLegacyDom?: boolean
}

export function finishListeningSession(opts: FinishOptions = {}): void {
  const mgr = getMgr()
  if (!mgr) return

  Promise.resolve(mgr.endGame('listening')).catch(() => {
    /* legacy already logs */
  })
  mgr.isGameActive = false

  if (opts.cleanupLegacyDom !== false) {
    const container = document.getElementById(LEGACY_GAME_CONTAINER_ID)
    container?.querySelector('.game-complete')?.remove()
  }
}

export function abortListeningSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ── Per-question audio counters (persisted across refresh) ──────────────────

interface ListeningAudioState {
  questionIndex: number
  playsSoFar: number
  audioPlaysLeft: number
}

function audioKey(): string {
  const userId = localStorage.getItem('currentUser') || 'default'
  return `v2_listening_audio_${userId}`
}

export function loadListeningAudioState(forIndex: number): ListeningAudioState | null {
  try {
    const raw = localStorage.getItem(audioKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as ListeningAudioState
    if (parsed.questionIndex !== forIndex) return null
    return parsed
  } catch {
    return null
  }
}

export function saveListeningAudioState(state: ListeningAudioState): void {
  try {
    localStorage.setItem(audioKey(), JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearListeningAudioState(): void {
  try {
    localStorage.removeItem(audioKey())
  } catch {
    /* ignore */
  }
}
