import { describe, expect, it } from 'vitest'
import { getLetterSpeech } from '../letterSpeech'

describe('getLetterSpeech (M18)', () => {
  it('replaces the spell-prone two-char respellings (the reported bug)', () => {
    // These used to be voiced letter-by-letter ("ar" → "a r", "ee" → "e e").
    expect(getLetterSpeech('R', 'ar')).toBe('arr')
    expect(getLetterSpeech('E', 'ee')).toBe('eee')
    expect(getLetterSpeech('F', 'ef')).toBe('eff')
    expect(getLetterSpeech('L', 'el')).toBe('ell')
    expect(getLetterSpeech('M', 'em')).toBe('emm')
    expect(getLetterSpeech('N', 'en')).toBe('enn')
    expect(getLetterSpeech('X', 'ex')).toBe('ecks')
  })

  it('keeps the already word-like names usable', () => {
    expect(getLetterSpeech('B')).toBe('bee')
    expect(getLetterSpeech('Q')).toBe('cue')
    expect(getLetterSpeech('W')).toBe('double-you')
  })

  it('is case-insensitive on the single-letter key', () => {
    expect(getLetterSpeech('r')).toBe('arr')
    expect(getLetterSpeech('e')).toBe('eee')
  })

  it('falls back to the supplied phonetic for unknown input', () => {
    expect(getLetterSpeech('', 'fallback')).toBe('fallback')
    expect(getLetterSpeech('123', 'xyz')).toBe('xyz')
  })
})
