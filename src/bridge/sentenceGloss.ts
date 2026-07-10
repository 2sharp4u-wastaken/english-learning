/**
 * Sentence gloss map (#60 — T2) — Hebrew glosses for authored-sentence content
 * words that are in NEITHER the vocabulary bank NOR the `GLUE_LEXICON`, so that
 * EVERY content word across the grammar / articles / progressive sentence banks is
 * tappable ("hear it") regardless of learned status.
 *
 * This is the third and last lookup source in `detectGlossableWords` (bank → glue →
 * this). It is populated by `scripts/build-sentence-gloss.mjs`, which enumerates
 * every token in the authored sentences and prints the ones still missing a gloss —
 * fill those here (one line each), re-run until the script reports zero gaps.
 *
 * Hebrew is authored WITH nikud inline (same rule as `GLUE_LEXICON`): `nk()`/
 * `applyNikud` only replaces bare consonant-runs from `window.nikudMap` and leaves
 * interleaved vowel points untouched, so a pre-pointed gloss renders correctly with
 * the nikud toggle ON (marks kept) and OFF (`stripNikud` removes them) — no
 * dependency on the network-only `build-nikud-map.py` rebuild.
 *
 * Curation rules (mirror `GLUE_LEXICON`):
 *  - Content words only (verbs / adjectives / adverbs / concrete nouns). Pure
 *    grammatical glue (a/an/the/and/for/pronouns) is intentionally omitted.
 *  - Pick the sense the word actually carries across the authored sentences.
 *  - Genuinely misleading polysemes go in `AMBIGUOUS_SKIP` (see `newWords.ts`).
 */
export const SENTENCE_GLOSS: Record<string, string> = {
  // ── Filled from scripts/build-sentence-gloss.mjs gap report (#60) ────────
  // Nouns
  bike: 'אוֹפַנַּיִם',
  child: 'יֶלֶד',
  children: 'יְלָדִים',
  day: 'יוֹם',
  home: 'בַּיִת',
  litter: 'שֶׁגֶר',
  mat: 'שָׁטִיחַ',
  week: 'שָׁבוּעַ',
  years: 'שָׁנִים',
  "o'clock": 'בְּשָׁעָה',
  // Adjectives / adverbs
  brightly: 'בִּבְהִירוּת',
  last: 'אַחֲרוֹן',
  // Quantifiers / prepositions / connectors (content-carrying for a young learner)
  about: 'עַל',
  below: 'מִתַּחַת',
  every: 'כָּל',
  many: 'הַרְבֵּה',
  when: 'כַּאֲשֶׁר',
}
