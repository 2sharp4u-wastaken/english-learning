/**
 * src/engine/boot.ts — React-owned engine startup (Slice 4.4.b1 cutover).
 *
 * Replaces the legacy boot (`app.js` AppManager + `gameLogic.js` GameManager that
 * loaded as eager `<script type=module>` and published `window.*` globals). React
 * now owns startup: once game data is loaded and a user is authenticated, `initEngine()`
 * builds the `src/engine/*` instances, wires them together, and stores them in
 * `src/engine/instances.ts` — bridges + game pages read the live engine via
 * `getApp()`/`getGameManager()` (Slice 4.4.b3 removed the `window.*` app shim). The
 * only window exposure left is the DEV-only `window.__engine` test handle below
 * (Slice 4.6), used solely by the Playwright integration specs.
 *
 * Faithful to the (now-deleted) legacy `AppManager.setupWithAuth`/`initializeManagers`
 * and `GameManager` ctor settings load. Re-inits on user-id change via `useEngineBoot`'s
 * `onAuthChange` subscription. Auth is owned by `src/bridge/auth.ts` (Slice 4.4.b2, no
 * `auth.js`); logout no longer reloads — the stale engine is rebuilt on next login.
 */

import { AppState, type AppManagers } from './appState'
import { GameManager } from './gameManager'
import { ScoreManager } from './score'
import { ProgressManager } from './progress'
import { CoinManager } from './coins'
import { CertificateManager } from './certificates'
import { CourseManager } from './courses'
import { setEngineInstances, getApp, getGameManager } from './instances'
import { getCurrentUserId } from '../bridge/auth'
// Course definitions (legacy app.js imported the same module-level list).
// @ts-expect-error — legacy .js import without a .d.ts
import { allCourses } from '../../data/courses/index.js'

let engineReady = false

// Progress saves are throttled (AppState.saveUserProgress, design-flaws fix
// 2026-07-05) — a coalesced trailing write may still be pending when the child
// closes the tab / backgrounds the PWA. Flush it on the page-exit signals
// (pagehide covers close/navigate; visibilitychange-hidden covers Android
// app-switch, where pagehide may never fire before the process is killed).
if (typeof window !== 'undefined') {
  const flushProgress = () => getApp()?.flushPendingSave?.()
  window.addEventListener('pagehide', flushProgress)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushProgress()
  })
}

function getVocabularyBank(): any[] {
  return ((window as any).vocabularyBank as any[]) ?? []
}

function getGameData(): Record<string, any[]> {
  return ((window as any).gameData as Record<string, any[]>) ?? {}
}

/**
 * Build + initialize the managers for a freshly-loaded userProgress. Mirrors the
 * dependency order of legacy `AppManager.initializeManagers` (app.js:1037-1048).
 * AppState registers `allCourses` itself after this returns.
 */
function createManagers(userProgress: any, save: () => void): AppManagers {
  const scoreManager = new ScoreManager()
  scoreManager.initialize()

  const progressManager = new ProgressManager()
  progressManager.initialize(userProgress)

  const courseManager = new CourseManager(userProgress, progressManager, {
    save,
    vocabularyBank: getVocabularyBank,
  })
  courseManager.initialize()

  const certificateManager = new CertificateManager(userProgress, { save })
  certificateManager.initialize()

  const coinManager = new CoinManager(userProgress, {
    save,
    // Legacy stamped history with the live GameManager's currentGame. The GameManager
    // isn't built until after createManagers returns, so read it lazily at call time.
    currentGameType: () => getGameManager()?.currentGame ?? null,
  })
  coinManager.initialize()

  return { scoreManager, progressManager, courseManager, certificateManager, coinManager }
}

/**
 * Build (or rebuild) the engine for the current authenticated user and store the
 * instances (`src/engine/instances.ts`) the bridges read. Safe to call again on
 * user switch (`user-logged-in`).
 */
