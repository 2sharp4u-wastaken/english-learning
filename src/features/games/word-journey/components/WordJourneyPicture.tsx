import type { WJWord } from '@/bridge/word-journey'
import { cn } from '@/lib/cn'
import { emojiSizeClass } from '@/lib/emojiFit'

/** Renders a word's real image when available, else its emoji (parity with the
 *  legacy renderPicture + the other React games' prompt pictures). */
export function WordJourneyPicture({
  word,
  // M3: shrink on short viewports (landscape/small phones) so the card + the
  // action button below it fit without scrolling.
  className = 'max-h-32 rounded-2xl object-contain [@media(max-height:700px)]:max-h-20',
}: {
  word: WJWord
  className?: string
}) {
  const overrides =
    ((window as any).wordImageOverrides as Record<string, string> | undefined) ?? {}
  const overrideKey = `${word.category}:${word.word.toLowerCase()}`
  const effective = word.imageUrl || overrides[overrideKey]
  if (effective) {
    return <img src={effective} alt="" className={className} />
  }
  const picture = word.picture || '🔤'
  return (
    <span
      className={cn(
        'inline-block max-w-full text-center leading-none [overflow-wrap:anywhere]',
        // Long keycap "pictures" (number words) shrink to fit instead of
        // overflowing the tile (beta #24).
        emojiSizeClass(picture, 'text-6xl [@media(max-height:700px)]:text-4xl'),
      )}
      role="img"
      aria-label={word.word}
    >
      {picture}
    </span>
  )
}
