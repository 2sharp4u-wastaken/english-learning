import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getPlayerUnlocks,
  setPlayerUnlocks,
  isExpressionsUnlockedForCurrentUser,
} from '../playerUnlocks'
import { getExpressionUnlock, EXPRESSION_UNLOCK_WORDS } from '../expressionGame'
import type { Expression } from '../expressions'
import { resetSettings } from '../settings'
import { setEngineInstances } from '@/engine/instances'

/**
 * Per-player parent unlocks (minimal: ביטויים). Pins that the blob is per-user and
 * parameterized (the parent sets a CHILD's blob), and that the expression gate
 * honors the current player's flag — bypassing the 50-word gate for that kid only,
 * but still requiring expression content to exist.
 */

const BANK: Expression[] = [
  mk('give up', 'לוותר'),
  mk('piece of cake', 'קל מאוד'),
  mk('break the ice', 'לשבור את הקרח'),
  mk('hit the books', 'ללמוד ברצינות'),
]

function mk(phrase: string, meaningHe: string): Expression {
  return {
    phrase, type: 'idiom', register: 'kid-friendly', meaningHe,
    meaningHeOptions: [meaningHe], exampleEn: `Use ${phrase}.`, exampleHe: '',
    difficulty: 'beginner',
  }
}

function stubEngine(learnedCount: number, bank: Expression[] = BANK): void {
  const app = { progressManager: { getDerivedLearnedCount: () => learnedCount }, userProgress: {} }
  setEngineInstances(app as never, {} as never)
  ;(window as unknown as { expressionBank: Expression[] }).expressionBank = bank
}

/** Simulate a logged-in player — getCurrentUserId reads the session, not `currentUser`. */
function loginAs(userId: string): void {
  localStorage.setItem(
    'currentSession',
    JSON.stringify({
      userId, userName: userId, displayName: userId, initial: userId[0],
      loginTime: Date.now(), lastActivity: Date.now(), authenticated: true,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  resetSettings()
})

afterEach(() => {
  setEngineInstances(null as never, null as never)
})

describe('playerUnlocks bridge — per-user, parameterized', () => {
  it('reads empty for unknown / null users', () => {
    expect(getPlayerUnlocks('kid')).toEqual({})
    expect(getPlayerUnlocks(null)).toEqual({})
  })

  it('sets and reads a specific child without affecting siblings', () => {
    setPlayerUnlocks('kidA', { expressions: true })
    expect(getPlayerUnlocks('kidA').expressions).toBe(true)
    expect(getPlayerUnlocks('kidB').expressions).toBeUndefined()
  })

  it('isExpressionsUnlockedForCurrentUser follows the logged-in user', () => {
    setPlayerUnlocks('kidA', { expressions: true })
    loginAs('kidA')
    expect(isExpressionsUnlockedForCurrentUser()).toBe(true)
    loginAs('kidB')
    expect(isExpressionsUnlockedForCurrentUser()).toBe(false)
  })
})

describe('expression gate honors the per-player unlock', () => {
  it('opens ביטויים below the 50-word gate for an unlocked child only', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS - 10) // well under the gate

    loginAs('kidA')
    expect(getExpressionUnlock().unlocked).toBe(false) // not unlocked yet

    setPlayerUnlocks('kidA', { expressions: true })
    expect(getExpressionUnlock().unlocked).toBe(true) // kidA opened

    loginAs('kidB')
    expect(getExpressionUnlock().unlocked).toBe(false) // sibling still gated
  })

  it('still requires content even when the child is unlocked', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS - 10, []) // no expression content
    loginAs('kidA')
    setPlayerUnlocks('kidA', { expressions: true })
    const u = getExpressionUnlock()
    expect(u.hasContent).toBe(false)
    expect(u.unlocked).toBe(false)
  })
})
