/**
 * src/lib/wordKey.ts — THE canonical word-identity key (design-flaws fix, 2026-07-05).
 *
 * `wordMastery`, `learnedWords`, `wordJourneyProgress` and every session map are
 * keyed by `<lowercased word>_<category>`. Before this module the template was
 * inlined ~25× across engine + bridges, and `appState.getWordStats/saveWordStats`
 * used a NON-lowercased variant — so a word entering with different casing split
 * into two mastery records (double-counted as "introduced", never reaching
 * "learned"). Always import this helper; never inline the template again.
 * Legacy non-lowercased keys are merged on load by
 * `AppState.normalizeWordMasteryKeys`.
 */
export function wordKey(word: string, category: string): string {
  return `${String(word ?? '').toLowerCase()}_${category ?? ''}`
}

/**
 * Best-effort canonicalization of an existing `<word>_<category>` key when the
 * stats entry doesn't carry `word`/`category` fields. Splits at the LAST
 * underscore (words may contain spaces but categories never contain
 * underscores) and lowercases the word part.
 */
export function canonicalizeWordKey(key: string): string {
  const idx = key.lastIndexOf('_')
  if (idx <= 0) return key.toLowerCase()
  return `${key.slice(0, idx).toLowerCase()}_${key.slice(idx + 1)}`
}
