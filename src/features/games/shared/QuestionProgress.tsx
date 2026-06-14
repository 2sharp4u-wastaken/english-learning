import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface QuestionProgressProps {
  current: number
  total: number
  onReset?: () => void
  /** Optional content centered in the top row, between the "שאלה N מתוך M"
   *  label (right) and the reset button (left). */
  center?: ReactNode
  /** Optional full-width content rendered BELOW the fill bar. Word Journey puts
   *  its stage bar here so it gets the whole card width instead of being
   *  squeezed into the cramped center slot on a phone (M3). */
  below?: ReactNode
  /** Short-viewport mode (M3) — tighter padding/gap. Set by GameScreenShell. */
  compact?: boolean
  className?: string
}

export function QuestionProgress({ current, total, onReset, center, below, compact, className }: QuestionProgressProps) {
  const nk = useNikud()
  const safeTotal = Math.max(total, 1)
  const safeCurrent = Math.max(0, Math.min(current, safeTotal))
  const pct = Math.round(((safeCurrent - 1) / safeTotal) * 100)
  const fill = Math.max(0, Math.min(100, current >= total ? 100 : pct))

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-white/5 bg-white/[0.04] px-4',
        compact ? 'gap-1 py-1.5' : 'gap-2 py-3',
        className,
      )}
      data-testid="question-progress"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[color:var(--slate-200)]">
          {nk('שאלה')} <span data-testid="qp-current">{safeCurrent}</span> {nk('מתוך')}{' '}
          <span data-testid="qp-total">{safeTotal}</span>
        </span>
        {center ? (
          <div className="flex min-w-0 flex-1 items-center justify-center" data-testid="qp-center">
            {center}
          </div>
        ) : null}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            data-testid="qp-reset"
            className="flex items-center gap-1.5 rounded-full border border-[color:var(--amber-400)]/40 bg-[color:var(--amber-400)]/15 px-3 py-1 text-xs font-semibold text-[color:var(--amber-400)] transition hover:bg-[color:var(--amber-400)]/25 hover:text-[color:var(--amber-300)]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {nk('אפס משחק')}
          </button>
        ) : null}
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-l from-[color:var(--mint-400)] to-[color:var(--blue-400)] transition-[width] duration-300"
          style={{ width: `${fill}%` }}
          data-testid="qp-fill"
        />
      </div>
      {below ? (
        <div className="pt-1" data-testid="qp-below">
          {below}
        </div>
      ) : null}
    </div>
  )
}
