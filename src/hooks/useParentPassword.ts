import { useState, useEffect, useCallback } from 'react'
import {
  isParentElevated,
  elevateParent,
  lockParent,
  subscribeParentMode,
} from '@/bridge/parentMode'

/**
 * Parent-password gate for protected settings, backed by the shared module-level
 * parent-mode store (`src/bridge/parentMode.ts`).
 *
 * - Auto-unlocked when the current user has role `parent`/`manager`.
 * - Otherwise unlocks after a correct admin password submission — and STAYS
 *   unlocked across navigation/screens for the timeout window (M12 Slice B).
 *   Previously this was per-component state that re-locked on every navigation.
 * - Drops on logout / user switch and on the elevation timeout.
 */
export function useParentPassword() {
  const [unlocked, setUnlocked] = useState<boolean>(() => isParentElevated())

  useEffect(() => subscribeParentMode(setUnlocked), [])

  const unlock = useCallback((password: string): boolean => elevateParent(password), [])
  const lock = useCallback(() => lockParent(), [])

  return { unlocked, unlock, lock }
}
