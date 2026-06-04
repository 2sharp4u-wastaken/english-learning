/**
 * src/engine/instances.ts — the live engine singletons (Slice 4.4.b3).
 *
 * b1 built the React-owned engine but kept a drop-in `window.*` shim
 * (`boot.ts → publishGlobals`) so the ~25 bridges/pages could keep reading
 * `window.app`/`window.gameManager`. b3 removes that shim: `boot.ts` now stores
 * the freshly-built instances here via `setEngineInstances`, and every bridge
 * imports `getApp`/`getGameManager` from this module instead of touching
 * `window.*`. `gameRegistry` is a static export of `./gameRegistry` (imported
 * directly where needed). The accessors return `null` until the engine boots —
 * exactly the readiness semantics the old `window.*` reads had (`undefined`
 * before boot), so all the existing `?.`-guarded call sites keep working.
 *
 * NOTE: still-legacy boot data (`window.vocabularyBank`/`window.gameData` from
 * data/_loader.js, `window.speechManager` from speechSynthesis.js, etc.) is NOT
 * part of this module — those scripts remain and are retired in 4.5/4.6.
 */

import type { AppState } from './appState'
import type { GameManager } from './gameManager'

let app: AppState | null = null
let gameManager: GameManager | null = null

/** Called by `boot.ts → initEngine` after the instances are built + wired. */
export function setEngineInstances(a: AppState, gm: GameManager): void {
  app = a
  gameManager = gm
}

export function getApp(): AppState | null {
  return app
}

export function getGameManager(): GameManager | null {
  return gameManager
}