export function initEngine(): boolean {
  const userId = getCurrentUserId()
  if (!userId) return false

  // User switch: push out any coalesced save the OUTGOING engine still holds
  // before the new one takes over (the deferred write targets the loaded user's
  // key — see AppState.loadedUserId — so this can never cross users).
  getApp()?.flushPendingSave?.()

  const app = new AppState({
    getUserId: () => getCurrentUserId(),
    vocabularyBank: getVocabularyBank,
    allCourses,
    createManagers,
    // The legacy DOM side effects are gone — React renders certs/courses/toasts
    // reactively, so the host hooks default to no-ops. onSettingsApplied keeps the
    // live engine's settings in sync when app.saveSettings is called (e.g. a parent
    // changes categories): re-apply + rebuild the filtered pools so the change is
    // picked up in-session, exactly as legacy did.
    onSettingsApplied: (settings) => {
      getGameManager()?.applySettings(settings)
      getGameManager()?.loadGameData()
    },
  })
  app.currentUser = userId
  // Faithful to legacy `AppManager.setupWithAuth` (app.js:74,93): the CALLER assigns
  // the loaded progress — `loadUserProgress()` only returns it. Without this assignment
  // `this.userProgress` stays null and `initializeManagers()` bails ("userProgress not
  // loaded"), leaving app/gameManager without their sub-managers.
  app.userProgress = app.loadUserProgress()
  app.initializeManagers()

  // Slice 3.7.1 orphan sweep, faithful to legacy `AppManager.setupWithAuth`
  // (app.js:79-82): drop leftover Word Builder state from when that game existed.
  // Bookmarks to /#/game/word-builder redirect to fill-blanks (GameHostPage.RETIRED_GAMES).
  try {
    localStorage.removeItem(`savedGame_${userId}_word-builder`)
    localStorage.removeItem(`v2_wordbuilder_audio_${userId}`)
  } catch {
    /* ignore quota/serialization */
  }

  const gm = new GameManager({
    getApp: () => app,
    vocabularyBank: getVocabularyBank,
    gameDataProvider: getGameData,
    getUserId: () => getCurrentUserId(),
    // isPracticeMode omitted → defaults false (legacy `SettingsManager` was never
    // defined, so its `isPracticeMode()` branch was always false in the live path).
  })
  gm.scoreManager = app.scoreManager
  gm.progressManager = app.progressManager
  gm.coinManager = app.coinManager
  gm.courseManager = app.courseManager

  // Settings: merge unprefixed localStorage with app overrides, exactly as the
  // legacy GameManager ctor did (gameLogic.js:60-65).
  try {
    const lsSettings = JSON.parse(localStorage.getItem('englishLearningSettings') || 'null')
    const appSettings = app.settings || {}
    gm.applySettings({ ...(lsSettings || gm.getDefaultSettings()), ...appSettings })
  } catch {
    gm.applySettings(gm.getDefaultSettings())
  }

  // Build the category-filtered + difficulty-gated pools the bridges read via
  // getScopedQuestionPool/getPracticeWords. Legacy did this in initializeGame()
  // (gameLogic.js:1268) AFTER settings load — so selectedCategories is current.
  gm.loadGameData()

  setEngineInstances(app, gm)
  exposeEngineForTests(app, gm)

  engineReady = true
  window.dispatchEvent(new CustomEvent('engine-ready'))
  return true
}

/**
 * Slice 4.6 — DEV-only test handle, replacing the b3 `window.app`/`window.gameManager`
 * debug seam.
 *
 * App code (bridges + game pages) reaches the engine via `getApp()`/`getGameManager()`
 * from `src/engine/instances.ts` — it never reads any window global. The only thing
 * that still needs an in-browser handle is the Playwright *integration* suite, which
 * drives/inspects the live engine from `page.evaluate` (the engine class isn't
 * importable in the page). So we expose a single, honestly-named `window.__engine =
 * { app, gm }` instead of production-looking `window.app`/`window.gameManager` globals.
 *
 * It is gated on `import.meta.env.DEV`, so production builds ship NO engine handle on
 * `window` at all (the old seam leaked in prod too). The pure-logic characterization
 * specs that needed no browser (selection bucketing, shuffle, default-progress schema)
 * moved to in-process Vitest unit tests (`src/engine/__tests__/*.test.ts`); only the
 * content/integration specs (`difficulty-gate`, `engine-bridge-contract`,
 * `react-routes`, `smoke`) still use this handle.
 */
function exposeEngineForTests(app: AppState, gm: GameManager): void {
  if (!import.meta.env.DEV) return
  ;(window as any).__engine = { app, gm }
}

export function getEngineReady(): boolean {
  return engineReady
}

// Re-export the live-instance accessors so existing `from '@/engine/boot'` /
// `from './boot'` imports keep resolving (the singletons now live in instances.ts).
export { getApp, getGameManager }
