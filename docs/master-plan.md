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

- **Committed baseline:** Phase 0 + Phase 1 (including 1.7 hybrid consolidation and 1.8 Word Journey audio hotfix) + Phase 2 + Wave 1 games (Vocabulary, Listening, Picture Match, True or Not)
- **Desired end state:** full migration of all 16 games + Phase 5 content expansion (idioms & slang)
- Waves 2–4 are planned and sequenced but treated as backlog until Wave 1 validates the pattern
- Phase 5 is backlog — promoted to committed only after Phase 3 Wave 1 ships

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
- Slice 0.2 completed and committed
- Slice 0.3 completed and ready to commit
- Slice 0.4 completed and ready to commit

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

Status: completed

Implemented notes:

- Hash-based routing via `createHashRouter` with all planned routes
- Desktop top nav (hidden on mobile) with active-state highlighting
- Mobile bottom nav (fixed, hidden on desktop) with active-state highlighting
- `PageContainer` provides max-width constraint, padding, and bottom-nav clearance on mobile
- `AppShell` wraps all routes with theme, gradient background, and layout structure
- `Providers` wrapper ready for future context providers (auth, settings, etc.)
- Placeholder pages for all routes show the slice they'll be implemented in
- `GameHostPage` reads `:gameId` param from URL
- `@/*` path alias added to both `vite.config.ts` and `tsconfig.json`
- `react-router-dom`, `lucide-react`, and `framer-motion` installed

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

Status: completed

Implemented notes:

- Full typed bridge layer with 5 modules: `storage.ts`, `auth.ts`, `progress.ts`, `settings.ts`, `games.ts`
- `types.ts` defines all shared TypeScript interfaces matching legacy localStorage schemas (UserProgress v4, User, Session, AppSettings, GameDefinition, GameUnlockEntry, etc.)
- Bridge modules read from legacy globals (`window.authService`, `window.appManager`, `window.gameRegistry`, `window.gameManager`) with localStorage fallbacks
- `storage.ts` handles v2_ prefix transparently
- `auth.ts` provides `getCurrentUser`, `isAuthenticated`, `onAuthChange` (poll-based)
- `progress.ts` provides `getUserSummary`, `getWordMastery`, `getCertificates`
- `settings.ts` provides `getSettings`, `saveSettings` (syncs both localStorage and legacy appManager)
- `games.ts` provides `getGameCatalog`, `getGameUnlockState`, `getContinueTarget`, `launchGame`, `exitGame`
- 4 React hooks: `useAuthSession`, `useUserProgress`, `useGameUnlocks`, `useSettings` — all use 500ms polling for cross-system reactivity
- Hooks use shallow comparison to avoid unnecessary re-renders

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

Status: completed

Implemented notes:

- `HomePage` now renders a real React home surface instead of a placeholder
- home hero reads authenticated user, continue target, summary stats, and unlock state from the bridge/hooks layer
- tiered game catalog is rendered in React with open/locked states and legacy unlock requirements
- unlocked cards route to `/#/game/:gameId`, where `GameHostPage` launches the existing legacy game flow
- `AppShell` now promotes the React shell to a fixed viewport overlay on hub routes so the new pages are actually visible even though `#react-root` still lives after legacy markup in `index.html`
- game routes drop the React shell chrome and hand control back to the legacy game surface for now

Files changed:

- `src/features/home/HomePage.tsx`
- `src/features/games/GameHostPage.tsx`
- `src/app/layout/AppShell.tsx`

Deliverables:

- React-owned home hero and progress summary
- React game-tier grid with unlock awareness
- working continue CTA and game launch handoff into legacy games

Acceptance criteria:

- home route shows real user summary data from the bridge
- locked vs unlocked games are visible in the new home grid
- selecting an unlocked game routes to `/#/game/:gameId` and starts the existing legacy game

### Slice 1.2: Header/Nav System

Status: completed

Implemented notes:

- `TopNav` now shows real data: logo (Hebrew), nav links with active state, score pill, coins pill, and user menu dropdown
- User menu dropdown provides quick access to profile, settings, and logout
- `MobileTopBar` added for mobile: compact top bar with user avatar/name, score, and coins; includes the same dropdown menu
- `MobileBottomNav` unchanged — handles mobile navigation tabs
- `logout()` added to auth bridge and exposed via `useAuthSession` hook
- Hub vs game mode transitions unchanged from 0.3 (AppShell hides shell chrome on game routes)
- Case toggle and nikud toggle are game-specific and will move to game chrome in Phase 2
- Dropdown menus use `start-0` (logical property) for correct RTL positioning

Files changed:

- `src/app/layout/TopNav.tsx` — real implementation with data, user menu
- `src/app/layout/AppShell.tsx` — added MobileTopBar
- `src/bridge/auth.ts` — added `logout()` export
- `src/hooks/useAuthSession.ts` — exposed `logout` callback

Files added:

- `src/app/layout/MobileTopBar.tsx` — mobile-only top bar with user info, score, coins, menu

Deliverables:

- fully replace role of `components/top-header.js` for hub mode
- responsive nav behavior (desktop top nav + mobile top bar + mobile bottom nav)
- game mode vs hub mode state transitions

Acceptance criteria:

- profile, score, coins, settings, logout all accessible
- header state transitions are stable
- RTL layout correct

### Slice 1.3: Profile / User Hub

Status: completed

Implemented notes:

- `ProfilePage` renders a full profile hub with 4 tabs: Overview, Certificates, Word Collection, Achievements
- Profile hero shows avatar (initial), display name, learning level with progress bar, and 5 mini-stat pills (streak, words learned, words mastered, coins, certificates)
- Level system matches legacy: מתחיל → חוקר → לומד מיומן → מומחה → אלוף → אגדה, based on words learned count
- Overview tab: weekly activity calendar (7-day row with active/today indicators), quick stats (games played, total score), unlocked games badge grid
- Certificates tab: gallery of earned certificates with topic name, date, and score; empty state when none earned
- Word Collection tab: sticker-book grid of graduated words with emoji, English word, Hebrew translation; sorted by graduation date (newest first); uses `vocabularyBank` global for word metadata
- Achievements tab: 5 achievement definitions matching legacy (first game, perfect score, week streak, vocabulary master, grammar guru) with unlocked/locked visual states
- Bridge extended: `getWordsMasteredCount`, `getLearnedWords`, `getBestScores`, `getActivityDates`, `getVocabularyBank` added to `src/bridge/progress.ts`
- All data sourced through bridge layer — no direct `window.*` or `localStorage` access in React components
- Tab navigation is horizontally scrollable on mobile, responsive grid layouts throughout

