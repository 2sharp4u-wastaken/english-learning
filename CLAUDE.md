# CLAUDE.md — English Learning Game (v3 — React Migration)

Behavioral rules for Claude Code in this project. These override defaults.

## Project Identity
- Hebrew-speaking kids, ages 5–8, learning English
- RTL interface (`dir="rtl"`, `lang="he"`)
- Hybrid app: React (Vite + TypeScript + Tailwind) progressively replacing legacy vanilla JS
- **Master plan:** `docs/master-plan.md` — the source of truth for migration phases and decisions

## Dev Setup
- **Start Python API server:** `python3 server.py` (port 3000, handles `/api/*` endpoints)
- **Start Vite dev server:** `npm run dev` (port 3002, proxies `/api/*` to Python)
- **Open app:** `http://localhost:3002` (HTTPS only works if `server.crt`/`server.key` exist at the project root; without them both servers fall back to HTTP)
- Both servers must be running during development

## Rules

### Never auto-commit or auto-push
Always ask before committing or pushing. Show the diff summary and wait for explicit approval.

### Slice closeout discipline
Before committing a non-trivial change or ending a session, consult the `feedback_cross_session_continuity` memory and run its 6-item closeout (master-plan + wiring-map + memory with WHY annotations + lean auto-load + cold-start verification). A PreToolUse hook nudges this on every `git commit` — don't ignore it. Skip for doc/typo/trivial fixes.

### Read before modifying
Read every file you plan to change before touching it. Do not suggest changes to code you haven't read.

### Keep the logger lean
`utils/consoleLogger.js` must use an in-memory array only — never localStorage persistence per log call, as it causes severe UI slowdown.

### Keep docs in sync
When changing any setting, game mechanic, or learning flow — update the relevant file in `docs/` in the same session.

### Bridge is the only gateway to legacy
React components must never access `window.*` globals or `localStorage` directly. All legacy data access goes through `src/bridge/*.ts` modules. React hooks in `src/hooks/` consume bridge modules. Existing bridges: `auth`, `audio`, `categories`, `courses`, `feedback`, `games`, `progress`, `settings`, `stats`, `storage`, `textPrefs`, `vocabulary`. Add new ones as needed; never bypass.

### CSS containment
- Tailwind Preflight is **disabled** — legacy `styles.css` provides its own resets
- React app is scoped under `#react-root` with its own reset in `src/styles/globals.css`
- Legacy `styles.css` is loaded via `<link>` tag, not imported into Vite
- No Tailwind prefix — utility classes don't collide with legacy semantic class names
- If a collision is discovered, fix it per-case

