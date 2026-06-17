import { describe, it, expect, beforeEach } from 'vitest'
import { getAllGameUnlocks, getGameUnlockState, isContentFullyExposed } from '../games'
import { getExpressionUnlock } from '../expressionGame'

/**
 * M12 Slice B — the parent "expose all content" toggle (`gameUnlockOverride`).
 * It must, read-time, report every game tile unlocked AND open the expression
 * tier, WITHOUT mutating stored progress (toggling off restores real gates).
 */

function seedProgress(gameUnlocks: Record<string, { unlocked: boolean }>) {
  localStorage.setItem(
    'currentSession',
    JSON.stringify({ userId: 'kid', userName: 'k', displayName: 'k', initial: 'k', loginTime: Date.now(), lastActivity: Date.now(), authenticated: true }),
  )
  localStorage.setItem('v2_userProgress_kid', JSON.stringify({ gameUnlocks }))
}

function setOverride(on: boolean) {
  localStorage.setItem('v2_englishLearningSettings', JSON.stringify({ gameUnlockOverride: on }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('expose-all-content overlay', () => {
  it('off: locked games stay locked', () => {
    setOverride(false)
    seedProgress({ vocabulary: { unlocked: false }, listening: { unlocked: true } })
    expect(isContentFullyExposed()).toBe(false)
    expect(getAllGameUnlocks().vocabulary.unlocked).toBe(false)
    expect(getGameUnlockState('vocabulary')?.unlocked).toBe(false)
  })

  it('on: every entry reads unlocked, stored progress untouched', () => {
    setOverride(true)
    seedProgress({ vocabulary: { unlocked: false }, scramble: { unlocked: false } })
    expect(isContentFullyExposed()).toBe(true)
    expect(getAllGameUnlocks().vocabulary.unlocked).toBe(true)
    expect(getAllGameUnlocks().scramble.unlocked).toBe(true)
    expect(getGameUnlockState('vocabulary')?.unlocked).toBe(true)
    // The persisted map is NOT mutated — toggling off would restore the gates.
    const stored = JSON.parse(localStorage.getItem('v2_userProgress_kid') as string)
    expect(stored.gameUnlocks.vocabulary.unlocked).toBe(false)
  })
})

describe('expose-all opens the expression tier', () => {
  it('on: expression unlock is true regardless of learned count (when content exists)', () => {
    setOverride(true)
    seedProgress({})
    const u = getExpressionUnlock()
    // hasContent depends on the loaded expression bank; assert the override path
    // is honored: unlocked === hasContent (not gated on the 50-word threshold).
    expect(u.unlocked).toBe(u.hasContent)
  })
})