Files changed:

- `src/bridge/progress.ts` — added 5 new bridge exports for profile data
- `src/features/profile/ProfilePage.tsx` — full implementation replacing placeholder

Deliverables:

- profile header, achievements, certificates, activity list

Acceptance criteria:

- data parity with existing user hub
- tabs work on desktop and mobile

### Slice 1.4: Courses

Status: completed

Implemented notes:

- `CoursesPage` renders a full courses hub with header stats, per-course cards, and expandable unit/topic detail
- Course cards show icon, Hebrew name, description, difficulty badge, and progress bar
- Expandable detail panel (click to toggle) reveals units with their topics
- Topic cards show icon, Hebrew name, activity badges (done/not-done), mastery progress bar, estimated time, and lock/complete state
- Bridge layer added: `src/bridge/courses.ts` reads from `window.appManager.courseManager` with localStorage fallback
- `useCourses` hook polls at 500ms for cross-system reactivity, builds a snapshot of all course/topic state
- `CourseProgressEntry` and `TopicProgressEntry` types added to `src/bridge/types.ts` (replacing `Record<string, unknown>` on `UserProgress.courses` and `UserProgress.topicProgress`)
- Overall progress shown at page top: X of Y topics completed with progress bar

Files added:

- `src/bridge/courses.ts` — bridge module for CourseManager access
- `src/hooks/useCourses.ts` — React hook for course data with polling

Files changed:

- `src/features/courses/CoursesPage.tsx` — full implementation replacing placeholder
- `src/bridge/types.ts` — added `CourseProgressEntry`, `TopicProgressEntry` types

Deliverables:

- course cards, expandable details, lesson timeline, unlock requirement banners

Acceptance criteria:

- current course progress remains correct
- expand/collapse interaction stable

### Slice 1.5: Stats

Status: completed

Implemented notes:

- `StatsPage` renders a full stats hub with user selector tabs and per-user content tabs
- User selector tabs dynamically list all registered users plus a "Hall of Fame" tab
- Per-user content has 6 tabs: Overview, Games, Words, Categories, Memory, Coins
- Overview tab: 5 metric tiles (total score, games played, words learned, learning time, streak), 4 insight cards (learning velocity, categories in progress, word journey count, overall average)
- Games tab: score banner, games stats table with per-game play count, average score, and best score
- Words tab: mastery overview tiles, word journey status table with per-word stage pills and status badges, word mastery breakdown (struggling/mastered) with progress bars
- Categories tab: summary tiles, category progress grid with per-category progress bars
- Memory tab: memory game best records table with stars display
- Coins tab: coin balance/earned/today tiles, coin history table with reason labels
- Hall of Fame: hero banner, combined summary tiles, 6 leaderboard sections across all users
- Bridge layer extended: `src/bridge/stats.ts` provides `buildUserStatsModel` with full data model (game history, word mastery stats, journey rows, category completion, memory records, learning velocity)
- `getAllUsers()` added to `src/bridge/auth.ts` for multi-user stats access
- `useStats` hook polls at 1s interval for selected user's stats model
- All data sourced through bridge layer — no direct `window.*` or `localStorage` access in React components
- Memory tab auto-disables when no memory records exist
- Responsive grid layouts throughout, RTL-correct

Files added:

- `src/bridge/stats.ts` — stats-specific bridge module with full data model builder
- `src/hooks/useStats.ts` — React hook for stats data with polling

Files changed:

- `src/features/stats/StatsPage.tsx` — full implementation replacing placeholder
- `src/bridge/auth.ts` — added `getAllUsers()` export

Deliverables:

- redesigned statistics page
- clearer summaries and chart/group layout

Acceptance criteria:

- same underlying data as existing `stats.html`
- legacy `stats.html` can be unlinked

### Slice 1.6: Settings Shell

Status: shipped (Option B — pragmatic split). 1.6.a/b/c + polish landed and covered by Playwright. Custom Words + Word Images deferred to a Phase 4.x slice and accessed via an "Advanced Tools" escape hatch that links to legacy `settings.html`. Functional coverage: tab rail mounts, protected gate opens and unlocks, dual-key persistence on category toggle, full reset flow (gate → confirm → defaults restored), Advanced Tools links to legacy `settings.html` (15/15 tests green).

Sub-slice status:

- **1.6.a — Shell + bridge expansion + password gate** — completed
  - Expanded `AppSettings` from 5 narrow fields to the full 12-field legacy shape (`selectedCategories`, `questionsPerGame`, `clickRepeatCount`, `audioPlaysAllowed`, `hebrewVocalization`, `learningPace`, `showNikud`, `lowercaseMode`, `showConfetti`, `exitBehavior`, `gameUnlockOverride`, `claudeApiKey`)
  - Dual-write to both `englishLearningSettings` (unprefixed) and `v2_englishLearningSettings` to stay compatible with in-session legacy managers
  - Admin CRUD passthroughs added to the auth bridge (`verifyAdminPassword`, `addUser`, `resetUserPassword`, `deleteUser`, `setUserRole`, `isCurrentUserAdmin`)
  - `useParentPassword` hook: session-scoped unlock, auto-unlock for users with `role = 'parent' | 'manager'`
  - SettingsPage with mobile-first tab rail (horizontal pills on mobile, vertical rail on desktop), top-bar reset/logs actions, `ParentPasswordModal` with async verifier signature
