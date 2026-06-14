import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface GameHeroProps {
  title: string
  subtitle?: string
  icon?: string
  /**
   * Optional content rendered to the physical LEFT of the centered title,
   * inside the same hero container. Used by Word Journey to sit its 5-stage
   * tracker beside the "מסע מילים" banner. Stacks below the title on narrow
   * screens so it never overlaps.
   */
  aside?: ReactNode
  /** Short-viewport mode (M3): collapse to a single slim line — small inline
   *  icon + title, no big icon block, no divider — to reclaim vertical space on
   *  small/landscape phones. Set by GameScreenShell via useCompactViewport. */
  compact?: boolean
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
export function GameHero({ title, subtitle, icon, aside, compact, className }: GameHeroProps) {
  const nk = useNikud()
  if (!title && !icon) return null
  // Compact (short viewport): one slim line, no divider — saves ~70px so the
  // question card isn't pushed off-screen on small/landscape phones.
  if (compact) {
    return (
      <div
        data-testid="game-hero"
        data-compact="true"
        className={cn('flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center', className)}
      >
        {icon ? (
          <span className="text-lg leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        <h1 className="text-base font-extrabold tracking-tight text-white">{nk(title)}</h1>
        {aside ? <div className="w-full sm:w-auto">{aside}</div> : null}
      </div>
    )
  }
  return (
    <div
      data-testid="game-hero"
      className={cn(
        'relative flex flex-col items-center gap-1 pt-1 pb-2 text-center',
        className,
      )}
    >
      {aside ? (
        <div className="order-2 mt-1 sm:absolute sm:left-0 sm:top-1/2 sm:order-none sm:mt-0 sm:-translate-y-1/2">
          {aside}
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-2.5">
        {icon ? (
          <span className="text-3xl leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {nk(title)}
        </h1>
      </div>
      {subtitle ? (
        <p className="text-sm text-[color:var(--slate-300)]">{nk(subtitle)}</p>
      ) : null}
      <div
        aria-hidden
        className="mt-1 h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  )
}
