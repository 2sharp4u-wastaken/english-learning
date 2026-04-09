# UI Overhaul Master Plan (v2 — Refined)

## Overview

Staged migration from the current no-build vanilla app into a modern React UI shell. Existing learning logic, storage, and game behavior are preserved until each area is deliberately replaced.

Current repo constraints:

- app shell is server-rendered/static HTML in `index.html`
- core orchestration lives in `app.js` (~1,840 lines)
- UI styles are centralized in `styles.css` (~9,300 lines)
- settings has a large inline style block in `settings.html`
- test coverage exists via Playwright in `tests/smoke.spec.js`
- custom Python dev server (`server.py`) with write API and HTTPS support
- 16 game modules, 6 managers, ~9,700 lines of game/manager code total
- 4MB of image assets in `img/`
- auth is a global `AuthService` class loaded via `<script>` tag (not ES module)

Goals:

- modernize the UI architecture
- create a reusable component system
- preserve current game and progress logic during migration
- reduce CSS entropy
- make future changes faster and safer

Scope commitment:

- **Committed baseline:** Phase 0 + Phase 1 + Phase 2 + Wave 1 games (Vocabulary, Listening, Picture Match, True or Not)
- **Desired end state:** full migration of all 16 games
- Waves 2–4 are planned and sequenced but treated as backlog until Wave 1 validates the pattern

## Chosen Stack

Use:

- `Vite`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `Radix UI`
- `Framer Motion`
- `Lucide React`
- `React Router` (hash-based routing — see Routing section)
- existing `Playwright`

Do not do:

- full rewrite of all game logic at once
- generic component library skinning only
- continue extending the single legacy stylesheet

## Routing Strategy

Use **React Router v7** with **hash-based routing** (`createHashRouter`).

Why hash routing:

- the app is a static SPA — no server-side routing
- during hybrid mode, legacy HTML pages (`settings.html`, `stats.html`, `words.html`) remain accessible at their real file paths
- hash routes (`/#/home`, `/#/settings`, `/#/game/vocabulary`) avoid collisions with legacy file URLs
- no server rewrite rules needed
- Vite dev server and the Python production server both work without configuration

Route map:

```
/#/              → Home (redirect to /#/home)
/#/home          → HomePage
/#/profile       → ProfilePage
/#/courses       → CoursesPage
/#/stats         → StatsPage
/#/settings      → SettingsPage
/#/game/:gameId  → GameHostPage
```

Migration path:

- Phase 0–1: React app lives at `index.html`, hash routes handle all navigation within it
- Legacy pages (`settings.html`, `stats.html`) remain available but are not linked from the new UI once their React replacements ship
- Phase 4: legacy HTML pages are deleted

## Dev Server Strategy

Use **Vite as the primary dev server**, with a proxy to the Python server for API endpoints.

