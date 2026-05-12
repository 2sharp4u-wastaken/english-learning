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

### Read before modifying
Read every file you plan to change before touching it. Do not suggest changes to code you haven't read.

### Keep the logger lean
`utils/consoleLogger.js` must use an in-memory array only — never localStorage persistence per log call, as it causes severe UI slowdown.

### Keep docs in sync
When changing any setting, game mechanic, or learning flow — update the relevant file in `docs/` in the same session.

### Bridge is the only gateway to legacy
React components must never access `window.*` globals or `localStorage` directly. All legacy data access goes through `src/bridge/*.ts` modules. React hooks in `src/hooks/` consume bridge modules.

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
`vocabulary`, `grammar`, `grammar-beginner`, `pronunciation`, `listening`, `reading`, `practice`, `abc`, `memory`, `scramble`, `fill-blanks`, `word-builder`, `word-journey`, `story-time`, `picture-match`, `true-or-not`

### React games registry
- `src/features/games/reactGames.ts` — `REACT_GAME_IDS` set; the source of truth for which games run in React vs legacy. Adding an ID here triggers `react-shell-active` to stay on during that game route so the legacy DOM is suppressed.
- `src/features/games/GameHostPage.tsx` — `REACT_GAMES` record maps ID → component. Anything not in the record falls through to legacy `launchGame()`.

## Phase 3 game migration pattern

For Slices 3.2–3.16: **clone Slice 3.1's structure; do not re-implement.**

The pattern was locked in by Slice 3.1 (Vocabulary). It is the agreed approach for the rest of Phase 3 — re-inventing it re-introduces parity bugs the user already pushed back on (refresh-flashes-learn-first, audio gate, plays counter, voice mismatch, stuck speech queue, mid-game resume, gate-eats-budget).

**Template files to copy when migrating a new game `X`:**

1. `src/bridge/vocabulary.ts` → `src/bridge/X.ts`. Keep the shape: `beginXSession({ fresh? })`, `recordXAnswer(question, idx)`, `finishXSession()`, `abortXSession()`, plus the per-question audio-state helpers (`loadVocabAudioState`/`saveVocabAudioState`/`clearVocabAudioState` — copy + rename with a per-game localStorage key).
2. `src/features/games/vocabulary/VocabularyGamePage.tsx` → `src/features/games/X/XGamePage.tsx`. Keep the mount-time legacy-readiness poll (`window.app.userProgress.learnedWords` must be hydrated before `start()`), `hardResetSpeech` on session start, voice-readiness poll before auto-play, `allowOverlap: true` on auto-play, auto-play suppressed on resume, gate plays consume budget but go through at 0, persistence-on-state-change useEffect.
3. Register the new game ID in `src/features/games/reactGames.ts` AND `src/features/games/GameHostPage.tsx`. Single addition; everything else (body class, refresh, exit dialog) works automatically.

**Reuse without modification:** `GameScreenShell`, `GameHeader` (case + nikud toggles via `useTextPrefs`), `QuestionProgress`, `MediaPromptCard` (audio-only by omitting `word`; icon-only via `audioIconOnly`), `AnswerGrid` (`variant="media"` for image options, `columns={2}` for binary), `FeedbackBanner`, `RewardModal`, `ExitConfirmDialog`, `VocabularyLearnFirst` (or a per-game variant if copy differs). Bridges: `@/bridge/audio`, `@/bridge/feedback`, `@/bridge/textPrefs`, `@/bridge/settings`.

**Tests:** add a Slice 3.X block to `tests/react-routes.spec.js` modeled on the Slice 3.1 block: learn-first, happy path, incorrect-answer-next, audio gate (if applicable), resume, persistence-across-refresh, header toggles, exit dialog.

**Docs to update in the same commit:** `docs/master-plan.md` Slice 3.X entry (status, files-touched), `docs/wiring-map.md` (new cause/effect chain mirroring the Vocabulary one).

**Reference:** Slice 3.1 commits — `9222211` (initial) plus follow-ups `c466b1b`, `8e35989`, `5287f58`, `d2d5fe7`, `87cab9a`, `d2b75ba`, `6281572`.
