import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '@/bridge/types'
import { getSettings, saveSettings, resetSettings } from '@/bridge/settings'

const POLL_INTERVAL = 500

function shallowEqualSettings(a: AppSettings, b: AppSettings): boolean {
  // Compare known scalar fields
  if (
    a.questionsPerGame !== b.questionsPerGame ||
    a.clickRepeatCount !== b.clickRepeatCount ||
    a.audioPlaysAllowed !== b.audioPlaysAllowed ||
    a.hebrewVocalization !== b.hebrewVocalization ||
    a.learningPace !== b.learningPace ||
    a.showNikud !== b.showNikud ||
    a.lowercaseMode !== b.lowercaseMode ||
    a.showConfetti !== b.showConfetti ||
    a.exitBehavior !== b.exitBehavior ||
    a.gameUnlockOverride !== b.gameUnlockOverride ||
    a.certDifficulty !== b.certDifficulty ||
    a.claudeApiKey !== b.claudeApiKey ||
    a.expressionsEnabled !== b.expressionsEnabled
  ) {
    return false
  }
  // Expression registers (Phase 5) — 3 booleans, compare by value.
  const ar = a.expressionRegisters
  const br = b.expressionRegisters
  if (ar !== br) {
    if (!ar || !br) return false
    if (
      ar['kid-friendly'] !== br['kid-friendly'] ||
      ar.casual !== br.casual ||
      ar.edgy !== br.edgy
    ) {
      return false
    }
  }
  // Compare category selection by length and content
  if (a.selectedCategories.length !== b.selectedCategories.length) return false
  for (let i = 0; i < a.selectedCategories.length; i++) {
    if (a.selectedCategories[i] !== b.selectedCategories[i]) return false
  }
  return true
}

/**
 * React hook that provides the current app settings with a setter.
 * Polls localStorage for external changes at a 500ms interval so changes
 * from the legacy settings page sync into React in-session.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())

  useEffect(() => {
    const id = setInterval(() => {
      const next = getSettings()
      setSettings((prev) => (shallowEqualSettings(prev, next) ? prev : next))
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const update = useCallback((updates: Partial<AppSettings>) => {
    saveSettings(updates)
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  const reset = useCallback(() => {
    const fresh = resetSettings()
    setSettings(fresh)
  }, [])

  return { settings, updateSettings: update, resetSettings: reset }
}
