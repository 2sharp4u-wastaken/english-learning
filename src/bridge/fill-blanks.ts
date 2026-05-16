import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'
// Legacy sentence data — same module gameLogic.js imports for fill-blanks.
// @ts-expect-error — legacy .js import without a .d.ts
import { getRandomSentences } from '../../data/sentences.js'

export interface FillBlanksQuestion {
  sentence: string
  translation: string
  words: string[]
  blank: { position: number; options: string[] }
  theme: string
  difficulty: string
}

export interface FillBlanksSessionReady {
  kind: 'ready'
  questions: FillBlanksQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type FillBlanksSessionResult =
  | FillBlanksSessionReady
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
  shuffledQuestions: FillBlanksQuestion[]
  scoreManager: LegacyScoreManager
  settings?: { gameUnlockOverride?: boolean } | null
  selectedCategories?: string[]
  currentTopicActivity?: string | null
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  getActiveTopicWords?(): Array<{ word: string; category: string }>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, responseTime: number, gameType: string): void
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: FillBlanksQuestion[]
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

const GAME_TYPE = 'fill-blanks'
const LEGACY_GAME_CONTAINER_ID = 'fill-blanks-container'
const MIN_LEARNED = 30
const BASE_SENTENCE_COUNT = 10
// Mirrors gameLogic.js SENTENCE_THEMES — themes that overlap with vocab categories.
const SENTENCE_THEMES = new Set([
  'animals', 'colors', 'daily', 'family', 'food', 'greetings', 'numbers', 'school',
])

function getLearnedCount(): number {
  return Object.keys((window as any).app?.userProgress?.learnedWords ?? {}).length
}

function computeThemes(mgr: LegacyGameManager): string[] {
  if (mgr.currentTopicActivity === GAME_TYPE && typeof mgr.getActiveTopicWords === 'function') {
    const topicWords = mgr.getActiveTopicWords() ?? []
    const themes = [
      ...new Set(
        topicWords
          .map((w) => w.category)
          .filter((c) => SENTENCE_THEMES.has(c)),
      ),
    ]
    if (themes.length > 0) return themes
  }
  return (mgr.selectedCategories ?? []).filter((c) => SENTENCE_THEMES.has(c))
}

export interface BeginOptions {
  fresh?: boolean
}

export function beginFillBlanksSession(opts: BeginOptions = {}): FillBlanksSessionResult {
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

  // V2 gating mirrors gameLogic.js:2049 — fill-blanks requires ≥30 learned.
  if (!mgr.settings?.gameUnlockOverride) {
    const learnedCount = getLearnedCount()
    if (learnedCount < MIN_LEARNED) {
      mgr.isGameActive = false
      return { kind: 'learn-first', learnedCount }
    }
  }

  const themes = computeThemes(mgr)
  const shuffled = (getRandomSentences(
    BASE_SENTENCE_COUNT,
    'beginner',
    themes.length > 0 ? themes : null,
  ) ?? []) as FillBlanksQuestion[]
  if (shuffled.length === 0) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

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

/**
 * Legacy fill-blanks-game.js awards 10 points on correct and advances the
 * question index regardless of correctness; we preserve both invariants.
 */
export function recordFillBlanksAnswer(
  question: FillBlanksQuestion,
  selected: string,
): AnswerOutcome {
  const mgr = getMgr()
  const correct = question.blank.options[0]
  const isCorrect = selected.toLowerCase() === correct.toLowerCase()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  const bank = ((window as any).vocabularyBank as Array<{ word: string; category: string }>) ?? []
  const vocabEntry = bank.find(
    (w) => w.word?.toLowerCase() === correct.toLowerCase(),
  )
  if (vocabEntry) {
    mgr.recordWordAttempt(vocabEntry.word, vocabEntry.category, isCorrect, 0, GAME_TYPE)
  }

  const pointsAwarded = isCorrect ? 10 : 0
  if (pointsAwarded > 0) {
    mgr.scoreManager?.addPoints(GAME_TYPE, pointsAwarded)
  }
  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy already logs */
  }
  return { isCorrect, pointsAwarded }
}

export interface FinishOptions {
  cleanupLegacyDom?: boolean
}

export function finishFillBlanksSession(opts: FinishOptions = {}): void {
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

export function abortFillBlanksSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ── Per-question audio counters (persisted across refresh) ──────────────────

interface FillBlanksAudioState {
  questionIndex: number
  playsSoFar: number
  audioPlaysLeft: number
}

function audioKey(): string {
  const userId = localStorage.getItem('currentUser') || 'default'
  return `v2_fillblanks_audio_${userId}`
}

export function loadFillBlanksAudioState(forIndex: number): FillBlanksAudioState | null {
  try {
    const raw = localStorage.getItem(audioKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as FillBlanksAudioState
    if (parsed.questionIndex !== forIndex) return null
    return parsed
  } catch {
    return null
  }
}

export function saveFillBlanksAudioState(state: FillBlanksAudioState): void {
  try {
    localStorage.setItem(audioKey(), JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearFillBlanksAudioState(): void {
  try {
    localStorage.removeItem(audioKey())
  } catch {
    /* ignore */
  }
}
