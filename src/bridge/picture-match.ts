import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'
import { isCourseMode } from './courseSession'

export interface PictureMatchOption {
  word: string
  picture?: string
  imageUrl?: string
}

export interface PictureMatchQuestion {
  word: string
  hebrew?: string
  translation?: string
  category: string
  options: PictureMatchOption[]
  correct: number
  picture?: string
  imageUrl?: string
}

export interface PictureMatchSessionReady {
  kind: 'ready'
  questions: PictureMatchQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type PictureMatchSessionResult =
  | PictureMatchSessionReady
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
  shuffledQuestions: PictureMatchQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getScopedQuestionPool(gameType: string): PictureMatchQuestion[]
  smartQuestionSelection(pool: PictureMatchQuestion[]): PictureMatchQuestion[]
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: PictureMatchQuestion[]
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

const LEGACY_GAME_CONTAINER_ID = 'picture-match-game'
const GAME_TYPE = 'picture-match'

function getLearnedCount(): number {
  return Object.keys((window as any).app?.userProgress?.learnedWords ?? {}).length
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginPictureMatchSession(opts: BeginOptions = {}): PictureMatchSessionResult {
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext(GAME_TYPE)

  // Course mode (launched from /courses): scope to the topic's words. Skip the
  // learned-word filter AND mid-game resume (topic words aren't learned yet).
  const courseMode = isCourseMode(GAME_TYPE)

  if (!opts.fresh && !courseMode) {
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
          (window as any).app?.userProgress?.coinHistory?.length ?? 0
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
    (window as any).app?.userProgress?.coinHistory?.length ?? 0

  let pool = mgr.getScopedQuestionPool(GAME_TYPE) ?? []
  if (!mgr.settings?.gameUnlockOverride && !courseMode) {
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

export function recordPictureMatchAnswer(
  question: PictureMatchQuestion,
  selectedIndex: number,
): AnswerOutcome {
  const mgr = getMgr()
  const isCorrect = selectedIndex === question.correct
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  mgr.recordWordAttempt(question.word, question.category, isCorrect, 0, GAME_TYPE)

  if (isCorrect) {
    mgr.scoreManager?.addPoints(GAME_TYPE, 10)
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

export function finishPictureMatchSession(opts: FinishOptions = {}): void {
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

export function abortPictureMatchSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ── Per-question audio counters (persisted across refresh) ──────────────────

interface PictureMatchAudioState {
  questionIndex: number
  playsSoFar: number
  audioPlaysLeft: number
}

function audioKey(): string {
  const userId = localStorage.getItem('currentUser') || 'default'
  return `v2_picture_match_audio_${userId}`
}

export function loadPictureMatchAudioState(forIndex: number): PictureMatchAudioState | null {
  try {
    const raw = localStorage.getItem(audioKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as PictureMatchAudioState
    if (parsed.questionIndex !== forIndex) return null
    return parsed
  } catch {
    return null
  }
}

export function savePictureMatchAudioState(state: PictureMatchAudioState): void {
  try {
    localStorage.setItem(audioKey(), JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearPictureMatchAudioState(): void {
  try {
    localStorage.removeItem(audioKey())
  } catch {
    /* ignore */
  }
}
