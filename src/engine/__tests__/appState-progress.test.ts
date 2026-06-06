import { describe, it, expect } from 'vitest'
import { AppState } from '../appState'

/**
 * Slice 4.6 — in-process port of the pure `getDefaultProgress` schema check
 * formerly in `tests/engine-bridge-contract.spec.js` ('AppManager.getDefaultProgress
 * — v4 schema contract'). `getDefaultProgress()` has no injected-dep or browser
 * coupling, so it belongs as a unit test here. The two *bridge-integration* tests
 * in that spec (begin → recordAnswer → saveState, against the real vocabulary.ts
 * + loaded content) stay in Playwright — they validate the real running app.
 *
 * This pins the v4 default-progress shape so the localStorage migration path keeps
 * existing saves loadable.
 */
describe('AppState.getDefaultProgress — v4 schema contract', () => {
  it('exposes the full v4 top-level key set + a populated gameUnlocks map', () => {
    const app = new AppState({ getUserId: () => 'schemasmoke' })
    const p = app.getDefaultProgress()

    expect(Object.keys(p).sort()).toEqual(
      [
        'bestScores', 'certificates', 'coinHistory', 'coins', 'courses', 'expressionMastery',
        'gameUnlocks', 'hasPlayedBefore', 'lastLoginDate', 'lastPlayDate', 'lastSessionWordKeys',
        'learnedWords', 'streakDays', 'studentName', 'topicProgress', 'totalCorrectAnswers',
        'totalGamesPlayed', 'totalLearningTimeMs', 'totalPoints', 'totalCoinsEarned', 'version',
        'wordJourneyProgress', 'wordMastery',
      ].sort(),
    )
    expect(p.version).toBe(4)
    expect(Object.keys(p.gameUnlocks).length).toBeGreaterThanOrEqual(15)
  })
})
