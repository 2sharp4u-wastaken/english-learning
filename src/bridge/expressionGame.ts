/**
 * src/bridge/expressionGame.ts — Phase 5 (Slice 5.3) self-contained engine for the
 * dedicated "ביטויים" expression games. Unlike the vocabulary game bridges, this
 * does NOT drive the legacy gameManager word-pool selection / learnedWords gating /
 * wordMastery recording. It reads register-filtered phrases from getExpressionBank()
 * and records progress into the separate `expressionMastery` map (keyed by phrase).
 *
 * Four games share one parameterized page (ExpressionGamePage), distinguished by
 * `mode`. All are tap/choose-based — no microphone — so they are fully testable.
 *
 * Gate: expressions unlock only after EXPRESSION_UNLOCK_WORDS derived-learned
 * vocabulary words (master-plan 5.3) AND the parent has enabled at least one
 * register with enough content (getExpressionBank() handles the enable/filter).
 */
import { setGameContext, cancelSpeech } from './audio'
import { getApp, getGameManager } from '../engine/instances'
import { getDerivedLearnedCount } from './progress'
import { getExpressionBank, getExpressionPlainForm, type Expression } from './expressions'

export type ExpressionMode = 'meaning' | 'truefalse' | 'blank' | 'build' | 'swap'

/** Derived-learned vocabulary words required before expressions unlock. */
export const EXPRESSION_UNLOCK_WORDS = 50
const QUESTIONS_PER_SESSION = 10
/** Distractor modes (meaning/blank/truefalse) need ≥4 phrases for a 4-option grid. */
const MIN_FOR_DISTRACTORS = 4
/** A worthwhile session needs at least this many buildable questions. */
const MIN_QUESTIONS = 3

/** mode → registered game id (reactGames.ts / GameHostPage / HomePage). */
export const EXPRESSION_GAME_TYPES: Record<ExpressionMode, string> = {
  meaning: 'expr-meaning',
  truefalse: 'expr-truefalse',
  blank: 'expr-blank',
  build: 'expr-build',
  swap: 'expr-swap',
}

export const YES_NO_OPTIONS = ['כן', 'לא'] as const

// ─── Unlock gate ───────────────────────────────────────────────────────────────

export interface ExpressionUnlock {
  unlocked: boolean
  learnedCount: number
  needed: number
  hasContent: boolean
}

/**
 * The single source of truth for whether expression games are playable. Read by
 * the page (locked screen) and the home tile gate (useExpressionUnlock).
 */
export function getExpressionUnlock(): ExpressionUnlock {
  const learnedCount = getDerivedLearnedCount()
  const hasContent = getExpressionBank().length > 0
  return {
    unlocked: learnedCount >= EXPRESSION_UNLOCK_WORDS && hasContent,
    learnedCount,
    needed: EXPRESSION_UNLOCK_WORDS,
    hasContent,
  }
}

// ─── Question shape ──────────────────────────────────────────────────────────────

export interface ExpressionQuestion {
  mode: ExpressionMode
  phrase: string
  meaningHe: string
  exampleEn: string
  exampleHe: string
  /** English phrase to voice via TTS (the page lowercases it). */
  audioPhrase: string
  /**
   * Main prompt shown in the card:
   * - meaning/truefalse → the English phrase
   * - blank            → the example sentence with the phrase replaced by "_____"
   * - build            → the Hebrew meaning (the target to assemble)
   * - swap             → the plain-English synonym to "upgrade" into the expression
   */
  promptText: string
  /** swap only — the plain-English synonym shown as the prompt. */
  plainEn?: string
  /** truefalse only — the candidate Hebrew meaning being judged. */
  candidateMeaning?: string
  /** Multiple-choice option labels (meaning/blank/truefalse). Empty for build. */
  options: string[]
  /** Optional Hebrew gloss under each option (blank mode bilingual hint). */
  sublabels?: Array<string | undefined>
  correct: number
  /** build only — shuffled words shown in the bank. */
  scrambledWords?: string[]
  /** build only — the correct word order. */
  answerWords?: string[]
}