- **1.6.b — Categories + Game + Advanced tabs** — completed
  - Categories tab: live word counts pulled from `window.vocabularyBank` via `src/bridge/categories.ts`, practice-mode badge when fewer than 5 categories selected, minimum-1 enforcement, select-all / clear shortcuts
  - Game tab: sliders for questions/click-repeat/audio budget, learning pace radio (slow/normal/fast), Hebrew vocalization toggle
  - Advanced tab: display toggles (nikud, lowercase, confetti), exit-behavior radio, game-unlock-override toggle
  - Shared primitives added: `Toggle`, `Slider`, `RadioCards`, `SectionCard`
- **1.6.c — Users tab** — completed
  - User table with identity + role badges (מנהל / הורה / אני)
  - Per-row actions: reset password, reset practice, reset stats, toggle parent role, delete
  - Every destructive action re-prompts for admin password via a reusable verifier-modal flow; success paths refresh the user list
  - "Add user" modal with id/display-name/initial/password validation (matches legacy `^[a-zA-Z0-9_]+$` id rule and the 4-user cap)
  - `resetUserPractice` / `resetUserStats` added to `src/bridge/progress.ts` (mirror the legacy localStorage-key clearing exactly)
- **1.6 polish — Custom Words / Word Images escape hatch + tests** — completed
  - `AdvancedToolsTab` renders two cards that link out to legacy `settings.html` for the Claude-import and image/translation-override flows (the two biggest porting risks — File System Access API and Claude API streaming — stay on legacy until a dedicated slice promotes them)
  - Playwright regression added for: tab-rail rendering, password-gate open-and-unlock, dual-key persistence of a settings change
  - The legacy `settings.html` page still exists and is reachable through the Advanced Tools escape hatch; no React nav surface links to it directly

Files added/changed:

- `src/bridge/settings.ts`, `src/bridge/auth.ts`, `src/bridge/progress.ts`, `src/bridge/categories.ts` (new), `src/bridge/types.ts`
- `src/hooks/useSettings.ts`, `src/hooks/useParentPassword.ts` (new)
- `src/features/settings/SettingsPage.tsx`
- `src/features/settings/components/`: `SettingsTabRail`, `ParentPasswordModal`, `AddUserModal`, `SectionCard`, `Toggle`, `Slider`, `RadioCards`
- `src/features/settings/tabs/`: `CategoriesTab`, `GameTab`, `AdvancedTab`, `UsersTab`, `AdvancedToolsTab`
- `tests/react-routes.spec.js` — added Slice 1.6 block

Deliverables (from original plan):

- tab rail / drawer nav replacing inline-heavy settings ✅
- section cards, parent-control UX ✅
- password protection preserved ✅ (session unlock + per-action re-prompts for destructive changes)

Acceptance criteria:

- all current settings remain editable — ✅ for the committed scope (Categories, Game, Advanced, Users). Custom Words + Word Images stay editable via the Advanced Tools escape hatch to legacy `settings.html` (Option B).
- protected actions remain protected ✅
- mobile behavior significantly improved ✅ (horizontal tab pills, cards sized for thumbs, no more inline scroll traps)
- legacy `settings.html` can be unlinked — partial. No React nav surface links to it; the deliberate Advanced Tools link remains until a later slice ports Custom Words + Word Images.

Deferred to a future slice (tracked here):

- React migration of **Custom Words** (Claude API import + save-to-source via File System Access API)
- React migration of **Word Images & Translations** (grid with file upload → base64, URL override, inline translation edit, save-to-source)
- Full deletion of legacy `settings.html` and associated CSS/JS

These two slices should land before Phase 4.3 (retire legacy pages) so `settings.html` can be deleted with the rest of the legacy HTML pages.

### Slice 1.7: Hybrid Shell Consolidation

Status: shipped

Objective: eliminate the mix between React and legacy surfaces during the hybrid period.

What landed:

- **Legacy DOM suppression already worked** — the body-class `react-shell-active` rule in `globals.css` hides `#top-header`, `#welcome-screen`, and `#user-hub-screen` on hub routes. The plan's claim that "only `#welcome-screen` is hidden reliably" was stale by the time this slice opened.
- **Layout cut-off bug not reproducible** — desktop & mobile screenshots confirm the React top bar is sticky-flow at `z:30`, height 57px, with `<main>` starting immediately at `y:57` and 24px top padding. No occlusion.
- **Exit-path single source of truth** — `gameManager.showWelcomeScreen()` (`gameLogic.js`) and the index.html `showWelcomeScreen()` both now route to `#/home` via the hash, dropping their direct `#welcome-screen` `classList`/`style` toggles. Every existing exit caller (inline `onclick`s, exit-bar listeners, internal `this.showWelcomeScreen()` cleanups) inherits the redirect — no per-callsite changes needed.
- **Game routes still render legacy chrome** — intentional; AppShell removes `react-shell-active` on `/game/*` so games keep their existing top bar / exit bar. Only the *exit* lands in React.
- **Regression test** — `tests/react-routes.spec.js` "gameManager.showWelcomeScreen routes through React Router to /#/home" exercises the full game→exit→React-home flow.

Files touched:

- `gameLogic.js` — `showWelcomeScreen()` now sets `location.hash = '#/home'` instead of toggling `#welcome-screen`
- `index.html` — same change in the index-level `showWelcomeScreen()` helper
- `tests/react-routes.spec.js` — game-exit regression added

Deferred to a later slice (not blocking 1.7):

- Auditing every legacy back/home button in `gameLogic.js` to bypass `gameManager.showWelcomeScreen()` and call React Router directly. Current state: they all go through the function so they all redirect, but the indirection is ugly.
- Replacing `app.js` and `components/top-header.js` legacy header logic on hub routes (already visually hidden, but still wired up in the DOM).

### Slice 1.9: Beginner Word-Length Difficulty Gate

Status: shipped

What landed:

- New `gameManager.applyDifficultyGate(items, gameType)` helper in `gameLogic.js`. Tiers keyed off `Object.keys(progressManager.learnedWords).length`:
  - 0–14 learned → words ≤ 7 letters; for `picture-match` and `listening`, items whose option-set has 2+ words > 5 letters are also rejected
  - 15–49 → words ≤ 9 letters
  - 50+ → no filter
