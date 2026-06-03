import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/bridge/types'
import { getCurrentUser, isAuthenticated as bridgeIsAuthenticated, onAuthChange, logout as bridgeLogout } from '@/bridge/auth'

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
      setUser(u)
      setAuthed(bridgeIsAuthenticated())
    })
    return unsubscribe
  }, [])

  const logout = useCallback(() => {
    bridgeLogout()
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
