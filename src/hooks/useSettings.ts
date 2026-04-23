import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '@/bridge/types'
import { getSettings, saveSettings } from '@/bridge/settings'

const POLL_INTERVAL = 500

/**
 * React hook that provides the current app settings with a setter.
 * Polls localStorage for external changes at a 500ms interval.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())

  useEffect(() => {
    const id = setInterval(() => {
      const next = getSettings()
      setSettings((prev) => {
        // Quick shallow check on known keys
        if (
          prev.soundEnabled === next.soundEnabled &&
          prev.speechRate === next.speechRate &&
          prev.autoPlayAudio === next.autoPlayAudio &&
          prev.showPhonetics === next.showPhonetics &&
          prev.language === next.language
        ) {
          return prev
        }
        return next
      })
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const update = useCallback((updates: Partial<AppSettings>) => {
    saveSettings(updates)
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  return { settings, updateSettings: update }
}
