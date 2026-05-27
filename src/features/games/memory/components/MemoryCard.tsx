import { cn } from '@/lib/cn'
import type { MemoryCard as MemoryCardData } from '@/bridge/memory'

const PAIR_GRADIENTS: Array<[string, string]> = [
  ['#11998e', '#38ef7d'],
  ['#3b82f6', '#22d3ee'],
  ['#8b5cf6', '#ec4899'],
  ['#f59e0b', '#f97316'],
  ['#ef4444', '#f43f5e'],
  ['#14b8a6', '#84cc16'],
  ['#6366f1', '#06b6d4'],
  ['#a855f7', '#f43f5e'],
  ['#0ea5e9', '#6366f1'],
  ['#f43f5e', '#f59e0b'],
  ['#10b981', '#3b82f6'],
  ['#d946ef', '#8b5cf6'],
]

export interface MemoryCardProps {
  card: MemoryCardData
  index: number
  faceUp: boolean
  matched: boolean
  disabled: boolean
  /** English display case for word cards. */
  renderEnglish: (word: string) => string
  /** Hebrew display (nikud-aware) for translation cards. */
  renderHebrew: (text: string) => string
  onClick: (index: number) => void
}

export function MemoryCard({
  card,
  index,
  faceUp,
  matched,
  disabled,
  renderEnglish,
  renderHebrew,
  onClick,
}: MemoryCardProps) {
  const [gradStart, gradEnd] = PAIR_GRADIENTS[Math.abs(card.pairId) % PAIR_GRADIENTS.length]
  const isWord = card.type === 'word'
  const display = isWord ? renderEnglish(card.content) : renderHebrew(card.content)

  return (
    <button
      type="button"
      data-testid="memory-card"
      data-index={index}
      data-pair={card.pairId}
      data-state={matched ? 'matched' : faceUp ? 'flipped' : 'down'}
      aria-label={faceUp || matched ? display : 'קלף הפוך'}
      disabled={disabled && !matched}
      onClick={() => onClick(index)}
      style={{ containerType: 'inline-size' }}
      className={cn(
        'group relative aspect-square select-none rounded-xl outline-none',
        '[perspective:800px] focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]',
        matched && 'opacity-90',
      )}
    >
      <div
        className={cn(
          'relative h-full w-full rounded-xl transition-transform duration-300 [transform-style:preserve-3d]',
          (faceUp || matched) && '[transform:rotateY(180deg)]',
        )}
      >
        {/* Back (face-down) */}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--ink-800)] to-[color:var(--ink-900)] text-2xl font-black text-white/40 shadow-md [backface-visibility:hidden]">
          ?
        </div>

        {/* Front (face-up) */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]',
            matched ? 'border-transparent' : 'border-white/15 bg-[color:var(--ink-900)]/95',
          )}
          style={
            matched
              ? {
                  background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
                }
              : undefined
          }
        >
          {card.word.visual ? (
            <span className="leading-none" style={{ fontSize: '44cqw' }} aria-hidden>
              {card.word.visual}
            </span>
          ) : null}
          <span
            dir={isWord ? 'ltr' : 'rtl'}
            lang={isWord ? 'en' : 'he'}
            style={{ fontSize: `clamp(0.5rem, ${display.length > 9 ? 13 : 16}cqw, 1rem)` }}
            className={cn(
              'font-bold leading-tight',
              matched ? 'text-white' : isWord ? 'text-[color:var(--mint-200)]' : 'text-white',
            )}
          >
            {display}
          </span>
        </div>
      </div>
    </button>
  )
}
