/**
 * src/features/games/gameIllustrations.tsx — multi-color, kid-friendly SVG
 * illustrations for each game (the "colored illustration" direction chosen
 * 2026-06-30 over flat line icons / emoji).
 *
 * Each entry is a self-contained `viewBox="0 0 64 64"` illustration with FIXED
 * colors (they do NOT recolor with the player theme — that's intentional for a
 * playful look; the tier-tinted tile behind them, drawn by `GameIcon`, carries
 * the theme accent instead). Rendered via `<GameIcon gameId variant />`.
 *
 * To add a game: add its id here + to `GAME_ICONS` (gameIcons.ts, for the tier
 * tile color). Word-Journey *stage* glyphs are deliberately NOT here — the stage
 * bar recolors per progress state, so it stays on single-color Lucide
 * (`word-journey/stageIcons.ts`). Inventory + WHY: `docs/game-icons-inventory.md`.
 */
import type { ComponentType, ReactNode } from 'react'

type IllProps = { className?: string }
const svg = (children: ReactNode) =>
  function Ill({ className }: IllProps) {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        {children}
      </svg>
    )
  }

// ── shared little parts ──────────────────────────────────────────────────────
const Paper = (fill = '#fff7ec') => <rect x="15" y="12" width="30" height="36" rx="4" fill={fill} />

// ── books ───────────────────────────────────────────────────────────────────
const OpenBook = (cover1: string, cover2: string, extra?: ReactNode) =>
  svg(
    <>
      <path d="M32 17 C26 12 16 12 10 15 L10 50 C16 47 26 47 32 51 Z" fill={cover1} />
      <path d="M32 17 C38 12 48 12 54 15 L54 50 C48 47 38 47 32 51 Z" fill={cover2} />
      <path d="M32 19 C27 15 18 15 13 17.5 L13 47 C18 45 27 45 32 48 Z" fill="#fff7ec" />
      <path d="M32 19 C37 15 46 15 51 17.5 L51 47 C46 45 37 45 32 48 Z" fill="#fffdf7" />
      <path d="M32 19 V48" stroke="#e0a07a" strokeWidth="1.4" />
      {extra}
    </>,
  )