- Applied at the candidate-pool builder in `loadGameData` for vocabulary, listening, and picture-match. `loadGameData` runs at every game start so toggling the setting takes effect on the next play with no reload.
- New `difficultyAutoGate` AppSetting (default `true`), wired through `src/bridge/types.ts`, `src/bridge/settings.ts`, and a new toggle in `Settings → Advanced → "מתקדם להורה"`.
- Defensive fallback: if the gate would empty the pool, the unfiltered list is returned (avoids "no questions available" deadlocks on niche category combos).
- Word Journey reads from raw `vocabularyBank`, not `gameData.vocabulary` — so it self-paces via mastery and the gate is a no-op there, as planned.

Tests: `tests/difficulty-gate.spec.js` covers all four tiers (0/20/60 learned + gate-off), the picture-match distractor rule, and the word-journey-untouched invariant. Full suite green (32/32).

Carry-forward (unchanged from original plan): when Phase 3 migrates Vocabulary / Listening / Picture Match / True or Not to React, this gate moves to a shared `src/bridge/wordSelection.ts` so React games and any remaining legacy games share one source of truth.

Objective: today the candidate-word pool is filtered by category only — `gameLogic.js:3396` explicitly skips word-length filtering. As a result, a brand-new learner can be served `transportation` or `butterfly` on the very first vocabulary question. Per-word mastery adapts *over time*, but says nothing about pool composition for a fresh user. This slice adds a progression-aware length gate.

Scope:

- Bucket candidate words by length and gate the pool by `summary.wordsLearned`:
  - 0–15 words learned: words ≤7 letters; in multi-distractor games, reject any answer set with 2+ words longer than 5 letters
  - 15–50: words ≤9 letters
  - 50+: no length filter
- Apply at the candidate-pool builder in `gameLogic.js` (the `filteredVocabulary`, `filteredListening`, `filteredPictureMatch` paths). Word Journey opts out — it already self-paces via mastery stages.
- Add a parent override toggle in Settings → Advanced (`difficultyAutoGate`, default on) so older siblings sharing the same machine can opt out without losing the rest of Advanced.
- Thresholds (15 / 50, ≤7 / ≤9, "long word" = >5) are starting values; instrument and tune.

Files likely touched:

- `gameLogic.js` — the four `filtered*` builders
- `src/bridge/settings.ts`, `src/bridge/types.ts`, `src/features/settings/tabs/AdvancedTab.tsx` — new `difficultyAutoGate` toggle
- `tests/react-routes.spec.js` — settings toggle persistence
- legacy Playwright coverage in `tests/smoke.spec.js` for the gate behavior at each tier

Acceptance criteria:

- a fresh user (0 words learned) never sees a word longer than 7 letters in vocabulary / listening / picture-match / true-or-not
- a fresh user never sees an answer set with 2+ words >5 letters
- a user with 50+ words learned sees the unfiltered pool
- toggle off in Advanced restores legacy behavior immediately, no reload required
- Word Journey is unaffected at every tier
- no regression on category-only filtering

Carry-forward: this filter logic is added in legacy `gameLogic.js`. When Phase 3 migrates Vocabulary / Listening / Picture Match / True or Not to React, the same gate is re-implemented in a shared `src/bridge/wordSelection.ts` module so React games and any remaining legacy games share one source of truth.

### Slice 1.8: Word Journey Step-1 Audio Parity

Status: shipped

What landed:

- Discover stage (`renderDiscover` in `games/word-journey-game.js`) now renders a `controls-row` with the canonical `.play-audio` button + `.plays-remaining` counter — visually identical to the listening / picture-match / pronunciation games.
- Audio plays (both the auto-play on stage entry and replay clicks) consume from `gameManager.audioPlaysLeft` via `consumeAudioPlay('word-journey')`, so the discover stage shares the global per-game audio budget rather than a per-stage local counter.
- The button auto-disables when the budget is exhausted; counter stays in sync with the gameManager via `updateAllPlayCounters('word-journey')`.

Bonus fix landed in the same slice:

- `src/bridge/games.ts` `launchGame()` now calls `gameManager.switchGame()` (which activates `#${gameType}-game`) instead of `gameManager.startGame()` directly. Direct `startGame` left every legacy game container at `display:none`, so the React Home → /#/game/* path was visually broken. Also restores the React Router hash after the legacy `performGameSwitch` overwrites it with the legacy `#${gameType}` style.

Tests:

- `tests/wj-step1.spec.js` — asserts the play button is visible, plays-counter is numeric (or ∞ for unlimited), and clicking the button doesn't increase the count.

Files touched:

- `games/word-journey-game.js`
- `src/bridge/games.ts`
- `tests/wj-step1.spec.js` (new)

Objective (original): kids sometimes miss hearing the target word on step 1 of Word Journey. Bring step 1 into parity with other games (listening, picture-match) by exposing a visible play button with a play-count budget. Carried forward in the Slice 3.13 React migration.

## Phase 2: Shared Gameplay UI

Objective: standardize the visual chrome around gameplay before migrating each game.

### Slice 2.1: GameScreenShell

Status: shipped (Option B — components only). Legacy game wrapping is intentionally deferred — each Phase 3 game adopts the shell as it migrates, at which point the per-game inline `.progress-container` is removed instead of being hidden behind a synced React overlay. No changes to legacy `/game/*` chrome in this slice.

What landed:

- `src/features/games/shared/GameScreenShell.tsx` — full-bleed dark gradient page, max-w-3xl content rail, accepts `header`, optional `progress`, `children`, optional `footer`
- `src/features/games/shared/GameHeader.tsx` — back button (defaults to `navigate('/home')`, accepts override), centered title + optional subtitle/icon, optional score and coins pills
- `src/features/games/shared/QuestionProgress.tsx` — Hebrew "שאלה X מתוך Y" counter, optional reset button, gradient progress bar with safe clamping (handles `current > total` and `total = 0`)
- `src/features/games/shared/GameShellDemo.tsx` — interactive demo wired at `/#/dev/game-shell` showing all primitives composed; clicking "הבא" advances counter + score, "אפס משחק" resets state. Lives inside `AppShell` chrome (acceptable for a dev preview)
- Routing: `src/app/router.tsx` registers `dev/game-shell` ahead of `game/:gameId`
- Playwright: `tests/react-routes.spec.js` "Slice 2.1: GameScreenShell" — asserts shell + header + score + progress render, increment-on-click works, and the back button routes to `/#/home`. Both tests green.

