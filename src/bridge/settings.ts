import type { AppSettings } from './types'
import { getApp } from '../engine/instances'
import { getKey, setKey, v2Key } from './storage'

const UNPREFIXED_KEY = 'englishLearningSettings'
const V2_KEY = v2Key('englishLearningSettings')

export const DEFAULT_SETTINGS: AppSettings = {
  selectedCategories: [
    'animals', 'colors', 'numbers', 'food', 'minecraft',
    'gaming', 'roblox', 'actions', 'nature', 'school',
  ],
  questionsPerGame: 10,
  clickRepeatCount: 3,
  audioPlaysAllowed: 8,
  hebrewVocalization: true,
  learningPace: 'normal',
  showNikud: true,
  lowercaseMode: false,
  showConfetti: true,
  exitBehavior: 'autosave',
  gameUnlockOverride: false,
  difficultyAutoGate: true,
  claudeApiKey: '',
}

// ─── Legacy global access ────────────────────────────────────────────────────

interface LegacyAppManager {
  settings: AppSettings | null
  saveSettings(): void
}

function getAppManager(): LegacyAppManager | null {
  return getApp() as unknown as LegacyAppManager | null
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * Get the current app settings. Reads from the legacy appManager first,
 * falls back to the v2 key, then the unprefixed legacy key, then defaults.
 */
export function getSettings(): AppSettings {
  const mgr = getAppManager()
  if (mgr?.settings) return { ...DEFAULT_SETTINGS, ...mgr.settings }

  const fromV2 = getKey<Partial<AppSettings>>(V2_KEY)
  if (fromV2) return { ...DEFAULT_SETTINGS, ...fromV2 }

  const fromLegacy = getKey<Partial<AppSettings>>(UNPREFIXED_KEY)
  if (fromLegacy) return { ...DEFAULT_SETTINGS, ...fromLegacy }

  return { ...DEFAULT_SETTINGS }
}

/**
 * Save a partial settings update. Dual-writes to both the unprefixed legacy
 * key and the v2 key; notifies the legacy appManager so in-session game
 * code picks up changes immediately.
 */
export function saveSettings(updates: Partial<AppSettings>): void {
  const current = getSettings()
  const merged = { ...current, ...updates }
  writeMerged(merged)
}

/**
 * Reset all settings to defaults. Writes the defaults to storage
 * and the legacy appManager.
 */
export function resetSettings(): AppSettings {
  const fresh = { ...DEFAULT_SETTINGS }
  writeMerged(fresh)
  return fresh
}

function writeMerged(merged: AppSettings): void {
  setKey(UNPREFIXED_KEY, merged)
  setKey(V2_KEY, merged)

  const mgr = getAppManager()
  if (mgr) {
    mgr.settings = merged
    mgr.saveSettings()
  }
}
