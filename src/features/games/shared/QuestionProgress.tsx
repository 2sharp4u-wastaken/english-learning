import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface QuestionProgressProps {
  current: number
  total: number
  onReset?: () => void
  className?: string
}

export function QuestionProgress({ current, total, onReset, className }: QuestionProgressProps) {
  const safeTotal = Math.max(total, 1)
  const safeCurrent = Math.max(0, Math.min(current, safeTotal))
  const pct = Math.round(((safeCurrent - 1) / safeTotal) * 100)
  const fill = Math.max(0, Math.min(100, current >= total ? 100 : pct))

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3',
        className,
      )}
      data-testid="question-progress"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[color:var(--slate-200)]">
          שאלה <span data-testid="qp-current">{safeCurrent}</span> מתוך{' '}
          <span data-testid="qp-total">{safeTotal}</span>
        </span>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            data-testid="qp-reset"
            className="flex items-center gap-1.5 rounded-full border border-[color:var(--amber-400)]/40 bg-[color:var(--amber-400)]/15 px-3 py-1 text-xs font-semibold text-[color:var(--amber-400)] transition hover:bg-[color:var(--amber-400)]/25 hover:text-[color:var(--amber-300)]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            אפס משחק
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
    </div>
  )
}