Carry-forward: when Phase 3 migrates Vocabulary first, the per-game `.progress-container` in `index.html` for that game's container becomes dead markup. Either delete those blocks per-game during migration, or sweep them all in Slice 4.4. Plan still calls Slice 4.4.

Files added:

- `src/features/games/shared/GameScreenShell.tsx`
- `src/features/games/shared/GameHeader.tsx`
- `src/features/games/shared/QuestionProgress.tsx`
- `src/features/games/shared/GameShellDemo.tsx`

Files changed:

- `src/app/router.tsx` — added `dev/game-shell` route
- `tests/react-routes.spec.js` — added Slice 2.1 block (2 tests)

Deliverables (from original plan):

- shared shell around all games ✅ (primitive-level — Phase 3 games consume it)
- consistent back, score, progress, reset/exit patterns ✅

Acceptance criteria:

- legacy games can render inside the shell via bridge — **deferred per Option B**. Phase 3 game migrations adopt the shell directly; legacy games keep their own inline progress chrome until ported.
- header/progress state synchronized — **deferred per Option B**. The shell is a controlled React component; state ownership lives in the consuming feature (each Phase 3 game).

### Slice 2.2: Shared Feedback and Reward System

Status: shipped (Option B — components only, like Slice 2.1). Each Phase 3 game adopts these primitives as it migrates; no legacy game is rewired in this slice.

What landed:

- `src/features/games/shared/FeedbackBanner.tsx` — fixed-positioned, top-centered status banner with `correct` / `incorrect` variants, optional `autoDismissMs`, Lucide icon, `role="status"` + `aria-live="polite"`. Carries `data-variant` for assertions.
- `src/features/games/shared/RewardModal.tsx` — end-of-game celebration dialog (`role="dialog"`, `aria-modal`). Renders score (always), optional coins, optional `correct / total` summary, optional close (X), optional "play again" CTA, and an "exit to home" CTA. Backdrop click + Escape dismiss via `onClose ?? onExit`.
- `src/features/games/shared/ExitConfirmDialog.tsx` — `role="alertdialog"` confirming game exit. Default Hebrew copy ("לצאת מהמשחק?" / "המשך משחק" / "יציאה"). Cancel autofocused, Escape = cancel, backdrop click = cancel.
- `src/features/games/shared/GameShellDemo.tsx` — extended with three demo buttons ("הבא" → correct banner, "תשובה לא נכונה" → incorrect banner, "סיים משחק" → reward modal). Header back button now opens the exit-confirm dialog instead of navigating directly.
- `src/styles/globals.css` — added `@keyframes feedbackReveal` (used by all three new components for entrance animation; previously lived only in legacy `styles.css`).
- Playwright: 5 new tests under `Slice 2.2: Shared feedback and reward`. Slice 2.1 back-button test updated to go through the new exit-confirm flow. All 7 Slice-2 tests green.

Files added:

- `src/features/games/shared/FeedbackBanner.tsx`
- `src/features/games/shared/RewardModal.tsx`
- `src/features/games/shared/ExitConfirmDialog.tsx`

Files changed:

- `src/features/games/shared/GameShellDemo.tsx` — wired all three new primitives
- `src/styles/globals.css` — added `feedbackReveal` keyframes
- `tests/react-routes.spec.js` — updated Slice 2.1 back-button test, added Slice 2.2 block (5 tests)

Deliverables (from original plan):

- shared success/fail/reward patterns ✅ (FeedbackBanner + RewardModal)
- improved reward celebration ✅ (gradient hero icon, stats grid, play-again CTA)

Acceptance criteria:

- integrates with current scoring and completion flows — **deferred per Option B**. Phase 3 game migrations consume these primitives directly, mirroring the Slice 2.1 pattern.

### Slice 2.3: Shared Interaction Primitives

Status: shipped (Option B — components only). Phase 3 game migrations consume these directly; no legacy game is rewired in this slice.

What landed:

- `src/features/games/shared/AnswerGrid.tsx` — generic option grid. Supports text or media options (`AnswerOption.label` / `AnswerOption.media`), `selectedIndex` + `correctIndex` + `revealed` for post-answer styling, `disabled` and `hidden` (audio-gated reveal), arrow-key focus navigation across options, RTL-aware. Auto-derives column count (2 / 3 / 4) from option count, overridable via `columns`. Each button exposes `data-state` (`idle | selected | correct | incorrect`) for assertions and styling, plus `data-index`. Lucide check/x icons mark correct/incorrect after reveal.
- `src/features/games/shared/MediaPromptCard.tsx` — top-of-game prompt panel. Optional `prompt` (instruction), `media` slot (image/emoji), `word` (LTR English), `translation` (Hebrew, optional — vocab game hides this), and an audio play button driven by `onPlayAudio` + `audioPlaying` + `audioDisabled` + `audioHint`. Covers the four Wave-1 game shapes: vocab (word + audio), listening (audio only), picture-match (audio prompt + media options on the grid), true-or-not (image + word).
- `src/features/games/shared/GameShellDemo.tsx` — extended with a 3-mode toggle (text / media / binary) wiring AnswerGrid + MediaPromptCard end-to-end, including correct/incorrect feedback, reveal locking, and play-again reset. Validates the "reusable across at least 3 game types" acceptance criterion in-shell.
- Playwright: 6 new tests under `Slice 2.3: Shared interaction primitives` — render, correct-select + lock, wrong-select reveal, arrow-key nav, mode switch, binary 2-option layout. Slice 2.1/2.2 tests updated to drive feedback/scoring through the new AnswerGrid (replacing the removed `demo-next` / `demo-wrong` buttons). All 13 Slice-2 tests green.

