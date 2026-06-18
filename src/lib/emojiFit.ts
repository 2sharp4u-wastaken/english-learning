/** Count grapheme clusters so multi-keycap "pictures" (number words like
 *  Thousand = 1️⃣0️⃣0️⃣0️⃣, Billion = 9 keycaps) can be sized to fit their tile
 *  instead of overflowing it (beta #24). Intl.Segmenter is exact; the fallback
 *  strips the variation-selector + enclosing-keycap codepoints so each keycap
 *  counts once (Array.from would otherwise count 3 codepoints per keycap). */
export function graphemeCount(str: string): number {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new () => { segment: (s: string) => Iterable<unknown> }
    }
  ).Segmenter
  if (Segmenter) {
    try {
      return [...new Segmenter().segment(str)].length
    } catch {
      /* fall through */
    }
  }
  return Array.from(str.replace(/[\uFE0F\u20E3]/g, '')).length
}

/** Tailwind font-size class that keeps a long keycap string inside an answer
 *  tile. `base` is the class used for the common single-emoji case so each call
 *  site keeps its own baseline; longer strings step down progressively. */
export function emojiSizeClass(str: string, base: string): string {
  const g = graphemeCount(str)
  if (g <= 1) return base
  if (g <= 2) return 'text-4xl [@media(max-height:700px)]:text-3xl'
  if (g <= 4) return 'text-3xl [@media(max-height:700px)]:text-2xl'
  return 'text-2xl [@media(max-height:700px)]:text-xl'
}
