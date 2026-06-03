import { useEffect } from 'react'
import { initEngine } from '@/engine/boot'
import { onAuthChange, getCurrentUserId } from '@/bridge/auth'

/**
 * Boots the React-owned engine (Slice 4.4.b1). Replaces the legacy eager-script
 * boot of `app.js` + `gameLogic.js`. Two preconditions must both hold:
 *   1. game data loaded — `data/_loader.js` sets `window.__gameDataReady` + fires
 *      `game-data-ready` when its top-level await finishes (so vocabularyBank /
 *      gameData are populated before the engine reads them).
 *   2. an authenticated user — resolved via `bridge/auth`, the standalone auth
 *      owner since Slice 4.4.b2 (no more `auth.js`).
 *
 * We trigger off `onAuthChange` (which fires an initial check immediately and then
 * polls every 500ms / on the `auth-changed` event) rather than only the
 * `user-logged-in` event. That matters because the engine must appear whenever a
 * user becomes available — including the test pattern that sets a session in
 * localStorage *after* navigation without a reload (legacy `gameLogic.js` published
 * `window.gameManager` at module load, unconditionally; this restores that "engine
 * shows up once a user exists" property within one poll). `initEngine()` is a
 * near-idempotent rebuild and `onAuthChange` only calls back when the user id
 * actually changes, so it runs ~once per user.
 *
 * No teardown on logout: b2's `logout()` no longer reloads the page, but the stale
 * engine globals sit harmlessly behind the login gate and are rebuilt on the next
 * login (user-id change → `maybeBoot` → `initEngine`).
 */
export function useEngineBoot(): void {
  useEffect(() => {
    let dataReady = Boolean((window as any).__gameDataReady)

    const maybeBoot = () => {
      if (dataReady && getCurrentUserId()) initEngine()
    }

    const onDataReady = () => {
      dataReady = true
      maybeBoot()
    }

    if (!dataReady) window.addEventListener('game-data-ready', onDataReady)
    // Initial check is synchronous; subsequent changes (login / user switch /
    // a session written after load) arrive via the 500ms poll.
    const unsubscribe = onAuthChange(() => maybeBoot())

    return () => {
      window.removeEventListener('game-data-ready', onDataReady)
      unsubscribe()
    }
  }, [])
}
