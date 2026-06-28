/**
 * src/features/games/gameIcons.ts — single source of truth for game icons.
 *
 * Before this map, every game's icon was a raw emoji string re-declared in up to
 * three places (`engine/gameRegistry.ts`, each game page's `headerProps`, and
 * `HomePage` `GAME_ORDER` fallbacks) that frequently drifted (e.g. grammar 📝 vs
 * ✏️, memory 🃏 vs 🧠) and collided (📖 reading == story-time, ✅ true-or-not ==
 * expr-truefalse). System emoji also render differently per OS and needed a
 * 310 KB Noto subset web-font to avoid "tofu" boxes on older Android
 * (`docs/emoji-tofu-fix.md`).
 *
 * Now: one `lucide-react` icon per game id, tinted by the game's Home tier so it
 * re-colors with the player's theme (the `--color-<tier>` vars in themes.css).
 * Lucide is already a dependency, renders pixel-identical on every device, and
 * scales crisply. Render via `<GameIcon gameId="…" />` (shared/GameIcon.tsx).
 *
 * Inventory + rationale + alternatives: `docs/game-icons-inventory.md`.
 */
import {
  ALargeSmall,
  AudioLines,
  Blocks,
  BookA,
  BookOpen,
  Brain,
  CircleCheck,
  CircleCheckBig,
  Footprints,
  GraduationCap,
  Headphones,
  Images,
  Map,
  Mic,
  PenLine,
  Puzzle,
  Repeat,
  ScrollText,
  Shuffle,
  SpellCheck,
  SquarePen,
  Target,
  Type,
  type LucideIcon,
} from 'lucide-react'

export type GameTierAccent = 'learn' | 'practice' | 'challenge' | 'test'

export interface GameIconDef {
  /** Lucide component rendered for this game. */
  Icon: LucideIcon
  /** Theme accent (maps to the `text-<accent>` Tailwind color + a tint). */
  accent: GameTierAccent
}

/**
 * id → icon. Within a tier, distinct glyphs keep neighbouring tiles
 * distinguishable for kids who navigate by picture (no more 📖/📖 or ✅/✅).
 */
export const GAME_ICONS: Record<string, GameIconDef> = {
  // Learn
  'word-journey': { Icon: Map, accent: 'learn' },
  abc: { Icon: ALargeSmall, accent: 'learn' },
  phonics: { Icon: AudioLines, accent: 'learn' },
  // Practice
  listening: { Icon: Headphones, accent: 'practice' },
  'picture-match': { Icon: Images, accent: 'practice' },
  'true-or-not': { Icon: CircleCheckBig, accent: 'practice' },
  memory: { Icon: Brain, accent: 'practice' },
  'grammar-beginner': { Icon: BookA, accent: 'practice' },
  articles: { Icon: Type, accent: 'practice' },
  progressive: { Icon: Footprints, accent: 'practice' },
  practice: { Icon: Target, accent: 'practice' },
  // Challenge
  reading: { Icon: BookOpen, accent: 'challenge' },
  pronunciation: { Icon: Mic, accent: 'challenge' },
  'story-time': { Icon: ScrollText, accent: 'challenge' },
  'fill-blanks': { Icon: PenLine, accent: 'challenge' },
  scramble: { Icon: Shuffle, accent: 'challenge' },
  grammar: { Icon: SpellCheck, accent: 'challenge' },
  // Test
  vocabulary: { Icon: GraduationCap, accent: 'test' },
  // Expressions (share the challenge accent, like the tier badge)
  'expr-meaning': { Icon: Puzzle, accent: 'challenge' },
  'expr-truefalse': { Icon: CircleCheck, accent: 'challenge' },
  'expr-blank': { Icon: SquarePen, accent: 'challenge' },
  'expr-build': { Icon: Blocks, accent: 'challenge' },
  'expr-swap': { Icon: Repeat, accent: 'challenge' },
}

/** Lookup with a safe fallback (Puzzle/challenge) for unknown ids. */
export function getGameIcon(gameId: string): GameIconDef {
  return GAME_ICONS[gameId] ?? { Icon: Puzzle, accent: 'challenge' }
}
