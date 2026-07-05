import { describe, it, expect } from 'vitest'
import { AppState } from '../appState'
import { wordKey, canonicalizeWordKey } from '../../lib/wordKey'

/**
 * Word-identity canonicalization (design-flaws fix, 2026-07-05): historic
 * writers keyed wordMastery with the raw-cased `${word}_${category}` while the
 * rest of the app lowercased — "Apple" and "apple" split into two records
 * (double-counted as introduced, never reaching learned). normalizeWordKeys
 * merges the twins on every load.
 */
describe('wordKey helpers', () => {
  it('lowercases the word, keeps the category', () => {
    expect(wordKey('Apple', 'food')).toBe('apple_food')
    expect(wordKey('ice cream', 'food')).toBe('ice cream_food')
  })
  it('canonicalizeWordKey lowercases only the word part (last underscore splits)', () => {
    expect(canonicalizeWordKey('Apple_food')).toBe('apple_food')
    expect(canonicalizeWordKey('Ice Cream_food')).toBe('ice cream_food')
    expect(canonicalizeWordKey('apple_food')).toBe('apple_food')
  })
})

describe('AppState.normalizeWordKeys (load-time migration)', () => {
  const stats = (over: any = {}) => ({
    word: 'Apple',
    category: 'food',
    totalAttempts: 4,
    correctAttempts: 3,
    incorrectAttempts: 1,
    consecutiveCorrect: 2,
    firstSeen: '2026-01-01T00:00:00.000Z',
    lastSeen: '2026-02-01T00:00:00.000Z',
    lastResult: 'correct',
    masteryLevel: 0.75,
    gameTypeStats: { vocabulary: { correct: 3, total: 4 } },
    responseTimes: [1000],
    averageResponseTime: 1000,
    reviewStage: 1,
    reachedLearned: false,
    lapses: 0,
    ...over,
  })

  it('merges a legacy-cased twin into the canonical entry (counters summed)', () => {
    const app = new AppState({ getUserId: () => 'mig' })
    localStorage.setItem(
      'v2_userProgress_mig',
      JSON.stringify({
        ...app.getDefaultProgress(),
        wordMastery: {
          Apple_food: stats(),
          apple_food: stats({
            word: 'apple',
            totalAttempts: 6,
            correctAttempts: 6,
            incorrectAttempts: 0,
            consecutiveCorrect: 5,
            lastSeen: '2026-03-01T00:00:00.000Z',
            masteryLevel: 1,
            reachedLearned: true,
            gameTypeStats: { vocabulary: { correct: 2, total: 2 }, listening: { correct: 4, total: 4 } },
          }),
        },
        learnedWords: { Apple_food: { graduatedDate: '2026-01-05' } },
        version: 4,
      }),
    )

    const progress = app.loadUserProgress()
    expect(progress.wordMastery['Apple_food']).toBeUndefined()
    const merged = progress.wordMastery['apple_food']
    expect(merged.totalAttempts).toBe(10)
    expect(merged.correctAttempts).toBe(9)
    expect(merged.incorrectAttempts).toBe(1)
    expect(merged.reachedLearned).toBe(true)
    expect(merged.masteryLevel).toBe(1)
    expect(merged.lastSeen).toBe('2026-03-01T00:00:00.000Z')
    expect(merged.firstSeen).toBe('2026-01-01T00:00:00.000Z')
    expect(merged.gameTypeStats.vocabulary).toEqual({ correct: 5, total: 6 })
    expect(merged.gameTypeStats.listening).toEqual({ correct: 4, total: 4 })
    // learnedWords re-keyed too
    expect(progress.learnedWords['apple_food']).toEqual({ graduatedDate: '2026-01-05' })
    expect(progress.learnedWords['Apple_food']).toBeUndefined()
  })

  it('re-keys a lone legacy-cased entry without data change', () => {
    const app = new AppState({ getUserId: () => 'mig2' })
    localStorage.setItem(
      'v2_userProgress_mig2',
      JSON.stringify({ ...app.getDefaultProgress(), wordMastery: { Dog_animals: stats({ word: 'Dog', category: 'animals' }) }, version: 4 }),
    )
    const progress = app.loadUserProgress()
    expect(progress.wordMastery['Dog_animals']).toBeUndefined()
    expect(progress.wordMastery['dog_animals'].totalAttempts).toBe(4)
  })

  it('getWordStats/saveWordStats use the canonical key regardless of input casing', () => {
    const app = new AppState({ getUserId: () => 'mig3' })
    app.userProgress = app.getDefaultProgress()
    app.saveWordStats('Cat', 'animals', stats({ word: 'Cat', category: 'animals' }))
    expect(app.userProgress.wordMastery['cat_animals']).toBeDefined()
    expect(app.userProgress.wordMastery['Cat_animals']).toBeUndefined()
    expect(app.getWordStats('CAT', 'animals')).toBeTruthy()
  })
})
