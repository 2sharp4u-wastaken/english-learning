import { cn } from '@/lib/cn'

export interface GameHeroProps {
  title: string
  subtitle?: string
  icon?: string
  className?: string
}

/**
 * Hero title rendered BETWEEN the header card and the progress strip on
 * every React game screen.
 *
 * Design adopted 2026-05-23 as the canonical title placement for all React
 * games (see CLAUDE.md "Shared game primitives" — Hero title). The previous
 * design centered the title inside the GameHeader card, where it competed
 * visually with the toggle/score pills. New design separates concerns: the
 * top row stays purely controls (back + toggles + score), the title acts as
 * a section heading directly above the progress bar, and the question card
 * follows.
 */
export function GameHero({ title, subtitle, icon, className }: GameHeroProps) {
  if (!title && !icon) return null
  return (
    <div
      data-testid="game-hero"
      className={cn(
        'flex flex-col items-center gap-1 pt-1 pb-2 text-center',
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2.5">
        {icon ? (
          <span className="text-3xl leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
      </div>
      {subtitle ? (
        <p className="text-sm text-[color:var(--slate-300)]">{subtitle}</p>
      ) : null}
      <div
        aria-hidden
        className="mt-1 h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  )
}
