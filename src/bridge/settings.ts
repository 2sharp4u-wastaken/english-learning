import type { AppSettings } from './types'
import { getKey, setKey, v2Key } from './storage'

const SETTINGS_KEY = v2Key('englishLearningSettings')

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  speechRate: 0.9,
  autoPlayAudio: true,
  showPhonetics: true,
  language: 'en',
}

// ─── Legacy global access ────────────────────────────────────────────────────

interface LegacyAppManager {
  settings: AppSettings | null
  saveSettings(): void
}

function getAppManager(): LegacyAppManager | null {
  return (window as any).appManager ?? null
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * Get the current app settings.
 * Reads from legacy appManager first, falls back to localStorage.
 */
export function getSettings(): AppSettings {
  const mgr = getAppManager()
  if (mgr?.settings) return { ...DEFAULT_SETTINGS, ...mgr.settings }
  return getKey<AppSettings>(SETTINGS_KEY) ?? { ...DEFAULT_SETTINGS }
}

/**
 * Save a partial settings update.
 * Writes to localStorage and notifies the legacy appManager if available.
 */
export function saveSettings(updates: Partial<AppSettings>): void {
  const current = getSettings()
  const merged = { ...current, ...updates }
  setKey(SETTINGS_KEY, merged)

  const mgr = getAppManager()
  if (mgr) {
    mgr.settings = merged
    mgr.saveSettings()
  }
}
