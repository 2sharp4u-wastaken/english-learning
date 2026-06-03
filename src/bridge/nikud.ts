import { useCallback } from 'react'
import { stripNikud, useTextPrefs } from './textPrefs'

/**
 * src/bridge/nikud.ts — React-owned Hebrew nikud (vowel-point) rendering.
 *
 * Background (FU-4.4-nikud): data Hebrew (`word.hebrew`) is already enriched at
 * boot by `utils/nikud.js → enrichVocabularyBank`, and games render it directly
 * with `stripNikud` for the toggle. The remaining un-owned surface was hardcoded
 * Hebrew UI chrome (titles, "שאלה N מתוך M", buttons), which `utils/nikudDOM.js`
 * used to enrich by structurally mutating `#react-root` — crashing the game
 * subtree on a mid-game toggle. This bridge moves that ownership into React:
 * components enrich their own Hebrew via `useNikud()`, and `nikudDOM` no longer
 * touches `#react-root` (the conflict disappears).
 *
 * The enrichment mirrors `utils/nikudDOM.js`: replace each Hebrew word run with
 * its mapped nikud'd form from `window.nikudMap` (loaded at boot by
 * `data/_loader.js`). Non-Hebrew text (English option labels) passes through
 * unchanged, so `nk()` is safe to apply to any string.
 */

const HEBREW_WORD = /[א-ת]+/g

/** The boot-loaded nikud map (`data/nikud-map.json` + localStorage cache). */
function getMap(): Record<string, string> | null {
  const m = (window as any).nikudMap
  return m && typeof m === 'object' ? m : null
}

/**
 * Apply the nikud preference to a Hebrew string.
 *  - `showNikud === true`  → add vowel points (word-run lookup); already-pointed
 *    or non-Hebrew text is returned unchanged.
 *  - `showNikud === false` → strip any vowel points.
 */
export function applyNikud(text: string | undefined | null, showNikud: boolean): string {
  if (!text) return ''
  if (!showNikud) return stripNikud(text)
  const map = getMap()
  if (!map) return text
  return text.replace(HEBREW_WORD, (w) => map[w] || w)
}

/**
 * React hook returning `nk(text)` — enrich/strip a Hebrew string per the live
 * nikud toggle. Re-renders when the toggle flips (via `useTextPrefs`), so games
 * update their chrome without any DOM mutation.
 */
export function useNikud(): (text: string | undefined | null) => string {
  const { showNikud } = useTextPrefs()
  return useCallback((text: string | undefined | null) => applyNikud(text, showNikud), [showNikud])
}
