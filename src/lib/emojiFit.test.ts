import { describe, expect, it } from 'vitest'
import { emojiSizeClass, graphemeCount } from './emojiFit'

describe('graphemeCount', () => {
  it('counts a single emoji as one', () => {
    expect(graphemeCount('🐶')).toBe(1)
    expect(graphemeCount('🔟')).toBe(1)
    expect(graphemeCount('1️⃣')).toBe(1)
  })

  it('counts each keycap in a number string once (not per codepoint)', () => {
    expect(graphemeCount('1️⃣3️⃣')).toBe(2) // Thirteen
    expect(graphemeCount('1️⃣0️⃣0️⃣0️⃣')).toBe(4) // Thousand
    expect(graphemeCount('1️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣')).toBe(9) // Billion
  })
})

describe('emojiSizeClass', () => {
  const base = 'text-6xl'

  it('keeps the caller baseline for a single glyph', () => {
    expect(emojiSizeClass('🐶', base)).toBe(base)
    expect(emojiSizeClass('1️⃣', base)).toBe(base)
  })

  it('steps the font size down as the keycap string grows', () => {
    const two = emojiSizeClass('1️⃣3️⃣', base)
    const four = emojiSizeClass('1️⃣0️⃣0️⃣0️⃣', base)
    const nine = emojiSizeClass('1️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣0️⃣', base)
    expect(two).not.toBe(base)
    expect(four).not.toBe(two)
    expect(nine).not.toBe(four)
    // The longest string lands on the smallest tier.
    expect(nine).toContain('text-2xl')
  })
})
