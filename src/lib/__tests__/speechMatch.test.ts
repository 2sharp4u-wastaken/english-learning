import { describe, it, expect } from 'vitest'
import { isBalancedSpeechMatch } from '../speechMatch'

/**
 * M10 (2026-06-14): the say-it games (ABC/Phonics/Word Journey) used to accept
 * whole wrong words and fragments. These pin the balanced replacement — the
 * exact false-accepts the user reported must fail, real attempts must pass.
 */
describe('isBalancedSpeechMatch', () => {
  it('accepts an exact match', () => {
    expect(isBalancedSpeechMatch('peach', 'peach')).toBe(true)
    expect(isBalancedSpeechMatch('elephant', 'elephant')).toBe(true)
  })

  it('rejects a one-consonant-swap word (the beach/peach giveaway)', () => {
    expect(isBalancedSpeechMatch('peach', 'beach')).toBe(false)
    expect(isBalancedSpeechMatch('ship', 'chip')).toBe(false)
    expect(isBalancedSpeechMatch('cat', 'bat')).toBe(false)
  })

  it('rejects a bare fragment of the target', () => {
    expect(isBalancedSpeechMatch('peach', 'each')).toBe(false)
    expect(isBalancedSpeechMatch('bee', 'ee')).toBe(false)
  })

  it('tolerates a plural / minor tail difference on longer words', () => {
    expect(isBalancedSpeechMatch('ship', 'ships')).toBe(true)
    expect(isBalancedSpeechMatch('elephant', 'elephants')).toBe(true)
  })

  it('handles multi-word targets by word count + per-word match', () => {
    expect(isBalancedSpeechMatch('ice cream', 'ice cream')).toBe(true)
    expect(isBalancedSpeechMatch('ice cream', 'ice')).toBe(false) // word-count mismatch
  })

  it('normalizes numerals both directions (Word Journey)', () => {
    expect(isBalancedSpeechMatch('nineteen', '19')).toBe(true)
    expect(isBalancedSpeechMatch('19', 'nineteen')).toBe(true)
  })

  it('expands compound digit transcripts to words (issue #29)', () => {
    // ASR returns "31" for the spoken target "Thirty-one"
    expect(isBalancedSpeechMatch('thirty-one', '31')).toBe(true)
    expect(isBalancedSpeechMatch('Thirty-one', '31')).toBe(true)
    expect(isBalancedSpeechMatch('twenty-one', '21')).toBe(true)
    expect(isBalancedSpeechMatch('fifty-one', '51')).toBe(true)
    // round tens still work
    expect(isBalancedSpeechMatch('thirty', '30')).toBe(true)
    // hundred/thousand stay single words
    expect(isBalancedSpeechMatch('hundred', '100')).toBe(true)
    expect(isBalancedSpeechMatch('thousand', '1000')).toBe(true)
    // wrong number still rejected
    expect(isBalancedSpeechMatch('thirty-one', '41')).toBe(false)
  })

  it('empty / unrecognized transcript never matches', () => {
    expect(isBalancedSpeechMatch('peach', '')).toBe(false)
    expect(isBalancedSpeechMatch('', 'peach')).toBe(false)
  })

  describe('ABC say-letter (phonetic target + bare-letter alias)', () => {
    const abc = (phonetic: string, letter: string, said: string) =>
      isBalancedSpeechMatch(phonetic, said, { aliases: [letter] })

    it('accepts the phonetic, the bare letter, and case/spacing variants', () => {
      expect(abc('bee', 'b', 'bee')).toBe(true)
      expect(abc('bee', 'b', 'b')).toBe(true)
      expect(abc('double-u', 'w', 'double u')).toBe(true) // hyphen↔space fold
      expect(abc('double-u', 'w', 'w')).toBe(true)
    })

    it('rejects a different letter (the false-accept bug)', () => {
      expect(abc('bee', 'b', 'see')).toBe(false) // C said for B
      expect(abc('bee', 'b', 'pee')).toBe(false) // P said for B
      expect(abc('ee', 'e', 'ef')).toBe(false) // F said for E
      expect(abc('ee', 'e', 'eye')).toBe(false) // I said for E
    })
  })
})
