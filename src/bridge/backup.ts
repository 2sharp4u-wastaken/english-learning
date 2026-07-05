import { listAllKeys, BACKUP_EXCLUDE } from '../lib/storageKeys'

/**
 * src/bridge/backup.ts — local backup export/import (design-flaws fix,
 * 2026-07-05).
 *
 * localStorage is the ONLY store (until Cloud Phase B ships progress sync), so
 * a browser "clear browsing data" or storage eviction deletes every child's
 * progress with zero recovery. This gives the parent a file-based escape
 * hatch: export snapshots the whole app state (all localStorage keys except
 * BACKUP_EXCLUDE secrets) into a JSON download; import restores it and the
 * caller reloads. UI: ParentsTab → "גיבוי מקומי (קובץ)".
 */

const BACKUP_FORMAT = 'english-learning-backup'
const BACKUP_FORMAT_VERSION = 1

export interface RestoreResult {
  success: boolean
  /** 'invalid-json' | 'invalid-format' | 'write-failed' */
  error?: string
  keysRestored?: number
}

export function buildBackupJson(): string {
  const keys: Record<string, string> = {}
  for (const key of listAllKeys()) {
    if (BACKUP_EXCLUDE.has(key)) continue
    const value = localStorage.getItem(key)
    if (value !== null) keys[key] = value
  }
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
      keys,
    },
    null,
    2,
  )
}

/** Build the backup and hand it to the browser as a .json download. */
export function downloadBackup(): void {
  const blob = new Blob([buildBackupJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `english-learning-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

/**
 * Restore a backup file's contents into localStorage. Existing keys are
 * overwritten; keys NOT in the backup are deliberately left alone (never
 * `localStorage.clear()` here — if a restore died half-way after a clear, the
 * device would end up worse than before). The caller reloads on success so
 * boot rebuilds everything from the restored state.
 */
export function restoreBackup(text: string): RestoreResult {
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    return { success: false, error: 'invalid-json' }
  }
  if (parsed?.format !== BACKUP_FORMAT || typeof parsed?.keys !== 'object' || parsed.keys === null) {
    return { success: false, error: 'invalid-format' }
  }

  let keysRestored = 0
  for (const [key, value] of Object.entries(parsed.keys)) {
    if (typeof value !== 'string') continue
    try {
      localStorage.setItem(key, value)
      keysRestored++
    } catch {
      return { success: false, error: 'write-failed', keysRestored }
    }
  }
  return { success: true, keysRestored }
}

/** Restore + full reload on success, so boot rebuilds from the restored state.
 *  (The reload lives here, not in the component — bridge owns window access.) */
export function restoreBackupAndReload(text: string): RestoreResult {
  const result = restoreBackup(text)
  if (result.success && typeof window !== 'undefined') {
    window.location.reload()
  }
  return result
}

/** Lightweight peek at a backup file for the confirm UI (date + key count). */
export function describeBackup(text: string): { exportedAt: string | null; keyCount: number } | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.format !== BACKUP_FORMAT || typeof parsed?.keys !== 'object' || parsed.keys === null) {
      return null
    }
    return {
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
      keyCount: Object.keys(parsed.keys).length,
    }
  } catch {
    return null
  }
}
