import type { WJWord } from '@/bridge/word-journey'

/** Renders a word's real image when available, else its emoji (parity with the
 *  legacy renderPicture + the other React games' prompt pictures). */
export function WordJourneyPicture({
  word,
  className = 'max-h-32 rounded-2xl object-contain',
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
    <span className="text-6xl" role="img" aria-label={word.word}>
      {word.picture || '🔤'}
    </span>
  )
}
