# Game Icons — Asset Inventory & Overhaul Assessment

**Status:** ✅ **IMPLEMENTED** — all game icons migrated from raw emoji to a
single themed `lucide-react` set (see "What shipped" below). This doc remains the
inventory of record + the rationale/alternatives.
**Audience:** Hebrew-speaking kids ages 5–8, RTL UI
**Scope:** the per-game icons shown on the Home tiles and inside each game's hero
header. (Vocabulary *word* images in `img/icons/**` are out of scope — those are
content, not chrome.)

## What shipped

- **One source of truth:** `src/features/games/gameIcons.ts` — `GAME_ICONS`
  maps every game id → a `lucide-react` glyph + a tier accent. `getGameIcon(id)`
  resolves with a safe `Puzzle`/challenge fallback.
- **One render component:** `src/features/games/shared/GameIcon.tsx` —
  `<GameIcon gameId variant tone />`. Variants: `tile` (Home grid, badged),
  `hero`/`heroCompact` (in-game `GameHero`), `inline` (em-sized, for pills/CTAs),
  `stage` (WJ). `tone='current'` inherits `currentColor` for colored backgrounds
  (the Home "בוא נשחק" CTA, locked/muted pills).
- **Threading:** `GameHeaderProps.gameId` → `GameScreenShell` → `GameHero` renders
  the themed icon (the emoji `icon` prop is kept only as a loading/non-game
  fallback). Every game page now passes `gameId` instead of an emoji `icon`.
- **Word Journey stages:** `src/features/games/word-journey/stageIcons.ts`
  (`WJ_STAGE_ICONS`) is the single map used by both the in-game `WJStageBar` and
  the Stats journey pills.
- **Render sites migrated:** Home tiles + continue CTA + next-unlock pill,
  `NewlyUnlockedModal`, every in-game `GameHero`, expression games,
  `BlankFillGamePage` (articles/progressive) incl. its empty state, Profile game
  badges, Stats coin-history game column + journey pills, `WJStageBar`.
- **Drift/collisions resolved:** distinct glyph per game (no more 📖/📖 or ✅/✅);
  icons are now defined once, not re-typed per render site.
- The legacy emoji strings still sit in `engine/gameRegistry.ts`,
  `HomePage` `GAME_ORDER.fallbackIcon`, `bridge/stats.ts` (`GAME_NAMES` /
  `WORD_JOURNEY_STAGES`) as inert data fallbacks — no render site reads them now.

**Direction chosen:** Lucide line icons (Option A) — fully self-contained (zero
new assets/licensing), device-consistent (kills the "tofu" problem), themeable,
reversible. Each icon is colored by its tier accent + sits in a soft badge on the
tiles to stay playful for the age group. To later switch to colored SVG
illustrations (Option B), swap the glyphs in `gameIcons.ts` + the render in
`GameIcon.tsx` — every site updates from that one place.

## TL;DR

- **Every game icon is a raw emoji string** (`icon: '📚'`) rendered as text in a
  `<span aria-hidden>` (`GameHero`) or a Home tile. There are **24 games**.
- The same icon is **declared in up to three places** per game
  (`gameRegistry.ts`, the game page's `headerProps`, and `HomePage` `GAME_ORDER`
  fallbacks) and several of them **disagree** — see "Inconsistencies" below.
- Emoji are already a known pain point: `docs/emoji-tofu-fix.md` describes a
  310 KB Noto subset web-font shipped just to stop newer-Unicode emoji rendering
  as blank "tofu" boxes on older Android. Emoji also look different on every
  OS/browser, so the brand is inconsistent across the families' devices.
