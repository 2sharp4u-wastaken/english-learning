import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'
import type { WJStageId } from '@/bridge/word-journey'

const STAGES: { id: WJStageId; icon: string; label: string }[] = [
  { id: 'discover', icon: '👀', label: 'גילוי' },
  { id: 'listen-match', icon: '👂', label: 'הקשבה' },
  { id: 'spell-tiles', icon: '✏️', label: 'כתיבה' },
  { id: 'say-word', icon: '🎤', label: 'דיבור' },
  { id: 'recall', icon: '🧠', label: 'זיכרון' },
]

/** The five-stage journey map. Mirrors the legacy wj-stage-bar: each step is
 *  active / completed / upcoming. */
export function WJStageBar({ activeStage }: { activeStage: WJStageId }) {
  const nk = useNikud()
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage)
  return (
    <div
      data-testid="wj-stage-bar"
      dir="rtl"
      className="mx-auto flex w-full max-w-md items-center justify-center gap-1"
    >
      {STAGES.map((stage, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming'
        return (
          <div key={stage.id} className="flex items-center gap-1">
            <div
              data-stage={stage.id}
              data-state={state}
              className="flex flex-col items-center gap-0.5"
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-base transition sm:size-9',
                  state === 'active' &&
                    'bg-gradient-to-br from-[color:var(--mint-400)] to-[color:var(--blue-400)] text-[color:var(--ink-950)] shadow-md',
                  state === 'done' && 'bg-[color:var(--mint-400)]/20 text-[color:var(--mint-400)]',
                  state === 'upcoming' && 'bg-white/5 text-[color:var(--slate-300)] opacity-50',
                )}
              >
                {state === 'done' ? '✓' : stage.icon}
              </span>
              <span
                className={cn(
                  'text-[0.6rem] font-medium sm:text-xs',
                  state === 'active' ? 'text-white' : 'text-[color:var(--slate-300)]',
                )}
              >
                {nk(stage.label)}
              </span>
            </div>
            {i < STAGES.length - 1 ? (
              <span className="text-[color:var(--slate-300)] opacity-40">←</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