const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`)
  }
  return <polygon points={pts.join(' ')} fill={fill} />
}

// ── the catalogue ────────────────────────────────────────────────────────────
export const GAME_ILLUSTRATIONS: Record<string, ComponentType<IllProps>> = {
  // Learn
  'word-journey': svg(
    <>
      <path d="M10 16 L24 12 L40 16 L54 12 L54 48 L40 52 L24 48 L10 52 Z" fill="#fdf3d7" stroke="#e7cf9b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 12 V48 M40 16 V52" stroke="#e7cf9b" strokeWidth="1.5" fill="none" />
      <path d="M18 42 Q26 30 34 36 T48 22" fill="none" stroke="#ef5a5a" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 5.5" />
      <circle cx="18" cy="42" r="3" fill="#33b3a6" />
      <circle cx="48" cy="22" r="5" fill="#ef5a5a" />
      <circle cx="48" cy="22" r="2" fill="#fff" />
    </>,
  ),
  abc: svg(
    <>
      <rect x="8" y="26" width="20" height="20" rx="5" fill="#34d6c0" />
      <text x="18" y="41" fontSize="13" fontWeight="800" fill="#0a4a42" textAnchor="middle" fontFamily="Arial">A</text>
      <rect x="30" y="26" width="20" height="20" rx="5" fill="#ffd24a" />
      <text x="40" y="41" fontSize="13" fontWeight="800" fill="#7a5800" textAnchor="middle" fontFamily="Arial">B</text>
      <rect x="22" y="9" width="20" height="20" rx="5" fill="#ff7a85" />
      <text x="32" y="24" fontSize="13" fontWeight="800" fill="#7a1e26" textAnchor="middle" fontFamily="Arial">C</text>
    </>,
  ),
  phonics: svg(
    <>
      <rect x="12" y="26" width="9" height="12" rx="2" fill="#2aa899" />
      <path d="M21 26 L33 18 V46 L21 38 Z" fill="#34d6c0" />
      <g stroke="#ffce4d" strokeWidth="2.6" fill="none" strokeLinecap="round">
        <path d="M40 24 q5 8 0 16" />
        <path d="M46 20 q9 12 0 24" />
      </g>
    </>,
  ),
  // Practice
  listening: svg(
    <>
      <path d="M14 37 V30 a18 18 0 0 1 36 0 V37" fill="none" stroke="#4a90e2" strokeWidth="5" strokeLinecap="round" />
      <rect x="9" y="32" width="12" height="21" rx="6" fill="#2f6fc4" />
      <rect x="43" y="32" width="12" height="21" rx="6" fill="#2f6fc4" />
      <rect x="12" y="35" width="6" height="15" rx="3" fill="#8fc0ff" />
      <rect x="46" y="35" width="6" height="15" rx="3" fill="#8fc0ff" />
      <g fill="#ffd24a">
        <circle cx="29" cy="47" r="3.2" />
        <rect x="31.2" y="34" width="2.4" height="13" />
        <path d="M31.2 34 l6 -2 v3.2 l-6 2z" />
      </g>
    </>,
  ),
  'picture-match': svg(
    <>
      <rect x="11" y="14" width="42" height="34" rx="5" fill="#68a8ff" />
      <rect x="15" y="18" width="34" height="26" rx="3" fill="#e7f3ff" />
      <circle cx="24" cy="26" r="3.5" fill="#ffd24a" />
      <path d="M15 41 V36 l9 -8 6 6 8 -9 11 11 v5 Z" fill="#4cc38a" />
    </>,
  ),
  'true-or-not': svg(
    <>
      <circle cx="24" cy="29" r="13" fill="#4cc38a" />
      <path d="M18 29 l4 4 8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="43" cy="39" r="11" fill="#ff6f61" />
      <path d="M39 35 l8 8 M47 35 l-8 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>,
  ),
  memory: svg(
    <>
      <g transform="rotate(-12 24 32)">
        <rect x="11" y="15" width="23" height="31" rx="4.5" fill="#7c6cf0" />
        <rect x="15" y="19" width="15" height="23" rx="3" fill="#a99cf7" />
        <circle cx="22.5" cy="30.5" r="4" fill="#fff" opacity=".55" />
      </g>
      <g transform="rotate(11 40 34)">
        <rect x="30" y="17" width="23" height="31" rx="4.5" fill="#ff8ac0" />
        <rect x="34" y="21" width="15" height="23" rx="3" fill="#ffd0e6" />
        {star(41.5, 32, 6, '#ff5fa2')}
      </g>
    </>,
  ),
  'grammar-beginner': svg(
    <>
      <path d="M16 14 h26 a3 3 0 0 1 3 3 v30 a3 3 0 0 1 -3 3 h-26 a4 4 0 0 1 -4 -4 v-28 a4 4 0 0 1 4 -4z" fill="#4a90e2" />
      <rect x="16" y="14" width="6" height="36" fill="#2f6fc4" />
      <text x="35" y="37" fontSize="15" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">Aa</text>
    </>,
  ),
  articles: svg(
    <>
      <path d="M12 14 h40 a4 4 0 0 1 4 4 v18 a4 4 0 0 1 -4 4 h-24 l-9 8 v-8 h-7 a4 4 0 0 1 -4 -4 v-18 a4 4 0 0 1 4 -4z" fill="#ffd24a" />
      <text x="32" y="32" fontSize="11" fontWeight="800" fill="#7a5800" textAnchor="middle" fontFamily="Arial">a · an · the</text>
    </>,
  ),
  progressive: svg(
    <>
      <g stroke="#68a8ff" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6 24 h9" />
        <path d="M4 31 h7" />
        <path d="M8 38 h6" />
      </g>
      <path d="M16 40 q0 -7 7 -8 l9 -1 6 -6 q2 7 9 9 l9 2 a4 4 0 0 1 4 4 v2 a3 3 0 0 1 -3 3 h-43 a4 4 0 0 1 -4 -4z" fill="#ff7a66" />
      <path d="M18 43 h35" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>,
  ),
  practice: svg(
    <>
      <circle cx="29" cy="32" r="20" fill="#ff7a66" />
      <circle cx="29" cy="32" r="14" fill="#fff7ec" />
      <circle cx="29" cy="32" r="8" fill="#68a8ff" />
      <circle cx="29" cy="32" r="3" fill="#ffd24a" />
      <path d="M44 18 L30 32" stroke="#4cc38a" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 18 l5 -3 m-5 3 l-2 -5 m2 5 l5 2" stroke="#2f8f5f" strokeWidth="2.2" strokeLinecap="round" />
    </>,
  ),
  // Challenge
  reading: OpenBook('#ff8a5c', '#ffb27a',
    <g stroke="#f3b48f" strokeWidth="1.7" strokeLinecap="round">
      <path d="M18 24 H28 M18 29 H27 M18 34 H28" />
      <path d="M36 24 H46 M37 29 H46 M36 34 H46" />
    </g>,
  ),
  pronunciation: svg(
    <>
      <g fill="none" stroke="#ffce4d" strokeWidth="2.6" strokeLinecap="round">
        <path d="M45 22 q5 10 0 20" />
        <path d="M50 18 q8 14 0 28" />
      </g>
      <rect x="22" y="9" width="14" height="29" rx="7" fill="#ff6f61" />
      <rect x="25" y="14" width="8" height="3" rx="1.5" fill="#ffcfc7" />
      <rect x="25" y="20" width="8" height="3" rx="1.5" fill="#ffcfc7" />
      <path d="M18 32 a11 11 0 0 0 22 0" fill="none" stroke="#c94a3f" strokeWidth="3.2" strokeLinecap="round" />
      <rect x="27.4" y="42" width="3.2" height="9" rx="1.6" fill="#c94a3f" />
      <rect x="20" y="50" width="18" height="3.6" rx="1.8" fill="#c94a3f" />
    </>,
  ),
  'story-time': OpenBook('#7c6cf0', '#a99cf7',
    <>
      {star(22.5, 30, 4.5, '#ffd24a')}
      {star(42, 28, 4, '#ff7a66')}
    </>,
  ),
  'fill-blanks': svg(
    <>
      {Paper()}
      <g stroke="#cdd8e6" strokeWidth="2" strokeLinecap="round">
        <path d="M20 21 H40 M20 27 H40" />
      </g>
      <rect x="20" y="32" width="13" height="4" rx="2" fill="#ffd24a" />
      <path d="M20 38 H40" stroke="#cdd8e6" strokeWidth="2" strokeLinecap="round" />
      <g transform="rotate(45 46 40)">
        <rect x="43" y="24" width="5" height="20" rx="2" fill="#ff7a66" />
        <path d="M43 44 h5 l-2.5 5z" fill="#5a4a2a" />
        <rect x="43" y="20" width="5" height="5" fill="#ffd24a" />
      </g>
    </>,
  ),
  scramble: svg(
    <>
      <path d="M28 14 q14 1 16 13" fill="none" stroke="#ff7a66" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M44 27 l1 -6 -6 2z" fill="#ff7a66" />
      <g transform="rotate(-12 22 28)">
        <rect x="13" y="20" width="17" height="17" rx="3.5" fill="#68a8ff" />
        <text x="21.5" y="32.5" fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">W</text>
      </g>
      <g transform="rotate(12 42 40)">
        <rect x="33" y="32" width="17" height="17" rx="3.5" fill="#ffd24a" />
        <text x="41.5" y="44.5" fontSize="11" fontWeight="800" fill="#7a5800" textAnchor="middle" fontFamily="Arial">O</text>
      </g>
    </>,
  ),
  grammar: svg(
    <>
      <rect x="15" y="11" width="29" height="37" rx="4" fill="#fff7ec" />
      <g stroke="#cdd8e6" strokeWidth="2" strokeLinecap="round">
        <path d="M21 20 H38 M21 26 H38 M21 32 H33" />
      </g>
      <circle cx="43" cy="44" r="9" fill="#4cc38a" />
      <path d="M39 44 l3 3 6 -7" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  // Test
  vocabulary: svg(
    <>
      <path d="M32 14 L55 24 L32 34 L9 24 Z" fill="#7c6cf0" />
      <path d="M20 28 v10 q12 8 24 0 v-10" fill="#a99cf7" />
      <rect x="53" y="24" width="2.4" height="12" fill="#ffd24a" />
      <circle cx="54.2" cy="38" r="3" fill="#ff7a66" />
    </>,
  ),
  // Expressions (tier = challenge)
  'expr-meaning': svg(
    <>
      <path d="M14 18 H32 V25 A4 4 0 0 1 32 33 V40 H14 Z" fill="#34d6c0" />
      <path d="M34 18 H52 V40 H34 V33 A4 4 0 0 1 34 25 Z" fill="#ff8a5c" />
    </>,
  ),
  'expr-truefalse': svg(
    <>
      <circle cx="24" cy="29" r="13" fill="#4cc38a" />
      <path d="M18 29 l4 4 8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="43" cy="39" r="11" fill="#ff6f61" />
      <path d="M39 35 l8 8 M47 35 l-8 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </>,
  ),
  'expr-blank': svg(
    <>
      {Paper()}
      <g stroke="#cdd8e6" strokeWidth="2" strokeLinecap="round">
        <path d="M20 21 H40 M20 27 H40" />
      </g>
      <rect x="20" y="32" width="13" height="4" rx="2" fill="#ffd24a" />
      <path d="M20 38 H40" stroke="#cdd8e6" strokeWidth="2" strokeLinecap="round" />
      <g transform="rotate(45 46 40)">
        <rect x="43" y="24" width="5" height="20" rx="2" fill="#ff7a66" />
        <path d="M43 44 h5 l-2.5 5z" fill="#5a4a2a" />
        <rect x="43" y="20" width="5" height="5" fill="#ffd24a" />
      </g>
    </>,
  ),
  'expr-build': svg(
    <>
      <rect x="13" y="34" width="16" height="13" rx="2.5" fill="#ff7a66" />
      <rect x="31" y="34" width="16" height="13" rx="2.5" fill="#68a8ff" />
      <rect x="22" y="19" width="16" height="13" rx="2.5" fill="#ffd24a" />
      <g fill="#fff" opacity=".45">
        <circle cx="18" cy="33.5" r="1.6" />
        <circle cx="24" cy="33.5" r="1.6" />
        <circle cx="36" cy="33.5" r="1.6" />
        <circle cx="42" cy="33.5" r="1.6" />
        <circle cx="27" cy="18.5" r="1.6" />
        <circle cx="33" cy="18.5" r="1.6" />
      </g>
    </>,
  ),
  'expr-swap': svg(
    <>
      <g fill="none" strokeLinecap="round" strokeWidth="3.4">
        <path d="M19 24 H35 a8 8 0 0 1 8 8" stroke="#34d6c0" />
        <path d="M45 40 H29 a8 8 0 0 1 -8 -8" stroke="#ff7a66" />
      </g>
      <path d="M43 32 l3 -5 -6 0z" fill="#34d6c0" transform="rotate(90 43 30)" />
      <path d="M19 32 l3 5 -6 0z" fill="#ff7a66" transform="rotate(-90 19 34)" />
    </>,
  ),
}

export function getGameIllustration(gameId: string): ComponentType<IllProps> | null {
  return GAME_ILLUSTRATIONS[gameId] ?? null
}
