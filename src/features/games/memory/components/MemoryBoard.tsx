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
  // For the small level (≤12 cards) a 4-wide grid leaves cards width-bound and
  // only fills the top of a tall portrait phone (beta #58 — "images/text too
  // small"); 3 columns there lets the cards grow and use the vertical space.
  const narrowCols = Math.min(columns, cards.length <= 12 ? 3 : 4)

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
  // shrink to fit when a level has more rows, rather than overflowing. The reserve
  // is a CSS variable so short landscape (globals.css hides the hero + progress
  // there) can shrink it — a fixed 19rem exceeds the ~20rem viewport height in
  // landscape and collapsed the cards to near-zero (beta #57).
  // Track = min(area-based size, width-fit, height-fit). NOTE: `100%` is the grid
  // container WIDTH and `100dvh` the viewport height — both are length caps on
  // different axes. The card scales its picture/word with container-query units.
  const track = (cols: number) => {
    const rows = Math.ceil(cards.length / cols)
    const widthCap = `calc((100% - ${((cols - 1) * GAP_REM).toFixed(2)}rem) / ${cols})`
    const heightCap = `calc((100dvh - var(--mem-chrome, 19rem)) / ${rows})`
    return `min(${side.toFixed(2)}rem, ${widthCap}, ${heightCap})`
  }

  return (
    <div
      data-testid="memory-board"
      className="mx-auto grid w-full max-w-3xl justify-center gap-2 sm:gap-2.5"
      style={{ gridTemplateColumns: `repeat(${narrowCols}, ${track(narrowCols)})` }}
    >
      <style>{`@media (min-width:640px){[data-testid="memory-board"]{grid-template-columns:repeat(${columns},${track(columns)})!important;}}@media (orientation:landscape) and (max-height:600px){[data-testid="memory-board"]{--mem-chrome:9.5rem;}}`}</style>
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
