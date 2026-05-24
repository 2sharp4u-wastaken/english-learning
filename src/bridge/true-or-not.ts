import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'

export interface TrueOrNotQuestion {
  word: string
  hebrew?: string
  translation?: string
  category: string
  /** Word's real image (the image that matches the spoken word). */
  picture?: string
  imageUrl?: string
  /** The image actually shown — may differ from `picture/imageUrl` on mismatch rounds. */
  displayPicture?: string
  displayImageUrl?: string
  /** Legacy truth flag — true if displayed image matches the word. */
  isMatch: boolean
  /** Derived index for AnswerGrid: 0 = כן/yes, 1 = לא/no. */
  correct: number
}

interface LegacyTrueOrNotQuestion {
  word: string
  translation?: string
  category: string
  image?: string
  imageUrl?: string
  displayImage?: string
  displayImageUrl?: string
  isMatch: boolean
}

export interface TrueOrNotSessionReady {
  kind: 'ready'
  questions: TrueOrNotQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type TrueOrNotSessionResult =
  | TrueOrNotSessionReady
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
  shuffledQuestions: LegacyTrueOrNotQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  _getLearnedWordSet(): Set<string>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: LegacyTrueOrNotQuestion[]
    currentQuestionIndex?: number
    totalQuestions?: number
    score?: number
    gameElapsedMs?: number
    selectedCategories?: string[]
  } | null
  deleteGameState(gameType: string): void
}

interface LegacyTrueOrNotGame {
  buildQuestions(words: Array<{
    word: string
    translation?: string
    category: string
    image?: string
    imageUrl?: string
  }>): LegacyTrueOrNotQuestion[]
}

function getMgr(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
}

function getLegacyGame(): LegacyTrueOrNotGame | null {
  return (window as any).trueOrNotGame ?? null
}

const LEGACY_GAME_CONTAINER_ID = 'true-or-not-container'
const GAME_TYPE = 'true-or-not'
const MIN_LEARNED_WORDS = 5

// V3 (docs/learning-flow-redesign.md): True-or-Not is a REVIEW-tier game, so its
// gate counts words INTRODUCED (Learning ∪ Learned), matching its now-introduced
// word pool. Falls back to the legacy learnedWords stamp if the manager is absent.
function getLearnedCount(): number {
  const pm = (window as any).app?.progressManager
  if (pm?.getIntroducedCount) return pm.getIntroducedCount()
  return Object.keys((window as any).app?.userProgress?.learnedWords ?? {}).length
}

function adapt(q: LegacyTrueOrNotQuestion): TrueOrNotQuestion {
  return {
    word: q.word,
    translation: q.translation,
    hebrew: q.translation,
    category: q.category,
    picture: q.image,
    imageUrl: q.imageUrl,
    displayPicture: q.displayImage ?? q.image,
    displayImageUrl: q.displayImageUrl ?? q.imageUrl,
    isMatch: q.isMatch,
    correct: q.isMatch ? 0 : 1,
  }
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginTrueOrNotSession(opts: BeginOptions = {}): TrueOrNotSessionResult {
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
          (window as any).app?.userProgress?.coinHistory?.length ?? 0
        mgr.isGameActive = true
        const resumeScore = saved.score ?? mgr.scoreManager?.getScore?.(GAME_TYPE) ?? 0
        mgr.scoreManager?.resetScore(GAME_TYPE)
        if (resumeScore > 0) mgr.scoreManager?.addPoints(GAME_TYPE, resumeScore)
        if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = resumeScore
        return {
          kind: 'ready',
          questions: saved.shuffledQuestions.slice(0, newTotal).map(adapt),
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

  // V2 gating: True-or-Not needs ≥5 learned words (mirrors gameLogic.js:2163-2172).
  if (!mgr.settings?.gameUnlockOverride) {
    if (getLearnedCount() < MIN_LEARNED_WORDS) {
      mgr.isGameActive = false
      return { kind: 'learn-first', learnedCount: getLearnedCount() }
    }
  }

  // Build the question pool from learned words (legacy: gameLogic.js:2173-2188).
  const learnedKeys = mgr._getLearnedWordSet()
  const allWords = ((window as any).vocabularyBank as Array<{
    word: string
    translation?: string
    category: string
    image?: string
    imageUrl?: string
  }>) ?? []
  const learnedPool = allWords.filter((w) =>
    learnedKeys.has(`${w.word?.toLowerCase()}_${w.category}`),
  )
  const pool = learnedPool.length >= 4 ? learnedPool : allWords
  if (pool.length < 4) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

  const legacy = getLegacyGame()
  if (!legacy?.buildQuestions) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }
  const questions = legacy.buildQuestions(pool)
  if (!questions || questions.length === 0) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

  mgr.shuffledQuestions = questions
  const settingsCap = getSettings().questionsPerGame || 10
  const total = Math.min(questions.length, settingsCap)
  mgr.totalQuestions = total
  mgr.isGameActive = true

  return {
    kind: 'ready',
    questions: questions.slice(0, total).map(adapt),
    total,
    resumeIndex: 0,
    resumeScore: 0,
  }
}

export interface AnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

export function recordTrueOrNotAnswer(
  question: TrueOrNotQuestion,
  selectedIndex: number,
): AnswerOutcome {
  const mgr = getMgr()
  // selectedIndex 0 = user said "yes/match"; 1 = user said "no/mismatch".
  const userSaysMatch = selectedIndex === 0
  const isCorrect = userSaysMatch === question.isMatch
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

export function finishTrueOrNotSession(opts: FinishOptions = {}): void {
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

export function abortTrueOrNotSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ── Per-question audio counters (persisted across refresh) ──────────────────

interface TrueOrNotAudioState {
  questionIndex: number
  playsSoFar: number
  audioPlaysLeft: number
}

function audioKey(): string {
  const userId = localStorage.getItem('currentUser') || 'default'
  return `v2_true_or_not_audio_${userId}`
}

export function loadTrueOrNotAudioState(forIndex: number): TrueOrNotAudioState | null {
  try {
    const raw = localStorage.getItem(audioKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as TrueOrNotAudioState
    if (parsed.questionIndex !== forIndex) return null
    return parsed
  } catch {
    return null
  }
}

export function saveTrueOrNotAudioState(state: TrueOrNotAudioState): void {
  try {
    localStorage.setItem(audioKey(), JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearTrueOrNotAudioState(): void {
  try {
    localStorage.removeItem(audioKey())
  } catch {
    /* ignore */
  }
}
