import type { UserProgress, UserSummary, WordStats, Certificate, LearnedWordEntry } from './types'
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
  return (window as any).appManager ?? null
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
    wordsLearned: Object.keys(p.learnedWords ?? {}).length,
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
 * Get all earned certificates.
 */
export function getCertificates(): Certificate[] {
  const p = getUserProgress()
  return p?.certificates ?? []
}

/**
 * Get the number of mastered words (masteryLevel >= 0.8).
 */
export function getWordsMasteredCount(): number {
  const mgr = getAppManager()
  if (mgr?.progressManager?.getMasteryStats) {
    return mgr.progressManager.getMasteryStats().mastered ?? 0
  }
  const p = getUserProgress()
  if (!p?.wordMastery) return 0
  return Object.values(p.wordMastery).filter(
    (w) => (w.masteryLevel ?? 0) >= 0.8,
  ).length
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
