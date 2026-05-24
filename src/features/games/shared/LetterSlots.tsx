import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export interface LetterSlotsProps {
  /** Target word — defines the number of slots. */
  target: string
  /** Available letter tiles (already shuffled by the caller). */
  tiles: string[]
  caseMode?: 'lowercase' | 'uppercase'
  /** Color the slots green/red after a check; null while building. */
  result?: 'correct' | 'wrong' | null
  /** Freeze interaction (e.g. after the answer is checked). */
  disabled?: boolean
  /** Bump to clear all slots/tiles (new word, or a Clear button). */
  resetKey?: string | number
  /** Reports the currently-built word on every change. */
  onChange?: (built: string) => void
  /** Called with each placed letter (so the game can speak it). */
  onPlaceLetter?: (letter: string) => void
}

interface Placed {
  letter: string
  tile: number
}

/**
 * Slot-based letter builder shared by the Reading game and the Word Journey
 * spell stage. Fixed underline slots (one per target letter) fill left-to-right
 * as the child taps colored tiles; tapping a filled slot backspaces the last
 * letter. Mirrors the legacy WJ `renderSpellTiles` slot mechanic (.wj-slot)
 * plus colored tiles — one implementation, identical feel in both games.
 */
export function LetterSlots({
  target,
  tiles,
  caseMode = 'lowercase',
  result = null,
  disabled = false,
  resetKey,
  onChange,
  onPlaceLetter,
}: LetterSlotsProps) {
  const [placed, setPlaced] = useState<Placed[]>([])
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set())

  // Reset on a new word / explicit clear.
  useEffect(() => {
    setPlaced([])
    setUsedTiles(new Set())
  }, [resetKey])

  // Report the built word.
  useEffect(() => {
    onChange?.(placed.map((p) => p.letter).join(''))
  }, [placed, onChange])

  const render = useCallback(
    (l: string) => (caseMode === 'lowercase' ? l.toLowerCase() : l.toUpperCase()),
    [caseMode],
  )

  const place = (tileIdx: number, letter: string) => {
    if (disabled || usedTiles.has(tileIdx) || placed.length >= target.length) return
    setPlaced((p) => [...p, { letter, tile: tileIdx }])
    setUsedTiles((s) => new Set(s).add(tileIdx))
    onPlaceLetter?.(letter)
  }

  const backspace = () => {
    if (disabled || placed.length === 0) return
    const last = placed[placed.length - 1]
    setPlaced((p) => p.slice(0, -1))
    setUsedTiles((s) => {
      const n = new Set(s)
      n.delete(last.tile)
      return n
    })
  }

  const slotColor =
    result === 'correct'
      ? 'border-[color:var(--mint-400)] text-[color:var(--mint-400)]'
      : result === 'wrong'
        ? 'border-rose-400 text-rose-300'
        : 'border-white/60 text-white'

  return (
    <div data-testid="letter-slots" className="flex flex-col items-center gap-4">
      {/* Slots */}
      <div dir="ltr" className="flex flex-wrap items-end justify-center gap-1.5">
        {Array.from({ length: target.length }).map((_, i) => {
          const entry = placed[i]
          return (
            <button
              key={i}
              type="button"
              data-testid="letter-slot"
              data-index={i}
              data-letter={entry ? entry.letter.toLowerCase() : ''}
              onClick={backspace}
              disabled={disabled || !entry}
              className={cn(
                'flex h-13 w-10 items-center justify-center border-b-[3px] pb-1 text-3xl font-bold transition-colors sm:w-11',
                slotColor,
              )}
              style={{ height: '3.25rem' }}
            >
              {entry ? render(entry.letter) : ''}
            </button>
          )
        })}
      </div>

      {/* Tile bank */}
      <div dir="ltr" className="flex max-w-md flex-wrap items-center justify-center gap-2">
        {tiles.map((letter, i) => {
          const used = usedTiles.has(i)
          return (
            <button
              key={i}
              type="button"
              data-testid="letter-tile"
              data-letter={letter.toLowerCase()}
              data-used={used ? 'true' : 'false'}
              onClick={() => place(i, letter)}
              disabled={disabled || used}
              className={cn(
                'inline-flex size-12 items-center justify-center rounded-xl border border-white/10 text-2xl font-bold shadow-sm transition sm:size-14 sm:text-3xl',
                used
                  ? 'cursor-not-allowed bg-white/5 text-white/30 opacity-40'
                  : 'bg-gradient-to-br from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] hover:brightness-110',
              )}
            >
              {render(letter)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
