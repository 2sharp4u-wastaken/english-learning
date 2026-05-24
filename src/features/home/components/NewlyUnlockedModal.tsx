import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export interface UnlockedGameMeta {
  id: string
  icon: string
  name: string
}

interface Props {
  games: UnlockedGameMeta[]
  onClose: () => void
}

/**
 * App-wide "you unlocked a new game!" celebration. Shown on the Home screen the
 * first time it mounts after a session unlocked one or more games (queued via
 * `queuePendingUnlocks`). Each unlocked game card pops in with a staggered
 * animation; dismissing keeps the child on Home with the new game visible.
 */
export function NewlyUnlockedModal({ games, onClose }: Props) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Next frame → trigger the enter transition.
    const id = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  if (games.length === 0) return null

  const title = games.length > 1 ? 'נפתחו משחקים חדשים!' : 'נפתח משחק חדש!'

  return (
    <div
      data-testid="newly-unlocked-modal"
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[color:var(--ink-900)] p-6 text-center shadow-2xl transition-all duration-300',
          shown ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
        )}
      >
        <div className="text-5xl">🎉</div>
        <h2 className="font-display text-2xl font-extrabold text-white">{title}</h2>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {games.map((g, i) => (
            <div
              key={g.id}
              data-testid="unlocked-game-card"
              className={cn(
                'flex w-28 flex-col items-center gap-2 rounded-2xl border border-[color:var(--mint-400)]/40 bg-gradient-to-br from-[color:var(--blue-400)]/20 to-[color:var(--mint-400)]/20 p-3 transition-all duration-500',
                shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-90 opacity-0',
              )}
              style={{ transitionDelay: `${150 + i * 180}ms` }}
            >
              <span className="text-4xl" aria-hidden>
                {g.icon}
              </span>
              <span className="text-sm font-bold leading-tight text-white">{g.name}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          data-testid="unlocked-modal-close"
          className="mt-1 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-10 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          קדימה! ←
        </button>
      </div>
    </div>
  )
}
