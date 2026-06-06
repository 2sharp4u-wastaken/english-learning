import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildExpressionSession,
  getExpressionUnlock,
  recordExpressionAnswer,
  EXPRESSION_UNLOCK_WORDS,
} from '../expressionGame'
import type { Expression } from '../expressions'
import { resetSettings } from '../settings'
import { setEngineInstances } from '@/engine/instances'
import { ProgressManager } from '@/engine/progress'

/**
 * Slice 5.3 — expression game engine. Covers the unlock gate (50 learned words),
 * the per-mode question building (distractors, true/false balance, blank masking,
 * word-order build), the not-enough fallback, mastery recording, and the engine's
 * keyed-by-phrase expressionMastery. All pure / engine-stubbed — no browser.
 */

// Controlled fixture bank (all kid-friendly so the default register filter keeps them).
const BANK: Expression[] = [
  mk('give up', 'לוותר', "Don't give up on your dreams."),
  mk('piece of cake', 'קל מאוד', 'The test was a piece of cake.'),
  mk('break the ice', 'לשבור את הקרח', 'He told a joke to break the ice.'),
  mk('hit the books', 'ללמוד ברצינות', 'I need to hit the books tonight.'),
  mk('under the weather', 'מרגיש לא טוב', 'She is feeling under the weather.'),
  mk('once in a blue moon', 'לעיתים רחוקות', 'We meet once in a blue moon.'),
]

function mk(phrase: string, meaningHe: string, exampleEn: string): Expression {
  return {
    phrase,
    type: 'idiom',
    register: 'kid-friendly',
    meaningHe,
    meaningHeOptions: [meaningHe],
    exampleEn,
    exampleHe: '',
    difficulty: 'beginner',
  }
}

const recorded: Array<[string, boolean]> = []

function stubEngine(learnedCount: number, bank: Expression[] = BANK): void {
  const progressManager = { getDerivedLearnedCount: () => learnedCount }
  const app = { progressManager, userProgress: { learnedWords: {}, totalPoints: 0 } }
  const gameManager = {
    isGameActive: false,
    recordExpressionAttempt: (phrase: string, isCorrect: boolean) =>
      recorded.push([phrase, isCorrect]),
  }
  setEngineInstances(app as never, gameManager as never)
  ;(window as unknown as { expressionBank: Expression[] }).expressionBank = bank
}

beforeEach(() => {
  recorded.length = 0
  resetSettings()
  stubEngine(EXPRESSION_UNLOCK_WORDS)
})

afterEach(() => {
  setEngineInstances(null as never, null as never)
})

describe('unlock gate', () => {
  it('is locked below the 50-word threshold', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS - 1)
    const u = getExpressionUnlock()
    expect(u.unlocked).toBe(false)
    expect(u.needed).toBe(EXPRESSION_UNLOCK_WORDS)
    expect(u.learnedCount).toBe(EXPRESSION_UNLOCK_WORDS - 1)
  })

  it('unlocks at the threshold when content exists', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS)
    expect(getExpressionUnlock().unlocked).toBe(true)
  })

  it('stays locked with no content even past the threshold', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS + 10, [])
    const u = getExpressionUnlock()
    expect(u.hasContent).toBe(false)
    expect(u.unlocked).toBe(false)
  })

  it('buildExpressionSession returns locked below threshold', () => {
    stubEngine(0)
    const s = buildExpressionSession('meaning')
    expect(s.kind).toBe('locked')
  })
})

describe('meaning mode', () => {
  it('builds 4-option questions whose correct option is the real meaning', () => {
    const s = buildExpressionSession('meaning')
    expect(s.kind).toBe('ready')
    if (s.kind !== 'ready') return
    for (const q of s.questions) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4) // no duplicate options
      expect(q.options[q.correct]).toBe(q.meaningHe)
      expect(q.promptText).toBe(q.phrase)
    }
  })
})

describe('truefalse mode', () => {
  it('uses כן/לא and, over many builds, produces both real and fake claims', () => {
    let sawReal = false
    let sawFake = false
    for (let i = 0; i < 40 && !(sawReal && sawFake); i++) {
      const s = buildExpressionSession('truefalse')
      if (s.kind !== 'ready') continue
      for (const q of s.questions) {
        expect(q.options).toEqual(['כן', 'לא'])
        if (q.correct === 0) {
          sawReal = true
          expect(q.candidateMeaning).toBe(q.meaningHe)
        } else {
          sawFake = true
          expect(q.candidateMeaning).not.toBe(q.meaningHe)
        }
      }
    }
    expect(sawReal).toBe(true)
    expect(sawFake).toBe(true)
  })
})

describe('blank mode', () => {
  it('masks the phrase out of its example and offers it among 4 phrase options', () => {
    const s = buildExpressionSession('blank')
    expect(s.kind).toBe('ready')
    if (s.kind !== 'ready') return
    for (const q of s.questions) {
      expect(q.promptText).toContain('_____')
      expect(q.promptText.toLowerCase()).not.toContain(q.phrase.toLowerCase())
      expect(q.options).toHaveLength(4)
      expect(q.options[q.correct]).toBe(q.phrase)
      expect(q.sublabels).toHaveLength(4)
    }
  })
})

describe('build mode', () => {
  it('scrambles the phrase words and excludes single-word phrases', () => {
    const s = buildExpressionSession('build')
    expect(s.kind).toBe('ready')
    if (s.kind !== 'ready') return
    for (const q of s.questions) {
      expect(q.answerWords!.length).toBeGreaterThanOrEqual(2)
      // Same multiset of words, just (probably) reordered.
      expect([...q.scrambledWords!].sort()).toEqual([...q.answerWords!].sort())
      expect(q.answerWords!.join(' ')).toBe(q.phrase)
      expect(q.promptText).toBe(q.meaningHe)
    }
  })
})

describe('not-enough fallback', () => {
  it('returns not-enough for distractor modes with a tiny bank', () => {
    stubEngine(EXPRESSION_UNLOCK_WORDS, [BANK[0], BANK[1]]) // only 2 → can't make 4 options
    const s = buildExpressionSession('meaning')
    expect(s.kind).toBe('not-enough')
  })
})

describe('mastery recording', () => {
  it('forwards answers to the engine, keyed by phrase', () => {
    recordExpressionAnswer('give up', true)
    recordExpressionAnswer('give up', false)
    expect(recorded).toEqual([
      ['give up', true],
      ['give up', false],
    ])
  })

  it('engine marks a phrase mastered after 3 correct and counts it', () => {
    const pm = new ProgressManager()
    pm.recordExpressionAttempt('give up', true)
    pm.recordExpressionAttempt('give up', false)
    expect(pm.getMasteredExpressionCount()).toBe(0)
    pm.recordExpressionAttempt('give up', true)
    pm.recordExpressionAttempt('give up', true)
    const stats = pm.expressionMastery['give up']
    expect(stats.correct).toBe(3)
    expect(stats.mastered).toBe(true)
    expect(pm.getMasteredExpressionCount()).toBe(1)
  })
})
