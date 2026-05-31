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

- `src/features/games/shared/GameScreenShell.tsx` — full-bleed dark gradient page, max-w-3xl content rail, accepts `header`, optional `progress`, `children`, optional `footer`. Forwards `header.title/icon/subtitle` to `<GameHero>` and the rest to `<GameHeader>`.
- `src/features/games/shared/GameHero.tsx` — **canonical title placement** (adopted 2026-05-23 — Slice 3.10 polish). Big centered icon + title rendered *between* the header card and the progress strip, with a hairline gradient divider. Replaced the in-header centered title to stop it visually competing with the toggle/score pills; sits between the controls row and the progress bar so it reads as a section heading. Game pages keep their existing `headerProps = { title, icon, score, onBack }` declaration — no per-page change required. Do NOT render a title elsewhere in a game page; see `feedback_react_game_hero_title` memory.
- `src/features/games/shared/GameHeader.tsx` — controls row only: back button (defaults to `navigate('/home')`, accepts override), optional score and coins pills, case + nikud toggles. `title`/`icon`/`subtitle` are accepted on props for shell forwarding but not rendered here.
- `src/features/games/shared/QuestionProgress.tsx` — Hebrew "שאלה X מתוך Y" counter, optional reset button, gradient progress bar with safe clamping (handles `current > total` and `total = 0`)
- `src/features/games/shared/GameShellDemo.tsx` — interactive demo wired at `/#/dev/game-shell` showing all primitives composed; clicking "הבא" advances counter + score, "אפס משחק" resets state. Lives inside `AppShell` chrome (acceptable for a dev preview)
- Routing: `src/app/router.tsx` registers `dev/game-shell` ahead of `game/:gameId`
- Playwright: `tests/react-routes.spec.js` "Slice 2.1: GameScreenShell" — asserts shell + header + score + progress render, increment-on-click works, and the back button routes to `/#/home`. Both tests green.

Carry-forward: when Phase 3 migrates Vocabulary first, the per-game `.progress-container` in `index.html` for that game's container becomes dead markup. The `#<game>-game` legacy containers are still present after Slice 4.4.a (the game *UI files* were deleted; the host markup + engine remain) — they get swept in Slice 4.4.b / 4.5.

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

**Slice 3.5: Reading** — letter-building UI. ~343 lines. ✅ shipped.

Status: complete (2026-05-13). Followed Slice 3.1 template. Differences vs 3.1:

- Letter-bank/built-word UI replaces `AnswerGrid` — first text-building Wave 2 slice. Each letter button has a stable `key` (index-letter pair) so duplicate letters render as distinct buttons; clicking moves a token from bank to built-word, "נקה" resets all `used` flags.
- Submission flow: bridge `recordReadingAnswer(question, builtWord, attempts)` returns `{isCorrect, pointsAwarded: max(0, 10 - attempts)}` matching legacy `games/reading-game.js`. The legacy "wrong-answer-still-advances-index" semantics are preserved by advancing `currentQuestionIndex` inside the bridge on every submission, then surfacing a Next button on incorrect (no retry exploit).
- 3-second English-word reveal cycle on each new question (and again after a wrong answer): `wordVisible` state + `wordHideTimer` ref. Hebrew translation stays visible the entire time.
- No 3-play audio reveal gate (the picture + initial English word are exposure). Per-question `audioPlaysAllowed` budget still applied so refresh can't grant unlimited replays.
- V2 gating reuses `getScopedQuestionPool('reading')` + `smartQuestionSelection` (reading is in legacy `VOCAB_GATED_GAMES`); requires ≥4 learned words, like vocabulary.
- `caseMode` toggles letter buttons + built word + prompt word between upper/lowercase. Legacy data stores letters uppercase; rendering decides display case at the React layer.

Files added:

- `src/bridge/reading.ts` — clone of `src/bridge/vocabulary.ts` keyed to `'reading'` gameType + `v2_reading_audio_<userId>` audio-state key. Signature change: `recordReadingAnswer(question, builtWord, attempts)` instead of selectedIndex.
- `src/features/games/reading/ReadingGamePage.tsx` — page with picture media slot + letter-bank/built-word + Check/Clear footer + auto-play (no reveal gate) + 3s word reveal cycle.
- `src/features/games/reading/components/ReadingLearnFirst.tsx` — learn-first prompt (requires ≥4 learned words).

Files modified:

- `src/features/games/reactGames.ts` — added `'reading'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `'reading': ReadingGamePage`.
- `tests/react-routes.spec.js` — Slice 3.5 block (7 tests: learn-first, happy path with picture+letter bank+check advances, clear button resets state, incorrect→no retry, resume, audio-state persistence across refresh, exit dialog).
- `docs/wiring-map.md` — "Reading Game (React — Slice 3.5)" cause/effect chain.

**Slice 3.6: Word Builder** — sentence-with-blank, choose-the-missing-word. ~182 lines. ✅ shipped, **retired by Slice 3.7.1** (folded into Fill Blanks).

Status: complete (2026-05-16). Followed Slice 3.1 template. Differences vs 3.1:

- Question source is `data/sentences.js` via legacy `getRandomSentences(20, 'beginner', themes)`; bridge fetches 20 (was 8 in legacy `gameLogic.js:2208`) so the `settings.questionsPerGame` cap up to 20 actually applies, then `Math.min(shuffled.length, settingsCap)`.
- 3 options per question (data shape: `blank.options = [correct, wrong1, wrong2]`). Options shuffled at the page layer; `correctIndex` recomputed per question via `useMemo`. AnswerGrid `variant='text'`, columns auto (3).
- Scoring: 15 pts per correct (matches legacy `word-builder-game.js:140`), no partial credit. Resume derives `correct = Math.floor(resumeScore / 15)` (not /10 like other Wave-1 slices).
- V2 gating mirrors `gameLogic.js:2190` — requires ≥20 learned words. `MIN_LEARNED = 20` in bridge.
- Always-on "השאלה הבאה" button after any answer (correct or incorrect). No auto-advance — kids need time to read the full sentence. Pressing the answer also re-speaks the full sentence (correct) or the target word (incorrect).
- Custom prompt card (not `MediaPromptCard`): theme badge + Hebrew translation (text-2xl/3xl matching prior slices) + sentence with inline blank slot styled by phase. `key={index}` on the prompt-section root forces a clean remount per question.
- Audio button is a separate gradient pill (speaker icon) above an amber "השמעות נותרו" hint — matches MediaPromptCard's `audioIconOnly` styling but standalone since the card layout is custom.

Files added:

- `src/bridge/word-builder.ts` — clone of Slice 3.1 bridge keyed to `'word-builder'` + `v2_wordbuilder_audio_<userId>` audio-state key. `recordWordBuilderAnswer(question, selectedWord)` returns `{isCorrect, pointsAwarded: isCorrect ? 15 : 0}` and advances `currentQuestionIndex` regardless of correctness (matches legacy).
- `src/features/games/word-builder/WordBuilderGamePage.tsx` — page with custom sentence-with-blank prompt + AnswerGrid (text) + always-on next button.
- `src/features/games/word-builder/components/WordBuilderLearnFirst.tsx` — learn-first prompt (≥20 learned).

Files modified:

- `src/features/games/reactGames.ts` — added `'word-builder'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `'word-builder': WordBuilderGamePage`.
- `src/features/games/shared/RewardModal.tsx` — **shared change affecting all 6 React games**: removed static title; introduced 10 English tiers (Perfect/Outstanding/Excellent/Great job/Well done/Nice effort/Keep going/Don't give up/You can do it/Let's try again) selected by `Math.round(correct/total*100)`; speaks the English tier on open via `speak()`; `dir="ltr"` on headline + Stat value to prevent RTL bidi flipping (was rendering "10 / 8" instead of "8 / 10", and "👏 !Great job" instead of "Great job! 👏"). Percentage is computed but **not** displayed.
- `src/bridge/audio.ts` — added `speakHebrew(text)` helper (passes `{ language: 'hebrew' }` to legacy `speechManager.speak`). Currently unused — kept for any future Hebrew-completion voice work.

**Slice 3.7: Fill Blanks** — sentence completion. ~205 lines. ✅ shipped.

Status: complete (2026-05-16). Followed Slice 3.6 (Word Builder) page shape verbatim — same data shape (sentences with `blank.options[3]`), same custom prompt card + always-on next button, same AnswerGrid. Differences vs 3.6:

- Scoring: 10 pts per correct (matches legacy `fill-blanks-game.js:141`). Resume derives `correct = Math.floor(resumeScore / 10)`. **Slice 3.7.1 raised this to 15** when word-builder was retired and its 15pt rate was inherited.
- V2 gating mirrors `gameLogic.js:2049` — requires ≥30 learned words. `MIN_LEARNED = 30` in bridge.
- Base sentence count: `getRandomSentences(10, ...)` (legacy already pulls 10; no over-fetch needed since `questionsPerGame` cap is also 10).
- Game title "השלם את המשפט", icon "✍️" (per `index.html:163` legacy card).

Files added:

- `src/bridge/fill-blanks.ts` — clone of Slice 3.6 bridge keyed to `'fill-blanks'` + `v2_fillblanks_audio_<userId>` audio-state key. `recordFillBlanksAnswer(question, selectedWord)` returns `{isCorrect, pointsAwarded: isCorrect ? 10 : 0}` and advances `currentQuestionIndex` regardless of correctness (matches legacy).
- `src/features/games/fill-blanks/FillBlanksGamePage.tsx` — page with custom sentence-with-blank prompt + AnswerGrid (text) + always-on next button.
- `src/features/games/fill-blanks/components/FillBlanksLearnFirst.tsx` — learn-first prompt (≥30 learned).

Files modified:

