import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface PhraseBuilderProps {
  /** Scrambled words shown in the bank, in their shuffled order. */
  scrambledWords: string[]
  /** Reports the currently-built phrase (in placement order) on every change. */
  onChange: (built: string[]) => void
  /** Color the placed chips once the answer is checked. */
  result?: 'correct' | 'incorrect' | null
  /** Changing this resets the builder (new question). */
  resetKey: number | string
  /** Apply the case-mode transform to chip text (English). */
  transform?: (word: string) => string
  /** Lock interaction after the answer is checked. */
  disabled?: boolean
  /** Voice a word when it's tapped into place. */
  onSpeakWord?: (word: string) => void
}

/**
 * Word-level phrase builder for the "build the phrase" expression game (Slice 5.3).
 * Tap a bank word to append it to the answer; tap a placed word to send it back.
 * Word-granularity (not letters) — pulled forward from the 5.4 "Build the Phrase"
 * idea since spelling a multi-word idiom letter-by-letter is tedious. Lighter than
 * the sentence-scramble chip zone (no drag-reorder) — tap-only, fully testable.
 */
export function PhraseBuilder({
  scrambledWords,
  onChange,
  result = null,
  resetKey,
  transform = (w) => w,
  disabled = false,
  onSpeakWord,
}: PhraseBuilderProps) {
  const nk = useNikud()
  // Placement order as indices into `scrambledWords` (handles duplicate words).
  const [placed, setPlaced] = useState<number[]>([])

  useEffect(() => {
    setPlaced([])
  }, [resetKey])

  const commit = useCallback(
    (next: number[]) => {
      setPlaced(next)
      onChange(next.map((i) => scrambledWords[i]))
    },
    [onChange, scrambledWords],
  )

  const placeWord = (i: number) => {
    if (disabled || placed.includes(i)) return
    commit([...placed, i])
    onSpeakWord?.(scrambledWords[i])
  }

  const removeAt = (pos: number) => {
    if (disabled) return
    commit(placed.filter((_, p) => p !== pos))
  }

  const bankIndices = scrambledWords.map((_, i) => i).filter((i) => !placed.includes(i))

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Answer zone (LTR — English phrase order) */}
      <div
        data-testid="phrase-answer-zone"
        dir="ltr"
        className={cn(
          'mx-auto flex min-h-[4rem] w-full max-w-xl flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 transition',
          result === 'correct'
            ? 'border-emerald-400/60 bg-emerald-400/10'
            : result === 'incorrect'
              ? 'border-rose-400/60 bg-rose-500/10'
              : 'border-white/15 bg-[color:var(--ink-900)]/40',
        )}
      >
        {placed.length === 0 ? (
          <span dir="rtl" className="text-sm text-[color:var(--slate-400)] sm:text-base">
            {nk('הקליקו על מילה כדי להוסיף אותה')}
          </span>
        ) : (
          placed.map((wordIndex, pos) => (
            <button
              key={`placed-${pos}-${wordIndex}`}
              type="button"
              data-testid="phrase-answer-chip"
              data-state={result ?? 'placed'}
              disabled={disabled}
              onClick={() => removeAt(pos)}
              className={cn(
                'rounded-xl border px-3 py-2 text-base font-semibold transition',
                result === 'correct'
                  ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100'
                  : result === 'incorrect'
                    ? 'border-rose-400/60 bg-rose-500/15 text-rose-100'
                    : 'border-[color:var(--blue-400)]/40 bg-[color:var(--blue-400)]/15 text-white hover:brightness-110',
                'disabled:cursor-not-allowed',
              )}
            >
              {transform(scrambledWords[wordIndex])}
            </button>
          ))
        )}
      </div>

      {/* Word bank */}
      <div
        data-testid="phrase-word-bank"
        dir="ltr"
        className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-2"
      >
        {bankIndices.map((i) => (
          <button
            key={`bank-${i}`}
            type="button"
            data-testid="phrase-bank-chip"
            disabled={disabled}
            onClick={() => placeWord(i)}
            className={cn(
              'rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-base font-semibold text-white transition',
              'hover:border-[color:var(--blue-400)]/40 hover:bg-white/[0.1]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {transform(scrambledWords[i])}
          </button>
        ))}
      </div>
    </div>
  )
}