Files added:

- `src/features/games/shared/AnswerGrid.tsx`
- `src/features/games/shared/MediaPromptCard.tsx`

Files changed:

- `src/features/games/shared/GameShellDemo.tsx` — replaced placeholder content with mode-toggled MediaPromptCard + AnswerGrid composition
- `tests/react-routes.spec.js` — added Slice 2.3 block (6 tests); rewrote Slice 2.1/2.2 click targets

Deliverables (from original plan):

- standard answer option cards ✅ (AnswerGrid)
- media prompt presentation ✅ (MediaPromptCard)
- mobile-friendly interactions ✅ (responsive column grid, large tap targets, focus-visible ring)

Acceptance criteria:

- reusable across at least 3 game types ✅ — demo proves text (vocab/listening), media (picture-match), and binary (true-or-not) shapes from a single pair of components.

## Phase 3: Game-by-Game Migration

Objective: migrate game UIs to React using shared gameplay primitives.

**Wave 1 is the committed scope.** It validates the shared primitives and the game migration pattern. Waves 2–4 are the desired end state and are sequenced here for planning, but they move from backlog to committed only after Wave 1 ships and the pattern is proven.

Order rationale: start with the simplest and most representative games to validate the pattern, then progress to more complex/custom games.

### Wave 1: Core pattern games — COMMITTED

These games share a question→answer→feedback loop. Migrating them first validates the shared primitives.

**Template (read before starting any Wave 1 slice):** Slice 3.1 locked in the pattern. New slices copy `src/bridge/vocabulary.ts` (begin/record/finish/abort + resume + audio-state persistence + V2 gating), copy `src/features/games/vocabulary/VocabularyGamePage.tsx` (mount-time legacy-readiness poll, audio gate, plays counter, manual play button, auto-play on `current` change with voice-readiness wait, gesture-free), register the new game ID in `src/features/games/reactGames.ts` and `src/features/games/GameHostPage.tsx`, then add a Slice 3.X test block to `tests/react-routes.spec.js`. Shared hooks/components to reuse without modification: `useTextPrefs` (case + nikud), `MediaPromptCard` (`audioIconOnly` mode + audio-only via no `word` prop), `AnswerGrid`, `FeedbackBanner`, `RewardModal`, `ExitConfirmDialog`, `QuestionProgress`, `cancelSpeech`/`speakWord`/`hardResetSpeech`, `getGameFeedback`/`getShowConfetti`/`triggerConfetti`, `stripNikud`, `getSettings`.

**Slice 3.1: Vocabulary** — the canonical question→answer game. ~266 lines. ✅ shipped.

Status: complete (2026-05-10). Pattern locked in: React UI drives the loop, bridges call directly into the legacy `gameManager` / `scoreManager` / `progressManager` / `speechManager`. `gameLogic.js`, `games/vocabulary-game.js`, and the managers were not modified — the legacy `#vocabulary-game` container stays in `index.html` until Slice 4.4. Slices 3.2–3.4 reuse the bridge shape from `src/bridge/vocabulary.ts` (begin → recordAnswer → finish → abort).

Files added:

- `src/bridge/vocabulary.ts` — session lifecycle + V2 gating; calls `gameManager.smartQuestionSelection`, `recordWordAttempt`, `scoreManager.addPoints`, `saveGameState`, `endGame`.
- `src/bridge/audio.ts` — thin wrapper over `window.speechManager`.
- `src/bridge/feedback.ts` — wraps global `getFeedback` + `confetti` + `SettingsManager.getSettings().showConfetti`.
- `src/features/games/vocabulary/VocabularyGamePage.tsx` — `GameScreenShell` + `MediaPromptCard` + `AnswerGrid` + `FeedbackBanner` + `RewardModal` + `ExitConfirmDialog`.
- `src/features/games/vocabulary/components/VocabularyLearnFirst.tsx` — React port of the legacy `.learn-first-prompt`; CTA routes to `/game/word-journey`.

Files modified:

- `src/features/games/GameHostPage.tsx` — branches on `gameId`; renders `VocabularyGamePage` when matched, otherwise falls through to `launchGame`. Re-applies the `react-shell-active` body class while a React game owns the route so legacy DOM stays suppressed.
- `tests/react-routes.spec.js` — Slice 3.1 block (4 tests: empty state, happy path with progress advancement, incorrect-answer reveal + manual next, header back → exit dialog).
- `docs/wiring-map.md` — new "Vocabulary Game (React — Slice 3.1)" cause/effect chain.

Acceptance criteria met:

- `/#/game/vocabulary` renders the React screen — `performGameSwitch('vocabulary')` is never called.
- Question pool, distractors, ordering, and length match legacy (uses `gameManager.smartQuestionSelection` + `applyDifficultyGate` + V2 gating).
- Scoring parity: `scoreManager.addPoints('vocabulary', 10)` on correct; `recordWordAttempt(word, category, isCorrect, 0, 'vocabulary')` and `saveGameState()` on every answer.
- V2 gating: pool < 4 renders the React empty state; legacy `.learn-first-prompt` is never DOM-injected.
- Audio parity: word auto-plays via `speechManager.speakWord`; feedback audio via `speechManager.speak`; `setGameContext('vocabulary')` on mount; `cancelSpeech` on unmount and on every new question.
- Confetti fires on correct answers when `settings.showConfetti` is true.
- After the configured `questionsPerGame` (default 10) the React `RewardModal` opens with score/correct/total.
- Mobile + RTL preserved (shared primitives are RTL-correct).
- Header back opens `ExitConfirmDialog`; confirm aborts the legacy session and routes to `/home`.
- No regression in non-vocabulary games — they still launch via the existing `launchGame` path.
- `npm run build` clean; `tsc --noEmit` clean; full Playwright React suite (33 tests) green.


**Slice 3.2: Listening** — same model with audio prompt. ~249 lines. ✅ shipped.

Status: complete (2026-05-12). Followed Slice 3.1 template. Differences vs 3.1:

