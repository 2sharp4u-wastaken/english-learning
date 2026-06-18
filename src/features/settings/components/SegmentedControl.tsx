import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Optional decorative emoji shown above the label. */
  emoji?: string
}

interface Props<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel?: string
}

/**
 * A prominent single-choice selector (M16): one row of equal segments where the
 * active one is strongly highlighted. Used as the *primary* control of a section
 * so it reads as one decision, visually outranking the secondary toggles beneath
 * it — the fix for "three independent on-switches that are really one choice".
 */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`segment-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-sm font-semibold transition-all',
              active
                ? 'bg-learn text-[color:var(--ink-950)] shadow-[var(--shadow-panel)] scale-[1.02]'
                : 'text-muted hover:bg-white/8 hover:text-text',
            )}
          >
            {opt.emoji && (
              <span className="text-xl leading-none" aria-hidden>
                {opt.emoji}
              </span>
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