- `src/features/games/reactGames.ts` — added `'fill-blanks'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `'fill-blanks': FillBlanksGamePage`.

**Slice 3.7.1: Retire Word Builder, fold into Fill Blanks** — ✅ shipped.

Status: complete (2026-05-16). After Slice 3.7 we noticed Word Builder and Fill Blanks are near-duplicates: both pull from the same `data/sentences.js` pool via `getRandomSentences(…, 'beginner', themes)`, render a sentence-with-blank + 3 multiple-choice options, advance index regardless of correctness, and use identical audio behavior. The only meaningful differences were the gate (≥20 vs ≥30) and scoring (15 vs 10). Decision: keep `fill-blanks` (canonical), retire `word-builder`, inherit word-builder's 15 pts/correct (sentence-with-blank arguably deserves the bonus over plain vocabulary).

Code deltas:

- Bumped `recordFillBlanksAnswer` reward 10 → 15; resume divisor 10 → 15; legacy `games/fill-blanks-game.js:141` raised to 15 to match.
- Deleted `games/word-builder-game.js`, `src/bridge/word-builder.ts`, `src/features/games/word-builder/`.
- Removed `'word-builder'` from: `REACT_GAME_IDS`, `GameHostPage.REACT_GAMES`, `gameLogic.js` (registry register, challenge-games set, gameTypes array, gating branch, switch case), `ScoreManager.js`, `ProgressManager.js` unlock list, `settings.js` gameTypes, `stats.js` games map, `components/top-header.js`, React `src/bridge/{progress,stats}.ts`, `src/features/{home,profile,courses}/*.tsx`, `index.html` (game card + legacy game container), `tests/smoke.spec.js`, `CLAUDE.md` game-types line.
- Added `GameHostPage.RETIRED_GAMES = { 'word-builder': 'fill-blanks' }` → `<Navigate to="/game/fill-blanks" replace />` for bookmark safety.
- Added one-time localStorage sweep in `app.js:setupWithAuth` to drop `savedGame_<uid>_word-builder` and `v2_wordbuilder_audio_<uid>` orphans. Historical `wordMastery[…].gameTypeStats['word-builder']` left in place (read-only stat, no live code path).

**Slice 3.8: Sentence Scramble** — drag/tap reordering. ~428 lines. ✅ shipped.

Status: complete (2026-05-17). Followed Slice 3.1 template loosely — this is the first React game whose answer surface isn't an `AnswerGrid` of fixed N options; words flow between a shuffled word bank and a reorderable answer zone. Differences vs 3.1:

- No audio gate — legacy never had one (the target sentence speaks once on load; player taps a play button to hear their in-progress sentence). Skipped `audioPlaysLeft` budget, audio-state persistence, and the auto-play voice-readiness wait entirely.
- Custom answer surface: `scramble-word-bank` (shuffled `<button>` chips) → tap moves token to `scramble-answer-zone`. Tokens carry stable `key` so duplicate words (e.g. "the … the") render as distinct buttons. Tap a placed chip → returns it to the bank.
- Reorder via native HTML5 DnD (`draggable` + drag/over/drop handlers on the chip), with a parallel touch path (`touchstart`/`move`/`end` + `elementFromPoint`) for mobile. No new dependency.
- Index advances regardless of correctness (matches `gameLogic.js` invariant); 10 pts/correct (legacy `sentence-scramble-game.js:330`). On wrong, the answer zone replays the **correct** order with a 180ms-staggered animation before "next" appears — mirrors `animateCorrectOrder()`.
- V2 gating: ≥30 learned words (matches `gameLogic.js:2000`); reuses the same theme-filter logic as Fill Blanks.

Files added:
- `src/bridge/sentence-scramble.ts` — clone of Slice 3.7's `fill-blanks.ts`, keyed to `'scramble'`. No audio-state helpers (no gate). `recordScrambleAnswer(question, playerWords[])` joins words with single spaces, case-insensitive compares against `question.words.map(stripPunct).join(' ')`, records a `recordWordAttempt` for every vocab-bank word in the sentence, +10 pts on correct, advances index regardless.
- `src/features/games/sentence-scramble/SentenceScrambleGamePage.tsx` — page (~450 lines). Bank + answer zone with `dir="ltr"` for LTR English flow inside the RTL shell. Reuses `GameScreenShell`, `GameHeader`, `QuestionProgress`, `RewardModal`, `ExitConfirmDialog`, `FeedbackBanner`. Reveal animation uses `setTimeout` budget tracked in `revealTimersRef` and cleared on unmount/exit/reset.
- `src/features/games/sentence-scramble/components/ScrambleLearnFirst.tsx` — 30-word gate empty state, links to Word Journey.

Files modified:
- `src/features/games/reactGames.ts` — added `'scramble'` to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — registered `scramble → SentenceScrambleGamePage`.
- `tests/react-routes.spec.js` — Slice 3.8 block (7 tests: empty state, happy path with index advance, tap-to-return, check-disabled-until-complete, incorrect-reveal, resume, exit dialog).
- `docs/wiring-map.md` — "Sentence Scramble Game (React — Slice 3.8)" cause/effect chain.

### Wave 3: Grammar and structured learning — BACKLOG

**Slice 3.9: Grammar Beginner** — guided grammar. ~384 lines. ✅ shipped.

Status: complete (2026-05-20, commit `aa805f3`). Did NOT follow the Slice 3.1 template — this is the first React game with four distinct question subtypes (`who-says-it`, `complete-sound`, `sounds-right`, `match-picture`) instead of a single question→answer model. Each subtype has its own answer surface (image-grid subject pickers, verb audio buttons, sentence audio cards). Differences vs 3.1:

- Question source: `data/grammarBeginnerData.js`'s `generateGrammarBeginnerQuestions(n)` — regenerates fresh each fresh start (no `smartQuestionSelection`).
- Question shape is a discriminated union (`type: QuestionType`) — see `src/bridge/grammar-beginner.ts` for the four `BaseQuestion` extensions and `getPredicateHebrew()` helper for gendered Hebrew agreement.
- Scoring: `max(0, 10 - attempts + 1)` from legacy `grammar-beginner-game.js:331` (first-try correct = 10 pts). Advances on first answer regardless of correctness.
- No V2 learn-first gate, no audio-state persistence key.
- Subtype audio behavior differs: `who-says-it`/`match-picture` auto-play sentence audio; `complete-sound` plays subject then predicate with a 500ms gap; `sounds-right` has no auto-play (legacy parity).
- Per-subtype view components live under `src/features/games/grammar-beginner/components/` (`WhoSaysItView`, `CompleteSoundView`, `SoundsRightView`, `MatchPictureView`, `TranslationFlash`) — kept here, not promoted to shared primitives, because no other game uses these specific layouts.

Slice closeout:

- `src/bridge/grammar-beginner.ts` — bridge keyed to `'grammar-beginner'`. `recordGrammarBeginnerAnswer(question, selected, attemptsBefore)` returns `{isCorrect, pointsAwarded}` using the legacy attempts formula.
- `src/features/games/grammar-beginner/GrammarBeginnerGamePage.tsx` — page component (~345 lines). Mount-time legacy-readiness poll; per-subtype audio handlers; translation flash on answer.
- `src/features/games/grammar-beginner/components/*.tsx` — five subtype-specific views.
- `src/features/games/reactGames.ts` — `'grammar-beginner'` in `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — `'grammar-beginner': GrammarBeginnerGamePage` in `REACT_GAMES`.
- `docs/wiring-map.md` — "Grammar Beginner Game (React — Slice 3.9)" cause/effect chain (backfilled 2026-05-23).
- `tests/react-routes.spec.js` — Slice 3.9 block (4 tests: happy path with correct answer advancing index, translation+Next on any answer, resume from saved state, exit dialog). Backfilled 2026-05-23.

**Slice 3.10: Grammar** — advanced grammar. ~207 lines. ✅ shipped.

Status: complete (2026-05-21). Followed the Slice 3.7 (Fill Blanks) page shape — sentence-with-blank + N-option AnswerGrid + always-on Next button + advance regardless of correctness. Differences vs 3.7:

- Data source: legacy `gameData.grammar` (data/grammarQuestions.js) filtered via `gameManager.getFilteredGrammarQuestions()` (respects `selectedCategories`) and ordered via `gameManager.smartQuestionSelection()`. No `getRandomSentences`-style helper, so the bridge calls the legacy manager methods directly.
- No V2 learn-first gate. No audio plays budget. Empty state shows only if `gameData.grammar` is unavailable.
- Question shape: `{ sentence (with ___), hebrewSentence, options: string[], correct: number, category, explanation, hebrewExplanation, difficulty }`.
- Scoring: 10 pts per correct (legacy grammar-game.js:143). Resume derives `correct = Math.floor(resumeScore / 10)`.
- Audio: speak praise (if correct) + full correct sentence on every answer. No auto-play of the prompt.
- UI: category badge (`GRAMMAR_CATEGORY_LABELS`), Hebrew translation, English sentence split around `___` with a styled blank `<span>` that fills with the chosen word (green if correct, red if incorrect — and shows the *correct* answer in red on incorrect). Explanation (`hebrewExplanation` first, falling back to `explanation`) surfaces after answering.
- Resume guard: stale state checker rejects saves whose `options[0]` isn't a string (mirrors legacy `gameLogic.js:2072` — guards against grammar-beginner-shape blobs cross-polluting `grammar`).

Slice closeout:

- `src/bridge/grammar.ts` — bridge keyed to `'grammar'`. `recordGrammarAnswer(question, selectedWord)` returns `{isCorrect, pointsAwarded: isCorrect ? 10 : 0}` and advances `currentQuestionIndex` regardless of correctness.
- `src/features/games/grammar/GrammarGamePage.tsx` — page component (~290 lines).
- `src/features/games/reactGames.ts` — `'grammar'` added to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — `'grammar': GrammarGamePage` added to `REACT_GAMES`.
- `tests/react-routes.spec.js` — Slice 3.10 block (4 tests: happy path with index advance, incorrect→reveal+explanation, resume, exit dialog).
- `docs/wiring-map.md` — "Grammar Game (React — Slice 3.10)" cause/effect chain.

Polish pass (2026-05-23):

- **Nikud + audio + UX fixes:** wired `useTextPrefs().showNikud` so the toggle strips nikud from the Hebrew sentence and explanation. Added a Volume2 play button — speaks the sentence with the blank replaced by a comma pause before answering, and speaks the full sentence with the correct answer filled in after answering. Auto-plays once per question after voices are ready.
- **Bilingual options + filled Hebrew sentence (data work):** added `hebrewOptions: string[]` to all 98 entries in `data/grammarQuestions.js`. The grammar page now (a) fills the Hebrew sentence blank with the gloss of the correct answer (e.g. `אנחנו לא יכול לשחק בחוץ בגשם`) and (b) renders each `AnswerGrid` option with a small Hebrew sublabel under the English word. Bumped the cache-buster on the grammar import in `data/_loader.js`. Bridge resume path now re-hydrates saved questions against the current `gameData.grammar` (matched by sentence) so older localStorage saves pick up the new field.
- **AnswerGrid `sublabel` field:** new optional per-option field rendered under the main label. First consumer is grammar; available to any future slice that wants bilingual options.
- **Hero title redesign (cross-cutting):** the shared `GameHeader` no longer renders the centered icon/title. A new `src/features/games/shared/GameHero.tsx` displays them between the header card and the progress strip with a gradient divider — applied to ALL React games via `GameScreenShell`. Slices 3.1–3.9 inherit the new look for free; no page changes needed. Documented in `CLAUDE.md` "Shared game primitives" and the `feedback_react_game_hero_title` memory so future slices follow.
- **Theme pills removed from Fill Blanks + Sentence Scramble:** the "food 🍎" / "colors 🎨" etc. badge in the prompt card was redundant (sentence content already revealed the topic) and present in only 2 of 9 React games. Removed from `FillBlanksGamePage.tsx` + `SentenceScrambleGamePage.tsx` along with their `THEME_ICONS` maps. The scramble test that asserted on `[data-testid="scramble-theme"]` is gone. Future sentence-bearing games should NOT re-introduce a theme/category badge in the prompt card.

### Wave 4: Special/complex games

These have unique interaction models and require the most custom work.

**Slice 3.11: Pronunciation** — SHIPPED 2026-05-23. Speech-recognition + comparePronunciation flow in React, clones the Slice 3.1 shape with picture-match's learn-first gate.

Pattern notes (mirrors `feedback_phase3_game_template`):

- Bridge keyed to `'pronunciation'`. Question shape: `{ word, hebrew, phonetic, picture, imageUrl, category, difficulty }` (matches `data/converters.js convertToPronunciation`).
- Gating: `pronunciation` is in legacy `VOCAB_GATED_GAMES` (`gameLogic.js:2212`) — bridge filters scoped pool by `_getLearnedWordSet()`; <4 learned → `kind:'learn-first'`. Reuses `PictureMatchLearnFirst` (same threshold + copy).
- Scoring: `pointsAwarded = isCorrect ? round(accuracy * 10) : 0`; `isCorrect = accuracy >= 0.7` (legacy `pronunciation-game.js:214 + 253`). Resume derives `correct = floor(resumeScore / 10)` — close enough given non-correct answers award 0.
- `recordPronunciationAttempt` advances `currentQuestionIndex` + saves regardless of correctness (legacy invariant — prevents retry exploit).
- Mic flow goes through bridge wrappers: `isSpeechRecognitionAvailable`, `startPronunciationRecording`, `stopPronunciationRecording`, `isCurrentlyRecording`. `RECORDING_CANCELLED` is swallowed (user-initiated stop); other errors render under the mic button.
- Audio: auto-plays target on each new question (10-attempt voice poll, 250 ms warmup). Manual listen button disabled while recording so kids can't cheat. Incorrect path speaks praise audio, waits 400 ms, then replays the target word before showing "Next".
- No per-question audio-state localStorage key (no play budget on pronunciation).

Slice closeout:

- `src/bridge/pronunciation.ts` — bridge (~280 lines).
- `src/features/games/pronunciation/PronunciationGamePage.tsx` — page (~400 lines).
- `src/features/games/reactGames.ts` — `'pronunciation'` added to `REACT_GAME_IDS`.
- `src/features/games/GameHostPage.tsx` — `'pronunciation': PronunciationGamePage` added to `REACT_GAMES`.
- `docs/wiring-map.md` — "Pronunciation Game (React — Slice 3.11)" cause/effect chain.

Polish pass (2026-05-23, same-day):

- **Fanfare SFX parity:** added `playAnswerSfx('correct'|'incorrect')` to `src/bridge/feedback.ts` (calls `window.audioEffects.playCorrect/playWrong`). Pronunciation reads `comparison.feedback` directly so it bypassed the implicit SFX trigger inside `getGameFeedback()`; now it fires the same WAV other games do, accompanying confetti.
- **Replay your recording:** parallel `getUserMedia` + `MediaRecorder` runs alongside `webkitSpeechRecognition` (recognition doesn't expose raw audio). On stop we build a Blob → ObjectURL and surface a "שמע את עצמך" button next to "השמע שוב" in the comparison panel. Blob URLs are released on advance / reset / exit / unmount to avoid leaks. Failure of the parallel capture is silent — recognition still drives scoring.
- **Resume autoplay suppression:** `start()` now sets `autoPlayedRef.current = true` when `resumeIndex > 0`. Chrome's autoplay policy blocks audio on a refreshed tab (no prior gesture); previously we attempted and silently failed. User taps the speaker to hear the word, like other React games on resume.
- **Comparison label:** "היעד" → "צָרִיךְ לוֹמַר" (responds to nikud toggle: plain "צריך לומר" when off).
- **Reset chip (cross-cutting, all React games):** `QuestionProgress.tsx` reset button gained an amber border + `RotateCcw` icon so it stands out from the panel background. Every React game inherits the change for free.

Playwright coverage is deliberately deferred to a follow-up — Web Speech API (mic + recognition) cannot be exercised in headless browsers without `--use-fake-device-for-media-stream` + a fake recognition stub; the rest of the slice (load, learn-first, exit dialog) shadows existing picture-match tests closely enough that reviewing those is sufficient until the stub lands.

**Slice 3.12: Story Time** — SHIPPED 2026-05-24. Two-phase read+quiz game with per-story progression. ~307 legacy lines → ~450 lines of React (page + 3 components + bridge).

Status: complete (2026-05-24). Did NOT follow the Slice 3.1 template — story-time is the first React game with internal phase transitions (read ↔ quiz) and per-session multi-document content (`stories[]`, each with its own quiz). Differences vs 3.1:

- **Phase state machine inside the page:** `phase: 'read' | 'quiz' | 'answered' | 'finished'`. Read renders `StoryReadPhase` (tappable highlights + per-sentence speakers + "מוכן לשאלות" CTA). Quiz renders `StoryQuizPhase` using the shared `AnswerGrid` (text variant, 3 cols by default). Advance order is: next quiz Q within story → next story (jump back to `read`) → finish.
- **Total = sum across stories, not stories.length:** the progress strip counts answered quiz questions (mirrors legacy `totalQuestions = stories.reduce(sum quizQs)`). So a 3-story session with 2 questions each shows 1..6 across the whole run.
- **No audio gate:** read phase plays words/sentences on tap only (no required-plays-before-reveal). Quiz options are visible immediately on phase switch.
- **Resume disabled (intentional):** legacy persists `currentQuestionIndex` (quiz count) but not `storyIndex`, so reopening silently restarts at story 0. The React bridge `deleteGameState` on every `begin` to keep behavior consistent with what legacy *appeared* to do. Documented in the bridge JSDoc and `feedback_story_time_resume_disabled` memory.
- **Learn-first gate:** ≥15 learned words (legacy gameLogic.js:2184). Bespoke `StoryTimeLearnFirst` component (the picture-match copy mentions "4 מילים" and CTA wording doesn't fit a 15-word story game).
- **Scoring:** +15 pts per correct quiz answer, matches legacy `story-time-game.js:249`. On correct we also `recordWordAttempt` for every `story.highlights` entry so highlighted words feed mastery (legacy parity).
- **Speech model:** `speakWord(word, 'story-time')` for highlight taps; `speak(sentence)` for the per-sentence 🔊 button (full-sentence TTS, not single-word). No nikud/case toggles in the read phase since story text is rendered LTR verbatim.

Files added:
- `src/bridge/story-time.ts` — `beginStoryTimeSession`, `recordStoryQuizAnswer`, `finishStoryTimeSession`, `abortStoryTimeSession` + `Story`, `StoryHighlight`, `StoryQuizQuestion` types. Imports legacy `data/stories.js` directly (no .d.ts).
- `src/features/games/story-time/StoryTimeGamePage.tsx` — page orchestrator with phase state machine + reward/exit handling.
- `src/features/games/story-time/components/StoryReadPhase.tsx` — sentence list with tappable highlights (translation tooltip + speakWord) and per-sentence speakers.
- `src/features/games/story-time/components/StoryQuizPhase.tsx` — wraps shared `AnswerGrid` with story title + question counter + Hebrew question text.
- `src/features/games/story-time/components/StoryTimeLearnFirst.tsx` — 15-word gate prompt.
- Registered in `src/features/games/reactGames.ts` (`REACT_GAME_IDS`) + `src/features/games/GameHostPage.tsx` (`REACT_GAMES`).
- `tests/react-routes.spec.js` — Slice 3.12 block (4 tests: learn-first under 15 learned, happy path read→quiz→correct→advance, incorrect→reveal+next, exit dialog).
- `docs/wiring-map.md` — "Story Time Game (React — Slice 3.12)" cause/effect chain.


#### Learning Flow Redesign — prerequisite for Slice 3.13 (approved 2026-05-24)

> **Status (2026-05-25): IMPLEMENTED — steps 1–7 shipped** (commits up to `2f42e06` on
> `v3-react-migration`). The stamp regression is closed. **Remaining before merge:** a
> certificate-recalibration product decision + a human play-test of the Word Journey
> stages/unlock modal. Lifecycle model + open loose ends: `docs/learning-path.md`
> ("Word Lifecycle Model" + "Open loose ends"). The build-order list below is kept for
> historical context.

Planning the Word Journey port surfaced two design leaks in the progression model:
graduation is batch-average (a weak word rides its batchmates into "learned"), and the
accurate per-word `wordMastery` signal is ignored in favor of a binary `learnedWords`
stamp that Word Journey alone writes. Approved fix: a **mastery-driven word lifecycle**
(New → Learning → Learned → Due) derived from `wordMastery`, with per-word graduation,
two-step promotion (Word Journey introduces → review games promote), light spacing, and
tiered unlocks (review games gate on *introduced* count, consolidation games on *Learned*
count). Existing users are grandfathered — no game/word access regression.

**Model + mechanics:** [`docs/learning-path.md`](learning-path.md) ("Word Lifecycle
Model"). This landed *before* the Word Journey React port and reshaped it. Build order:

1. Progress-model refactor in `managers/ProgressManager.js` (derived status helpers,
   spacing interval, grandfather migration).
2. Re-tier unlock gates + repoint each game's word pool (`gameLogic.js` gating +
   `src/bridge/*` filters), keeping logic in managers/bridges so Phase 4.4 can still
   retire `gameLogic.js`.
3. **Slice 3.13** below (the React port) against the new model.
4. Repoint review games to the Learning/Due pools; wire Slice 3.16 (Practice) to the Due
   bucket.
5. Mechanics polish (Word Collection Learning/Learned states, level/cert recalibration,
   Continue-recommendation reorder, Stats Due indicator).

Cross-slice notes: **3.14 Memory** word-mode threshold reads *introduced* instead of
learned; **3.15 ABC** is unaffected (still feeds the Reading `abcMastery` gate); **3.16
Practice** becomes the dedicated Due/weak-word surface; **Phase 5** keeps its separate
`expressionMastery`, but the lifecycle helpers should be written generically so it can
reuse New/Learning/Learned/Due.

**Slice 3.13: Word Journey** — multi-stage progression (5 stages). ✅ **Shipped (React,
2026-05-24).** ~1,237 legacy lines → React: `src/bridge/word-journey.ts` + page +
6 components (`WJStageBar`, `DiscoverStage`, `ListenMatchStage`, `SpellStage`,
`SayWordStage`, `RecallStage`, `WJCelebration`). Built against the redesign:
**per-word graduation, no batch ≥60% rule, no mid-journey resume** (an abandoned journey
still banks the per-word mastery earned in the stages played). The bridge does its own
`finishWordJourney` (history/points/coins/unlock-recheck) and never calls the legacy
`endGame`, so the old batch-`graduateWord` path is simply never reached — no gameLogic
edit was needed. Spell stage reuses `SpellingComparison` + voices the word on correct;
Discover keeps the Slice 3.0 per-word listen budget; celebration is the animated
per-journey summary (word + picture + audio + status). Say-word reuses the pronunciation
bridge's mic; full E2E is limited by the speech-recognition stub gap (see Slice 3.11), so
`tests/wj-step1.spec.js` covers render/stage-map/Discover-budget/advance. Honors
`docs/learning-path.md` "Word Journey mechanics" (5 fixed stages, `learningPace`-only batch size).
**Slice 3.14: Memory** — card-flip grid, timer-based. ✅ **Shipped (React, 2026-05-25).**
~1,589 legacy lines → `src/bridge/memory.ts` + `MemoryGamePage` + 3 components
(`MemoryCard`, `MemoryBoard`, `MemoryLevelSummary`). Did NOT follow the Slice 3.1
question→answer template — Memory is a self-contained 3-level run (6/9/12 pairs), like
Word Journey. The bridge does its own per-level finish (stars/coins/personal-best) and
final-run finish (history/totalPoints/unlock-recheck), never calls legacy `endGame`.
Differences / decisions vs legacy `memory-game.js`:
- **Pool = *introduced* words** (`_getLearnedWordSet()` ∩ selected categories), gated at
  `< 6` with a learn-first prompt → divergence from legacy (full bank, no gate); aligns
  Memory with the learning-flow redesign. `gameUnlockOverride` skips the introduced filter.
- **No mid-run resume** (each entry starts at level 1), following the Word Journey
  precedent — avoids the legacy phantom-flip resume bugs entirely (React owns the DOM, so
  the stale-listener / ghost-click / board-generation guards are unneeded).
- Daily-seeded pair selection kept (parity: scores comparable across kids per day).
- Scoring parity: 10 base + (combo≥2 → 5×combo) + first-try 10; stars from mistakes (+4th
  speed star); coins `level*5 + pairs*2 + star-bonus (+combo≥3)`. Per-level personal best
  written to `memoryBest_<userId>` in the **same shape the stats page reads** (`MemoryRecord`).
- Card click voices the English word (`allowOverlap`); a match plays the "<hebrew> is
  <english>" celebration via a `speechGen` ref so navigating away cancels it.
- Files: `src/bridge/memory.ts`, `src/features/games/memory/MemoryGamePage.tsx` +
  `components/{MemoryCard,MemoryBoard,MemoryLevelSummary}.tsx`; registered in
  `reactGames.ts` + `GameHostPage.tsx` (memory was already in `app.js` unlocks, HomePage
  `GAME_ORDER`, and `gameLogic.js`).
- `tests/react-routes.spec.js` — Slice 3.14 block (4 tests: learn-first gate under 6 words,
  level-1 board + single match advances pairs/score, complete level 1 → summary + advance to
  level 2, exit dialog). Cards expose `data-pair`/`data-index`/`data-state` for deterministic
  pair-matching in tests.
- `docs/wiring-map.md` — "Memory Game (React — Slice 3.14)" cause/effect chain.
**Slice 3.15: ABC** — alphabet learning, custom layout. ✅ **Shipped (React, 2026-05-25).**
~778 legacy lines (`games/abc-game.js` + `data/abcData.js`) → `src/bridge/abc.ts` +
`ABCGamePage` + `components/ABCAllMastered`. Followed the Slice 3.9 (Grammar Beginner)
multi-subtype model — one page switching on six question subtypes — rather than the single
question→answer Slice 3.1 template. Differences / decisions vs legacy:
- **Six subtypes in one page**: `match-case`, `letter-sound`, `identify-case`,
  `alphabet-order`, `word-picture` (all multiple-choice via shared `AnswerGrid`) +
  `say-letter` (speech recognition, reusing the pronunciation Slice 3.11 recognition flow).
  Question generation is delegated unchanged to legacy `generateABCQuestions(20)`.
- **Mastery-driven, NOT learned-word gated**: ABC is a learn-tier game (always unlocked).
  The generator filters out letters at mastery ≥ 0.8 and returns `[]` once all 26 are
  mastered → bridge surfaces `kind: 'all-mastered'` → `ABCAllMastered` congratulations
  screen (🎓) with reset-mastery / back-home, mirroring legacy `showABCMasteryComplete`.
  Reset goes through `gameManager.resetABCMastery()` (wipes `<letter>_abc` keys).
- **20 fixed questions** (legacy registry config), NOT the global `questionsPerGame`
  setting. Questions are pre-ordered by the generator for variety, so never reshuffled.
- **Audio gate**: the four letter-sound subtypes hide options (`AnswerGrid hidden`) until
  the letter phonetic auto-plays (voice-readiness poll, listening-Slice-3.2 model);
  `word-picture` shows options immediately and voices the *word*; `say-letter` has no gate.
- Scoring 10 pts/correct via `scoreManager`; `recordWordAttempt(letter, 'abc', …)` feeds
  `<letter>_abc` mastery; index advances on every answer (correct OR wrong). Correct
  auto-advances after 1.5s; wrong reveals the correct option, voices it, and shows Next.
- `say-letter` matching ported verbatim from legacy (transcript contains phonetic/letter,
  or Levenshtein ≤ 2). Graceful degradation: unsupported recognition shows a message + a
  skip button (no Playwright coverage of the mic path — same stub gap as Slice 3.11).
- Resume via the generic `savedGame_<userId>_abc` state (Grammar Beginner bridge pattern).
- Files: `src/bridge/abc.ts`, `src/features/games/abc/ABCGamePage.tsx` +
  `components/ABCAllMastered.tsx`; registered in `reactGames.ts` + `GameHostPage.tsx` (abc
  was already in `app.js` unlocks, HomePage `GAME_ORDER`, and `gameLogic.js`).
- `tests/react-routes.spec.js` — Slice 3.15 block (5 tests: audio-gated reveal + correct
  advance, incorrect → reveal + Next, resume mid-session, all-26-mastered congratulations,
  exit dialog). Tests inject deterministic `match-case` saved state to dodge the random
  `say-letter`/mic path.
- `docs/wiring-map.md` — "ABC Game (React — Slice 3.15)" cause/effect chain.
**Slice 3.16: Practice** — weak-word review, meta-game. ✅ **Shipped (React, 2026-05-25).**
The dedicated **Due/weak-word review** surface under the redesign, and the **last game type
to migrate — Phase 3 game migration is now complete** (every catalog game runs in React).
~289 legacy lines (`games/practice-game.js`) → `src/bridge/practice.ts` + `PracticeGamePage`
+ `components/PracticeEmpty`. Reuses the **Pronunciation Slice 3.11 mechanic** (mic → compare),
so the page is a near-clone; what differs is the *pool* and *persistence*:
- **Pool = Due-first Learned set** (redesign §5/§6): `progressManager.getDueWords()` front-loaded,
  then `getWordsByStatus('learned')` minus the Due ones, each `{word,category}` mapped to a full
  question via `gameData.pronunciation` (same convert shape). Capped at `questionsPerGame` (10).
  Divergence from legacy, which drew *struggling* words (mastery < 0.5). `gameUnlockOverride`
  practices the whole bank.
- **No resume** — practice is never persisted (legacy `saveGameState`/`loadGameState`
  special-case `practice`); `beginPracticeSession()` is always fresh, no save on each attempt.
- **Scored + banked** — `finishPracticeSession()` is self-contained (updateProgress +
  `saveGameScoreToHistory('practice')` + totalPoints delta + `checkAndUnlockGames` +
  saveUserProgress), and **never calls the legacy DOM `endGame`** (its practice branch assumes
  `#practice-game` markup). This is a deliberate divergence: legacy practice was "session-based,
  no scoring"; the React version scores it for parity with every other game's RewardModal.
- 0 Learned words → `kind:'learn-first'` → `<PracticeEmpty>` ("nothing to review yet" → Word Journey).
- Speech helpers (`startPronunciationRecording` etc.) are GAME_TYPE-agnostic, re-exported from
  `bridge/pronunciation` rather than duplicated.
- Files: `src/bridge/practice.ts`, `src/features/games/practice/PracticeGamePage.tsx` +
  `components/PracticeEmpty.tsx`; registered in `reactGames.ts` + `GameHostPage.tsx`; added to
  HomePage `GAME_ORDER` (practice tier — was missing); already in `app.js` UNGATED_GAMES +
  `gameLogic.js` registry.
- `tests/react-routes.spec.js` — Slice 3.16 block (3 tests: empty state, Due-pool capped render,
  exit dialog). Mic path uncovered (Slice 3.11 `webkitSpeechRecognition` stub gap).
- `docs/wiring-map.md` — "Practice Game (React — Slice 3.16)" cause/effect chain.

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

### Post-Wave additions (2026-05-25)

Driven by play-feedback. All shipped on `v3-react-migration`, verified via Playwright.

1. **Listening auto-play on resume.** Listening was the only game that suppressed
   its entry auto-play when resuming a mid-session save (`autoPlayedRef` set true
   on restore), so re-entry felt inconsistent vs Grammar Beginner / Word Journey.
   Fix: it now always voices the word on entry; on resume it skips the budget /
   reveal-gate counters (via `resumedRef`) so `audioPlaysLeft` stays correct.
   `ListeningGamePage.tsx`. (Grammar Beginner uses a flat 300ms timer with no
   readiness check and skips auto-play for `sounds-right`; Word Journey drives
   audio per-stage — documented for future parity questions.)

2. **Word Journey stage bar relocated** into the hero, left of the "מסע מילים"
   banner, via the new optional `GameHero` `heroAside` slot (forwarded through
   `GameScreenShell`/`GameHeader` props). Title invariant preserved.

3. **Shared blank-fill engine** (`shared/BlankFillGamePage.tsx` + `bridge/grammarLike.ts`)
   — one parameterised page + generic bridge for focused fill-in-the-sentence
   grammar games. First two games on it:
   - **Articles (`articles`)** — a / an / the, picture-prompted, vowel/consonant
     rule + "the" for specific things. Data: `data/articlesData.js`.
   - **Progressive tenses (`progressive`)** — present + past progressive
     (is/are/was/were + -ing), action-emoji prompts. Data: `data/progressiveData.js`.
   Both always-unlocked (supplementary practice), registered everywhere a React
   game must be. To add more (plurals, prepositions, …) follow the recipe in
   CLAUDE.md "Shared game primitives" — do NOT clone the grammar page.

4. **Homepage redesign.** Replaced the developer-dashboard layout (dev-facing
   copy, 4 stat cards + 3 quick links + verbose tier grid) with a kid-facing
   home: mascot greeting, one big "let's play" CTA (continue target), glanceable
   stat chips, and lighter icon-forward tiles. Kept the four `home-tier-*`
   sections (the learn→practice→challenge→test guidance structure) + `home-hero`
   testid. `HomePage.tsx`.

   Curriculum gaps still open (suggested, not built): numbers/colors/shapes,
   opposites, question-words game, dedicated plurals + prepositions games. The
   general `grammar` game still carries only ~2 article + 4 present-continuous
   questions — the new dedicated games supersede those for practice.

### Phonics game (2026-05-26)

Status: shipped on `v3-react-migration`, verified via Playwright (5 tests, non-mic
subtypes). Driven by a request to teach multi-letter sounds (sh/ch/th, ee/oo, …)
that the ABC game can't — ABC teaches letter *names* (ay/bee/see) + case/order,
none of which apply to a digraph. **New dedicated game, not an ABC extension.**

- **`משחק צלילים` (`phonics`, icon 🔡)** — covers consonant digraphs (sh, ch, th,
  ph, wh, ck, ng) + vowel teams (ee, oo, ai, oa, ea, ay). Always-unlocked, "learn"
  tier beside ABC. Mastery is per-sound under `<sound>_phonics` (e.g. `sh_phonics`),
  exactly mirroring ABC's `<letter>_abc` model: generator filters sounds at mastery
  ≥ 0.8 and returns `[]` once all are mastered → congratulations screen.
- **Three subtypes in one page** (ABC multi-subtype model): `hear-pick-word`
  (hear an example → tap the matching picture; media AnswerGrid, audio-gated;
  picture options show **NO word text** — a visible word lets the child eye-scan
  the spelling for the target digraph instead of listening, so every emoji in
  the bank must be unique + recognisable on its own, e.g. feet 👣 vs foot 🦶),
  `see-pick-sound` (see a picture + hear it → choose the sound; text AnswerGrid
  with Hebrew gloss sublabels, audio-gated), `say-sound` (mic, lenient transcript
  match — **no Playwright coverage**, same `webkitSpeechRecognition` stub gap as
  ABC say-letter / Pronunciation / Practice).
- Files: `data/phonicsData.js` (sound bank + `generatePhonicsQuestions` +
  mastery helpers), `src/bridge/phonics.ts` (clone of `abc.ts`;
  `resetPhonicsMastery` wipes `*_phonics` keys directly since there's no legacy
  gameManager reset — game is React-only), `src/features/games/phonics/`. Wired in
  `reactGames.ts`, `GameHostPage.tsx`, `gameLogic.js` (no-module register, like
  articles), `app.js` (gameUnlocks + gameTypeStats defaults + UNGATED_GAMES),
  `HomePage.tsx` GAME_ORDER. No `data/_loader.js` entry needed (bridge imports the
  generator directly, like ABC — not the blank-fill `window.gameData` path).

### UX polish pass (2026-05-27)

A cross-cutting play-test pass (no new games). WHY each change:

- **One-screen games (no silent scroll).** `GameScreenShell` gained `fitViewport`
  (now **default `true`**): the shell is `100dvh`, header/title/progress/footer are
  pinned, and only `<main>` scrolls if content overflows — so the "next" button is
  never pushed below the fold. Any game can opt out with `fitViewport={false}`.
- **nikud number-drop fix.** `utils/nikudDOM.js` Case D overwrote a parent's whole
  `textContent` when it had no child *elements*, wiping React's adjacent text nodes
  (`סיפור {n} מתוך {m}` → "ספור"). Now it only does so for a lone text node; else it
  wraps. See memory `project_nikud_dom_clobbers_react_numbers`.
- **Mic games (Pronunciation + Practice).** Removed auto-advance on a *correct*
  answer (regression) — the result/replay stays up and "next" shows for both
  outcomes. The results card now **replaces** the mic button when answered (opaque),
  killing the stacked-scroll.
- **Story Time.** Bigger Hebrew title/subtext; a "▶️ הקרא את כל הסיפור" button that
  reads every sentence and highlights the active *sentence* (not its play button);
  English question audio — added `questionEn` to every `data/stories.js` template
  (slot-resolved in `buildStoryFromTemplate`, `StoryQuizQuestion.questionEn`), spoken
  when each quiz question appears.
- **Grammar games.** Grammar-beginner translation moved *inside* the prompt card
  (was a floating pill). Standalone Grammar: the Hebrew sentence blank + option
  glosses now stay hidden until answered (they previously gave the answer away).
- **Memory.** Hebrew-only audio on a match; **no wrong-pair SFX** (a non-match isn't a
  mistake). Card sizing: `side = √(AREA/cardCount)` (AREA bumped to 1944 ≈ 2×), capped by
  **both** width-fit AND a viewport **height-fit** (`(100dvh − CHROME)/rows`) so the board
  fits one screen with no scroll on any level; picture/word scale with `cqw` (the card is a
  container-query context — reusing the grid-track `var()` for `font-size` was the
  regression that hid the pictures, since `100%` means width vs. font-size by context).
  **Level 3 is 6 columns / 4 rows** (8×3 was width-bound → smaller cards). **No auto-advance
  on level clear:** the board stays up (matched cards tappable to replay the word) with a
  stars banner + a pinned "רמה הבאה" / "סיים משחק" button; only that tap advances/finishes.
- **Home.** Reactive owl mascot (framer-motion idle float + tap cheer + sparkle +
  spoken encouragement); tappable greeting (speaks "שלום {name}") and stat pills
  (distinct SFX via `playEffect` in `bridge/feedback`); "בוא נשחק" now **rotates**
  among unlocked review games (`getContinueTarget`, `REVIEW_ROTATION`) instead of
  always Listening. Top-bar nav links spread full-width; profile/settings live only
  in the avatar dropdown.
- **Confetti hiccup.** `warmUpConfetti()` (bridge/feedback, called once from
  `App.tsx`) pre-inits canvas-confetti so the first celebration doesn't stutter.

### Density / polish follow-ups (2026-05-28)

- **Reading density.** The game fits one screen, so its actions (נקה / בדוק /
  השאלה הבאה) render **inline** under the letter bank instead of the pinned
  `GameScreenShell` footer, and the content is **top-aligned** (not vertically
  centered) — one compact cluster, no big gap before a bottom-pinned bar. Prompt
  card compacted (smaller picture, `max-w-md`, tighter padding). Pattern worth
  reusing for the Word Journey spell stage.
- **Memory polish.** Matched pair does a brief scale "pop" (`memoryMatchPop`
  keyframe — a CSS gradient can't tween from the solid face color, so motion is
  the cue); tapping a matched card replays **the language it shows** (Hebrew card
  → Hebrew, English card → English).
- **Home mascot bubble (RTL).** The encouragement bubble uses `start-0` (right
  edge in RTL) so it grows inward/left and never clips the page edge — `end-0`
  resolves to `left:0` in RTL and grew off-screen.

**Deferred / optional (discussed, not applied — pick up anytime):**

- **Pronunciation right-pair Hebrew delay** — shrink the ~400ms pre-Hebrew delay
  to ~200ms so the celebration lands right after the "ding" (reduces the stray-tap
  window). Constant in `PronunciationGamePage` `playMatchedPairAudio`-equivalent.
- **Memory timing tweaks** — `FLIP_BACK_MS` 1000→~800 for a snappier wrong-pair
  flip-back; consider `allowOverlap:false` on tap audio for crisper sound.
- **Reuse Reading's compact layout** (inline actions + top-aligned cluster) for the
  **Word Journey spell stage** for consistency.
- **Coin stat-pill sound** — currently the "victory" fanfare (no dedicated coin SFX
  exists); options: synthesize a coin "cha-ching" or have the pill speak its value.
- **Memory sizing knobs** — `AREA_REM2`, `CHROME_REM`, and per-level `columns`
  (`bridge/memory.ts`) are the levers if cards feel too big/small on any level.

## Planned feature slices (backlog)

### Slice C1: Launchable Courses page — SHIPPED (3-game MVP, 2026-05-27)

**Status: SHIPPED.** Vocabulary, Listening, Picture-Match launch from `/courses`, scope to
the topic's words, credit the topic on finish, and return to `/courses`. Covered by two
Playwright tests (`react-routes.spec.js` → "Slice C1: Launchable Courses"). What actually
landed vs. the spec below:

- **Prereq bug fixed:** `bridge/courses.ts` resolved its manager via `window.appManager`,
  which **does not exist** — the real globals are `window.courseManager` /
  `window.app.courseManager`. So `getAllCourses()` always returned `[]` and the React
  Courses page silently rendered its empty state. Both `courses.ts` and `courseSession.ts`
  now resolve `window.courseManager ?? window.app?.courseManager`. The old Slice 1.4 test
  missed this because it only asserts the word "קורסים", present in the empty-state copy too.
- **Crediting is automatic** — no new finish bridge call. React finish → `endGame` →
  (`gameLogic.js:3404`) `app.updateProgress(…, getProgressUpdateContext())` →
  (`app.js:1641`) `_trackCourseActivityFromGame` → `courseManager.completeGameActivity({topicId})`.
  `getProgressUpdateContext` reads `currentTopicId`/`currentTopicActivity`, so a set context
  at finish is sufficient.
- **MVP = 3 games**, then `true-or-not` landed as a **fast-follow (2026-05-28)** — now 4.
  `true-or-not` builds its pool from learned words via `legacy.buildQuestions` (not
  `getScopedQuestionPool`), and its `learnedPool.length >= 4 ? learnedPool : allWords`
  fallback silently un-scopes a sparse topic. Fix: in course mode the bridge builds the
  pool from `gameManager.getActiveTopicWords()` (the topic word objects) — **never falling
  back to `allWords`** — and skips the ≥5-learned gate + mid-game resume, mirroring the
  other three. Page routes back to `/courses` on exit via `getActiveCourseSession`. Added
  `'true-or-not'` to `LAUNCHABLE_ACTIVITIES` (CoursesPage) and a dedicated Playwright test
  (sets the course context directly, since no course topic lists `true-or-not` as an
  activity yet). NB: like `picture-match`/`listening`, this is forward-looking — the badge
  only becomes clickable if a topic's `activities` array includes the game.
- **Two invariants** baked into the bridge + pages (see `project_launchable_courses_c1`
  memory): (1) never route through legacy `performGameSwitch` — `gameLogic.js:1733` clears
  the course context on a game-type mismatch; set context directly. (2) Clear the context
  only on USER-triggered exit (RewardModal exit / abort), never synchronously at finish —
  `endGame` is async and reads the context late, so an early clear would race the credit.
  `abort<Game>Session` does NOT clear course context, so the abort path clears it explicitly.
- **Course mode** in the 3 bridges (`isCourseMode(gameType)` = `currentTopicId` set AND
  `currentTopicActivity === gameType`) skips both the mid-game resume and the learned-word
  filter (topic words usually aren't learned yet — that's the point).

**Original spec (for reference):**

#### Slice C1 spec (planned 2026-05-27)

**Goal:** make the Courses page actionable. Today `CoursesPage.tsx` is a read-only
progress dashboard (Course → Unit → Topic → Activities, mastery %, lock state). Make
each unlocked topic's activity launch the matching game **scoped to that topic's
words**, then on finish credit the topic and return to `/courses`.

**The mechanism already exists — confirmed:**
- Legacy `gameManager.setCourseActivityContext({ topicId, activityType, topicWords })`
  (`gameLogic.js:658`) sets `currentTopicId` / `currentTopicActivity` / `currentTopicWords`.
- `gameManager.getScopedQuestionPool(gameType)` (`gameLogic.js:1886`) **already returns the
  topic-scoped pool** when those are set and `currentTopicActivity === gameType`. Any React
  bridge that builds its pool via `getScopedQuestionPool` (e.g. `bridge/vocabulary.ts:150`)
  inherits scoping for free.
- `CourseManager` auto-detects topic coverage from a finished session's words (`CourseManager.js`
  ~455–490: ≥3 matched words AND ≥60% coverage → best-match topic), and advances/unlocks the
  next topic. Legacy parity entry point: `app.js:497 startTopicActivity()`.

**Work to do:**
1. **Bridge** — new `src/bridge/courseSession.ts` (or extend `courses.ts`): `startTopicActivity({topicId, activityType, topicWords})` → `courseManager.startTopic(topicId)` + `gameManager.setCourseActivityContext(...)`; `getActiveCourseSession()` → `{topicId, activityType, returnTo:'/courses'} | null`; `clearCourseSession()` (clear the legacy context — verify the clear path in `gameLogic.js`). Never touch `window.*` outside the bridge.
2. **CoursesPage** — make a topic's activity badges (or a per-topic ▶️) clickable when the topic is unlocked → `startTopicActivity()` → `navigate('/game/'+activityType)`. MVP to React games that scope cleanly via `getScopedQuestionPool`: **vocabulary, listening, picture-match, true-or-not** first; expand later. Mirror the legacy activity-picker UX (`app.js:478`).
3. **Course-mode adaptations in the game bridges/pages:** when a course session is active, (a) **skip the learn-first gate**, and (b) **skip the "learned-only" pool filter** (topic words are usually NOT yet learned — that's the point), e.g. gate `bridge/vocabulary.ts:152` behind `!courseMode`. On finish: run the normal finish (feeds CourseManager coverage → auto-credits the topic), then `clearCourseSession()` and route to `getActiveCourseSession()?.returnTo` (`/courses`) instead of `/home` (RewardModal `onExit` + ExitConfirm). Verify the React finish path actually feeds CourseManager's coverage recorder; if not, add a bridge call passing the session word list on finish.
4. **Test:** Playwright — seed user, open `/courses`, expand an unlocked course, tap a topic activity, assert route `/game/<activity>` with the scoped words, complete it, assert return to `/courses` + topic mastery/progress advanced.

**Risks:** not every activity supports scoped pools — memory/story/abc/phonics build their own pools and would need explicit topic-word support; keep them out of the MVP launcher. Audit the learn-first/learned-filter gating per activity bridge.

### Slice INFRA1: Network / public / app access — SPIKE (investigate, no commit)

Investigate exposing the app beyond `localhost` and pick a path:
- **LAN access:** Vite `--host` (or `server.host` in `vite.config`) so other devices hit `http://<lan-ip>:3002`; bind `server.py` to `0.0.0.0`. **Gotcha:** the mic games (Pronunciation, Practice) and TTS need a **secure context** — `getUserMedia` + Web Speech only work on `https://` or `localhost`, so LAN needs the `server.crt`/`server.key` HTTPS path (already referenced in `CLAUDE.md` dev setup) + firewall allowance.
- **Public access:** `npm run build` → static `dist/`; decide the fate of the Python `/api/*` backend (host it, or make endpoints optional — progress is in `localStorage`, per-device, so the SPA mostly stands alone). Quick-share via a tunnel (cloudflared/ngrok); durable via static host (Netlify/Vercel/GH Pages) + API host or stub.
- **As an app:** **PWA** (manifest + service worker — installable + offline) is the lowest-friction fit for a static SPA → recommend first; Capacitor/Tauri/Electron only if app-store distribution is needed.
- **Deliverable:** a recommendation + concrete steps for the chosen path, with the HTTPS/secure-context requirement called out as the main blocker for mic games off-localhost.

## Phase 4: Cleanup and Consolidation

Objective: remove dead legacy code and shrink maintenance burden.

### Slice 4.0: Code-split React game pages — SHIPPED (2026-05-29, with a caveat)

Vite's post-build warning had been flagging the main bundle as oversize (~1.32 MB minified / 341 KB gzipped) since the Wave 1 game migrations started landing. Every first-visit user downloaded, parsed, and executed all React games before anything interactive rendered.

**What shipped:**

- Every static game-page import in `src/features/games/GameHostPage.tsx` is now `React.lazy(() => import('./<game>/<Page>').then(m => ({ default: m.<Page> })))` — the `.then` maps our named exports to the default that `React.lazy` requires. The resolved `<ReactGame />` is wrapped in `<Suspense>` with a `GameScreenShell` fallback whose back button still works during chunk fetch.
- `RETIRED_GAMES` redirect still wins: `GameHostPage` returns `<Navigate>` **before** the `<Suspense>` branch, so `/#/game/word-builder` redirects with no flash.
- `vite.config.ts` `manualChunks`: `vendor` (React/Router/Lucide + small utils) and `motion` (framer-motion + motion-dom — only `HomeMascot` uses it) split out of the app chunk.
- Result: **22 per-game chunks** (each 0.3–26 KB), `vendor` 336 KB, `motion` 125 KB, and the main `index` chunk down from 1.32 MB → **632 KB minified / 149 KB gzipped**. A first-visit user no longer downloads any game code until they open a game. **This is the real win and it is done.**

**Caveat — the "<500 KB main chunk" acceptance bar is NOT met, and can't be until Phase 4.4:** `index.html` loads the legacy vanilla-JS graph (`consoleLogger.js`, `data/_loader.js`, `gameLogic.js`, `app.js`) as eager `<script type="module">` tags. **Vite fuses sibling module-script entries into the SAME entry chunk as `src/main.tsx`** (the built `index.html` has a single `<script>` tag). Entry modules can't be reassigned by `manualChunks`, so this legacy bootstrap can't be split out. Measured composition of the 632 KB index: ~894 KB-original of legacy (≈500 KB minified — `gameLogic` 163 KB, `app.js` 73 KB, managers, and the eagerly-imported legacy game modules) + ~259 KB-original of React (≈145 KB minified). So legacy alone is ~500 KB minified — the bar is unreachable while that legacy is eager. It shrinks when **Phase 4.4** deletes the legacy game files (the plan already noted 4.4 owns "the legacy game files that share the bundle"). De-booting legacy via a dynamic import was rejected: it introduces a React-vs-legacy boot-order race for a cosmetic metric.

**Verified:** `npm run build` clean (tsc + vite); 27 Playwright route tests green across vocabulary, courses-launch, true-or-not, the word-builder retired-redirect spec, reading (shared `LetterSlots`/`SpellingComparison` chunk), and memory (self-contained run) — lazy chunks load on demand without breaking navigation.

**Revised acceptance:**

- ✅ Each React game is its own chunk in `dist/assets/`.
- ✅ Playwright route tests pass; retired-games redirect still fires with no Suspense flash.
- ✅ Games no longer eager-loaded; main chunk down ~52% (1.32 MB → 632 KB).
- ✅ Main chunk <500 KB minified — **MET by Slice 4.4.a (2026-05-30)**: deleting the 15 eager `games/*.js` modules dropped the `index` chunk to **495.01 KB** minified (121 KB gzipped). The remaining legacy in the chunk is `gameLogic.js`/`app.js`/`managers/*` (the engine the React bridges still drive) — its removal is deferred to **Slice 4.4.b**.

### Slice 4.1: Retire Legacy Home Markup/CSS — SHIPPED (2026-05-30)

- ✅ removed legacy welcome/home sections + their inline JS handlers from `index.html` (welcome-screen, tier-sections, continue-hero, game-cards, `updateHomeCardStates`, hash-nav handler). The post-login welcome-chime listener is kept; React Router owns routing and React owns the home screen.
- ✅ deleted related CSS from `styles.css` (~650 lines: `.welcome-*`, `.tier-*`, `.continue-hero*`, `.game-card*` home variants, `.home-compact/-streak/-words*`)
- ✅ removed `hub-animations.js` (and its now-dangling `purgecss.config.js` content+safelist entries: `home-compact`, `game-card-featured`, `tier-badge-`, `tier-section`, `continue-hero`, `welcome-`)
- ✅ tests repointed: the `Game Gating` block in `tests/smoke.spec.js` (4 tests) targeted the now-deleted legacy `.game-card[data-game]` + `.locked` class — repointed to the React `[data-testid="home-game-card"]` + `data-locked` attribute. The `slice-3.7.1` "word-builder not on home" test was repointed off `.game-card` (it had become vacuously true).

**Gotcha uncovered (see `project_react_home_gating_persisted` memory):** the React home computes lock state from **persisted** `gameUnlocks` via the bridge, and treats an *absent* entry as **unlocked** (`unlocks[id]?.unlocked === false`). A fresh user's default gameUnlocks live only in `window.app.userProgress` (in-memory) until the first `saveUserProgress()` — `loadUserProgress()` returns defaults but never persists them. The deleted legacy welcome screen masked this by reading the in-memory object directly. Net: a brand-new user with no saved progress currently sees *all* games unlocked on the React home (pre-existing since Phase 1; not introduced here). The fresh-user gating test now flushes defaults via `window.app.saveUserProgress()` before asserting.

**Carry-forward for Slices 4.2–4.4:** retiring legacy DOM will keep stranding tests that assert against the *hidden* legacy tree (visible-or-not, Playwright matches the class attribute). When deleting legacy markup, grep specs for the removed selectors and repoint to the React `data-testid`/`data-*` equivalents — and check the repointed assertion isn't vacuously true (count 0 because the element class no longer exists anywhere).

### Follow-up FU-4.1: Fresh user sees all games unlocked on the React home

Surfaced (not introduced) by Slice 4.1. **Bug:** a brand-new user with no persisted progress sees *every* game unlocked on `/#/home`. The React home gates on **persisted** `gameUnlocks` (`useGameUnlocks` → `bridge/games.getAllGameUnlocks`, absent entry = unlocked), but `app.js loadUserProgress()` returns the locked defaults **in-memory only** and never saves them — first persist is the first `saveUserProgress()` (after a game). The retired legacy welcome screen masked this by reading in-memory `window.app.userProgress`.

Severity: low-moderate (a child could open e.g. Grammar/Reading with zero learned words; they'd just hit the empty/learn-first prompt). Pre-existing since Phase 1.

Fix options (pick when scheduled): (a) persist seeded defaults at user-create/login in `app.js`; or (b) have `bridge/games.getAllGameUnlocks` fall back to the default unlock map when the persisted map is empty/absent. Prefer keeping gating *computation* in legacy ProgressManager until Phase 4.4; do not re-derive gating inside the React home. Add a Playwright case asserting a fresh user (no `saveUserProgress()`) shows `data-locked="true"` on gated cards. See `project_react_home_gating_persisted` memory.

### Slice 4.2: Retire Header Legacy System — PARTIAL (2026-05-30, React shell de-wired)

**Dependency discovered:** `components/top-header.js`, `components/header-score.js`, and the header CSS (`.top-header`/`.header-*`/`.case-toggle-btn`/`.nikud-toggle-btn`) are **shared** with the legacy `stats.html`/`settings.html`/`words.html` pages, which can't be deleted until 4.3 — and 4.3 is itself gated on porting Custom Words + Word Images to React (see line ~885). So the files + CSS **cannot be deleted in 4.2 without breaking the legacy pages**. They are moved to **Slice 4.3** (delete alongside the pages that import them).

What 4.2 **did** ship (non-breaking; the legacy `#top-header` was already permanently hidden by `body.react-shell-active !important`, since Phase 3 made every route React-driven):
- ✅ `index.html`: removed the `initTopHeader({activePage:'home'})` bootstrap + the `window.showGameInHeader`/`window.setHeaderMode` exposes. React owns the header (`TopNav`/`MobileTopBar` on hub routes, `GameHeader` in games). The case/nikud init the legacy header did is redundant: React `textPrefs` uses the same `globalLetterCase` key + `lowercase-mode` class, and `window._showNikud` is set at module load by `data/_loader.js → utils/nikud.js`.
- ✅ `gameLogic.js`: removed the two guarded `window.setHeaderMode('hub')` / `window.showGameInHeader(gameType)` calls (they were already no-ops once the globals were gone).
- ✅ `src/styles/globals.css`: dropped `#top-header` (4.2) and the already-dead `#welcome-screen` (4.1) from the `react-shell-active` suppression rule; kept `#user-hub-screen` + `.app-layout`.

**Moved to Slice 4.3 (do together with deleting the legacy pages):** delete `components/top-header.js`, `components/header-score.js`, and the header CSS blocks in `styles.css`.

### Slice 4.3: Retire Legacy Pages — SHIPPED (2026-05-30, Python-free, mobile-ready)

Sequenced sub-slices (full design: approved plan / `project_custom_content_bridge` memory). The runtime was already Python-free; `server.py` only backed optional save-to-source + a nikud CORS proxy. **End state: the app runs with `npm run dev` alone — no `/api/*` calls remain; `server.py` is now an optional maintainer tool.**

**Follow-up FU-4.3-idb:** move image-override blobs from localStorage to IndexedDB (with boot-time async hydration of `window.wordImageOverrides` *before* any game route renders — 8 game pages read it synchronously). Do when the ~5 MB localStorage quota bites. The async `customContent` bridge makes it a one-file change.

- ✅ **4.3.a (2026-05-30)** — `src/bridge/customContent.ts`: async storage seam for custom words + image/translation overrides + Export/Import. Promise-based **on purpose** so a future Capacitor mobile port swaps the backend (localStorage → IndexedDB → Capacitor Preferences) in one file. Backed by localStorage today, reusing the existing keys (`customWords_global`, `wordImageOverrides`, `wordTranslationOverrides`) so the legacy boot path keeps working. **Image blobs stay in localStorage, NOT IndexedDB** — 8 game pages + `utils/imageRenderer.js` read `window.wordImageOverrides` *synchronously*; the bridge keeps that window object hydrated. IndexedDB-for-blobs is a tracked follow-up (FU-4.3-idb) to do when the ~5 MB quota actually bites.
- ✅ **4.3.b (2026-05-30)** — Custom Words ported to React: `src/bridge/wordImport.ts` (ported `utils/wordImporter.js`; browser-direct Anthropic call) + `CustomWordsPanel.tsx` in `AdvancedToolsTab` (key entry, paste-import + live log, list+delete, JSON Export/Import). Replaced the `settings.html` link. `/api/write-text` save-to-source dropped. Tests: 3 new in `react-routes.spec.js` Settings block; full suite 120 green.
- ✅ **4.3.c (2026-05-30)** — Word Images & Translations ported: `WordImagesPanel.tsx` (grid + category/search filters, per-word image via URL or file→base64, inline translation edit, clear-all) backed by `customContent`; `getAllWords()` accessor added to `bridge/categories.ts`. Dropped `/api/write-image|fetch-image|write-text`. **Translation overrides now apply at boot** in `data/_loader.js` (before nikud + gameData build) — the legacy path only worked after Python save-to-source. Last `settings.html` escape hatch removed from `AdvancedToolsTab`. Tests: 4 new (no-escape-hatch, image set/reset live via `window.wordImageOverrides`, translation override). 9 Settings tests green.
- ✅ **4.3.d (2026-05-30)** — Nikud Python-free: `utils/nikud.js` `loadNikudMap()` merges static `data/nikud-map.json` + a localStorage `nikudCache`; `fetchNikudFromAPI()` calls Dicta Nakdan **directly** (CORS-fail → `{}` → graceful un-niqqud fallback); `persistNikudEntries()` writes the cache instead of source. No `/api/enrich-nikud`.
- ✅ **4.3.e (2026-05-30)** — Deleted `settings.html`/`stats.html`/`words.html`, `settings.js`/`stats.js`, `components/top-header.js`+`header-score.js` (parked from 4.2), `utils/wordImporter.js`+`fileSystemWriter.js`+`wordImageManager.js`. Removed `<script src="settings.js">` from `index.html`. Removed the dead header CSS from `styles.css` (the `.top-header`/`.header-*` section + the `.case-toggle-btn`/`.nikud-toggle-btn` block — ~290 lines; the legacy settings/stats/words page CSS was inline in those HTML files, deleted with them). Pruned `purgecss.config.js` (dropped the 3 HTML pages + dead `header-mode`/`wim-*` safelist). Removed the 2 legacy-page smoke describes; repointed the `slice-3.7.1` stats test to the React `/#/stats` route. NOTE: `utils/imageRenderer.js` (runtime `window.wordImageOverrides` hydrator) is **kept** — distinct from the deleted `wordImageManager.js` (settings editor).
- ✅ **4.3.f (2026-05-30)** — Zero runtime `/api/*`: removed the (already-commented) `/api/log-error` from `error-tracker.js` and the now-unused Vite `/api`→:3000 proxy. `server.py` kept as an **optional** maintainer tool (docstring updated). Updated `CLAUDE.md` Dev Setup + `docs/dev-setup.md` (one process: `npm run dev`; mic works on localhost) + the `customWords_global` (no `v2_` prefix) key nit.

### Slice 4.4: Retire Legacy Game Code

Originally one slice, but investigation (2026-05-30) confirmed the two recorded blockers split it cleanly into **4.4.a (delete the game *UI* layer)** and **4.4.b (delete the *engine* + auth)**. 4.4.a is done; 4.4.b is deferred and large.

#### Slice 4.4.a: Retire Legacy Game UI Files — SHIPPED (2026-05-30)

The 15 `games/*.js` files were **pure DOM-render methods** (`loadVocabularyQuestion`, `checkXAnswer`, …) bound onto the GameManager, reachable only through the legacy `loadQuestion`/`switchGame`/`startGame` render path — i.e. the `bridge/games.ts launchGame` fallthrough, which **no game hits** (all 18 are in `REACT_GAME_IDS`). React renders every game and drives the engine through the bridges, so this layer was dead and deletable.

- ✅ deleted all 15 `games/*.js`.
- ✅ **Blocker #2 resolved** — moved the `window.wordImageOverrides` boot-hydration out of the deleted `utils/imageRenderer.js` into `data/_loader.js` (eager, runs before `/src/main.tsx`, already the boot home for the sibling parent-content keys `customWords_global` / `wordTranslationOverrides`); deleted `utils/imageRenderer.js`. The runtime setter in `src/bridge/customContent.ts` stays the owner of live updates. See `project_custom_content_bridge` memory.
- ✅ **One live exception ported** — `games/true-or-not-game.js`'s `buildQuestions` was a *pure question generator* the React bridge consumed via `window.trueOrNotGame`. Ported verbatim into `src/bridge/true-or-not.ts` as `buildTrueOrNotQuestions` (no DOM/`this`); dropped the `window.trueOrNotGame` readiness gate in `TrueOrNotGamePage.tsx`. **(All other 5 app.js-group bridges — word-journey/memory/story-time/scramble/fill-blanks — were already self-sufficient: they generate questions via engine methods (`getWordJourneyWords`) or data modules (`getStoriesForSession`/`getRandomSentences`) + self-built level arrays, NOT the legacy instances.)**
- ✅ removed the 9 game-module imports + method bindings in `gameLogic.js` and the 6 game-class imports + `initializeGameInstances()` in `app.js`.
- ✅ neutralized the now-unreachable `bridge/games.ts launchGame` fallthrough to a `console.warn` (fires only for an unknown gameId).
- ✅ **Slice 4.0 <500 KB bar MET**: `index` chunk 632 KB → **495.01 KB** minified.
- ✅ all 147 React Playwright tests green (incl. true-or-not, story-time, word-journey, memory, picture-match).

**Deliberately left for 4.4.b (low-risk decision):** `gameLogic.js` still contains its legacy DOM launch/render path (`loadQuestion` switch, `nextQuestion`, `setup*EventListeners`, `startGame`'s render tail, and guarded `window.<game>Game` references in `endGame`/`saveGameState`/`loadGameState`). It is **formally unreachable** now (launchGame neutralized; no game falls through) and its guarded blocks safely skip (instances are `undefined`). Gutting it from a 168 KB file was judged not worth the regression risk once the bundle bar was already met — it goes away wholesale when 4.4.b removes the engine. **Behavior note:** story-time's `mgr.endGame` now takes the generic `else` percentage branch (real `scoreManager` score) instead of the legacy `window.storyTimeGame.quiz*` block (which React never populated → was effectively 0); verified by tests.

#### Follow-up FU-4.4-imgkey: image-override key casing mismatch (pre-existing)

Surfaced (not introduced) during 4.4.a verification. **Bug:** a parent-set image override renders in most picture games but **NOT in Reading or Word Journey** for the same word. Write side (`src/bridge/customContent.ts` `overrideKey`) stores `${category}:${word}` with the word's title-case as listed from `vocabularyBank` (e.g. `animals:Cat`). Read side is inconsistent: listening/picture-match/pronunciation/practice/true-or-not read `${category}:${word}` (matches), but `ReadingGamePage.tsx:57` and `word-journey/components/WordJourneyPicture.tsx:14` read `${category}:${word.toLowerCase()}` (`animals:cat` → no match). Fix: normalize both sides to one casing (lowercase is the safer canonical form — but check no existing localStorage `wordImageOverrides` keys would be orphaned, or migrate them on read). Severity: low (override silently ignored in 2 of ~7 picture games). Pre-existing, independent of the 4.4.a deletion.

#### Follow-up FU-4.4-nikud: nikud toggle mid-game crashes React game subtree (pre-existing)

Surfaced during the 4.4.b0 manual baseline pass (independent of b0, which is test-only). **Repro:** in any React game (seen in Vocabulary), toggle the nikud control (`header-nikud-toggle`) mid-question → the word + answers vanish, the area shows `טוען…` (loading). Exiting and re-entering recovers it, with the toggle correctly applied.

**Root cause — React ↔ nikudDOM shared-DOM-ownership conflict.** Data Hebrew is stored *plain* (`hebrew: 'אני'`, no nikud); nikud is injected at RUNTIME by `utils/nikudDOM.js`, which walks the **entire body including `#react-root`** and *structurally mutates* React-owned nodes — `processTextNode` Case E does `parent.replaceChild(span, node)` (utils/nikudDOM.js:156) and Case D overwrites `textContent`. On a toggle, `onNikudChanged` re-walks the body (`applyNikudToTree(document.body)`, line 203) at the same time `useTextPrefs`'s `nikud-changed` listener re-renders the game (`showNikud` state). React then reconciles against a DOM whose nodes nikudDOM moved/replaced → it throws → the game subtree unmounts/remounts → the mount effect re-runs `beginVocabularySession`, `session` is briefly null → the `!session` branch renders `טוען…` (which nikudDOM then enriches to `טוֹעֵן…`). Same boundary as the earlier [[project_nikud_dom_clobbers_react_numbers]] fix (Case D lone-text-node guard), but Case E's structural `replaceChild` was never guarded for React.

**Decision (2026-06-01):** do NOT hot-patch mid-b0 (the easy "skip `#react-root`" fix would leave React Hebrew permanently un-nikud'd, since React depends on nikudDOM for injection). **Cure belongs in b1/b2:** move nikud ownership INTO React — a bridge pre-enriches Hebrew from `data/nikud-map.json` so React renders nikud'd text directly, then `#react-root` is excluded from `nikudDOM` entirely (the conflict disappears with the legacy engine). Severity: medium (recoverable; only on a mid-game toggle). **Note for a regression test:** the headless boot path currently fails managers-init for `/#/game/vocabulary` — a working repro needs that solved first (or assert at the nikudDOM unit level that it skips/▷ doesn't structurally mutate a `#react-root` subtree).

#### Slice 4.4.b: Retire the Engine + Auth — IN PROGRESS (blocker #1)

This is the genuinely hard, multi-session part. **Do not start without scoping the engine surface first.**

**Strategy decided (2026-06-01):** *reimplement* the learning logic fresh in React/TS (not a verbatim port). The accepted risk is *silent* regressions, so the mitigation is mandatory: fully MAP the legacy behavior and PIN it with characterization tests against the real legacy modules **first**, then make the rewrite reproduce those captured outputs before deleting anything. Split into four shippable sub-slices, each landing with green tests: **b0** (characterization harness), **b1** (engine rewrite), **b2** (auth rewrite), **b3** (final DOM cleanup). Full scoping + responsibility map: plan file `dynamic-twirling-wren.md`.

##### Slice 4.4.b0: Characterization harness — SHIPPED (2026-06-01)

The safety net. 17 new specs that dynamic-import the **real legacy modules** in-browser (reusing the `learning-lifecycle.spec.js` / `difficulty-gate.spec.js` patterns) and pin shipping behavior so the b1 rewrite is verifiable, not a leap of faith. All predicted golden values matched the legacy engine on first run; full suite **164 passed** (147 prior + 17 new).
- `tests/engine-pure-logic.spec.js` (10) — `ScoreManager` (calculateCoins/calculatePercentage/getPerformanceRating/calculateXP), `CoinManager` (award helpers/awardStreakBonus/updateStreak/checkDailyBonus), `ProgressManager.calculateMastery` exact numbers, `CourseManager` unlock-requirement gating. Managers are clean `export class` → constructed directly with plain objects.
- `tests/engine-selection.spec.js` (4) — `GameManager.smartQuestionSelection` RNG-**independent** structural invariants (dedup, 50-cap, pool-subset, due-words-always-selected, session-rotation exclusion) + `improvedShuffle` permutation. GameManager isn't importable (attaches to window, side-effects in ctor) → drives the booted `window.gameManager` with a deterministic `progressManager` stub to isolate bucketing from ProgressManager's due/mastery rules. Exact shuffled order deliberately NOT pinned (won't survive a reimplementation that consumes randomness differently); b1 parity compares invariants + distribution.
- `tests/engine-bridge-contract.spec.js` (3) — v4 `getDefaultProgress` schema (top-level keys the rewrite must keep so saves migrate) + vocabulary `begin → recordAnswer → saveState` contract (the real `src/bridge/vocabulary.ts` imported via Vite, snapshotting wordMastery mutation/score/resumable gameState).

**b1 oracle plan:** keep the legacy modules in-tree (unreferenced by the app) as a parity oracle; add `tests/engine-parity.spec.js` running the same seeded scenario through legacy + new and asserting deep-equal; only delete legacy once parity is green.

##### Slice 4.4.b1: Engine rewrite — NEXT

1. **The React bridges drive the legacy engine as their live backend.** ~13 `src/bridge/*` modules invoke ~40 methods/properties on `window.gameManager` / `app` / `managers/*` — not glue, but the app's brain: `smartQuestionSelection` / `getScopedQuestionPool` / `_getLearnedWordSet` (spaced-repetition selection), `recordWordAttempt` / `endGame` / `saveGameState` / `loadGameState` (progress/resume/score persistence), and the whole course-unlock/mastery/certificate ruleset (`isCourseUnlocked`, `checkAndUnlockGames`, `getTopicMastery`, …). Deleting `gameLogic.js`/`app.js` requires faithfully reimplementing that learning logic in React/bridges (a silent bug — a word that never resurfaces, a course that won't unlock — degrades the kid's experience without throwing). Also `window.gameData` and `window.vocabularyBank` come from `data/_loader.js` (still needed regardless).
- remove `gameLogic.js` (GameManager engine) once reimplemented
- remove `app.js` orchestration (AppManager — also owns `userProgress` load/save, certificates, coin history)

##### Slice 4.4.b2: Auth rewrite

- **Boot order inversion** (lands with b1) — today legacy boots, sets up managers after auth, then React reads them. Removing the engine means React owns startup; mind the gating race already flagged in FU-4.1 (`project_react_home_gating_persisted`).

   **Auth.** remove `auth.js` global script — `src/bridge/auth.ts` transitions from adapter to standalone auth owner (see Auth End-State section). Port login + password-entry + user-select screens to React (LoginPage / PasswordEntryPage) consuming `useAuthSession`; legacy modal markup in `index.html` is deleted alongside `auth.js`. (Interim: 2026-05 restyled the legacy modal CSS to match the React palette — `.auth-modal*` / `.user-select-*` / `.login-*` / `.password-*` / `.auth-btn` blocks in `styles.css` — so visuals stay consistent until the port lands.)

##### Slice 4.4.b3: Final cleanup

Delete the now-dead legacy DOM launch/render path left in `gameLogic.js` by 4.4.a, and the dead `#<game>-game` containers in `index.html` (overlaps Slice 4.5).

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
