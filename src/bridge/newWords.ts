import { getLearnedWordKeySet } from './progress'
import { GLUE_LEXICON } from './glueLexicon'

/**
 * Shared "new word" detection (bug-dump 2026-06-07 E8; mirrors the E6 Story Time
 * rule). A word is "new" when it exists in the vocabulary bank but is NOT yet in
 * the child's learned set — so it can be surfaced with its Hebrew + audio as a
 * vocabulary-exposure layer over grammar/story sentences. Exposure-only: callers
 * must NOT record these toward mastery.
 */

export interface NewWord {
  /** Token form as it appears in the text, lowercased (used to match tokens). */
  word: string
  /** Hebrew translation, from the bank entry (raw — wrap in nk() to display). */
  hebrew: string
  category?: string
}

interface VocabWord {
  word?: string
  translation?: string
  hebrew?: string
  category?: string
}

const PUNCT_EDGE = /^[.,!?;:'"()]+|[.,!?;:'"()]+$/g

// Highly polysemous words whose single bank gloss actively MISLEADS as a floating
// tooltip: e.g. "right" is banked as ימין (direction), but in "right now"/"right
// away" it means כרגע/מיד (beta #55). The pill is exposure-only (never recorded to
// mastery), so suppressing a wrong gloss is strictly better than teaching the
// wrong sense — the sentence's own Hebrew translation still carries the meaning.
const AMBIGUOUS_SKIP = new Set(['right'])

// Cache the bank index by bank-array identity so we don't rebuild ~900 entries
// on every question render.
let cachedBank: VocabWord[] | null = null
let cachedIndex: Map<string, VocabWord> | null = null

function bankIndex(bank: VocabWord[]): Map<string, VocabWord> {
  if (cachedBank === bank && cachedIndex) return cachedIndex
  const idx = new Map<string, VocabWord>()
  for (const w of bank) if (w && w.word) idx.set(w.word.toLowerCase(), w)
  cachedBank = bank
  cachedIndex = idx
  return idx
}

// Exact match, then a shallow singular/3rd-person "-s" strip (runs→run, cats→cat).
// Kept deliberately shallow to avoid over-matching (identical to E6).
function lookup(clean: string, idx: Map<string, VocabWord>): VocabWord | null {
  if (idx.has(clean)) return idx.get(clean) ?? null
  if (clean.length > 3 && clean.endsWith('s')) {
    const base = clean.slice(0, -1)
    if (idx.has(base)) return idx.get(base) ?? null
  }
  return null
}

/**
 * Bank words found in `texts` that are NOT in the learned set — de-duped, in
 * first-seen order. Defaults: bank = `window.vocabularyBank`, learnedSet derived
 * from `getLearnedWordKeySet()` (its keys are `word_category` → take the word).
 */
export function detectNewWords(
  texts: string | string[],
  opts: { learnedSet?: Set<string>; bank?: VocabWord[] } = {},
): NewWord[] {
  const list = Array.isArray(texts) ? texts : [texts]
  const bank = opts.bank ?? ((window as unknown as { vocabularyBank?: VocabWord[] }).vocabularyBank ?? [])
  const idx = bankIndex(bank)
  const learned =
    opts.learnedSet ?? new Set([...getLearnedWordKeySet()].map((k) => k.split('_')[0]))

  const out = new Map<string, NewWord>()
  for (const text of list) {
    if (!text) continue
    for (const raw of text.split(/\s+/)) {
      const clean = raw.replace(PUNCT_EDGE, '').toLowerCase()
      if (!clean || learned.has(clean) || out.has(clean) || AMBIGUOUS_SKIP.has(clean)) continue
      // Bank word first (canonical translation); fall back to the glue lexicon
      // for common non-bank sentence words (beta #59 — "need", "running", …).
      const entry = lookup(clean, idx)
      const hebrew = entry ? (entry.translation ?? entry.hebrew) : GLUE_LEXICON[clean]
      if (!hebrew) continue
      out.set(clean, { word: clean, hebrew, category: entry ? entry.category : 'glue' })
    }
  }
  return [...out.values()]
}
