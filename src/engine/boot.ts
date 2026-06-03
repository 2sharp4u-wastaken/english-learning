/**
 * src/engine/boot.ts — React-owned engine startup (Slice 4.4.b1 cutover).
 *
 * Replaces the legacy boot (`app.js` AppManager + `gameLogic.js` GameManager that
 * loaded as eager `<script type=module>` and published `window.*` globals). React
 * now owns startup: once game data is loaded and a user is authenticated, `initEngine()`
 * builds the `src/engine/*` instances, wires them together, and **republishes the same
 * `window.*` globals** the legacy engine did — so the ~13 bridges that read
 * `window.gameManager`/`window.app` and the React pages that poll those globals for
 * readiness keep working unchanged (a true drop-in). Removing the window shim entirely
 * (bridges importing `src/engine` directly) is deferred to b3.
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
import { gameRegistry } from './gameRegistry'
import { getCurrentUserId } from '../bridge/auth'
// Course definitions (legacy app.js imported the same module-level list).
// @ts-expect-error — legacy .js import without a .d.ts
import { allCourses } from '../../data/courses/index.js'

let appState: AppState | null = null
let gameManager: GameManager | null = null
let engineReady = false

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
    // Legacy stamped history with window.gameManager?.currentGame.
    currentGameType: () => (window as any).gameManager?.currentGame ?? null,
  })
  coinManager.initialize()

  return { scoreManager, progressManager, courseManager, certificateManager, coinManager }
}

/** Publish the same globals the legacy engine exported (drop-in compat shim). */
function publishGlobals(app: AppState, gm: GameManager): void {
  const w = window as any
  w.app = app
  w.gameManager = gm
  w.scoreManager = app.scoreManager
  w.progressManager = app.progressManager
  w.courseManager = app.courseManager
  w.certificateManager = app.certificateManager
  w.coinManager = app.coinManager
  w.gameRegistry = gameRegistry
}

/**
 * Build (or rebuild) the engine for the current authenticated user and publish the
 * globals. Safe to call again on user switch (`user-logged-in`).
 */
export function initEngine(): boolean {
  const userId = getCurrentUserId()
  if (!userId) return false

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
      gameManager?.applySettings(settings)
      gameManager?.loadGameData()
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

  appState = app
  gameManager = gm
  publishGlobals(app, gm)

  engineReady = true
  window.dispatchEvent(new CustomEvent('engine-ready'))
  return true
}

export function getEngineReady(): boolean {
  return engineReady
}

export function getApp(): AppState | null {
  return appState
}

export function getGameManager(): GameManager | null {
  return gameManager
}
