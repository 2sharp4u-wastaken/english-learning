import { useState, useEffect, useCallback } from 'react'
import { isCurrentUserAdmin, verifyAdminPassword } from '@/bridge/auth'

/**
 * Session-scoped parent-password gate for protected settings.
 *
 * Unlock state is kept in memory for the lifetime of the page:
 * - Auto-unlocked when the current user has role `parent` or `manager`.
 * - Otherwise unlocks only after a correct admin password submission.
 * - Locks on page reload (no persisted unlock) to match the legacy UX.
 */
export function useParentPassword() {
  const [unlocked, setUnlocked] = useState<boolean>(() => isCurrentUserAdmin())

  useEffect(() => {
    // Keep auto-unlock fresh if the session user changes (e.g. after login)
    if (unlocked) return
    if (isCurrentUserAdmin()) setUnlocked(true)
  }, [unlocked])

  const unlock = useCallback((password: string): boolean => {
    if (verifyAdminPassword(password)) {
      setUnlocked(true)
      return true
    }
    return false
  }, [])

  const lock = useCallback(() => setUnlocked(false), [])

  return { unlocked, unlock, lock }
}
