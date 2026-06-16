import { describe, it, expect, beforeEach } from 'vitest'
import { AppState } from '../../engine/appState'
import { ProgressManager } from '../../engine/progress'
import { setEngineInstances } from '../../engine/instances'
import type { GameManager } from '../../engine/gameManager'
import {
  seedLearnedWords,
  unlockAllGames,
  clearLearnedWords,
  unlockExpressionTier,
  getQAStatus,
} from '../qa'

/**
 * QA "unlock for testing" bridge (backlog M12 Slice A). Wires a real AppState +
 * ProgressManager (the same path boot.ts uses) so the lifecycle-count derivation
 * and unlock map are exercised end-to-end, then asserts the levers move the live
 * counts the panel reports.
 */
function harness(bankSize: number) {
  const app = new AppState({ getUserId: () => 'qatest' })
  app.userProgress = app.getDefaultProgress()
  const pm = new ProgressManager()
  pm.initialize(app.userProgress)
  app.progressManager = pm
  setEngineInstances(app, {} as unknown as GameManager)
  ;(window as unknown as { vocabularyBank: unknown[] }).vocabularyBank = Array.from(
    { length: bankSize },
    (_, i) => ({ word: `word${i}`, translation: `t${i}`, category: 'animals', image: '' }),
  )
  return { app, pm }
}

describe('bridge/qa — parent/QA unlock levers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('seedLearnedWords marks words both introduced and learned', () => {
    harness(60)
    const learned = seedLearnedWords(10)
    expect(learned).toBe(10)
    const s = getQAStatus()
    expect(s.introduced).toBe(10)
    expect(s.learned).toBe(10)
  })

  it('seeding adds incrementally and never re-seeds an already-learned word', () => {
    harness(60)
    expect(seedLearnedWords(10)).toBe(10)
    expect(seedLearnedWords(10)).toBe(20) // 10 new words, not the same 10 again
  })

  it('seeding 10 words unlocks the introduced-gated games but not the learned-gated ones', () => {
    const { pm } = harness(60)
    seedLearnedWords(10)
    expect(pm.getGameUnlockStatus('listening')?.unlocked).toBe(true) // introduced ≥ 5
    expect(pm.getGameUnlockStatus('vocabulary')?.unlocked).toBe(true) // introduced ≥ 10
    expect(pm.getGameUnlockStatus('story-time')?.unlocked).toBe(false) // learned ≥ 15
  })

  it('unlockAllGames forces every gated game open (bypasses topic gates)', () => {
    const { pm } = harness(60)
    unlockAllGames()
    expect(pm.getGameUnlockStatus('story-time')?.unlocked).toBe(true)
    expect(pm.getGameUnlockStatus('grammar')?.unlocked).toBe(true) // needs topics — gate bypassed
  })

  it('unlockExpressionTier seeds at least the needed derived-learned words', () => {
    harness(80)
    const learned = unlockExpressionTier()
    expect(learned).toBeGreaterThanOrEqual(getQAStatus().expressionsNeeded)
  })

  it('clearLearnedWords resets the seed but keeps ABC letter mastery', () => {
    const { pm } = harness(60)
    seedLearnedWords(10)
    // Seed an ABC letter directly so we can prove it survives the clear.
    pm.recordWordAttempt('A', 'abc', true, 'abc')
    clearLearnedWords()
    const s = getQAStatus()
    expect(s.introduced).toBe(0)
    expect(s.learned).toBe(0)
    expect(pm.getWordStats('A', 'abc')).not.toBeNull()
  })
})
