import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'
import { useCompactViewport } from '@/features/games/shared/useCompactViewport'
import type { WJStageId } from '@/bridge/word-journey'

const STAGES: { id: WJStageId; icon: string; label: string }[] = [
  { id: 'discover', icon: '👀', label: 'גילוי' },
  { id: 'listen-match', icon: '👂', label: 'הקשבה' },
  { id: 'spell-tiles', icon: '✏️', label: 'כתיבה' },
  { id: 'say-word', icon: '🎤', label: 'דיבור' },
  { id: 'recall', icon: '🧠', label: 'זיכרון' },
]

/** The five-stage journey map. Mirrors the legacy wj-stage-bar: each step is
 *  active / completed / upcoming.
 *
 *  Responsive (M3): on a phone the per-icon Hebrew labels + arrow connectors
 *  don't fit, so they're hidden (`sm:` only) and the row is icons-only; the
 *  current stage's name is shown once as a single line beneath, so kids still
 *  see where they are without an illegible label blob. */
export function WJStageBar({ activeStage }: { activeStage: WJStageId }) {
  const nk = useNikud()
  // Short viewports (landscape phones) are wide but cramped — collapse to
  // icons-only there too, not just on narrow width (M3).
  const compact = useCompactViewport()
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage)
  const active = STAGES[activeIndex]
  return (
    <div
      data-testid="wj-stage-bar"
      dir="rtl"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-1"
    >
      <div className="flex w-full items-center justify-center gap-1">
        {STAGES.map((stage, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming'
          return (
            <div key={stage.id} className="flex items-center gap-0.5 sm:gap-1">
              <div
                data-stage={stage.id}
                data-state={state}
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm transition sm:size-9 sm:text-base',
                    state === 'active' &&
                      'bg-gradient-to-br from-[color:var(--mint-400)] to-[color:var(--blue-400)] text-[color:var(--ink-950)] shadow-md',
                    state === 'done' && 'bg-[color:var(--mint-400)]/20 text-[color:var(--mint-400)]',
                    state === 'upcoming' && 'bg-white/5 text-[color:var(--slate-300)] opacity-50',
                  )}
                >
                  {state === 'done' ? '✓' : stage.icon}
                </span>
                {/* Per-icon labels only fit on wider AND tall-enough screens. */}
                <span
                  className={cn(
                    'text-[0.6rem] font-medium sm:text-xs',
                    compact ? 'hidden' : 'hidden sm:block',
                    state === 'active' ? 'text-white' : 'text-[color:var(--slate-300)]',
                  )}
                >
                  {nk(stage.label)}
                </span>
              </div>
              {i < STAGES.length - 1 ? (
                <span
                  className={cn(
                    'text-[color:var(--slate-300)] opacity-40',
                    compact ? 'hidden' : 'hidden sm:inline',
                  )}
                >
                  ←
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {/* Narrow screens: the per-icon labels are hidden, so name the current
          stage once here instead. */}
      {active ? (
        <span
          className={cn('text-xs font-semibold text-white', compact ? 'block' : 'sm:hidden')}
          data-testid="wj-stage-current"
        >
          {active.icon} {nk(active.label)}
        </span>
      ) : null}
    </div>
  )
}
