# English Learning Games — לומדים אנגלית בכיף

An interactive English-learning web app for Hebrew-speaking kids (ages 5–8): multiple
game types, gamification, per-word progress tracking, and parent controls — all in a
fun, fully RTL Hebrew interface.

The app is a **hybrid**: a React UI (Vite + TypeScript + Tailwind) is progressively
replacing the original vanilla-JS app. Legacy game/manager logic still runs underneath
and React reaches it only through typed adapters in `src/bridge/`. See
[`docs/master-plan.md`](docs/master-plan.md) for the migration plan and phase status.

## Getting Started

Two dev servers run side by side:

```bash
python3 server.py     # Python API server on :3000 (handles /api/*)
npm run dev           # Vite dev server on :3002 (proxies /api/* to :3000)
```

Then open **`http://localhost:3002`**. (HTTPS is served automatically if `server.crt`/
`server.key` exist at the project root — required for microphone games; see
[`docs/dev-setup.md`](docs/dev-setup.md).)

## Features

- **Multiple game types** — vocabulary, grammar, pronunciation, listening, reading,
  spelling, memory, and the multi-stage Word Journey
- **Gamification** — coins, streaks, certificates, learning levels, course progression
- **Progress tracking** — per-user word mastery, daily streaks, statistics
- **Parent controls** — password-protected settings, custom word lists
- **Hebrew UI** — fully RTL, designed for young learners
- **Text-to-speech & speech recognition** — pronunciation playback and spoken practice

## How learning works (in brief)

Word Journey introduces new words; the other games reinforce them; accumulated progress
unlocks more games. The full model — the mastery-driven word lifecycle (New → Learning →
Learned → Due, with light spacing), Word Journey mechanics, and open loose ends — is
documented in [`docs/learning-path.md`](docs/learning-path.md).

## Architecture

```
index.html          # Vite entry — hosts both #react-root and legacy markup
app.js              # Legacy orchestration & auth bootstrap (kept until Phase 4)
gameLogic.js        # Legacy GameManager
games/              # Legacy game modules (migrating to React one slice at a time)
managers/           # ScoreManager, ProgressManager, GameRegistry, CourseManager,
                    # CertificateManager, CoinManager — logic source of truth
data/               # Shared word/sentence/course data (used by legacy + React)
src/                # React app (Vite + TS + Tailwind)
  bridge/           # Typed adapters to legacy globals & localStorage (the only gateway)
  hooks/            # React hooks consuming bridge modules
  features/         # Page-level features (home, profile, settings, games/*)
  ui/ components/   # shadcn/ui primitives + shared components
  app/              # Shell, hash router, providers
  styles/           # Tokens, themes, scoped reset
server.py           # Python dev server: static files, /api write endpoints, HTTPS
```

- **Bridge is the only gateway to legacy.** React components never touch `window.*`
  globals or `localStorage` directly — all access goes through `src/bridge/*.ts`.
- **CSS containment.** Tailwind Preflight is disabled; the React app is scoped under
  `#react-root`; legacy `styles.css` is loaded via `<link>` and never imported into Vite.
- **Routing.** Hash-based React Router (`/#/home`, `/#/game/:gameId`, …); legacy
  `.html` pages remain reachable at their file paths until retired in Phase 4.

### Word schema

```js
{ word, translation, category, image, imageUrl? }
```

### Key localStorage keys (all `v2_`-prefixed)

| Key | Purpose |
|-----|---------|
| `currentUser` | Active user ID |
| `v2_userProgress_<userId>` | Progress, word mastery, streak, certificates |
| `v2_englishLearningSettings` | App-wide settings |
| `v2_authUsers` | User accounts |
| `v2_customWords_global` | Parent-added custom words (shared across users) |

## Documentation

| Doc | What it covers |
|-----|----------------|
| [`docs/master-plan.md`](docs/master-plan.md) | Migration phases & slices — source of truth |
| [`docs/wiring-map.md`](docs/wiring-map.md) | Cause/effect chains across the app |
| [`docs/learning-path.md`](docs/learning-path.md) | Learning/unlock model, word lifecycle, Word Journey mechanics, open loose ends |
| [`docs/score-system.md`](docs/score-system.md) | Scoring, persistence, and coin economy |
| [`docs/dev-setup.md`](docs/dev-setup.md) | Servers, HTTPS/mic certs, known limitations |
| `CLAUDE.md` | Behavioral rules for Claude Code in this repo |

## Word Categories

Animals, Colors, Food, Home, Body, Clothes, Actions, Adjectives, Numbers, Feelings,
Nature, Sports, School, Places, Time, Transportation, Music, Tools, Signs, Family,
Weather, Gaming (Minecraft, Roblox), and parent-added Custom words.

## Adding Custom Words

In the parent settings (password-protected), add custom words with a Hebrew translation
and optional image. Custom words are shared across all user profiles.
