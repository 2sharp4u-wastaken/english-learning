import { MemoryCard } from './MemoryCard'
import type { MemoryCard as MemoryCardData } from '@/bridge/memory'

export interface MemoryBoardProps {
  cards: MemoryCardData[]
  flipped: number[]
  matched: Set<number>
  /** Board columns on wide screens; narrows automatically on small screens. */
  columns: number
  processing: boolean
  renderEnglish: (word: string) => string
  renderHebrew: (text: string) => string
  onCardClick: (index: number) => void
}

export function MemoryBoard({
  cards,
  flipped,
  matched,
  columns,
  processing,
  renderEnglish,
  renderHebrew,
  onCardClick,
}: MemoryBoardProps) {
  // Keep cards comfortably tappable for kids: cap columns on narrow screens so
  // the largest level (24 cards) wraps to more rows instead of shrinking flat.
  const narrowCols = Math.min(columns, 4)

  // Equal total card area across levels: cardCount × side² = AREA, so
  // side = √(AREA / cardCount). Fewer cards (low levels) → bigger cards; more
  // cards (high levels) → smaller cards; the combined footprint is identical.
  // Each track is capped to the width-fit so it never overflows on narrow
  // screens. `--mem-card` (the resolved track size) is exposed so the card can
  // scale its picture/word to match.
  // Doubled card size (linear ~2× → area ×4 vs the original 486).
  const AREA_REM2 = 1944
  const side = Math.sqrt(AREA_REM2 / Math.max(cards.length, 1))
  const GAP_REM = 0.625 // matches sm:gap-2.5; safe upper bound for gap-2 too
  // Reserve for the game chrome (header + title + progress + stats pill + footer)
  // so the board always fits one screen — no scroll on any level/device. Cards
  // shrink to fit when a level has more rows, rather than overflowing.
  const CHROME_REM = 19
  // Track = min(area-based size, width-fit, height-fit). NOTE: `100%` is the grid
  // container WIDTH and `100dvh` the viewport height — both are length caps on
  // different axes. The card scales its picture/word with container-query units.
  const track = (cols: number) => {
    const rows = Math.ceil(cards.length / cols)
    const widthCap = `calc((100% - ${((cols - 1) * GAP_REM).toFixed(2)}rem) / ${cols})`
    const heightCap = `calc((100dvh - ${CHROME_REM}rem) / ${rows})`
    return `min(${side.toFixed(2)}rem, ${widthCap}, ${heightCap})`
  }

  return (
    <div
      data-testid="memory-board"
      className="mx-auto grid w-full max-w-3xl justify-center gap-2 sm:gap-2.5"
      style={{ gridTemplateColumns: `repeat(${narrowCols}, ${track(narrowCols)})` }}
    >
      <style>{`@media (min-width:640px){[data-testid="memory-board"]{grid-template-columns:repeat(${columns},${track(columns)})!important;}}`}</style>
      {cards.map((card, index) => (
        <MemoryCard
          key={card.id}
          card={card}
          index={index}
          faceUp={flipped.includes(index)}
          matched={matched.has(index)}
          disabled={processing}
          renderEnglish={renderEnglish}
          renderHebrew={renderHebrew}
          onClick={onCardClick}
        />
      ))}
    </div>
  )
}
