import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SentenceText } from '../NewWordPill'
import type { GlossWord } from '@/bridge/newWords'

/**
 * #60 two-tier rendering: isNew words render as prominent pills (up to maxPills),
 * every other glossable word (learned, or new past the cap) renders as a quiet
 * tap-to-hear word — so the "new" signal stays legible.
 */

const g = (word: string, isNew: boolean): GlossWord => ({ word, hebrew: `he-${word}`, isNew })

function countTestid(html: string, id: string): number {
  return html.split(`data-testid="${id}"`).length - 1
}

describe('SentenceText tiers (#60)', () => {
  it('renders an unlearned word as a pill and a learned word as quiet', () => {
    const map = new Map<string, GlossWord>([
      ['apple', g('apple', true)],
      ['astronaut', g('astronaut', false)],
    ])
    const html = renderToStaticMarkup(
      h(SentenceText, { text: 'an apple and astronaut', newWords: map, renderWord: (s: string) => s, maxPills: 3 }),
    )
    expect(html).toContain('data-testid="new-word-pill"')
    expect(html).toContain('data-word="apple"')
    expect(html).toContain('data-testid="quiet-word"')
    expect(html).toContain('data-word="astronaut"')
  })

  it('caps prominent pills at maxPills; overflow new words fall back to quiet', () => {
    const map = new Map<string, GlossWord>([
      ['one', g('one', true)],
      ['two', g('two', true)],
      ['three', g('three', true)],
      ['four', g('four', true)],
    ])
    const html = renderToStaticMarkup(
      h(SentenceText, { text: 'one two three four', newWords: map, renderWord: (s: string) => s, maxPills: 2 }),
    )
    expect(countTestid(html, 'new-word-pill')).toBe(2)
    expect(countTestid(html, 'quiet-word')).toBe(2)
  })
})
