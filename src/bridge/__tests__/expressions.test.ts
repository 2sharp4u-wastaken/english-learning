import { describe, it, expect, beforeEach } from 'vitest'
import {
  getExpressionBank,
  getExpressionsByType,
  getAllExpressions,
  getEnabledRegisters,
  DEFAULT_REGISTERS,
  type Expression,
} from '../expressions'
import { saveSettings, resetSettings } from '../settings'
import {
  setExpressionMeaningOverride,
  removeExpressionMeaningOverride,
} from '../customContent'
// Real authored content — the same module data/_loader.js exposes as window.expressionBank.
// @ts-expect-error untyped legacy JS data module (shape validated by this very spec)
import { expressionBank as rawExpressionBank } from '../../../data/expressions/_index.js'
// Vocabulary source of truth (what builds window.vocabularyBank), for the disjointness check.
// @ts-expect-error untyped legacy JS data module
import * as rawCategories from '../../../data/categories/_index.js'

const expressionBank: Expression[] = rawExpressionBank
const categories = rawCategories as Record<string, Array<{ word?: string }>>

/**
 * Slice 5.1 — Expression Data Model. Pins the schema contract, the register
 * filter (the boundary Slice 5.2's Settings UI will drive), and the hard
 * invariant that the expression catalog stays disjoint from vocabulary so
 * regular vocabulary games never pick up phrases.
 *
 * The bridge reads window.expressionBank (set by data/_loader.js in the real app);
 * here we install the real authored bank onto the global so we test against
 * shipping content, not a fixture.
 */

const TYPES = ['idiom', 'slang', 'phrasal-verb'] as const
const REGISTERS = ['kid-friendly', 'casual', 'edgy'] as const
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const

beforeEach(() => {
  ;(window as unknown as { expressionBank: Expression[] }).expressionBank = expressionBank
  resetSettings()
})

describe('expression content bank', () => {
  it('ships the full authored seed across all three types', () => {
    expect(expressionBank.length).toBeGreaterThanOrEqual(120)
    const counts = TYPES.map((t) => expressionBank.filter((e) => e.type === t).length)
    counts.forEach((c) => expect(c).toBeGreaterThan(0))
  })

  it('every entry satisfies the Expression schema', () => {
    for (const e of expressionBank) {
      expect(typeof e.phrase).toBe('string')
      expect(e.phrase.length).toBeGreaterThan(0)
      expect(TYPES).toContain(e.type)
      expect(REGISTERS).toContain(e.register)
      expect(typeof e.meaningHe).toBe('string')
      expect(e.meaningHe.length).toBeGreaterThan(0)
      expect(Array.isArray(e.meaningHeOptions)).toBe(true)
      expect(e.meaningHeOptions!.length).toBeGreaterThanOrEqual(2)
      // The chosen meaning is always one of (and defaults to the first of) the options.
      expect(e.meaningHeOptions![0]).toBe(e.meaningHe)
      expect(typeof e.exampleEn).toBe('string')
      expect(typeof e.exampleHe).toBe('string')
      expect(DIFFICULTIES).toContain(e.difficulty)
    }
  })

  it('has no duplicate phrases', () => {
    const seen = expressionBank.map((e) => e.phrase.toLowerCase())
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('register filter', () => {
  it('returns only kid-friendly expressions by default', () => {
    const bank = getExpressionBank()
    expect(bank.length).toBeGreaterThan(0)
    expect(bank.every((e) => e.register === 'kid-friendly')).toBe(true)
    // casual/edgy are present in the raw bank but filtered out by default.
    expect(expressionBank.some((e) => e.register === 'casual')).toBe(true)
    expect(getExpressionBank().some((e) => e.register === 'casual')).toBe(false)
  })

  it('defaults match DEFAULT_REGISTERS (kid-friendly on, casual/edgy off)', () => {
    expect(getEnabledRegisters()).toEqual(DEFAULT_REGISTERS)
  })

  it('includes casual/edgy once the parent enables them', () => {
    saveSettings({ expressionRegisters: { 'kid-friendly': true, casual: true, edgy: true } })
    const bank = getExpressionBank()
    expect(bank.some((e) => e.register === 'casual')).toBe(true)
    expect(bank.some((e) => e.register === 'edgy')).toBe(true)
    expect(bank.length).toBe(expressionBank.length)
  })

  it('can disable kid-friendly too (filter is fully data-driven)', () => {
    saveSettings({ expressionRegisters: { 'kid-friendly': false, casual: false, edgy: false } })
    expect(getExpressionBank()).toHaveLength(0)
  })
})

describe('getExpressionsByType', () => {
  it('returns only the requested type, register-filtered', () => {
    saveSettings({ expressionRegisters: { 'kid-friendly': true, casual: true, edgy: true } })
    for (const t of TYPES) {
      const list = getExpressionsByType(t)
      expect(list.every((e) => e.type === t)).toBe(true)
    }
  })
})

describe('catalogs stay disjoint (no vocabulary game picks up expressions)', () => {
  it('no expression phrase collides with a vocabulary word', () => {
    const vocabWords = new Set(
      Object.values(categories)
        .flat()
        .map((w: { word?: string }) => (w.word ?? '').toLowerCase())
        .filter(Boolean),
    )
    const collisions = expressionBank
      .map((e) => e.phrase.toLowerCase())
      .filter((p) => vocabWords.has(p))
    expect(collisions).toEqual([])
  })
})

describe('master switch (Slice 5.2)', () => {
  it('empties the game-facing bank when expressions are disabled', () => {
    saveSettings({ expressionsEnabled: false })
    expect(getExpressionBank()).toHaveLength(0)
    // The manager view still sees everything.
    expect(getAllExpressions().length).toBe(expressionBank.length)
  })

  it('restores the bank when re-enabled', () => {
    saveSettings({ expressionsEnabled: false })
    expect(getExpressionBank()).toHaveLength(0)
    saveSettings({ expressionsEnabled: true })
    expect(getExpressionBank().length).toBeGreaterThan(0)
  })
})

describe('meaning overrides (Slice 5.2)', () => {
  const phrase = 'give up' // kid-friendly phrasal verb → in the default bank

  it('overrides meaningHe in both accessors and survives the register filter', async () => {
    const custom = 'להפסיק לנסות'
    await setExpressionMeaningOverride(phrase, custom)

    const fromAll = getAllExpressions().find((e) => e.phrase === phrase)
    const fromBank = getExpressionBank().find((e) => e.phrase === phrase)
    expect(fromAll?.meaningHe).toBe(custom)
    expect(fromBank?.meaningHe).toBe(custom)
    // The candidate options are untouched (source meaning still recoverable).
    expect(fromAll?.meaningHeOptions?.[0]).not.toBe(custom)
  })

  it('removing the override restores the source meaning', async () => {
    const source = getAllExpressions().find((e) => e.phrase === phrase)!.meaningHeOptions![0]
    await setExpressionMeaningOverride(phrase, 'משהו אחר')
    await removeExpressionMeaningOverride(phrase)
    expect(getAllExpressions().find((e) => e.phrase === phrase)?.meaningHe).toBe(source)
  })
})
