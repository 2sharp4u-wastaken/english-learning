import { describe, it, expect } from 'vitest'
import { stripSpeechEmoji } from '../stripEmoji'

describe('stripSpeechEmoji', () => {
  it('removes a trailing emoji and tidies the space (the owl message bug)', () => {
    expect(stripSpeechEmoji('כבר למדת 5 מילים! ממשיכים? 🌟')).toBe('כבר למדת 5 מילים! ממשיכים?')
    expect(stripSpeechEmoji('כל הכבוד! 3 ימים ברצף! 🔥')).toBe('כל הכבוד! 3 ימים ברצף!')
    expect(stripSpeechEmoji('יאללה, בוא נלמד מילים חדשות! 🚀')).toBe('יאללה, בוא נלמד מילים חדשות!')
  })

  it('removes emoji mid-string and collapses the gap', () => {
    expect(stripSpeechEmoji('שלום 👋 חבר')).toBe('שלום חבר')
  })

  it('handles compound emoji (ZWJ, skin tone, keycap, variation selector)', () => {
    expect(stripSpeechEmoji('היי 👍🏽 כל הכבוד')).toBe('היי כל הכבוד')
    expect(stripSpeechEmoji('שלב 1️⃣ הסתיים')).toBe('שלב הסתיים')
  })

  it('leaves plain Hebrew/English/punctuation/digits untouched', () => {
    expect(stripSpeechEmoji('שלום עידן')).toBe('שלום עידן')
    expect(stripSpeechEmoji('Excellent pronunciation!')).toBe('Excellent pronunciation!')
  })

  it('is safe on empty / emoji-only input', () => {
    expect(stripSpeechEmoji('')).toBe('')
    expect(stripSpeechEmoji('🚀🔥')).toBe('')
  })
})
