import { cn } from '@/lib/cn'

interface SpellingComparisonProps {
  /** The correct spelling (as stored — usually uppercase). */
  target: string
  /** What the child built. */
  attempt: string
  /** Render letters lower/upper to match the game's case toggle. */
  caseMode?: 'lowercase' | 'uppercase'
  /** Vowelize the Hebrew labels when nikud is on. */
  showNikud?: boolean
}

/**
 * "Learn from the mistake" panel for the letter-building games (Reading +
 * Word Journey spell stage). Shows the correct word (all green) above the
 * child's attempt, with each attempted letter colored green when it matches
 * the target at that position and red when it doesn't — so the child sees
 * exactly which letters were wrong.
 *
 * Shared so the Word Journey spell stage (React port, step 4) reuses it.
 */
export function SpellingComparison({
  target,
  attempt,
  caseMode = 'lowercase',
  showNikud = false,
}: SpellingComparisonProps) {
  const tx = (s: string) => (caseMode === 'lowercase' ? s.toLowerCase() : s.toUpperCase())
  const targetLetters = target.split('')
  const attemptLetters = attempt.split('')

  const tile =
    'inline-flex size-10 items-center justify-center rounded-xl border text-2xl font-bold sm:size-12 sm:text-3xl'

  return (
    <section
      data-testid="spelling-comparison"
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-4 backdrop-blur"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-[color:var(--mint-400)]">
          {showNikud ? 'הַמִּלָּה הַנְּכוֹנָה' : 'המילה הנכונה'} ✓
        </p>
        <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2">
          {targetLetters.map((letter, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              data-testid="spelling-target-letter"
              className={cn(
                tile,
                'border-[color:var(--mint-400)]/60 bg-[color:var(--mint-400)]/15 text-[color:var(--mint-400)]',
              )}
            >
              {tx(letter)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-[color:var(--slate-300)]">
          {showNikud ? 'מַה שֶּׁכָּתַבְתָּ' : 'מה שכתבת'}
        </p>
        <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2">
          {attemptLetters.length === 0 ? (
            <span className="text-lg text-[color:var(--slate-300)]">—</span>
          ) : (
            attemptLetters.map((letter, i) => {
              const ok =
                letter.toLowerCase() === (targetLetters[i] ?? '').toLowerCase()
              return (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  data-testid="spelling-attempt-letter"
                  data-correct={ok ? 'true' : 'false'}
                  className={cn(
                    tile,
                    ok
                      ? 'border-[color:var(--mint-400)]/60 bg-[color:var(--mint-400)]/15 text-[color:var(--mint-400)]'
                      : 'border-rose-400/60 bg-rose-500/15 text-rose-300',
                  )}
                >
                  {tx(letter)}
                </span>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
