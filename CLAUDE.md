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
