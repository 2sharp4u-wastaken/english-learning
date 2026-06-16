import type { WJWord } from '@/bridge/word-journey'

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
  return (
    <span className="text-6xl [@media(max-height:700px)]:text-4xl" role="img" aria-label={word.word}>
      {word.picture || '🔤'}
    </span>
  )
}
