import { getLearnedWordKeySet } from './progress'
import { GLUE_LEXICON } from './glueLexicon'
import { SENTENCE_GLOSS } from './sentenceGloss'

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

/**
 * A glossable word (#60): any bank/glue/authored-sentence word that HAS a Hebrew
 * gloss, regardless of learned status. `isNew` distinguishes the two render tiers —
 * unlearned words get the prominent "new word" pill, learned ones get the quiet
 * tap-to-hear affordance. `detectNewWords` is the `isNew`-only subset (unchanged
 * contract for existing callers/tests).
 */
export interface GlossWord extends NewWord {
  /** true when the word is NOT yet in the child's learned set. */
  isNew: boolean
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
 * ALL glossable words in `texts` — bank + glue lexicon + authored-sentence gloss
 * map — de-duped, in first-seen order, each tagged `isNew` (#60: T1 drops the old
 * learned-word skip so a learned bank word like "astronaut" is still tappable; the
 * caller renders `isNew` words as pills and the rest as quiet tap-to-hear words).
 * Lookup order: bank (canonical) → GLUE_LEXICON (#59 common sentence words) →
 * SENTENCE_GLOSS (#60 T2 authored-sentence fills). Pure grammatical glue
 * (a/the/and/pronouns) is in none of these, so it stays untappable (noise).
 */
export function detectGlossableWords(
  texts: string | string[],
  opts: { learnedSet?: Set<string>; bank?: VocabWord[] } = {},
): GlossWord[] {
  const list = Array.isArray(texts) ? texts : [texts]
  const bank = opts.bank ?? ((window as unknown as { vocabularyBank?: VocabWord[] }).vocabularyBank ?? [])
  const idx = bankIndex(bank)
  const learned =
    opts.learnedSet ?? new Set([...getLearnedWordKeySet()].map((k) => k.split('_')[0]))

  const out = new Map<string, GlossWord>()
  for (const text of list) {
    if (!text) continue
    for (const raw of text.split(/\s+/)) {
      const clean = raw.replace(PUNCT_EDGE, '').toLowerCase()
      if (!clean || out.has(clean) || AMBIGUOUS_SKIP.has(clean)) continue
      const entry = lookup(clean, idx)
      const hebrew = entry ? (entry.translation ?? entry.hebrew) : (GLUE_LEXICON[clean] ?? SENTENCE_GLOSS[clean])
      if (!hebrew) continue
      out.set(clean, {
        word: clean,
        hebrew,
        category: entry ? entry.category : 'gloss',
        isNew: !learned.has(clean),
      })
    }
  }
  return [...out.values()]
}

/**
 * Bank/glue/gloss words found in `texts` that are NOT in the learned set — the
 * `isNew` subset of {@link detectGlossableWords}. Unchanged contract: exposure-only,
 * de-duped, first-seen order. Used for the "new words" pills + the after-answer
 * review table.
 */
export function detectNewWords(
  texts: string | string[],
  opts: { learnedSet?: Set<string>; bank?: VocabWord[] } = {},
): NewWord[] {
  return detectGlossableWords(texts, opts).filter((w) => w.isNew)
}