- **Yes, replacing them is very feasible.** The whole surface flows through one
  prop (`GameHero`'s `icon`), so a single render-layer change + a centralized
  icon map covers all 24 games. The open question is *what* to replace them with
  (line icons vs. colored illustrations vs. consistent emoji set) — see "Options".

## Where game icons live (the data flow)

```
gameRegistry.ts (ENTRIES[].icon)  ──► bridge/games.getGameCatalog()
        │                                      │
        │                                      ▼
        │                            HomePage catalog: game?.icon ?? fallbackIcon
        │                                      │
        │                                      ▼  rendered as text in the Home tile
        │
        └─ (NOT used in-game) each game page declares its OWN headerProps.icon
                                      │
                                      ▼
                            GameScreenShell → GameHero icon  (text span)
```

So the **Home tile** icon comes from the registry (falling back to
`GAME_ORDER`), while the **in-game hero** icon comes from each page's local
`headerProps`. They are independent strings, which is why they drift.

### Render sites

| Layer | File | How icon is used |
|---|---|---|
| Canonical catalog | `src/engine/gameRegistry.ts` | `ENTRIES[].icon` emoji string |
| Home tiles | `src/features/home/HomePage.tsx` | `GAME_ORDER[].fallbackIcon` + render `{game.icon}` (line ~289) |
| In-game hero | each `src/features/games/*/**GamePage.tsx` | local `headerProps = { icon: '…' }` |
| Hero primitive | `src/features/games/shared/GameHero.tsx` | `icon?: string` → `<span className="text-3xl" aria-hidden>{icon}</span>` |
| WJ stage bar | `src/features/games/word-journey/components/WJStageBar.tsx` | per-stage emoji |
| Expression modes | `src/features/games/expressions/ExpressionGamePage.tsx` | `MODE_META[].icon` |
| Loading state | `src/features/games/GameHostPage.tsx` | `icon: '⏳'` |

## Full inventory (24 games)

Canonical = `gameRegistry.ts`. "In-game" = the icon the game's own hero shows.
"Home fallback" = `GAME_ORDER` fallback (only used if the registry entry is
missing — today the registry always wins on the Home tile).

| # | Game id | Hebrew name | Canonical (registry) | In-game hero | Home fallback | Notes |
|---|---|---|---|---|---|---|
| 1 | `vocabulary` | אוצר מילים / מבחן מילים | 📚 | 📚 | 📝 | name+icon drift (test tier) |
| 2 | `grammar` | דקדוק | ✏️ | 📝 | ✏️ | **registry ≠ in-game** |
| 3 | `grammar-beginner` | דקדוק למתחילים | 🔊 | 🔊 | 📐 | **home fallback ≠ registry** |
| 4 | `articles` | a / an / the | 📝 | 📝 | 📝 | shares 📝 with vocab+grammar |
| 5 | `progressive` | זמן מתמשך | 🏃 | 🏃 | 🏃 | |
| 6 | `pronunciation` | הגייה | 🎤 | 🎤 | 🎤 | shares 🎤 with WJ say-word |
| 7 | `listening` | הקשבה | 👂 | 🎧 | 👂 | **registry ≠ in-game** |
| 8 | `reading` | קריאה | 📖 | 📖 | 📖 | **collides with story-time** |
| 9 | `practice` | מצב תרגול | 🎯 | 🎯 | 🎯 | shares 🎯 with practice tier badge |
| 10 | `abc` | ABC אותיות | 🔤 | 🔤 | 🔤 | |
| 11 | `phonics` | משחק צלילים | 🔡 | 🔡 | 🔡 | near-identical to 🔤 abc |
| 12 | `memory` | משחק זיכרון | 🃏 | 🧠 | 🧠 | **registry ≠ in-game/home** |
| 13 | `scramble` | סידור משפטים | 🔀 | 🔀 | 🔀 | |
| 14 | `fill-blanks` | השלם את המשפט | ✍️ | ✍️ | ✍️ | shares ✍️ with expr-blank, WJ spell |
| 15 | `word-journey` | מסע המילים | 🗺️ | 🗺️ | 🗺️ | |
| 16 | `picture-match` | מילה לתמונה | 🖼️ | 🖼️ | 🖼️ | |
| 17 | `true-or-not` | נכון או לא? | ✅ | ✅ | ✅ | **collides with expr-truefalse** |
| 18 | `story-time` | זמן סיפור | 📖 | 📖 | 📚 | **collides with reading; home≠registry** |
| 19 | `expr-meaning` | התאמת משמעות | 🧩 | 🧩 | 🧩 | |
| 20 | `expr-truefalse` | נכון או לא? | ✅ | ✅ | ✅ | collides with true-or-not |
| 21 | `expr-blank` | השלימו את הביטוי | ✍️ | ✍️ | ✍️ | collides with fill-blanks |
| 22 | `expr-build` | בנו את הביטוי | 🧱 | 🧱 | 🧱 | |
| 23 | `expr-swap` | החליפו בביטוי | 🔄 | 🔄 | 🔄 | |

### Word Journey stage icons (`WJStageBar.tsx`)
| Stage | Icon |
|---|---|
| discover | 👀 |
| listen-match | 👂 |
| spell-tiles | ✏️ |
| say-word | 🎤 |
| recall | 🧠 |

### Tier header emojis (`HomePage.tsx` `TIER_META`)
| Tier | Emoji |
|---|---|
| learn (מתחילים ללמוד) | 🌱 |
| practice (מתרגלים יחד) | 🎯 |
| challenge (אתגרים מגניבים) | 🚀 |
| test (בודקים מה ידעתי) | 🏆 |
| expressions (ביטויים) | 💬 |

## Inconsistencies worth fixing regardless of the visual direction

1. **Same icon defined in 2–3 places that disagree** — `grammar` (✏️ vs 📝),
   `listening` (👂 vs 🎧), `memory` (🃏 vs 🧠 vs 🧠), `grammar-beginner`
   (🔊 vs 📐), `story-time` (📖 vs 📚), `vocabulary` (name "אוצר מילים" vs the
   test-tile intent "מבחן מילים").
2. **Collisions** — 📖 is used by both reading and story-time; ✅ by both
   true-or-not and expr-truefalse; ✍️ by fill-blanks, expr-blank, and WJ spell;
   📝 by articles + grammar(in-game) + vocab(home). Kids navigating by picture
   can't tell two tiles apart.
3. **No single source of truth.** Each render site re-types the emoji literal,
   so any future change must be made in N places.

**Recommendation (independent of visuals):** introduce one
`src/features/games/gameIcons.ts` map keyed by game id and have every render
site read from it. That alone removes the drift and makes a later asset swap a
one-file change.

## Is replacing emoji feasible? — Yes

All 24 game icons funnel through `GameHero`'s `icon` prop and the Home tile
`{game.icon}` span. Both currently render the value as **text**. To support
"something better" we change `icon?: string` to accept a richer value (an icon
component / asset key) and render accordingly, then centralize the mapping. No
game logic, scoring, or routing is touched.

### Options for "something better"

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **A. Lucide icons** (already a dependency) | Swap each emoji for a `lucide-react` line icon (e.g. `BookOpen`, `Mic`, `Headphones`, `Brain`, `Puzzle`) | Zero new deps; pixel-identical on every device; themeable via `currentColor`; tiny | Monochrome line art is **less playful** for ages 5–8; some concepts (story, articles) have no obvious glyph |
| **B. Colored SVG illustrations** | A bespoke/curated set of flat, colorful kid-friendly SVGs in `img/icons/games/` (or a pack like OpenMoji-color / Streamline) | Most appealing for the age group; full brand control; consistent across devices | Needs ~24 assets sourced/commissioned + licensing; larger payload; more work |
| **C. Consistent emoji set** (e.g. OpenMoji / Twemoji as SVG) | Keep the emoji *vocabulary*, but render from a bundled SVG set instead of the system font | Same friendly look everywhere; kills the tofu problem for good; familiar shapes | Adds an asset/sprite layer; Twemoji style is flat (some kids prefer Noto's rounder look) |
| **D. Status quo + cleanup** | Keep emoji, but fix the inconsistencies/collisions and centralize the map | Cheapest; keeps the colorful look | Still device-inconsistent; tofu risk remains for new emoji |

**My recommendation:** **B (colored SVG illustrations) for the strongest result**,
or **C (bundled SVG emoji set)** as the high-value / lower-effort middle path —
both give cross-device consistency that the current system-emoji approach can
never have, which matters because the families test on a spread of Android
devices (the very reason `emoji-tofu-fix.md` exists). In all cases, do the
**centralized icon map (the cleanup from option D) first** — it's a prerequisite
that makes the asset swap a single-file change and is worth doing on its own.

## Suggested implementation phases (once a direction is chosen)

1. **Centralize** — add `gameIcons.ts` (id → icon), point `gameRegistry`,
   `HomePage`, every `headerProps`, `WJStageBar`, and the expression `MODE_META`
   at it. Resolve the drift/collisions. (Pure refactor, no visual change.)
2. **Render layer** — extend `GameHero.icon` (and the Home tile) to accept the
   new icon type (component or asset key) with an emoji fallback.
3. **Assets** — drop in the chosen set (Lucide mapping / SVG files) behind the
   map. Verify RTL, compact/landscape hero, locked (grayscale) state, and the
   `data-testid="game-hero"` tests still pass.
4. **Docs** — update this file + CLAUDE.md "Shared game primitives" with the new
   icon convention so future games follow it.