export type ExpressionSession =
  | { kind: 'ready'; mode: ExpressionMode; questions: ExpressionQuestion[]; total: number }
  | { kind: 'locked'; unlock: ExpressionUnlock }
  | { kind: 'not-enough'; available: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Sample up to `count` distinct values from `pool`, skipping anything in `exclude`. */
function sampleDistinct(pool: string[], count: number, exclude: Set<string>): string[] {
  const out: string[] = []
  const seen = new Set(exclude)
  for (const v of shuffle(pool)) {
    if (out.length >= count) break
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function words(phrase: string): string[] {
  return phrase.trim().split(/\s+/).filter(Boolean)
}

/** Replace the first case-insensitive occurrence of `phrase` with a blank. */
function blankSentence(exampleEn: string, phrase: string): string | null {
  const idx = exampleEn.toLowerCase().indexOf(phrase.toLowerCase())
  if (idx < 0) return null
  return `${exampleEn.slice(0, idx)}_____${exampleEn.slice(idx + phrase.length)}`
}

function scrambleWords(target: string[]): string[] {
  if (target.length < 2) return [...target]
  let s = shuffle(target)
  let guard = 0
  while (s.join(' ') === target.join(' ') && guard++ < 12) s = shuffle(target)
  return s
}

function buildOne(mode: ExpressionMode, e: Expression, bank: Expression[]): ExpressionQuestion | null {
  const base = {
    mode,
    phrase: e.phrase,
    meaningHe: e.meaningHe,
    exampleEn: e.exampleEn ?? '',
    exampleHe: e.exampleHe ?? '',
    audioPhrase: e.phrase,
  }

  if (mode === 'meaning') {
    const distractors = sampleDistinct(
      bank.map((x) => x.meaningHe),
      3,
      new Set([e.meaningHe]),
    )
    if (distractors.length < 3) return null
    const options = shuffle([e.meaningHe, ...distractors])
    return {
      ...base,
      promptText: e.phrase,
      options,
      correct: options.indexOf(e.meaningHe),
    }
  }

  if (mode === 'truefalse') {
    const isReal = Math.random() < 0.5
    let candidate = e.meaningHe
    if (!isReal) {
      const [wrong] = sampleDistinct(
        bank.map((x) => x.meaningHe),
        1,
        new Set([e.meaningHe]),
      )
      if (!wrong) return null
      candidate = wrong
    }
    return {
      ...base,
      promptText: e.phrase,
      candidateMeaning: candidate,
      options: [...YES_NO_OPTIONS],
      correct: isReal ? 0 : 1,
    }
  }

  if (mode === 'blank') {
    const blanked = blankSentence(e.exampleEn ?? '', e.phrase)
    if (!blanked) return null
    const distractors = sampleDistinct(
      bank.map((x) => x.phrase),
      3,
      new Set([e.phrase]),
    )
    if (distractors.length < 3) return null
    const options = shuffle([e.phrase, ...distractors])
    const meaningByPhrase = new Map(bank.map((x) => [x.phrase, x.meaningHe]))
    return {
      ...base,
      promptText: blanked,
      options,
      sublabels: options.map((p) => meaningByPhrase.get(p)),
      correct: options.indexOf(e.phrase),
    }
  }

  if (mode === 'swap') {
    // Plain English → pick the expression that means the same. Skip phrases with
    // no authored plain form, and keep distractors semantically distinct so the
    // question has exactly one defensible answer.
    const plain = getExpressionPlainForm(e.phrase)
    if (!plain) return null
    const distractorPool = bank.filter(
      (x) =>
        x.phrase !== e.phrase &&
        x.meaningHe !== e.meaningHe &&
        getExpressionPlainForm(x.phrase) !== plain,
    )
    const distractors = sampleDistinct(distractorPool.map((x) => x.phrase), 3, new Set([e.phrase]))
    if (distractors.length < 3) return null
    const options = shuffle([e.phrase, ...distractors])
    const meaningByPhrase = new Map(bank.map((x) => [x.phrase, x.meaningHe]))
    return {
      ...base,
      // Voice the plain prompt on the audio button so it never reveals the answer.
      audioPhrase: plain,
      plainEn: plain,
      promptText: plain,
      options,
      sublabels: options.map((p) => meaningByPhrase.get(p)),
      correct: options.indexOf(e.phrase),
    }
  }

  // build
  const answerWords = words(e.phrase)
  if (answerWords.length < 2) return null
  return {
    ...base,
    promptText: e.meaningHe,
    options: [],
    correct: 0,
    answerWords,
    scrambledWords: scrambleWords(answerWords),
  }
}

function buildQuestions(mode: ExpressionMode, bank: Expression[], count: number): ExpressionQuestion[] {
  const out: ExpressionQuestion[] = []
  for (const e of shuffle(bank)) {
    if (out.length >= count) break
    const q = buildOne(mode, e, bank)
    if (q) out.push(q)
  }
  return out
}

// ─── Session lifecycle ─────────────────────────────────────────────────────────

export function buildExpressionSession(mode: ExpressionMode): ExpressionSession {
  const unlock = getExpressionUnlock()
  if (!unlock.unlocked) return { kind: 'locked', unlock }

  const bank = getExpressionBank()
  // Distractor modes need a minimum bank; build only needs multi-word phrases.
  if (mode !== 'build' && bank.length < MIN_FOR_DISTRACTORS) {
    return { kind: 'not-enough', available: bank.length }
  }

  setGameContext(EXPRESSION_GAME_TYPES[mode])
  const questions = buildQuestions(mode, bank, QUESTIONS_PER_SESSION)
  if (questions.length < MIN_QUESTIONS) return { kind: 'not-enough', available: bank.length }

  const mgr = getGameManager() as { isGameActive?: boolean } | null
  if (mgr) mgr.isGameActive = true
  return { kind: 'ready', mode, questions, total: questions.length }
}

/** Record one answer into expressionMastery (keyed by phrase). Persists immediately. */
export function recordExpressionAnswer(phrase: string, isCorrect: boolean): void {
  const mgr = getGameManager() as { recordExpressionAttempt?(p: string, c: boolean): void } | null
  mgr?.recordExpressionAttempt?.(phrase, isCorrect)
}

/** Finish a run: bank the session score into totalPoints + bestScores, then save. */
export function finishExpressionSession(mode: ExpressionMode, score: number): void {
  const gameType = EXPRESSION_GAME_TYPES[mode]
  const app = getApp() as
    | { userProgress?: { totalPoints?: number }; updateProgress?(t: string, s: number): void }
    | null
  if (app?.userProgress) {
    app.userProgress.totalPoints = (app.userProgress.totalPoints || 0) + Math.max(0, score)
  }
  try {
    app?.updateProgress?.(gameType, score) // increments games-played + saves
  } catch {
    /* legacy logs */
  }
  const mgr = getGameManager() as { isGameActive?: boolean } | null
  if (mgr) mgr.isGameActive = false
}

/** Exit without crediting (back button / unmount). */
export function abortExpressionSession(): void {
  cancelSpeech()
  const mgr = getGameManager() as { isGameActive?: boolean; currentGame?: string | null } | null
  if (mgr) {
    mgr.isGameActive = false
    mgr.currentGame = null
  }
}