- Prompt is audio-first: `MediaPromptCard` omits `word`, renders `media` (picture/emoji) + `translation` (Hebrew) + icon-only audio button. The English word is never shown — the player must identify it from the audio.
- `REQUIRED_PLAYS_BEFORE_REVEAL = 1` (vs vocab's 3). Matches legacy `games/listening-game.js`, which reveals options after the first auto-play completes. Voluntary re-plays still consume the per-question `audioPlaysAllowed` budget.
- caseMode applied to **option labels** (English) instead of the prompt word.

Files added:

- `src/bridge/listening.ts` — clone of `src/bridge/vocabulary.ts` keyed to `'listening'` gameType + `v2_listening_audio_<userId>` audio-state key.
- `src/features/games/listening/ListeningGamePage.tsx` — clone of `VocabularyGamePage` with the prompt + gate differences above.
- `src/features/games/listening/components/ListeningLearnFirst.tsx` — copy of vocab learn-first copy (≥4 learned words required).

Files modified:

- `src/features/games/reactGames.ts` — added `'listening'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `listening: ListeningGamePage`.
- `tests/react-routes.spec.js` — Slice 3.2 block (6 tests: empty state, happy path with no English word visible, incorrect→next, resume, audio-state persistence across refresh, exit dialog).
- `docs/wiring-map.md` — "Listening Game (React — Slice 3.2)" cause/effect chain.
**Slice 3.3: Picture Match** — image-heavy answer layout. ~118 lines. ✅ shipped.

Status: complete (2026-05-12). Followed Slice 3.1 template. Differences vs 3.1:

- Options are pictures, not text: `AnswerGrid` rendered with `variant="media"`, `columns={4}`, and each option carries `media` (image or emoji) instead of `label`. `option.ariaLabel` set from the English word for a11y.
- Prompt shows the English target word (audio-icon-only play button + 1-play reveal gate). Legacy also auto-plays the English word and reveals options after the first play — same model as Listening. Reusing `REQUIRED_PLAYS_BEFORE_REVEAL = 1` + the `audioPlaysAllowed` budget. (Master-plan's earlier "no audio gate" note was a misread of the legacy code.)
- `caseMode` applied to the **prompt word** (English), like vocab.
- Hebrew translation hidden from the prompt to keep the cue audio-first (matches legacy, which hides `picture-match-hebrew`).

Files added:

- `src/bridge/picture-match.ts` — clone of `src/bridge/listening.ts` keyed to `'picture-match'` gameType + `v2_picture_match_audio_<userId>` audio-state key. `PictureMatchOption` is `{ word, picture?, imageUrl? }` (vs listening's string options).
- `src/features/games/picture-match/PictureMatchGamePage.tsx` — clone of `ListeningGamePage` with media-option rendering (`OptionPicture` honors `wordImageOverrides`).
- `src/features/games/picture-match/components/PictureMatchLearnFirst.tsx` — copy of listening learn-first (≥4 learned words required for a viable 4-option pool).

Files modified:

- `src/features/games/reactGames.ts` — added `'picture-match'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `'picture-match': PictureMatchGamePage`.
- `tests/react-routes.spec.js` — Slice 3.3 block (6 tests: learn-first, happy path with English word visible + media variant, incorrect→next, resume with media options, audio-state persistence across refresh, exit dialog).
- `docs/wiring-map.md` — "Picture Match Game (React — Slice 3.3)" cause/effect chain.
**Slice 3.4: True or Not** — binary answer variant. ~217 lines. ✅ shipped.

Status: complete (2026-05-12). Followed Slice 3.1 template. Differences vs 3.1:

- 2-option `AnswerGrid` (`columns={2}`) with labels `✓ כן` / `✗ לא`. The bridge adapts the legacy `isMatch: boolean` field to a stable `correct` index (0 = כן, 1 = לא) so `AnswerGrid` keeps its index-based contract.
- Prompt shows the English target word + a **displayed image that may or may not match** the word (legacy `displayImage`/`displayImageUrl` distinct from the word's own `image`/`imageUrl`). The Hebrew translation is rendered too — kids need both cues to judge "does this picture match this word?". Image overrides intentionally only fire on the `isMatch` rounds (consulting overrides on a mismatch round would replace the decoy image with the answer image and give the round away).
- No audio reveal gate — legacy True-or-Not shows both word and image immediately, the audio is just a cue. The per-question `audioPlaysAllowed` budget is still applied so a refresh doesn't grant unlimited replays.
- Question building lives in `window.trueOrNotGame.buildQuestions()` (legacy class), not in `gameManager.getScopedQuestionPool` — the bridge waits for both `gameManager` and `trueOrNotGame` to be ready before calling `start`. V2 gating requires ≥5 learned words (mirrors `gameLogic.js:2163-2172`).
- `caseMode` and nikud applied to the prompt word/translation, like vocab.

Files added:

- `src/bridge/true-or-not.ts` — clone of `src/bridge/picture-match.ts` keyed to `'true-or-not'` gameType + `v2_true_or_not_audio_<userId>` audio-state key. `TrueOrNotQuestion` carries `{word, picture, imageUrl, displayPicture, displayImageUrl, isMatch, correct}`. Bridge calls `window.trueOrNotGame.buildQuestions(pool)` rather than `smartQuestionSelection`.
- `src/features/games/true-or-not/TrueOrNotGamePage.tsx` — page with image media slot + 2-option grid + auto-play (no reveal gate).
- `src/features/games/true-or-not/components/TrueOrNotLearnFirst.tsx` — learn-first prompt (requires ≥5 learned words).

Files modified:

- `src/features/games/reactGames.ts` — added `'true-or-not'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `'true-or-not': TrueOrNotGamePage`.
- `tests/react-routes.spec.js` — Slice 3.4 block (6 tests: learn-first, happy path with 2 options + image prompt + no audio gate, incorrect→next, resume, audio-state persistence across refresh, exit dialog).
- `docs/wiring-map.md` — "True or Not Game (React — Slice 3.4)" cause/effect chain.

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

## Phase 5: Content Expansion — Idioms & Slang

Objective: introduce multi-word expressions (idioms and slang) as a first-class content type alongside the existing single-word vocabulary.

Motivation:

- idioms ("give up", "put up", "look after") and slang ("got beef", "no cap", "that's fire") are essential for natural English comprehension and connect to how kids actually hear English in media
- the current `{ word, translation, category, image }` schema is single-word and emoji-based — it does not fit multi-word phrases with non-literal meaning
- several existing games (picture-match, memory, scramble) do not adapt to phrases without degrading; new or adapted games are needed
- slang requires parental control — not every family wants "edgy" registers enabled for their child

Scope commitment:

- Phase 5 is BACKLOG — entered only after Phase 3 Wave 1 ships and Settings (Slice 1.6) is stable
- Phase 5 may run in parallel with Phase 3 Waves 2–4 once those are promoted to committed

### Slice 5.1: Expression Data Model

Status: planned

Define the new content shape and load path. No game consumes this data yet — data plumbing only.

Schema:

```ts
type ExpressionType = 'idiom' | 'slang' | 'phrasal-verb'
type Register = 'kid-friendly' | 'casual' | 'edgy'

interface Expression {
  phrase: string                 // "give up", "got beef with"
  type: ExpressionType
  register: Register
  meaningHe: string              // figurative meaning in Hebrew (לוותר)
  literalHe?: string             // literal word-by-word Hebrew, if instructive
  exampleEn: string              // "Don't give up on your dreams."
  exampleHe: string              // translated example for context
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  audioUrl?: string              // optional cached TTS
}
```

Files added:

- `data/expressions/idioms.js`
- `data/expressions/slang.js`
- `data/expressions/phrasalVerbs.js`
- `data/expressions/_index.js`
- `src/bridge/expressions.ts` — parallel catalog, distinct from `vocabularyBank`
- `src/hooks/useExpressions.ts`

Deliverables:

- schema locked in TypeScript and JS
- initial seed of ~50 idioms, ~40 phrasal verbs, ~30 slang expressions
- Hebrew meanings reviewed by a native speaker (not machine-translated)

Acceptance criteria:

- `bridge.getExpressionBank()` returns a typed list filtered by enabled registers
- regular vocabulary games (picture-match, memory, scramble) do NOT pick up expressions
- phrases render correctly in RTL alongside Hebrew translations

### Slice 5.2: Parental Control for Registers

Status: planned — depends on Slice 1.6 (Settings Shell)

Settings toggles to enable/disable each register. Defaults: `kid-friendly` on, `casual` off, `edgy` off. Changes gated behind the parent password (same mechanism as existing protected settings).

Files:

- `src/features/settings/*` (assumes Slice 1.6 complete)
- `src/bridge/settings.ts` — add `expressionRegisters: Record<Register, boolean>`
- `src/bridge/expressions.ts` — filter at the bridge boundary

Acceptance criteria:

- toggles persist per-user, with sensible defaults
- bridge filters the expression bank by enabled registers before any game sees it
- UI labels each register clearly, with example phrases so parents know what they are enabling
- disabling a register while a game is in progress does not crash the session

### Slice 5.3: Expression Games — Tier 1 (Adapt Existing)

Status: planned — depends on Slice 5.1

Adapt games that work naturally with phrases:

- **Listening** — hear phrase, pick Hebrew meaning from 4 options
- **Fill Blanks** — "Don't _____ on your dreams" → pick the idiom that fits
- **True or Not** — "'give up' means לוותר?" → yes/no
- **Reading** — read phrase + example sentence, pick meaning

Each game receives a `contentSource: 'vocabulary' | 'expressions'` flag. Default source depends on unlock tier — expressions unlock only after 50 learned vocabulary words.

Files:

- extend existing game implementations (legacy or migrated, depending on Phase 3 state)
- `src/features/games/shared/` — primitives updated to accept `Expression` questions
- `src/bridge/progress.ts` — new `expressionMastery` key, tracked separately from `wordMastery`

Acceptance criteria:

- at least 3 existing games play cleanly with expression content
- scoring and mastery tracked separately (`expressionMastery` keyed by phrase)
- RTL layout correct for multi-word English phrases with Hebrew meaning
- Playwright coverage for each adapted game

### Slice 5.4: Expression-Native Games — Tier 2 (New)

Status: planned — backlog until Slice 5.3 validates the pattern

New games designed around phrases rather than single words:

- **Meaning Match** — phrase shown, 4 Hebrew meanings to pick from (inverse of fill-blanks)
- **Build the Phrase** — scattered English words, reorder to form the target idiom
- **Context Swap** — English sentence shown; replace a plain verb/noun with the matching idiom or phrasal verb

Each game uses the shared gameplay primitives from Phase 2.

### Slice 5.5: Expression Progress & Certificates

Status: planned — depends on 5.3

Surface expression mastery in Profile and Stats; add a new certificate for hitting milestones.

Files:

- `src/bridge/progress.ts` — `getExpressionMastery()`, `getMasteredExpressions()`, milestone certs
- `src/features/profile/ProfilePage.tsx` — new "Expressions" section or tab
- `src/features/stats/StatsPage.tsx` — expression mastery row
- `managers/CertificateManager.js` (or its React successor) — new cert `milestone_expressions_30`: "אלוף ביטויים"

Acceptance criteria:

- Profile shows mastered expressions separately from vocabulary
- Stats shows per-register mastery counts
- New certificate awarded at 30 mastered expressions
- No regression in existing vocabulary progress display

### Risks specific to Phase 5

- **Content quality** — idiom translation requires native-speaker review; machine translation produces awkward or wrong Hebrew. Budget for a bilingual review pass before ship.
- **Slang drift** — "got beef" will eventually sound dated. Reuse the existing parent-custom-words flow as the update mechanism, rather than embedding content in the codebase long-term.
- **Unlock tuning** — too strict and kids never reach expressions; too loose and it overwhelms basic vocab learners. Target ~50 learned words as a starting gate; instrument and adjust.
- **Audio** — multi-word TTS sometimes mangles phrase intonation. Consider pre-recording audio for high-value idioms rather than relying on TTS at runtime.

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
