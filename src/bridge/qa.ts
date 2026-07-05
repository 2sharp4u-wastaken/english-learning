import { getApp } from '../engine/instances'
import { getAbcMasteryPercent } from './progress'
import { getExpressionUnlock } from './expressionGame'
import { wordKey } from '../lib/wordKey'

/**
 * src/bridge/qa.ts — parent/QA "unlock for testing" bridge (backlog M12 sub-item,
 * Slice A). A thin, standalone testing affordance surfaced in the parent-gated
 * כלי הורה tab (`QATestingPanel`): open gated content without grinding to the
 * thresholds. NOT kid-facing — it lives behind the parent password.
 *
 * It manipulates the CURRENT logged-in user's live engine progress (the same
 * progress the kid plays under), going through the real `ProgressManager` so the
 * derived lifecycle counts and game-unlock map stay self-consistent, then
 * `saveUserProgress()` persists and a synthetic `engine-ready` event makes the
 * Home unlock hooks (`useGameUnlocks`/`useExpressionUnlock`) refresh immediately
 * instead of waiting for their 500ms poll.
 *
 * WHY seeding is the main lever: both the expression tier (≥50 derived-learned
 * words, `getExpressionUnlock`) AND the consolidation games gate on derived-
 * learned, and every gated vocabulary game also needs a non-empty word POOL to be
 * playable — so marking words "learned" satisfies the gate AND fills the pool in
 * one move. `unlockAllGames` is a secondary lever for the topic-gated games
 * (fill-blanks/scramble/grammar need completed topics, which seeding can't grant).
 */

interface BankWord {
  word: string
  category: string
}

/** The ProgressManager surface this bridge drives (typed loosely — it's `any` on AppState). */
interface QAProgressManager {
  wordMastery: Record<string, { category?: string } | undefined>
  learnedWords: Record<string, unknown>
  gameUnlocks: Record<string, { unlocked?: boolean; unlockedDate?: string | null } | undefined>
  recordWordAttempt(word: string, category: string, isCorrect: boolean, gameType: string): unknown
  getIntroducedCount?: () => number
  getDerivedLearnedCount?: () => number
  getLearnedWordKeys?: () => Set<string>
  getCompletedTopicCount?: () => number
  checkAndUnlockGames?: (learnedCount: number, topicsDone: number, abcMastery: number) => string[]
}

/** The AppState fields this bridge writes through (its progress object + save). */
interface AppStateLike {
  userProgress: {
    wordMastery?: Record<string, unknown>
    learnedWords?: Record<string, unknown>
    gameUnlocks?: Record<string, unknown>
  } | null
  saveUserProgress?: () => void
}

function getPM(): QAProgressManager | null {
  return (getApp()?.progressManager as QAProgressManager | undefined) ?? null
}

/** Vocabulary words eligible for seeding (ABC letters excluded — they're not "words"). */
function vocabBank(): BankWord[] {
  const bank = ((window as { vocabularyBank?: BankWord[] }).vocabularyBank ?? []) as BankWord[]
  return bank.filter((w) => w && w.word && w.category !== 'abc')
}

export interface QAStatus {
  introduced: number
  learned: number
  bankSize: number
  expressionsUnlocked: boolean
  expressionsNeeded: number
}

export function getQAStatus(): QAStatus {
  const pm = getPM()
  const unlock = getExpressionUnlock()
  return {
    introduced: pm?.getIntroducedCount?.() ?? 0,
    learned: pm?.getDerivedLearnedCount?.() ?? 0,
    bankSize: vocabBank().length,
    expressionsUnlocked: unlock.unlocked,
    expressionsNeeded: unlock.needed,
  }
}

/** Persist + nudge the Home unlock hooks to recompute now (not on the next poll). */
function commit(): void {
  const app = getApp() as (AppStateLike & { saveUserProgress?: () => void }) | null
  const pm = getPM()
  // `ProgressManager.initialize` only shares these collections with `userProgress`
  // by reference when the key already existed at init; a migrated v4 progress can
  // lack `wordMastery`, leaving the manager with a fresh object that diverges. Re-
  // point them so our in-place mutations are always captured by saveUserProgress.
  if (app?.userProgress && pm) {
    app.userProgress.wordMastery = pm.wordMastery
    app.userProgress.learnedWords = pm.learnedWords
    app.userProgress.gameUnlocks = pm.gameUnlocks
  }
  app?.saveUserProgress?.()
  window.dispatchEvent(new CustomEvent('engine-ready'))
}

/** Re-evaluate the unlock map from the (just-changed) counts, the same call gameplay makes. */
function recomputeUnlocks(pm: QAProgressManager): void {
  const topics = pm.getCompletedTopicCount?.() ?? 0
  pm.checkAndUnlockGames?.(0, topics, getAbcMasteryPercent())
}

/**
 * Mark up to `count` not-yet-learned vocabulary words as fully mastered (three
 * correct attempts each → derived "learned"). Returns the new derived-learned
 * count. Idempotent on already-learned words (they're skipped).
 */
export function seedLearnedWords(count: number): number {
  const pm = getPM()
  if (!pm) return 0
  const learnedKeys = pm.getLearnedWordKeys?.() ?? new Set<string>()
  let added = 0
  for (const w of vocabBank()) {
    if (added >= count) break
    const key = wordKey(w.word, w.category)
    if (learnedKeys.has(key)) continue
    // Three correct attempts clears the lifecycle bar (totalAttempts≥3,
    // masteryLevel 1.0≥0.8, consecutiveCorrect 3≥2) → reachedLearned.
    for (let i = 0; i < 3; i++) pm.recordWordAttempt(w.word, w.category, true, 'vocabulary')
    added++
  }
  recomputeUnlocks(pm)
  commit()
  return pm.getDerivedLearnedCount?.() ?? 0
}

/** Seed exactly enough learned words to open the expression tier. Returns the new count. */
export function unlockExpressionTier(): number {
  const pm = getPM()
  const have = pm?.getDerivedLearnedCount?.() ?? 0
  const needed = getExpressionUnlock().needed
  if (have >= needed) return have
  return seedLearnedWords(needed - have)
}

/** Force every gated game open (bypasses topic gates seeding can't satisfy). */
export function unlockAllGames(): void {
  const pm = getPM()
  if (!pm) return
  const today = new Date().toISOString().slice(0, 10)
  for (const id of Object.keys(pm.gameUnlocks)) {
    const entry = pm.gameUnlocks[id]
    if (entry && !entry.unlocked) {
      entry.unlocked = true
      entry.unlockedDate = today
    }
  }
  commit()
}

/**
 * Undo the QA seed: clear all vocabulary mastery + grandfathered learned words for
 * the current user (ABC letter mastery is preserved so ABC progress survives).
 * Scores/coins/certificates are untouched — for a full wipe use משתמשים → איפוס.
 */
export function clearLearnedWords(): void {
  const pm = getPM()
  if (!pm) return
  for (const k of Object.keys(pm.wordMastery)) {
    if (pm.wordMastery[k]?.category !== 'abc') delete pm.wordMastery[k]
  }
  for (const k of Object.keys(pm.learnedWords)) delete pm.learnedWords[k]
  commit()
}
