import { setGameContext, cancelSpeech } from './audio'
import { getSettings } from './settings'
// Legacy data module — same one gameLogic.js imports.
// @ts-expect-error — legacy .js import without a .d.ts
import { generateGrammarBeginnerQuestions } from '../../data/grammarBeginnerData.js'

// ─── Question shape (mirrors data/grammarBeginnerData.js) ──────────────────

export type QuestionType =
  | 'who-says-it'
  | 'complete-sound'
  | 'sounds-right'
  | 'match-picture'

export interface PredicateInfo {
  word: string
  image: string
  hebrew: string
  hebrewFem?: string
  hebrewPlural?: string
}

export interface SubjectOption {
  key: string
  image: string
  hebrew: string
  isCorrect: boolean
  predicateImage?: string
}

export interface VerbOption {
  verb: string
  audio: string
  isCorrect: boolean
}

export interface SentenceOption {
  sentence: string
  audio: string
  isCorrect: boolean
}

interface BaseQuestion {
  type: QuestionType
  instruction: string
  instructionAudio: string
  correctAnswer: string
  hebrewSentence: string
}

export interface WhoSaysItQuestion extends BaseQuestion {
  type: 'who-says-it'
  sentence: string
  sentenceAudio: string
  options: SubjectOption[]
  predicate: PredicateInfo
}

export interface CompleteSoundQuestion extends BaseQuestion {
  type: 'complete-sound'
  subjectKey: string
  subjectImage: string
  subjectHebrew: string
  subjectAudio: string
  predicate: PredicateInfo
  options: VerbOption[]
  fullSentence: string
}

export interface SoundsRightQuestion extends BaseQuestion {
  type: 'sounds-right'
  subjectImage: string
  subjectHebrew: string
  predicateImage: string
  predicateHebrew: string
  options: SentenceOption[]
  sentenceAudio: string
}

export interface MatchPictureQuestion extends BaseQuestion {
  type: 'match-picture'
  sentence: string
  sentenceAudio: string
  predicate: PredicateInfo
  options: SubjectOption[]
}

export type GrammarBeginnerQuestion =
  | WhoSaysItQuestion
  | CompleteSoundQuestion
  | SoundsRightQuestion
  | MatchPictureQuestion

// ─── Session ────────────────────────────────────────────────────────────────

export interface GrammarBeginnerSessionReady {
  kind: 'ready'
  questions: GrammarBeginnerQuestion[]
  total: number
  resumeIndex: number
  resumeScore: number
}

export type GrammarBeginnerSessionResult = GrammarBeginnerSessionReady

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
  shuffledQuestions: GrammarBeginnerQuestion[]
  scoreManager: LegacyScoreManager
  gameElapsedMs?: number
  gameSessionStartAt?: number | null
  gameCoinHistoryStartIndex?: number
  lastPersistedScores?: Record<string, number>
  saveGameState(): boolean
  endGame(gameType: string): Promise<void> | void
  loadGameState(gameType: string): {
    shuffledQuestions?: GrammarBeginnerQuestion[]
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

const GAME_TYPE = 'grammar-beginner'

export interface BeginOptions {
  fresh?: boolean
}

export function beginGrammarBeginnerSession(
  opts: BeginOptions = {},
): GrammarBeginnerSessionResult {
  const mgr = getMgr()
  setGameContext(GAME_TYPE)

  // Resume path — legacy gameLogic.js:2103 regenerates only when !isResuming.
  if (mgr && !opts.fresh) {
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
  } else if (mgr && opts.fresh) {
    mgr.deleteGameState?.(GAME_TYPE)
  }

  // Fresh: regenerate questions each game (legacy gameLogic.js:2094).
  const cap = getSettings().questionsPerGame || 10
  const fresh = (generateGrammarBeginnerQuestions as (n: number) => GrammarBeginnerQuestion[])(
    cap,
  )

  if (mgr) {
    mgr.isResuming = false
    mgr.currentGame = GAME_TYPE
    mgr.currentQuestionIndex = 0
    mgr.shuffledQuestions = fresh
    mgr.totalQuestions = fresh.length
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
    questions: fresh,
    total: fresh.length,
    resumeIndex: 0,
    resumeScore: 0,
  }
}

export interface AnswerOutcome {
  isCorrect: boolean
  pointsAwarded: number
}

/**
 * Scores per legacy grammar-beginner-game.js:331 — `max(0, 10 - attempts + 1)`
 * where `attempts` is the count *after* incrementing for the current attempt
 * (so first-try correct → attempts=1 → 10 points). Always advances the index
 * after one answer (correct OR wrong, no retry — see legacy lines 351/369).
 */
export function recordGrammarBeginnerAnswer(
  question: GrammarBeginnerQuestion,
  selected: string,
  attemptsBefore: number,
): AnswerOutcome {
  const isCorrect = selected === question.correctAnswer
  const mgr = getMgr()
  if (!mgr) return { isCorrect, pointsAwarded: 0 }

  const attempts = attemptsBefore + 1
  const pointsAwarded = isCorrect ? Math.max(0, 10 - attempts + 1) : 0
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

export function finishGrammarBeginnerSession(): void {
  const mgr = getMgr()
  if (!mgr) return
  Promise.resolve(mgr.endGame(GAME_TYPE)).catch(() => {
    /* legacy logs */
  })
  mgr.isGameActive = false
}

export function abortGrammarBeginnerSession(): void {
  const mgr = getMgr()
  cancelSpeech()
  if (!mgr) return
  mgr.isGameActive = false
  mgr.currentGame = null
}

// ─── Hebrew predicate gender helpers (mirror grammarBeginnerData) ──────────

/**
 * Pick the gendered hebrew form of the predicate to match the subject:
 * - feminine subjects (she) → hebrewFem
 * - plural subjects (we / they) → hebrewPlural
 * - everything else → masculine default
 *
 * Mirrors getPredicateHebrew() in data/grammarBeginnerData.js.
 */
export function getPredicateHebrew(predicate: PredicateInfo, subjectKey: string): string {
  const fem = new Set(['she'])
  const plural = new Set(['we', 'they'])
  if (fem.has(subjectKey) && predicate.hebrewFem) return predicate.hebrewFem
  if (plural.has(subjectKey) && predicate.hebrewPlural) return predicate.hebrewPlural
  return predicate.hebrew
}

/** Capitalize first letter of a sentence (legacy sentenceCase). */
export function sentenceCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
