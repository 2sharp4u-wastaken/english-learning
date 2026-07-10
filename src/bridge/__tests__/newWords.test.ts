import { describe, it, expect } from 'vitest'
import { detectGlossableWords, detectNewWords } from '../newWords'

/**
 * #60 — "tap any word to hear it". detectGlossableWords surfaces EVERY glossable
 * content word (bank → glue → sentence-gloss) regardless of learned status, tagging
 * each isNew; detectNewWords stays the isNew-only subset (unchanged contract).
 */

const BANK = [
  { word: 'Astronaut', translation: 'אסטרונאוט', category: 'astronomy' },
  { word: 'Apple', translation: 'תפוח', category: 'food' },
]

describe('detectGlossableWords (#60)', () => {
  it('includes a LEARNED bank word, tagged isNew:false (fixes the astronaut case)', () => {
    const g = detectGlossableWords('She is an astronaut', {
      bank: BANK,
      learnedSet: new Set(['astronaut']),
    })
    const astro = g.find((w) => w.word === 'astronaut')
    expect(astro).toBeTruthy()
    expect(astro?.isNew).toBe(false)
    expect(astro?.hebrew).toBe('אסטרונאוט')
  })

  it('tags an UNLEARNED bank word isNew:true', () => {
    const g = detectGlossableWords('I ate an apple', { bank: BANK, learnedSet: new Set() })
    expect(g.find((w) => w.word === 'apple')?.isNew).toBe(true)
  })

  it('falls back to the authored sentence-gloss map for non-bank words', () => {
    const g = detectGlossableWords('The mouse is below the box', { bank: [], learnedSet: new Set() })
    const below = g.find((w) => w.word === 'below')
    expect(below?.hebrew).toBe('מִתַּחַת')
  })

  it('does not gloss pure function words', () => {
    const g = detectGlossableWords('the and is of', { bank: BANK, learnedSet: new Set() })
    expect(g).toHaveLength(0)
  })
})

describe('detectNewWords stays the isNew-only subset', () => {
  it('excludes a learned word that detectGlossableWords still returns', () => {
    const opts = { bank: BANK, learnedSet: new Set(['astronaut']) }
    expect(detectGlossableWords('an astronaut', opts).some((w) => w.word === 'astronaut')).toBe(true)
    expect(detectNewWords('an astronaut', opts).some((w) => w.word === 'astronaut')).toBe(false)
  })
})
