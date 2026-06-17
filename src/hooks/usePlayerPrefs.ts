import { useState, useEffect, useCallback } from 'react'
import {
  getPlayerPrefs,
  savePlayerPrefs,
  subscribePlayerPrefs,
  type PlayerPrefs,
} from '@/bridge/playerPrefs'

/**
 * Per-player customization prefs ("המשחק שלי"), live across the session.
 * Re-reads on every save and on profile switch (subscribePlayerPrefs listens to
 * `auth-changed`), so each child sees their own look the moment they log in.
 */
export function usePlayerPrefs() {
  const [prefs, setPrefs] = useState<PlayerPrefs>(() => getPlayerPrefs())

  useEffect(() => subscribePlayerPrefs(setPrefs), [])

  const update = useCallback((patch: Partial<PlayerPrefs>) => {
    savePlayerPrefs(patch)
    setPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  return { prefs, updatePrefs: update }
}