### RTL-first
Design and implement RTL first. Use Tailwind logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`) and RTL utilities (`rtl:`, `ltr:`). Test RTL in every slice.

## Architecture Quick Reference

### Hybrid structure
```
/                    ← project root
  index.html         ← Vite entrypoint (has both #react-root and legacy markup)
  app.js             ← legacy orchestration (kept until Phase 4)
  games/             ← legacy game modules
  managers/          ← legacy managers (ScoreManager, ProgressManager, etc.)
  data/              ← shared data (used by both legacy and React)
  src/               ← React app (Vite + TypeScript + Tailwind)
    bridge/          ← typed adapters to legacy globals and localStorage
    hooks/           ← React hooks consuming bridge modules
    features/        ← page-level features (home, profile, settings, etc.)
    ui/              ← shadcn/ui primitives
    components/      ← shared app components
    app/             ← shell, router, providers
    styles/          ← tokens, themes, scoped reset
```

### Routing
Hash-based routing via React Router (`createHashRouter`):
- `/#/home`, `/#/profile`, `/#/courses`, `/#/stats`, `/#/settings`, `/#/game/:gameId`
- Legacy `.html` pages remain accessible at their file paths until retired

### Word object schema
```js
{ word, translation, category, image, imageUrl? }
```

### localStorage keys
- `currentUser` — active user ID
- `v2_userProgress_<userId>` — progress, wordMastery, streak, certificates
- `v2_englishLearningSettings` — app settings
- `v2_authUsers` — all user accounts
- `v2_customWords_global` — parent-added custom words
- All keys use `v2_` prefix (set in `app.js`)

### Managers (legacy, in `managers/`)
ScoreManager, ProgressManager, GameRegistry, CourseManager, CertificateManager, CoinManager
Initialized after auth in `app.js → AppManager.setupWithAuth()`.
Accessed from React only via `src/bridge/` modules.

### Game types
`vocabulary`, `grammar`, `grammar-beginner`, `pronunciation`, `listening`, `reading`, `practice`, `abc`, `memory`, `scramble`, `fill-blanks`, `word-journey`, `story-time`, `picture-match`, `true-or-not`

### React games registry
- `src/features/games/reactGames.ts` — `REACT_GAME_IDS` set; the source of truth for which games run in React vs legacy. Adding an ID here triggers `react-shell-active` to stay on during that game route so the legacy DOM is suppressed.
- `src/features/games/GameHostPage.tsx` — `REACT_GAMES` record maps ID → component. Anything not in the record falls through to legacy `launchGame()`.

### Shared game primitives (Phase 3 reuse, do not duplicate)
- `src/features/games/shared/GameScreenShell.tsx` — hero + header + progress + main + footer slots. Forwards `header.title/icon/subtitle` to `<GameHero>` and the rest of `header` to `<GameHeader>`.
- `src/features/games/shared/GameHero.tsx` — **canonical title placement** (adopted 2026-05-23). Big centered icon + title rendered *between* the header card and the progress strip, with a hairline gradient divider. Every React game gets this for free via `GameScreenShell`; pages just declare `headerProps = { title, icon, score, onBack }` as before. Do NOT render the title anywhere else, and do NOT add another title element inside game pages. Optional `header.heroAside` slot renders content to the physical LEFT of the centered title (stacks below on narrow screens) — used by Word Journey to sit its `WJStageBar` beside the "מסע מילים" banner.
- `src/features/games/shared/GameHeader.tsx` — controls row only: back button, score, coins, case + nikud toggles (via `useTextPrefs`). `title`/`icon`/`subtitle` are accepted on the props for shell forwarding but intentionally not rendered here.
- `src/features/games/shared/QuestionProgress.tsx` — "שאלה N מתוך M" + reset button
- `src/features/games/shared/MediaPromptCard.tsx` — word/translation/media slot + audio button (`audioIconOnly` for legacy speaker look; omit `word` for audio-only games)
- `src/features/games/shared/AnswerGrid.tsx` — N options grid (`columns={2|3|4}`, `variant='text'|'media'`, `hidden` for audio gate). Supports an optional `sublabel` per option, rendered as small Hebrew gloss under the main label (used by Slice 3.10 Grammar for bilingual options).
- `src/features/games/shared/FeedbackBanner.tsx` — correct/incorrect floating banner
- `src/features/games/shared/RewardModal.tsx` — end-of-session reward
- `src/features/games/shared/ExitConfirmDialog.tsx` — "leave game?" modal
- `src/features/games/shared/SpellingComparison.tsx` — "learn from the mistake" panel for letter-building games: correct word (green) above the child's attempt with per-position green/red letters. Used by Reading + Word Journey spell. Pair it with voicing the correct word on a correct answer.
- `src/features/games/shared/LetterSlots.tsx` — slot-based letter builder (fixed underline slots per letter + colored tile bank, tap-slot-to-backspace, green/red result via `result` prop, reset via `resetKey`, reports built word via `onChange`). Shared by Reading + Word Journey spell so both have identical slot mechanics (mirrors legacy `wj-slot`).
- `src/features/games/shared/BlankFillGamePage.tsx` + `src/bridge/grammarLike.ts` — **shared blank-fill engine** for focused fill-in-the-sentence grammar games. One parameterised page + one generic bridge back MANY small games. To add another (e.g. plurals, prepositions): author a data bank `data/<key>.js` (shape mirrors `grammarQuestions.js`, add optional `emoji`), wire it into `data/_loader.js` → `window.gameData.<key>`, add a thin wrapper page `<X>GamePage` rendering `<BlankFillGamePage gameType dataKey title icon/>`, register the id in `reactGames.ts` + `GameHostPage.tsx` + `gameLogic.js` (no module) + `gameUnlocks` defaults in `app.js` + `GAME_ORDER` in HomePage. Reuse `feedbackKey='grammar'` (default). Articles (`articles`) + Progressive tenses (`progressive`) are the first two; do NOT clone the grammar page per-game. The standalone `grammar/GrammarGamePage.tsx` predates this engine and stays separate (its tests pin it).

## Phase 3 game migration pattern

Slices 3.2–3.16 clone Slice 3.1 (Vocabulary). Copy `src/bridge/vocabulary.ts` + `src/features/games/vocabulary/VocabularyGamePage.tsx`, register the new game ID in `src/features/games/reactGames.ts` + `GameHostPage.tsx`. Reuse shared primitives and bridges unchanged. Do NOT re-implement the bridge shape, audio gate, mid-game resume, or audio-state persistence — full checklist + lifecycle invariants in the `feedback_phase3_game_template` memory and slice-specific diffs in `docs/master-plan.md`.
