import { describe, it, expect } from 'vitest'
import {
  deriveWordStatus,
  isDerivedLearned,
  deriveLifecycle,
  DEFAULT_LIFECYCLE_THRESHOLDS,
  type LifecycleWordStats,
} from '../lifecycle'

/**
 * PROG1 (2026-06-14): the pure lifecycle rule is the single source of truth shared
 * by ProgressManager (current user) and bridge/stats.ts (any selected user), so
 * "words learned" (introduced) and "words mastered" (Learned) can never diverge
 * the way Home=31 / Stats=0 did. These pins lock the per-word rule + the snapshot
 * aggregation (mastery ∪ grandfathered, abc-excluded, sticky reachedLearned).
 */

// A word at the exact "learned" bar: ≥3 attempts, ≥0.8 mastery, ≥2 consecutive.
const learnedStats: LifecycleWordStats = {
  word: 'dog',
  category: 'animals',
  totalAttempts: 4,
  masteryLevel: 0.9,
  consecutiveCorrect: 3,
}
// Introduced but not yet mastered.
const learningStats: LifecycleWordStats = {
  word: 'cat',
  category: 'animals',
  totalAttempts: 2,
  masteryLevel: 0.5,
  consecutiveCorrect: 1,
}

describe('isDerivedLearned', () => {
  it('requires all three thresholds (attempts, mastery, consecutive)', () => {
    expect(isDerivedLearned(learnedStats)).toBe(true)
    expect(isDerivedLearned({ ...learnedStats, totalAttempts: 2 })).toBe(false)
    expect(isDerivedLearned({ ...learnedStats, masteryLevel: 0.79 })).toBe(false)
    expect(isDerivedLearned({ ...learnedStats, consecutiveCorrect: 1 })).toBe(false)
    expect(isDerivedLearned(null)).toBe(false)
  })
})

describe('deriveWordStatus', () => {
  it('classifies new / learning / learned', () => {
    expect(deriveWordStatus(null, false)).toBe('new')
    expect(deriveWordStatus({ totalAttempts: 0 }, false)).toBe('new')
    expect(deriveWordStatus(learningStats, false)).toBe('learning')
    expect(deriveWordStatus(learnedStats, false)).toBe('learned')
  })

  it('grandfathered words are learned even with no/weak stats', () => {
    expect(deriveWordStatus(null, true)).toBe('learned')
    expect(deriveWordStatus(learningStats, true)).toBe('learned')
  })

  it('sticky reachedLearned keeps a dipped word learned', () => {
    // mastery dipped below the bar but the sticky flag holds it Learned.
    const dipped: LifecycleWordStats = {
      totalAttempts: 5,
      masteryLevel: 0.6,
      consecutiveCorrect: 0,
      reachedLearned: true,
    }
    expect(isDerivedLearned(dipped)).toBe(false)
    expect(deriveWordStatus(dipped, false)).toBe('learned')
  })

  it('introduced is forever — a fumbled word stays learning, never new', () => {
    expect(deriveWordStatus({ totalAttempts: 1, masteryLevel: 0.1, consecutiveCorrect: 0 }, false)).toBe(
      'learning',
    )
  })
})

describe('deriveLifecycle', () => {
  it('counts introduced (learning ∪ learned) and learned from a snapshot', () => {
    const res = deriveLifecycle({
      wordMastery: {
        dog_animals: learnedStats,
        cat_animals: learningStats,
        fish_animals: { word: 'fish', category: 'animals', totalAttempts: 0 }, // new
      },
    })
    expect(res.introducedCount).toBe(2) // dog + cat
    expect(res.learnedCount).toBe(1) // dog
    expect(res.byStatus).toEqual({ new: 1, learning: 1, learned: 1 })
  })

  it('excludes ABC letter entries from both counts', () => {
    const res = deriveLifecycle({
      wordMastery: {
        a_abc: { word: 'a', category: 'abc', totalAttempts: 5, masteryLevel: 1, consecutiveCorrect: 5 },
        dog_animals: learnedStats,
      },
    })
    expect(res.introducedCount).toBe(1)
    expect(res.learnedCount).toBe(1)
  })

  it('unions grandfathered learnedWords without double-counting the mastery entry', () => {
    const res = deriveLifecycle({
      wordMastery: { dog_animals: learnedStats }, // also grandfathered below
      learnedWords: { dog_animals: { graduatedDate: '2026-01-01' }, owl_animals: {} },
    })
    // dog (mastery+stamp = one word) + owl (stamp only) = 2 learned, 2 introduced.
    expect(res.introducedCount).toBe(2)
    expect(res.learnedCount).toBe(2)
  })

  it('grandfathered ABC stamp keys are excluded too', () => {
    const res = deriveLifecycle({ learnedWords: { a_abc: {}, dog_animals: {} } })
    expect(res.introducedCount).toBe(1)
    expect(res.learnedCount).toBe(1)
  })

  it('empty snapshot → all zeros', () => {
    const res = deriveLifecycle({})
    expect(res.introducedCount).toBe(0)
    expect(res.learnedCount).toBe(0)
    expect(res.introducedKeys.size).toBe(0)
  })

  it('honors custom thresholds', () => {
    const stats: LifecycleWordStats = { totalAttempts: 2, masteryLevel: 0.8, consecutiveCorrect: 2 }
    expect(deriveLifecycle({ wordMastery: { x_food: stats } }).learnedCount).toBe(0) // 2 < default 3
    const loose = { ...DEFAULT_LIFECYCLE_THRESHOLDS, minAttempts: 2 }
    expect(deriveLifecycle({ wordMastery: { x_food: stats } }, loose).learnedCount).toBe(1)
  })
})
