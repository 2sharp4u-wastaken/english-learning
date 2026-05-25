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

  return (
    <div
      data-testid="memory-board"
      className="mx-auto grid w-full max-w-2xl gap-2 sm:gap-2.5"
      style={
        {
          '--mem-cols': String(columns),
          '--mem-cols-narrow': String(narrowCols),
          gridTemplateColumns: `repeat(var(--mem-cols-narrow), minmax(0, 1fr))`,
        } as React.CSSProperties
      }
    >
      <style>{`@media (min-width: 640px){[data-testid="memory-board"]{grid-template-columns:repeat(var(--mem-cols),minmax(0,1fr))!important;}}`}</style>
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
