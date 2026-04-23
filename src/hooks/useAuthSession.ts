import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/bridge/types'
import { getCurrentUser, onAuthChange, logout as bridgeLogout } from '@/bridge/auth'

/**
 * React hook that tracks the current authenticated user.
 * Re-renders when the user logs in or out.
 */
export function useAuthSession() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser())

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser)
    return unsubscribe
  }, [])

  const logout = useCallback(() => {
    bridgeLogout()
    setUser(null)
  }, [])

  return {
    user,
    isAuthenticated: user !== null,
    userId: user?.id ?? null,
    displayName: user?.name ?? null,
    initial: user?.initial ?? null,
    logout,
  }
}
