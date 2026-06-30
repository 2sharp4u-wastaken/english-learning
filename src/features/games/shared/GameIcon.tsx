import { cn } from '@/lib/cn'
import { getGameIcon, type GameTierAccent } from '../gameIcons'
import { getGameIllustration } from '../gameIllustrations'

/**
 * GameIcon — renders a game's icon. As of the 2026-06-30 overhaul this is a
 * multi-color, kid-friendly SVG **illustration** (`gameIllustrations.tsx`) sitting
 * on a tier-tinted rounded tile, instead of a flat line icon or system emoji.
 * Games without an illustration fall back to the themed Lucide glyph (`gameIcons`).
 *
 * Variants:
 *  - `tile`        Home grid tile (illustration on a tier tile)
 *  - `hero`        in-game GameHero (slightly smaller tile)
 *  - `heroCompact` short-viewport GameHero (bare illustration, no tile)
 *  - `inline`      next to text in pills/buttons (bare small illustration)
 *  - `stage`       small bare glyph (legacy; WJ stage bar uses its own map)
 *
 * Illustrations have fixed colors (they don't theme-shift); the tile behind them
 * carries the tier accent. `tone`/Lucide tinting only applies to the fallback.
 */
export type GameIconVariant = 'tile' | 'hero' | 'heroCompact' | 'inline' | 'stage'

const ACCENT_TEXT: Record<GameTierAccent, string> = {
  learn: 'text-learn',
  practice: 'text-practice',
  challenge: 'text-challenge',
  test: 'text-test',
}

// Dark tier-tinted gradient for the tile behind an illustration.
const TILE_BG: Record<GameTierAccent, string> = {
  learn: 'linear-gradient(150deg,#10463f,#0c2e2a)',
  practice: 'linear-gradient(150deg,#13385f,#0c2238)',
  challenge: 'linear-gradient(150deg,#5a4316,#34280c)',
  test: 'linear-gradient(150deg,#5e2a23,#37160f)',
}

const TILE_BASE = 'inline-flex items-center justify-center ring-1 ring-white/10 shadow-[0_8px_18px_rgba(0,0,0,.28)]'

const SPEC: Record<GameIconVariant, { tile: string | null; art: string; glyph: string }> = {
  tile: { tile: cn(TILE_BASE, 'size-16 rounded-2xl'), art: 'size-11', glyph: 'size-8' },
  hero: { tile: cn(TILE_BASE, 'size-14 rounded-2xl'), art: 'size-10', glyph: 'size-7' },
  heroCompact: { tile: null, art: 'size-7', glyph: 'size-5' },
  inline: { tile: null, art: 'size-[1.4em]', glyph: 'size-[1.15em]' },
  stage: { tile: null, art: 'size-5', glyph: 'size-4' },
}

export interface GameIconProps {
  gameId: string
  variant?: GameIconVariant
  /** Only affects the Lucide fallback: `current` inherits color, `accent` tints. */
  tone?: 'accent' | 'current'
  className?: string
}

export function GameIcon({ gameId, variant = 'hero', tone = 'accent', className }: GameIconProps) {
  const spec = SPEC[variant]
  const { accent } = getGameIcon(gameId)
  const Illustration = getGameIllustration(gameId)

  if (Illustration) {
    const art = <Illustration className={spec.art} />
    if (!spec.tile) return <span className={cn('inline-flex', className)}>{art}</span>
    return (
      <span className={cn(spec.tile, className)} style={{ background: TILE_BG[accent] }}>
        {art}
      </span>
    )
  }

  // Fallback: themed Lucide glyph (loading / any unmapped id).
  const { Icon } = getGameIcon(gameId)
  const glyph = (
    <Icon aria-hidden strokeWidth={2.25} className={cn(spec.glyph, tone === 'accent' && ACCENT_TEXT[accent])} />
  )
  if (!spec.tile) return <span className={cn('inline-flex', className)}>{glyph}</span>
  return (
    <span className={cn(spec.tile, className)} style={{ background: TILE_BG[accent] }}>
      {glyph}
    </span>
  )
}
