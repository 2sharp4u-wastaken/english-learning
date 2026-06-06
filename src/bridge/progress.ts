import type { UserProgress, UserSummary, WordStats, Certificate, LearnedWordEntry } from './types'
import { getApp } from '../engine/instances'
import { getKey, v2Key } from './storage'
import { getCurrentUserId } from './auth'

// ─── Legacy global access ────────────────────────────────────────────────────

interface LegacyAppManager {
  userProgress: UserProgress | null
  progressManager?: {
    getLearnedWordCount(): number
    getMasteryStats(): { total: number; mastered: number; learning: number; struggling: number; newWords: number }
    getLearnedWords(): Record<string, LearnedWordEntry>
    wordMastery: Record<string, WordStats>
    thresholds: { mastered: number; learning: number }
  } | null
}

function getAppManager(): LegacyAppManager | null {
  return getApp() as unknown as LegacyAppManager | null
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * Load the full user progress object.
 * Reads from the legacy appManager first, falls back to localStorage.
 */
export function getUserProgress(): UserProgress | null {
  const mgr = getAppManager()
  if (mgr?.userProgress) return mgr.userProgress

  const userId = getCurrentUserId()
  if (!userId) return null
  return getKey<UserProgress>(v2Key(`userProgress_${userId}`))
}

// ─── V3 mastery-driven learned helpers (docs/learning-flow-redesign.md) ───────
// "Learned" is now derived from wordMastery (∪ grandfathered), NOT the legacy
// learnedWords stamp — Word Journey no longer writes that stamp. Everything that
// needs a "learned" count/set must go through these so it tracks new progress.

function getProgressManager(): {
  getDerivedLearnedCount?: () => number
  getIntroducedCount?: () => number
  getLearnedWordKeys?: () => Set<string>
} | null {
  return getApp()?.progressManager ?? null
}

/** Derived "Learned" count (mastery-stable ∪ grandfathered, excl. ABC letters). */
export function getDerivedLearnedCount(): number {
  const pm = getProgressManager()
  if (pm?.getDerivedLearnedCount) return pm.getDerivedLearnedCount()
  return Object.keys(getUserProgress()?.learnedWords ?? {}).length
}

/** Count of words the child has been introduced to (Learning ∪ Learned). */
export function getIntroducedCount(): number {
  const pm = getProgressManager()
  if (pm?.getIntroducedCount) return pm.getIntroducedCount()
  return Object.keys(getUserProgress()?.learnedWords ?? {}).length
}

/**
 * The word-collection map keyed by derived-Learned words (preserving the
 * grandfathered graduation date where one exists). Replaces the raw stamp so the
 * sticker book stays populated under the V3 model (the stamp no longer grows).
 */
export function getLearnedCollection(): Record<string, { graduatedDate?: string }> {
  const stamp = getLearnedWords()
  const out: Record<string, { graduatedDate?: string }> = {}
  for (const key of getLearnedWordKeySet()) out[key] = stamp[key] ?? {}
  return out
}

/** Derived "Learned" word-key set for consolidation-tier content selection. */
export function getLearnedWordKeySet(): Set<string> {
  const pm = getProgressManager()
  if (pm?.getLearnedWordKeys) return pm.getLearnedWordKeys()
  return new Set(Object.keys(getUserProgress()?.learnedWords ?? {}))
}

/**
 * Get a high-level summary of the current user's progress.
 */
export function getUserSummary(): UserSummary {
  const p = getUserProgress()
  if (!p) {
    return { streakDays: 0, wordsLearned: 0, coins: 0, totalScore: 0, totalGamesPlayed: 0 }
  }
  return {
    streakDays: p.streakDays ?? 0,
    // V3 (redesign §8): "words learned" = introduced (words met) for momentum;
    // mastery is reported separately as getWordsMasteredCount (= derived Learned).
    wordsLearned: getIntroducedCount(),
    coins: p.coins ?? 0,
    totalScore: p.totalPoints ?? 0,
    totalGamesPlayed: p.totalGamesPlayed ?? 0,
  }
}

/**
 * Get all word mastery entries.
 */
export function getWordMastery(): WordStats[] {
  const p = getUserProgress()
  if (!p?.wordMastery) return []
  return Object.values(p.wordMastery)
}

/**
 * Phase 5 expression mastery, keyed by phrase (Slice 5.3). Separate from
 * wordMastery — feeds the expression games and (later, Slice 5.5) the Profile /
 * Stats expression surfaces. Shape: { phrase, seen, correct, mastered, lastSeen }.
 */
export function getExpressionMastery(): Array<{
  phrase: string
  seen: number
  correct: number
  mastered: boolean
  lastSeen: string | null
}> {
  const p = getUserProgress() as { expressionMastery?: Record<string, any> } | null
  if (!p?.expressionMastery) return []
  return Object.values(p.expressionMastery)
}

/** Count of phrases the child has mastered (≥3 correct). */
export function getMasteredExpressionCount(): number {
  return getExpressionMastery().filter((e) => e.mastered).length
}

/**
 * Get all earned certificates.
 */
export function getCertificates(): Certificate[] {
  const p = getUserProgress()
  return p?.certificates ?? []
}

/**
 * Number of words "mastered" — under the V3 model this is the derived Learned
 * count (mastery-stable ∪ grandfathered), the same number the consolidation
 * gates use, so the profile "שליטה" stat matches what unlocks the hard games.
 */
export function getWordsMasteredCount(): number {
  return getDerivedLearnedCount()
}

/**
 * Get learned words map (graduated words with metadata).
 */
export function getLearnedWords(): Record<string, LearnedWordEntry> {
  const mgr = getAppManager()
  if (mgr?.progressManager?.getLearnedWords) {
    return mgr.progressManager.getLearnedWords()
  }
  const p = getUserProgress()
  return p?.learnedWords ?? {}
}

/**
 * Get best scores per game type.
 */
export function getBestScores(): Record<string, number> {
  const p = getUserProgress()
  return p?.bestScores ?? {}
}

/**
 * Get activity dates (ISO date strings for days the user was active).
 */
export function getActivityDates(): string[] {
  const p = getUserProgress()
  return p?.activityDates ?? []
}

/**
 * Get the vocabulary bank from the legacy global.
 */
export function getVocabularyBank(): Array<{ word: string; translation: string; category: string; image: string }> {
  return (window as any).vocabularyBank ?? []
}

// ─── Admin-only: per-user resets ────────────────────────────────────────────

const RESET_GAME_TYPES = [
  'vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening',
  'reading', 'abc', 'memory', 'scramble', 'fill-blanks', 'practice',
  'true-or-not', 'picture-match', 'word-journey', 'story-time',
]

/**
 * Reset only the "practice" data (wordMastery) for a user. Keeps scores,
 * certificates, coins intact. Used by the Users tab reset-practice action.
 */
export function resetUserPractice(userId: string): void {
  const key = v2Key(`userProgress_${userId}`)
  const progress = (getKey<UserProgress>(key) ?? {}) as Partial<UserProgress>
  progress.wordMastery = {}
  localStorage.setItem(key, JSON.stringify(progress))
}

/**
 * Reset ALL stats for a user (scores, history, coins, certificates, mastery,
 * learned words, activity). Preserves version and settings. Used by the
 * Users tab reset-stats action.
 */
export function resetUserStats(userId: string): void {
  for (const game of RESET_GAME_TYPES) {
    localStorage.removeItem(`${userId}_${game}_history`)
  }
  localStorage.removeItem(`memoryBest_${userId}`)

  const key = v2Key(`userProgress_${userId}`)
  const progress = (getKey<UserProgress>(key) ?? {}) as Partial<UserProgress> & Record<string, unknown>
  progress.bestScores = {}
  progress.totalGamesPlayed = 0
  ;(progress as Record<string, unknown>).gameHistory = {}
  progress.streakDays = 0
  progress.lastPlayDate = null
  // Prevent the daily coin bonus from re-firing on next load.
  progress.lastLoginDate = new Date().toISOString().split('T')[0]
  progress.totalCorrectAnswers = 0
  progress.totalPoints = 0
  progress.totalLearningTimeMs = 0
  progress.coins = 0
  progress.coinHistory = []
  progress.certificates = []
  progress.learnedWords = {}
  progress.wordMastery = {}
  progress.gameUnlocks = {}
  progress.activityDates = []
  progress.wordJourneyProgress = {}
  localStorage.setItem(key, JSON.stringify(progress))
}