Setup:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        secure: false, // self-signed cert
      },
    },
  },
})
```

How it works:

- Vite serves the React app, handles HMR, and processes `src/` files
- Legacy files in the project root (`app.js`, `games/`, `managers/`, `data/`, `img/`) are served by Vite as static assets from the project root
- The Python server runs on port 3000 and handles only API endpoints (`/api/write-text`, `/api/write-image`, `/api/fetch-image`, `/api/enrich-nikud`, `/api/ping`)
- Vite proxies `/api/*` requests to the Python server

Developer workflow:

Two processes are required. They run in separate terminals:

1. **Terminal 1:** `python3 server.py` — starts API server on port 3000
2. **Terminal 2:** `npm run dev` — starts Vite on port 3002, proxies `/api/*` to port 3000

Open `https://localhost:3002` to use the app.

The Python server is only needed when using API endpoints (image download, nikud enrichment, file writes). For pure frontend work it can be skipped — `/api/*` calls will just fail silently.

Scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "npx playwright test",
    "test:ui": "npx playwright test --ui"
  }
}
```

Production build:

- `npm run build` outputs to `dist/`
- `dist/` can be served by any static file server
- For API endpoints in production, the Python server must also run

## Hybrid index.html Coexistence

During the migration, `index.html` serves both the legacy app and the React app. The boundary is explicit:

```html
<body>
  <!-- Legacy markup: app-layout, welcome-screen, game-area, etc. -->
  <div class="app-layout">
    ...legacy DOM...
  </div>

  <!-- React app: mounts here, completely separate DOM tree -->
  <div id="react-root"></div>

  <!-- Legacy scripts -->
  <script src="auth.js"></script>
  <script type="module" src="app.js"></script>

  <!-- Vite/React entrypoint -->
  <script type="module" src="/src/main.tsx"></script>
</body>
```

Takeover model — React progressively hides legacy regions:

- **Phase 0:** React renders inside `#react-root` alongside the legacy app. Both are visible. React shows a minimal shell; legacy handles all real functionality.
- **Phase 1:** React takes over the home screen, nav, profile, settings, stats. When React is ready to own a surface, the corresponding legacy DOM section is hidden via `display: none` (toggled by React on mount). Legacy markup stays in `index.html` but is not visible.
- **Phase 2–3:** Games launch inside `#react-root`. Legacy game rendering is either bridged (legacy game mounts inside a React container div) or replaced.
- **Phase 4:** All legacy markup and scripts are removed from `index.html`. React owns the full page.

Key rule: React and legacy never render the same surface simultaneously. When React takes over a section, it hides the legacy equivalent. This prevents visual doubling and CSS conflicts.

## CSS Containment Strategy

During hybrid mode, both legacy `styles.css` and Tailwind CSS are active. This requires explicit containment to prevent conflicts.

Approach:

1. **Tailwind prefix**: start without a prefix — re-evaluate if collisions appear (see below)
2. **Scoped mounting**: the React app mounts inside `<div id="react-root">`. Legacy HTML lives outside this div
3. **Tailwind's Preflight (reset) is scoped**: configure `corePlugins: { preflight: false }` in `tailwind.config.ts` to disable Tailwind's global CSS reset, which would conflict with legacy styles
4. **Custom Preflight**: add a scoped reset inside `src/styles/globals.css` that only applies within `#react-root`
5. **Legacy CSS is not imported by Vite**: the legacy `styles.css` is loaded via `<link>` tag in `index.html` and only affects legacy markup. As legacy sections are deleted, their CSS is removed too
6. **Font loading**: move from CDN `<link>` tags to `@font-face` declarations in `src/styles/globals.css` for Heebo and Fredoka. Legacy pages keep their own font links until retired

Starting without a Tailwind prefix because:

- Tailwind utility classes (`flex`, `p-4`, `text-sm`) are unlikely to collide with the legacy CSS (which uses semantic class names like `.game-card`, `.tier-section`)
- The scoped Preflight prevents reset conflicts

If collisions appear during development, options are: fix per-case, or add a Tailwind `prefix` (e.g., `tw-`) globally. Adding a prefix later is a mechanical find-replace, so starting without one is low-risk.

## Bridge Layer Design

The bridge is **load-bearing infrastructure**, not a throwaway shim. It will be the primary interface between React and legacy code for the full duration of the migration. Design it with proper types, error handling, and tests.

### Architecture

```
React components
    ↓ (hooks)
useAuthSession, useUserProgress, useGameUnlocks, useSettings
    ↓ (bridge modules)
src/bridge/auth.ts, progress.ts, settings.ts, games.ts, storage.ts
    ↓ (reads/writes)
localStorage + window globals (authService, appManager, gameManager)
```

Note: the bridge directory is `src/bridge/`, not `src/legacy/bridge/`. Naming it "legacy" implies it's temporary — it isn't during the migration.

### Bridge contracts

```ts
// auth.ts
getCurrentUser(): User | null
onAuthChange(callback: (user: User | null) => void): () => void

// progress.ts
getUserSummary(): UserSummary  // streak, wordsLearned, coins, totalScore
getWordMastery(): WordMastery[]
getAchievements(): Achievement[]
getCertificates(): Certificate[]

// settings.ts
getSettings(): AppSettings
saveSettings(settings: Partial<AppSettings>): void

// games.ts
getGameCatalog(): GameDefinition[]
getGameUnlockState(gameId: string): UnlockState
getContinueTarget(): ContinueTarget | null
launchGame(gameId: string): void
exitGame(): void

// storage.ts
getKey<T>(key: string): T | null
setKey<T>(key: string, value: T): void
// handles V2_STORAGE_PREFIX transparently
```

### Global access pattern

The legacy app exposes globals: `authService`, `appManager`, `gameManager`. The bridge reads from these via `window.*` with type assertions. All global access is confined to bridge modules — React components never touch `window` directly.

```ts
// Example: src/bridge/auth.ts
function getAuthService(): AuthService {
  const svc = (window as any).authService;
  if (!svc) throw new Error('AuthService not initialized');
  return svc;
}
```

### Auth End-State

During the migration, `auth.ts` in the bridge reads from the global `authService` (which is `auth.js`). When `auth.js` is retired in Phase 4, auth must be reimplemented in React:

- `src/bridge/auth.ts` becomes the **auth owner**, not just an adapter
- It reads/writes `localStorage` directly for user accounts (`v2_authUsers`), sessions (`v2_currentUser`), and activity tracking
- The `useAuthSession` hook provides the React UI with login/logout/session state
- The session timeout logic (currently in `AuthService`) is reimplemented in the bridge module
- Password hashing and admin password check are reimplemented in the bridge module

This means `src/bridge/auth.ts` has two lifecycle stages:
1. **During migration (Phase 0–3):** adapter that reads from `window.authService`
2. **After migration (Phase 4):** standalone auth module that owns session state directly

The bridge contract (`getCurrentUser`, `onAuthChange`) stays the same — only the implementation changes. React hooks and components are unaffected by this transition.

### Event synchronization

Legacy code mutates localStorage and DOM directly. React needs to stay in sync:

- **Polling**: bridge hooks use `setInterval` to poll localStorage for changes (500ms interval). This is simple and sufficient for this app's data change frequency
- **Custom events**: where feasible, dispatch `CustomEvent` from bridge when writing, so React hooks can listen via `addEventListener`
- **No Redux/Zustand needed**: the bridge hooks themselves are the state layer

## Migration Strategy

Use a hybrid migration.

Principles:

- React owns layout and visual composition
- existing managers and game modules continue to provide behavior initially
- migrate shell first, then shared gameplay chrome, then games one by one
- each slice must be independently testable and visually shippable
- legacy UI stays operational until replacement is complete

Migration model:

1. introduce build system and React app
2. create the bridge layer for auth, progress, coins, unlocks, and game launch actions
3. replace home/profile/settings/stats first
4. embed legacy game screens under the new shell
5. replace game UIs incrementally — Wave 1 is committed, Waves 2–4 are backlog
6. retire legacy CSS and old pages progressively as React replaces them

## Target File Structure

This structure is a target vision. It will be built incrementally per-phase — only the files needed for the current phase are created. Do not scaffold empty files.

```text
/
  index.html              ← hybrid: legacy markup + #react-root + Vite entrypoint (see Hybrid Coexistence section)
  settings.html           ← legacy, kept until Phase 1.6
  stats.html              ← legacy, kept until Phase 1.5
  words.html              ← legacy, kept until Phase 4

  app.js                  ← legacy orchestration, kept until Phase 4
  gameLogic.js            ← legacy game engine
  auth.js                 ← legacy auth (global script)
  games/                  ← legacy game modules
  managers/               ← legacy managers
  data/                   ← shared data (used by both legacy and React)
  utils/                  ← legacy utilities
  img/                    ← shared assets

  src/
    main.tsx              ← React entrypoint
    vite-env.d.ts

    app/
      App.tsx
      router.tsx          ← createHashRouter config
      providers.tsx       ← React context providers

      layout/
        AppShell.tsx
        TopNav.tsx
        MobileBottomNav.tsx
        PageContainer.tsx

    styles/
      globals.css         ← scoped Preflight + base styles
      tokens.css          ← design tokens (CSS custom properties)
      themes.css          ← theme definitions

    ui/                   ← shadcn/ui primitives (added as needed)
      button.tsx
      card.tsx
      dialog.tsx
      ...

    components/           ← shared app components
      StatPill.tsx
      ProgressRing.tsx
      TierBadge.tsx
      ...

    features/
      home/
        HomePage.tsx
        components/
      profile/
        ProfilePage.tsx
        components/
      courses/
        CoursesPage.tsx
        components/
      settings/
        SettingsPage.tsx
        components/
      stats/
        StatsPage.tsx
      games/
        GameHostPage.tsx
        shared/           ← shared gameplay components
        vocabulary/       ← per-game React implementations
        listening/
        ...

    bridge/               ← NOT "legacy/bridge" — this is core infra
      auth.ts
      progress.ts
      settings.ts
      games.ts
      storage.ts
      types.ts            ← shared TypeScript types for bridge contracts

    hooks/
      useAuthSession.ts
      useUserProgress.ts
      useGameUnlocks.ts
      useSettings.ts

    lib/
      rtl.ts
      cn.ts
      motion.ts
```

## Dependencies

Add:

- `react`, `react-dom`
- `typescript`
- `vite`, `@vitejs/plugin-react`
- `react-router-dom` (v7)
- `tailwindcss`, `@tailwindcss/vite`
- `class-variance-authority`, `clsx`, `tailwind-merge`
- `framer-motion`
- `lucide-react`
- `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`
- `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-switch`, `@radix-ui/react-progress`
- `@radix-ui/react-avatar`, `@radix-ui/react-slot`

Keep:

- `@playwright/test`

Add later (when needed):

- `zod`
- `sonner`
- `embla-carousel-react`

## Design System

Visual direction:

- premium playful product
- not generic SaaS
- not 2023 glassmorphism wallpaper

Theme:

- base background: deep ink/navy
- surface: elevated dark cards with selective warm highlights
- tier accents:
  - Learn: mint
  - Practice: blue
  - Challenge: amber
  - Test: coral
- use color for meaning, not decoration only

Typography:

- Hebrew UI font: `Heebo`
- English educational display font: `Fredoka` or `Baloo 2`
- clear distinction between product chrome and learning content

Spacing:

- 8-point scale
- larger touch targets for children
- cards with more breathing room

Motion:

- use Framer Motion for route transitions, card entrance staggering, modal reveals, reward moments
- avoid perpetual noise animations

RTL rules:

- design from RTL first
- all nav, drawers, icon directions, transitions, and spacing utilities must be RTL-aware
- no "LTR then patched" approach

## Component Inventory

(Unchanged from v1 — see original plan for full list. Components are created as needed per slice, not pre-scaffolded.)

## Page Specs

(Unchanged from v1 — see original plan for Home, Profile, Courses, Stats, Settings, Game Host specs.)

## Testing Strategy

Keep Playwright as the end-to-end safety net.

Add expectations gradually per-slice for:

- home rendering
- game lock/unlock
- continue CTA
- profile summaries
- settings navigation
- legacy game launch under new shell

Maintain current smoke checks from `tests/smoke.spec.js`.

Add per-slice acceptance tests alongside each slice, not as a batch at the end.

## Phase 0: Foundation

Objective: prepare the repo for a hybrid React migration without breaking the current app.

Current status:

- Slice 0.1 completed and committed
- Slice 0.2 completed and ready to commit
- Slice 0.3 not started
- Slice 0.4 not started

### Slice 0.1: Tooling Bootstrap

Status: completed

Implemented notes:

- Vite, React, and TypeScript bootstrap added
- `index.html` now mounts React into `#react-root` while preserving the legacy DOM
- `vite.config.ts` uses port 3002, proxies `/api/*` to port 3000, and builds with `target: 'esnext'` so existing legacy modules with top-level `await` still bundle

Files added:

- `vite.config.ts`
- `tsconfig.json`
- `src/main.tsx`
- `src/vite-env.d.ts`
- update `package.json`
- update `index.html` (add `<div id="react-root">` and Vite script tag)

Deliverables:

- Vite dev server starts on port 3002 with proxy to Python server on 3000
- React+TS app boots and renders "Hello" inside `#react-root`
- Legacy markup in `index.html` still present and functional
- `npm run dev` and `npm run build` work

Acceptance criteria:

- `npm run dev` starts Vite, HMR works
- `/api/ping` proxied to Python server returns `{ ok: true }`
- Legacy game flow still works if accessed directly

### Slice 0.2: Styling Foundation

Status: completed

Implemented notes:

- Tailwind, PostCSS, and utility dependencies added
- scoped React-only styling foundation added under `src/styles/`
- `src/main.tsx` now imports the global style entry and renders a token-driven RTL demo panel inside `#react-root`
- font loading currently uses local `@font-face` declarations with fallback to installed system fonts; no font asset files have been added to the repo yet

Files added:

- `src/styles/globals.css` — scoped Preflight within `#react-root`, base layer
- `src/styles/tokens.css` — CSS custom properties for colors, spacing, radius, shadows
- `src/styles/themes.css` — theme definitions (dark default)
- `tailwind.config.ts` — with `preflight: false`, content paths, RTL-aware config
- `src/lib/cn.ts` — `clsx` + `tailwind-merge` utility

Deliverables:

- token system (CSS custom properties)
- base RTL setup
- font loading via `@font-face` for Heebo and Fredoka
- Tailwind integration with disabled Preflight
- scoped reset inside `#react-root`

Acceptance criteria:

- Tailwind classes work inside React components
- Legacy styles outside `#react-root` are unaffected
- No visual regressions on legacy pages

### Slice 0.3: App Shell Skeleton

Files added:

- `src/app/App.tsx`
- `src/app/router.tsx` — `createHashRouter` with placeholder routes
- `src/app/providers.tsx`
- `src/app/layout/AppShell.tsx`
- `src/app/layout/TopNav.tsx`
- `src/app/layout/PageContainer.tsx`

Deliverables:

- hash-based routing operational
- modern shell frame with top nav
- placeholder pages for each route
- mobile layout baseline

Acceptance criteria:

- navigating `/#/home`, `/#/settings`, etc. renders correct placeholder
- responsive shell works on desktop and mobile
- legacy app still functional at root (both coexist during development)

### Slice 0.4: Bridge Layer

Files added:

- `src/bridge/types.ts`
- `src/bridge/storage.ts`
- `src/bridge/auth.ts`
- `src/bridge/progress.ts`
- `src/bridge/settings.ts`
- `src/bridge/games.ts`
- `src/hooks/useAuthSession.ts`
- `src/hooks/useUserProgress.ts`
- `src/hooks/useGameUnlocks.ts`
- `src/hooks/useSettings.ts`

Deliverables:

- typed bridge contracts for auth, progress, settings, games, storage
- React hooks that expose bridge data with polling-based reactivity
- all `window.*` global access confined to bridge modules

Acceptance criteria:

- React shell can render real user name, streak, coins, score
- game catalog and unlock states are readable
- launching a legacy game from React works
- bridge types are complete and match actual localStorage schema

## Phase 1: Core Shell Overhaul

Objective: replace the high-visibility product surfaces before touching game internals.

### Slice 1.1: Home Screen

(Unchanged from v1 — see detailed spec in original plan.)

### Slice 1.2: Header/Nav System

Files:

- `TopNav.tsx` (real implementation)
- `MobileBottomNav.tsx`
- profile menu and settings entry

Deliverables:

- fully replace role of `components/top-header.js`
- responsive nav behavior
- game mode vs hub mode state transitions

Acceptance criteria:

- profile, score, coins, settings, logout all accessible
- header state transitions are stable
- RTL layout correct

### Slice 1.3: Profile / User Hub

Files:

- `src/features/profile/*`

Deliverables:

- profile header, achievements, certificates, activity list

Acceptance criteria:

- data parity with existing user hub
- tabs work on desktop and mobile

### Slice 1.4: Courses

Files:

- `src/features/courses/*`

Deliverables:

- course cards, expandable details, lesson timeline, unlock requirement banners

Acceptance criteria:

- current course progress remains correct
- expand/collapse interaction stable

### Slice 1.5: Stats

Files:

- `src/features/stats/*`

Deliverables:

- redesigned statistics page
- clearer summaries and chart/group layout

Acceptance criteria:

- same underlying data as existing `stats.html`
- legacy `stats.html` can be unlinked

### Slice 1.6: Settings Shell

Files:

- `src/features/settings/*`

Deliverables:

- tab rail / drawer nav replacing inline-heavy settings
- section cards, parent-control UX
- password protection preserved

Acceptance criteria:

- all current settings remain editable
- protected actions remain protected
- mobile behavior significantly improved
- legacy `settings.html` can be unlinked

## Phase 2: Shared Gameplay UI

Objective: standardize the visual chrome around gameplay before migrating each game.

### Slice 2.1: GameScreenShell

Files:

- `src/features/games/shared/GameScreenShell.tsx`
- `src/features/games/shared/GameHeader.tsx`
- `src/features/games/shared/QuestionProgress.tsx`

Deliverables:

- shared shell around all games
- consistent back, score, progress, reset/exit patterns

Acceptance criteria:

- legacy games can render inside the shell via bridge
- header/progress state synchronized

### Slice 2.2: Shared Feedback and Reward System

Files:

- `src/features/games/shared/FeedbackBanner.tsx`
- `src/features/games/shared/RewardModal.tsx`
- `src/features/games/shared/ExitConfirmDialog.tsx`

Deliverables:

- shared success/fail/reward patterns
- improved reward celebration

Acceptance criteria:

- integrates with current scoring and completion flows

### Slice 2.3: Shared Interaction Primitives

Files:

- `src/features/games/shared/AnswerGrid.tsx`
- `src/features/games/shared/MediaPromptCard.tsx`

Deliverables:

- standard answer option cards
- media prompt presentation
- mobile-friendly interactions

Acceptance criteria:

- reusable across at least 3 game types

## Phase 3: Game-by-Game Migration

Objective: migrate game UIs to React using shared gameplay primitives.

**Wave 1 is the committed scope.** It validates the shared primitives and the game migration pattern. Waves 2–4 are the desired end state and are sequenced here for planning, but they move from backlog to committed only after Wave 1 ships and the pattern is proven.

Order rationale: start with the simplest and most representative games to validate the pattern, then progress to more complex/custom games.

### Wave 1: Core pattern games — COMMITTED

These games share a question→answer→feedback loop. Migrating them first validates the shared primitives.

**Slice 3.1: Vocabulary** — the canonical question→answer game. ~266 lines.
**Slice 3.2: Listening** — same model with audio prompt. ~249 lines.
**Slice 3.3: Picture Match** — image-heavy answer layout. ~118 lines.
**Slice 3.4: True or Not** — binary answer variant. ~217 lines.

### Wave 2: Text-building games — BACKLOG

These involve constructing text rather than choosing answers.

**Slice 3.5: Reading** — letter-building UI. ~343 lines.
**Slice 3.6: Word Builder** — word construction. ~182 lines.
**Slice 3.7: Fill Blanks** — sentence completion. ~205 lines.
**Slice 3.8: Sentence Scramble** — drag/tap reordering. ~428 lines.

### Wave 3: Grammar and structured learning — BACKLOG

**Slice 3.9: Grammar Beginner** — guided grammar. ~384 lines.
**Slice 3.10: Grammar** — advanced grammar. ~207 lines.

### Wave 4: Special/complex games — BACKLOG

These have unique interaction models and require the most custom work.

**Slice 3.11: Pronunciation** — recording/feedback, microphone access. ~325 lines.
**Slice 3.12: Story Time** — narrative flow, multi-step. ~307 lines.
**Slice 3.13: Word Journey** — multi-stage progression. ~1,237 lines.
**Slice 3.14: Memory** — card-flip grid, timer-based. ~1,589 lines.
**Slice 3.15: ABC** — alphabet learning, custom layout. ~778 lines.
**Slice 3.16: Practice** — weak-word review, meta-game. ~289 lines.

### Per-game migration template

For each game:

Files:

- `src/features/games/<game-id>/GameScreen.tsx`
- `src/features/games/<game-id>/components/*.tsx` (as needed)
- bridge hooks if needed
- Playwright test additions

Common acceptance criteria:

- scoring parity with legacy implementation
- unlock parity
- audio parity
- no regression in progression save state
- mobile fit and RTL correctness
- renders inside GameScreenShell
- uses shared feedback/reward components

## Phase 4: Cleanup and Consolidation

Objective: remove dead legacy code and shrink maintenance burden.

### Slice 4.1: Retire Legacy Home Markup/CSS

- remove legacy home sections from `index.html`
- delete related CSS from `styles.css`
- remove `hub-animations.js`

### Slice 4.2: Retire Header Legacy System

- remove `components/top-header.js`
- remove `components/header-score.js`
- remove related CSS

### Slice 4.3: Retire Legacy Pages

- delete `settings.html`, `stats.html`, `words.html`
- delete `settings.js`, `stats.js`
- remove related CSS and inline styles

### Slice 4.4: Retire Legacy Game UI Code

- remove `games/*.js` files (logic has been reimplemented in React)
- remove `gameLogic.js` if fully replaced
- remove `app.js` orchestration (replaced by React app)
- remove `auth.js` global script — `src/bridge/auth.ts` transitions from adapter to standalone auth owner (see Auth End-State section)

### Slice 4.5: CSS Rationalization

- delete `styles.css` entirely (all styles now in Tailwind + token system)
- delete `game-completion-styles.css`
- remove font-awesome CDN link (replaced by Lucide)
- remove Poppins CDN link (replaced by Heebo/Fredoka)
- audit for any remaining dead CSS

### Slice 4.6: Test Expansion

- update smoke tests to target React app exclusively
- add regression tests for all migrated flows
- remove tests that reference legacy selectors

Acceptance criteria for Phase 4:

- no legacy-only shell code remains
- `styles.css` is deleted
- all pages are React routes
- Playwright tests pass against React-only app
- `npm run build` produces a clean, deployable bundle

## Per-Slice Implementation Template

Every slice should follow this template:

- Objective
- User-facing outcome
- Files added
- Files changed
- Components/hooks introduced
- Bridge/API contracts used
- States handled
- Test cases
- Acceptance criteria
- Rollback strategy (during hybrid period: revert to legacy route)

## Definitions of Done

A slice is done when:

- UI is implemented
- real data is wired
- responsive behavior works
- RTL is verified
- legacy parity is validated
- Playwright coverage exists or is updated
- no temporary workarounds introduced

A phase is done when:

- all slices meet acceptance criteria
- no temporary workaround remains on the critical path for the next phase

## Risks and Mitigations

1. **Bridge becomes messy over time.**
   Mitigation: centralize all legacy access under `src/bridge/`. Typed contracts. Test bridge modules independently.

2. **Visual overhaul breaks progression behavior.**
   Mitigation: preserve current managers as logic source-of-truth until game-by-game migration. Bridge reads from them, doesn't reimplement.

3. **CSS conflict between legacy and Tailwind.**
   Mitigation: disable Tailwind Preflight, scope React reset to `#react-root`, keep legacy `styles.css` loaded via `<link>` tag only. No shared CSS imports.

4. **RTL regressions in modern components.**
   Mitigation: test RTL explicitly in every slice, especially nav, drawers, and animated transitions. Use Tailwind's RTL utilities (`rtl:`, `ltr:`) and logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`).

5. **Routing confusion during hybrid period.**
   Mitigation: hash routing avoids all collisions with legacy file paths. Clear route map documented above.

6. **Two dev servers add friction.**
   Mitigation: Vite proxy makes `/api/*` calls transparent. Two terminals are required (`python3 server.py` + `npm run dev`), but the Python server can be skipped for pure frontend work — API calls just fail silently.

7. **Game migration scope is large (16 games).**
   Mitigation: only Wave 1 (4 games) is committed. Waves 2–4 are backlog until Wave 1 validates the pattern. Wave ordering is by complexity — simpler games first. The bridge ensures unmigrated legacy games remain fully functional indefinitely.

## Repo Strategy

This migration executes in the **existing repo** on a dedicated branch (e.g., `react-migration`), branched from the current working state.

Why stay in the same repo:

- preserves git history, blame, and diff continuity — valuable during a long migration
- no risk of losing context about why code exists as-is
- branch-based workflow allows easy comparison with the pre-migration state
- avoids the overhead of maintaining a separate copy

Setup:

1. Branch from current state: `git checkout -b react-migration`
2. Begin Phase 0 on that branch
3. Merge to main when Phase 1 is complete and the new shell is validated
