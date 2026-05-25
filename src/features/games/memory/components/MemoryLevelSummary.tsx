import { cn } from '@/lib/cn'
import type { MemoryLevelMetrics, MemoryPersonalBest } from '@/bridge/memory'

export interface MemoryLevelSummaryProps {
  level: number
  totalLevels: number
  metrics: MemoryLevelMetrics
  isLastLevel: boolean
  /** Cumulative score across all levels played so far. */
  totalScore: number
  /** Per-level personal bests, keyed by level number (string). */
  bests: Record<string, MemoryPersonalBest>
  onNext: () => void
  onPlayAgain: () => void
  onHome: () => void
}

function Stars({ count }: { count: number }) {
  const clamped = Math.max(1, Math.min(4, count))
  return (
    <span data-testid="memory-stars" data-stars={clamped} className="text-3xl tracking-wide">
      {'⭐'.repeat(clamped)}
    </span>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} שנ׳`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function MemoryLevelSummary({
  level,
  totalLevels,
  metrics,
  isLastLevel,
  totalScore,
  bests,
  onNext,
  onPlayAgain,
  onHome,
}: MemoryLevelSummaryProps) {
  const runProgressPct = Math.round((level / totalLevels) * 100)

  return (
    <div
      data-testid="memory-summary"
      dir="rtl"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 py-2 text-center"
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl">{isLastLevel ? '🏆' : '⬆️'}</span>
        <h2 className="text-2xl font-black text-white">
          {isLastLevel ? 'המשחק הושלם!' : `רמה ${level} הושלמה!`}
        </h2>
        {metrics.isNewBest ? (
          <span
            data-testid="memory-new-best"
            className="rounded-full bg-[color:var(--amber-400)]/20 px-3 py-0.5 text-sm font-bold text-[color:var(--amber-300)]"
          >
            שיא אישי חדש ✨
          </span>
        ) : null}
        <Stars count={metrics.stars} />
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryChip label="ניקוד הרמה" value={String(metrics.score)} />
        <SummaryChip label="זמן" value={formatTime(metrics.timeSeconds)} />
        <SummaryChip label="טעויות" value={String(metrics.mistakes)} />
        <SummaryChip label="דיוק" value={`${metrics.accuracyPct}%`} />
        {metrics.maxCombo >= 2 ? <SummaryChip label="קומבו" value={`×${metrics.maxCombo}`} /> : null}
        <SummaryChip label="מטבעות" value={`+${metrics.coins}`} highlight />
      </div>

      <div className="w-full rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/60 p-3">
        <div className="mb-1 flex items-center justify-between text-sm text-[color:var(--slate-200)]">
          <span>
            רמה {level} מתוך {totalLevels}
          </span>
          <strong dir="ltr">
            {totalScore} נק׳ · {runProgressPct}%
          </strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)]"
            style={{ width: `${runProgressPct}%` }}
          />
        </div>
      </div>

      <PersonalBestTable bests={bests} currentLevel={level} totalLevels={totalLevels} />

      <div className="mt-1 flex w-full flex-col items-center gap-2">
        {!isLastLevel ? (
          <button
            type="button"
            data-testid="memory-next-level"
            onClick={onNext}
            className="w-full max-w-xs rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
          >
            המשך לרמה {level + 1} →
          </button>
        ) : (
          <button
            type="button"
            data-testid="memory-play-again"
            onClick={onPlayAgain}
            className="w-full max-w-xs rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
          >
            שחק שוב 🔄
          </button>
        )}
        <button
          type="button"
          data-testid="memory-home"
          onClick={onHome}
          className="w-full max-w-xs rounded-full border border-white/15 px-8 py-2.5 text-sm font-bold text-[color:var(--slate-200)] transition hover:bg-white/5"
        >
          בחר משחק אחר 🏠
        </button>
      </div>
    </div>
  )
}

function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2',
        highlight
          ? 'border-[color:var(--amber-400)]/40 bg-[color:var(--amber-400)]/10'
          : 'border-white/10 bg-[color:var(--ink-900)]/60',
      )}
    >
      <span dir="ltr" className="text-lg font-black text-white">
        {value}
      </span>
      <span className="text-xs text-[color:var(--slate-300)]">{label}</span>
    </div>
  )
}

function PersonalBestTable({
  bests,
  currentLevel,
  totalLevels,
}: {
  bests: Record<string, MemoryPersonalBest>
  currentLevel: number
  totalLevels: number
}) {
  const rows = []
  for (let i = 1; i <= totalLevels; i++) {
    const rec = bests[String(i)]
    rows.push(
      <tr
        key={i}
        className={cn(i === currentLevel && 'bg-[color:var(--blue-400)]/10 font-bold text-white')}
      >
        <td className="py-1 text-center">{i}</td>
        <td className="py-1 text-center" dir="ltr">
          {rec ? rec.score : '—'}
        </td>
        <td className="py-1 text-center" dir="ltr">
          {rec?.timeSeconds != null ? `${rec.timeSeconds}s` : '—'}
        </td>
        <td className="py-1 text-center">{rec ? '⭐'.repeat(Math.max(1, rec.stars)) : '—'}</td>
      </tr>,
    )
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/60 p-3">
      <h3 className="mb-1 flex items-center justify-center gap-1 text-sm font-bold text-[color:var(--slate-100)]">
        🏆 שיאים אישיים
      </h3>
      <table className="w-full text-sm text-[color:var(--slate-200)]">
        <thead>
          <tr className="text-xs text-[color:var(--slate-400)]">
            <th className="py-1 font-medium">רמה</th>
            <th className="py-1 font-medium">ניקוד</th>
            <th className="py-1 font-medium">זמן</th>
            <th className="py-1 font-medium">כוכבים</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
