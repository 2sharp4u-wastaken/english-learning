import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'
import { getDerivedLearnedCount, getLearnedWordKeySet } from './progress'
// Legacy data module — same one gameLogic.js imports.
// @ts-expect-error — legacy .js import without a .d.ts
import { getStoriesForSession } from '../../data/stories.js'

// ─── Story shape (mirrors data/stories.js buildStoryFromTemplate output) ───

export interface StoryHighlight {
  word: string
  translation: string
  category?: string
}

export interface StoryQuizQuestion {
  question: string
  /** English phrasing of the question, spoken aloud as the child reads the Hebrew. */
  questionEn?: string
  options: string[]
  correctIndex: number
}

export interface Story {
  id: string
  title: string
  sentences: string[]
  /** NEW (not-yet-learned) bank words found in the story → tappable pills +
   *  translation + audio + the "new words" review table. Exposure-only. */
  highlights: StoryHighlight[]
  /** Learned slot words featured by the story — reinforced (recordWordAttempt)
   *  on a correct quiz answer. Distinct from `highlights` (E6, 2026-06-08). */
  reinforceWords?: { word: string; category?: string }[]
  questions: StoryQuizQuestion[]
}

// ─── Session ───────────────────────────────────────────────────────────────

export interface StoryTimeSessionReady {
  kind: 'ready'
  stories: Story[]
  totalQuizQuestions: number
}

export type StoryTimeSessionResult =
  | StoryTimeSessionReady
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
  shuffledQuestions: Story[]
  scoreManager: LegacyScoreManager
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
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  deleteGameState(gameType: string): void
}

function getMgr(): LegacyGameManager | null {
  return getGameManager() as unknown as LegacyGameManager | null
}

const GAME_TYPE = 'story-time'
const LEARN_FIRST_THRESHOLD = 15
const SESSION_STORY_COUNT = 3
const POINTS_PER_CORRECT = 15

// V3: "learned" = derived (mastery-stable ∪ grandfathered), not the frozen stamp.
function getLearnedCount(): number {
  return getDerivedLearnedCount()
}

export interface BeginOptions {
  fresh?: boolean
}

/**
 * Start a Story Time session.
 *
 * Legacy story-time's resume is structurally broken — `currentQuestionIndex`
 * counts quiz answers across stories but `storyIndex` (which selects the
 * current story) lives only on the legacy game instance and isn't persisted,
 * so on reopen the game silently restarts at story 0. The React port skips
 * resume entirely (always starts fresh, clears any saved state) to match
 * legacy's *observable* behavior without the broken bookkeeping.
 */
/**
 * Fisher-Yates shuffle of each question's answer options, returning new story
 * objects with `correctIndex` remapped to wherever the correct value landed.
 * Pure — does not mutate the source story/question objects.
 */
export function shuffleQuestionOptions(stories: Story[]): Story[] {
  return stories.map((story) => ({
    ...story,
    questions: story.questions.map((q) => {
      const correctValue = q.options[q.correctIndex]
      const order = [...q.options]
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      return { ...q, options: order, correctIndex: order.indexOf(correctValue) }
    }),
  }))
}

export function beginStoryTimeSession(opts: BeginOptions = {}): StoryTimeSessionResult {
  void opts // resume intentionally unsupported — see comment above
  const mgr = getMgr()
  if (!mgr) return { kind: 'learn-first', learnedCount: 0 }

  setGameContext(GAME_TYPE)
  mgr.deleteGameState?.(GAME_TYPE)

  // Learn-first gate: legacy gameLogic.js requires ≥15 learned words.
  if (!mgr.settings?.gameUnlockOverride) {
    if (getLearnedCount() < LEARN_FIRST_THRESHOLD) {
      mgr.isGameActive = false
      return { kind: 'learn-first', learnedCount: getLearnedCount() }
    }
  }

  // Build stories from learned words — mirrors gameLogic.js:2191-2205.
  const allWords = ((window as any).vocabularyBank as any[]) ?? []
  const learnedWordsList = [...getLearnedWordKeySet()]
    .map((key) => {
      const [word, category] = key.split('_')
      return (
        allWords.find((w) => w.word?.toLowerCase() === word && w.category === category) ||
        { word, category }
      )
    })
    .filter(Boolean)

  const rawStories = (getStoriesForSession as (
    learned: any[],
    all: any[],
    count: number,
  ) => Story[])(learnedWordsList, allWords, SESSION_STORY_COUNT)

  if (!rawStories || rawStories.length === 0) {
    mgr.isGameActive = false
    return { kind: 'learn-first', learnedCount: getLearnedCount() }
  }

  // The story data authors every question's correct answer at index 0, and
  // nothing downstream shuffles — so the correct option sat in a fixed slot
  // every time, making the quiz trivial (bug-dump 2026-06-07 E3). Shuffle each
  // question's options per session and remap `correctIndex`. Options are
  // de-duped upstream, so `indexOf` of the correct value is unambiguous.
  const stories = shuffleQuestionOptions(rawStories)

  const totalQuizQuestions = stories.reduce((sum, s) => sum + s.questions.length, 0)

  mgr.isResuming = false
  mgr.currentGame = GAME_TYPE
  mgr.currentQuestionIndex = 0
  mgr.shuffledQuestions = stories
  mgr.totalQuestions = totalQuizQuestions
  mgr.scoreManager?.resetScore(GAME_TYPE)
  if (mgr.lastPersistedScores) mgr.lastPersistedScores[GAME_TYPE] = 0
  mgr.gameElapsedMs = 0
  mgr.gameSessionStartAt = Date.now()
  mgr.gameCoinHistoryStartIndex =
    getApp()?.userProgress?.coinHistory?.length ?? 0
  mgr.isGameActive = true

  return { kind: 'ready', stories, totalQuizQuestions }
}

export interface QuizOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/**
 * Record one quiz answer. Mirrors legacy story-time-game.js:197-257:
 * - +15 points on correct
 * - recordWordAttempt for the story's LEARNED featured words on correct
 *   (reinforcement). NEW auto-highlighted words are exposure-only and are NOT
 *   recorded — reading a story must not auto-advance mastery (E6, 2026-06-08).
 * - advances currentQuestionIndex regardless of correctness
 */
export function recordStoryQuizAnswer(
  story: Story,
  question: StoryQuizQuestion,
  selectedIndex: number,
): QuizOutcome {
  const isCorrect = selectedIndex === question.correctIndex
  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  if (isCorrect) {
    mgr.scoreManager?.addPoints(GAME_TYPE, POINTS_PER_CORRECT)
    for (const w of story.reinforceWords ?? []) {
      mgr.recordWordAttempt(w.word, w.category ?? '', true, 0, GAME_TYPE)
    }
  }

  mgr.currentQuestionIndex += 1
  try {
    mgr.saveGameState()
  } catch {
    /* legacy logs */
  }

  return { isCorrect, pointsAwarded: isCorrect ? POINTS_PER_CORRECT : 0 }
}

export function finishStoryTimeSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortStoryTimeSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}
