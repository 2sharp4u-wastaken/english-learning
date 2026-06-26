import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/bridge/types'
import { getCurrentUser, isAuthenticated as bridgeIsAuthenticated, onAuthChange, logout as bridgeLogout } from '@/bridge/auth'
import { router } from '@/app/router'

/**
 * Reset the route to /home on logout so the NEXT sign-in starts on the home page
 * instead of resuming the previous user's last route. The `createHashRouter`
 * instance is a module-level singleton whose `state.location` PERSISTS while the
 * `AuthGate` swaps the `RouterProvider` for the `LoginPage` and back — so a
 * re-login would otherwise re-mount the router straight onto the stale route
 * (e.g. `#/settings` or `#/game/vocabulary`).
 *
 * We navigate via `router.navigate` (not `window.location.hash = ...`): react-router
 * v7's hash history listens to `popstate` only and ignores `hashchange`, so a raw
 * hash assignment would not update the router's internal state. `router.navigate`
 * updates that state directly (and the URL), and works even while the provider is
 * unmounted, so login lands on home.
 *
 * Imported statically despite the router.tsx → AppShell → TopNav → useAuthSession
 * cycle: `router` is only read at call time (logout), by when every module has
 * finished evaluating, so the live binding is resolved.
 */
function resetRouteToHome(): void {
  if (router.state.location.pathname !== '/home') {
    void router.navigate('/home')
  }
}

/**
 * React hook that tracks the current authenticated user.
 * Re-renders when the user logs in or out.
 *
 * `isAuthenticated` reflects a valid SESSION (faithful to legacy `auth.js`, which
 * hid the login modal on session validity), not whether the session's user has a
 * record in the users DB. They differ only in the test harness, which seeds a
 * session whose id isn't in `users` — the app must still render, exactly as before.
 */
export function useAuthSession() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser())
  const [authed, setAuthed] = useState<boolean>(() => bridgeIsAuthenticated())

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      if (!u) resetRouteToHome()
      setUser(u)
      setAuthed(bridgeIsAuthenticated())
    })
    return unsubscribe
  }, [])

  const logout = useCallback(() => {
    bridgeLogout()
    resetRouteToHome()
    setUser(null)
    setAuthed(false)
  }, [])

  return {
    user,
    isAuthenticated: authed,
    userId: user?.id ?? null,
    displayName: user?.name ?? null,
    initial: user?.initial ?? null,
    logout,
  }
}
