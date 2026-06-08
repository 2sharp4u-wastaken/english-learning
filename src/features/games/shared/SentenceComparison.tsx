import { cn } from '@/lib/cn'

interface SentenceComparisonProps {
  /** The correct word order. */
  target: string[]
  /** The word order the child built. */
  attempt: string[]
  /** Render words lower/upper to match the game's case toggle. */
  caseMode?: 'lowercase' | 'uppercase'
}

const norm = (w: string) => w.replace(/[.,!?;:]+$/, '').toLowerCase()

/**
 * Word-order sibling of {@link SpellingComparison} for Sentence Scramble (D4,
 * bug-dump 2026-06-07). Same "learn from the mistake" treatment — the correct
 * sentence (all green) above the child's attempt, each attempted word green
 * when it sits in the right position and red when it doesn't — but laid out as
 * word chips instead of single-letter tiles.
 */
export function SentenceComparison({
  target,
  attempt,
  caseMode = 'lowercase',
}: SentenceComparisonProps) {
  const tx = (s: string) => (caseMode === 'lowercase' ? s.toLowerCase() : s.toUpperCase())
  const chip =
    'inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-lg font-bold sm:text-xl'

  return (
    <section
      data-testid="sentence-comparison"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-4 backdrop-blur"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-[color:var(--mint-400)]">המשפט הנכון ✓</p>
        <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2">
          {target.map((word, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              data-testid="sentence-target-word"
              className={cn(
                chip,
                'border-[color:var(--mint-400)]/60 bg-[color:var(--mint-400)]/15 text-[color:var(--mint-400)]',
              )}
            >
              {tx(word)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-[color:var(--slate-300)]">מה שכתבת</p>
        <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2">
          {attempt.length === 0 ? (
            <span className="text-lg text-[color:var(--slate-300)]">—</span>
          ) : (
            attempt.map((word, i) => {
              const ok = norm(word) === norm(target[i] ?? '')
              return (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  data-testid="sentence-attempt-word"
                  data-correct={ok ? 'true' : 'false'}
                  className={cn(
                    chip,
                    ok
                      ? 'border-[color:var(--mint-400)]/60 bg-[color:var(--mint-400)]/15 text-[color:var(--mint-400)]'
                      : 'border-rose-400/60 bg-rose-500/15 text-rose-300',
                  )}
                >
                  {tx(word)}
                </span>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
