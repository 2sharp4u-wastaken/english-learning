import { describe, expect, it } from 'vitest'
import { getLetterSpeech } from '../letterSpeech'

describe('getLetterSpeech (M18, revised #37/#38)', () => {
  it('avoids spell-prone two-char respellings — single uppercase or a real word', () => {
    // These used to be voiced letter-by-letter ("ar" → "a r", "ee" → "e e"). The
    // #37/#38 fix replaced the respellings with EITHER a single uppercase letter
    // (TTS cannot spell one char, so it must say the name) or a matching English
    // word (R→"are", X→"ex"). The supplied phonetic is ignored once the letter is
    // in the 26-letter map.
    expect(getLetterSpeech('R', 'ar')).toBe('are')
    expect(getLetterSpeech('E', 'ee')).toBe('E')
    expect(getLetterSpeech('F', 'ef')).toBe('F')
    expect(getLetterSpeech('L', 'el')).toBe('L')
    expect(getLetterSpeech('M', 'em')).toBe('M')
    expect(getLetterSpeech('N', 'en')).toBe('N')
    expect(getLetterSpeech('S', 'es')).toBe('S')
    expect(getLetterSpeech('X', 'ex')).toBe('ex')
  })

  it('keeps the already word-like names usable', () => {
    expect(getLetterSpeech('B')).toBe('bee')
    expect(getLetterSpeech('Q')).toBe('cue')
    expect(getLetterSpeech('W')).toBe('double-you')
  })

  it('is case-insensitive on the single-letter key', () => {
    expect(getLetterSpeech('r')).toBe('are')
    expect(getLetterSpeech('e')).toBe('E')
  })

  it('falls back to the supplied phonetic for unknown input', () => {
    expect(getLetterSpeech('', 'fallback')).toBe('fallback')
    expect(getLetterSpeech('123', 'xyz')).toBe('xyz')
  })
})
