import { describe, it, expect } from 'vitest'
import { normalizeSpokenNumerals } from '../pronunciation'

/**
 * Regression for the Word Journey say-word bug: the recognizer transcribes a
 * spoken number word as digits ("nineteen" → "19"), which must still match the
 * target word. SayWordStage runs both sides through normalizeSpokenNumerals.
 */
describe('normalizeSpokenNumerals', () => {
  it('maps digit tokens to English number words', () => {
    expect(normalizeSpokenNumerals('19')).toBe('nineteen')
    expect(normalizeSpokenNumerals('1')).toBe('one')
    expect(normalizeSpokenNumerals('100')).toBe('hundred')
  })

  it('leaves non-numeral words untouched and works token-wise', () => {
    expect(normalizeSpokenNumerals('apple')).toBe('apple')
    expect(normalizeSpokenNumerals('the 19')).toBe('the nineteen')
  })

  it('makes a digit transcript match its target word', () => {
    const said = normalizeSpokenNumerals('19')
    const expected = normalizeSpokenNumerals('nineteen')
    expect(said).toBe(expected)
  })
})
