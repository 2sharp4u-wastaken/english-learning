import { describe, it, expect, beforeEach } from 'vitest'
import { buildUserStatsModel } from '../stats'

/**
 * PROG1 regression (2026-06-14): reproduce the exact reported bug — Home shows
 * "31 מילים שלמדתי" while Stats showed "0 מילים נלמדו". Cause: Stats read the
 * legacy `learnedWords` stamp (written only by full Word-Journey graduation) while
 * the V3 model derives learned from `wordMastery`. After the fix, `learnedCount`
 * = introduced (matches Home) and `masteredCount` = derived Learned, both from the
 * shared pure lifecycle rule over the user's snapshot.
 */

function seedProgress(userId: string, progress: Record<string, unknown>) {
  localStorage.setItem(`v2_userProgress_${userId}`, JSON.stringify(progress))
}

describe('buildUserStatsModel — PROG1 introduced vs mastered', () => {
  beforeEach(() => localStorage.clear())

  it('learnedCount = introduced (wordMastery), not the empty learnedWords stamp', () => {
    const wordMastery: Record<string, unknown> = {}
    // 31 words practiced; 3 of them at the mastery bar (≥3 attempts, ≥0.8, ≥2 consec).
    for (let i = 0; i < 31; i++) {
      const mastered = i < 3
      wordMastery[`w${i}_animals`] = {
        word: `w${i}`,
        category: 'animals',
        totalAttempts: mastered ? 4 : 1,
        correctAttempts: mastered ? 4 : 1,
        incorrectAttempts: 0,
        consecutiveCorrect: mastered ? 4 : 1,
        masteryLevel: mastered ? 1 : 0.4,
      }
    }
    // The bug scenario: stamp is EMPTY (kid never completed a full Word Journey).
    seedProgress('kid', { wordMastery, learnedWords: {} })

    const m = buildUserStatsModel('kid', 'זוהר')
    expect(m.learnedCount).toBe(31) // introduced — now matches Home's 31
    expect(m.masteredCount).toBe(3) // derived Learned (the rigorous gate metric)
    // Guard against regressing to the legacy reading, which was 0:
    expect(Object.keys(m.progress.learnedWords || {}).length).toBe(0)
  })

  it('ABC letter entries are excluded from both counts', () => {
    seedProgress('kid', {
      wordMastery: {
        a_abc: { word: 'a', category: 'abc', totalAttempts: 5, masteryLevel: 1, consecutiveCorrect: 5 },
        dog_animals: { word: 'dog', category: 'animals', totalAttempts: 4, masteryLevel: 1, consecutiveCorrect: 3 },
      },
      learnedWords: {},
    })
    const m = buildUserStatsModel('kid', 'זוהר')
    expect(m.learnedCount).toBe(1)
    expect(m.masteredCount).toBe(1)
  })

  it('grandfathered Word-Journey graduations still count as learned + mastered', () => {
    seedProgress('kid', {
      wordMastery: {},
      learnedWords: { owl_animals: { graduatedDate: '2026-01-01' } },
    })
    const m = buildUserStatsModel('kid', 'זוהר')
    expect(m.learnedCount).toBe(1)
    expect(m.masteredCount).toBe(1)
  })

  it('weekly velocity counts new words met in the last 7 days via firstSeen', () => {
    const recent = new Date().toISOString()
    const old = new Date(Date.now() - 30 * 864e5).toISOString()
    seedProgress('kid', {
      wordMastery: {
        new1_food: { word: 'new1', category: 'food', totalAttempts: 1, masteryLevel: 0.3, firstSeen: recent },
        new2_food: { word: 'new2', category: 'food', totalAttempts: 1, masteryLevel: 0.3, firstSeen: recent },
        old1_food: { word: 'old1', category: 'food', totalAttempts: 1, masteryLevel: 0.3, firstSeen: old },
      },
      learnedWords: {},
    })
    expect(buildUserStatsModel('kid', 'זוהר').learningVelocity).toBe(2)
  })
})
