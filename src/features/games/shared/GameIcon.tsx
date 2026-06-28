import { cn } from '@/lib/cn'
import { getGameIcon, type GameTierAccent } from '../gameIcons'

/**
 * GameIcon — renders a game's icon from the central `GAME_ICONS` map
 * (`src/features/games/gameIcons.ts`) as a themed `lucide-react` glyph instead
 * of a raw system emoji. Device-consistent and crisp at any size; tinted by the
 * game's tier accent so it re-colors with the player's theme.
 *
 * Variants:
 *  - `tile`        Home grid tile (badge + large glyph)
 *  - `hero`        in-game GameHero (badge + medium glyph)
 *  - `heroCompact` short-viewport GameHero (bare medium glyph, no badge)
 *  - `inline`      next to text in pills/buttons (bare small glyph)
 *  - `stage`       Word Journey stage bar (bare tiny glyph)
 */
export type GameIconVariant = 'tile' | 'hero' | 'heroCompact' | 'inline' | 'stage'

const ACCENT_TEXT: Record<GameTierAccent, string> = {
  learn: 'text-learn',
  practice: 'text-practice',
  challenge: 'text-challenge',
  test: 'text-test',
}

const BADGE_BASE = 'inline-flex items-center justify-center bg-white/10 ring-1 ring-white/10'

const SPEC: Record<GameIconVariant, { badge: string | null; icon: string }> = {
  tile: { badge: cn(BADGE_BASE, 'size-14 rounded-2xl sm:size-16'), icon: 'size-7 sm:size-8' },
  hero: { badge: cn(BADGE_BASE, 'size-11 rounded-xl'), icon: 'size-6' },
  heroCompact: { badge: null, icon: 'size-5' },
  inline: { badge: null, icon: 'size-[1.15em]' },
  stage: { badge: null, icon: 'size-4' },
}

export interface GameIconProps {
  gameId: string
  variant?: GameIconVariant
  /** `accent` (default) tints by tier; `current` inherits `currentColor` — use
   *  on colored backgrounds where the tier tint would clash (e.g. the Home CTA). */
  tone?: 'accent' | 'current'
  className?: string
}

export function GameIcon({ gameId, variant = 'hero', tone = 'accent', className }: GameIconProps) {
  const { Icon, accent } = getGameIcon(gameId)
  const spec = SPEC[variant]
  const glyph = (
    <Icon aria-hidden strokeWidth={2.25} className={cn(spec.icon, tone === 'accent' && ACCENT_TEXT[accent])} />
  )
  if (!spec.badge) return <span className={className}>{glyph}</span>
  return <span className={cn(spec.badge, className)}>{glyph}</span>
}
