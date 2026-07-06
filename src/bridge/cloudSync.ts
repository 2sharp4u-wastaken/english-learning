/**
 * src/bridge/cloudSync.ts — Cloud backup + restore of per-player progress/prefs
 * (Tier-3 Phase B). Sits on top of the optional cloud account (`cloudAccount.ts`).
 *
 * WHAT: pushes each linked child's `v2_userProgress_<id>` / `v2_playerPrefs_<id>`
 * blob to the Worker (`PUT /api/progress|prefs/:cloudPlayerId`, debounced on
 * change) and pulls them back on a fresh device (`GET …`). The blobs are opaque
 * pass-through — the exact bytes the app already stores locally — so no schema
 * churn per feature.
 *
 * LINK MAP: local user ids differ per device, so a device-local map
 * (`cloudPlayerLinks`: `{ [localUserId]: cloudPlayerId }`) records which cloud
 * player each on-device profile backs up to. The parent links a profile once
 * (`linkAndBackup` creates the cloud player + pushes); after that auto-backup
 * and manual push/pull use the mapping.
 *
 * OFFLINE-FIRST: everything here is a no-op without a cloud account. The app
 * plays fully offline; this is a backup layer, never required.
 *
 * NOTE (Phase B is BACKUP, not sync): push is last-write-wins to the cloud;
 * pull overwrites the local blob and the caller reloads (the engine holds the
 * old progress in memory and would re-save over a freshly pulled blob otherwise
 * — same reason `bridge/backup.ts` reloads after a restore). Bidirectional
 * conflict-merge is Phase C (docs/cloud-backend.md).
 */

import { getCurrentUserId } from './auth'
import { cloudApi, isCloudSignedIn, cloudCreatePlayer, type CloudResult } from './cloudAccount'
import { v2Key } from './storage'
import { SAVE_SUCCESS_EVENT } from '../lib/storageEvents'

const LINKS_KEY = 'cloudPlayerLinks'
const SYNC_CHANGED_EVENT = 'cloud-sync-changed'
const PLAYER_PREFS_CHANGED_EVENT = 'player-prefs-changed'
// Long enough to coalesce a burst of answers into one push, short enough that a
// closed tab usually got the last state up. Auto-backup is best-effort; the
// manual "גיבוי כעת" button is the guaranteed path.
const AUTO_BACKUP_DEBOUNCE_MS = 4000

/** The GET /api/progress|prefs shape — `blob` is null when nothing is backed up. */
export interface BackupMeta {
  blob: string | null
  updated: string | null
}

// ─── Link map (local userId ↔ cloud playerId) ─────────────────────────────────

export function getPlayerLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function saveLinks(map: Record<string, string>): void {
  localStorage.setItem(LINKS_KEY, JSON.stringify(map))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_CHANGED_EVENT))
}

export function getLinkedPlayerId(localUserId: string): string | null {
  return getPlayerLinks()[localUserId] ?? null
}

export function isPlayerLinked(localUserId: string): boolean {
  return getLinkedPlayerId(localUserId) !== null
}

export function linkPlayer(localUserId: string, cloudPlayerId: string): void {
  const map = getPlayerLinks()
  map[localUserId] = cloudPlayerId
  saveLinks(map)
}

export function unlinkPlayer(localUserId: string): void {
  const map = getPlayerLinks()
  delete map[localUserId]
  saveLinks(map)
}

// ─── Raw per-user blob keys (opaque bytes — read/written verbatim) ─────────────

function progressKey(localUserId: string): string {
  return v2Key(`userProgress_${localUserId}`)
}
function prefsKey(localUserId: string): string {
  return v2Key(`playerPrefs_${localUserId}`)
}

// ─── Push (local → cloud) ─────────────────────────────────────────────────────

/** Back up one linked profile's progress + prefs blobs to the cloud. */
export async function pushBackup(localUserId: string): Promise<CloudResult> {
  const cloudId = getLinkedPlayerId(localUserId)
  if (!cloudId) return { ok: false, error: 'הפרופיל אינו מקושר לענן' }

  const progress = localStorage.getItem(progressKey(localUserId))
  if (progress !== null) {
    const r = await cloudApi(`/api/progress/${encodeURIComponent(cloudId)}`, {
      method: 'PUT',
      body: JSON.stringify({ blob: progress }),
    })
    if (!r.ok) return { ok: false, error: r.error, code: r.code }
  }

  const prefs = localStorage.getItem(prefsKey(localUserId))
  if (prefs !== null) {
    const r = await cloudApi(`/api/prefs/${encodeURIComponent(cloudId)}`, {
      method: 'PUT',
      body: JSON.stringify({ blob: prefs }),
    })
    if (!r.ok) return { ok: false, error: r.error, code: r.code }
  }

  return { ok: true }
}

/**
 * First-time "enable backup": create a cloud player for this profile (unless it
 * is already linked), record the link, then push. `name`/`initial` seed the
 * cloud player — pseudonymous under the family (only PII is the parent email).
 */
export async function linkAndBackup(
  localUserId: string,
  name: string,
  initial: string,
): Promise<CloudResult> {
  let cloudId = getLinkedPlayerId(localUserId)
  if (!cloudId) {
    const created = await cloudCreatePlayer(name, initial)
    if (!created.ok || !created.data) return { ok: false, error: created.error }
    cloudId = created.data.id
    linkPlayer(localUserId, cloudId)
  }
  return pushBackup(localUserId)
}

// ─── Pull (cloud → local) ─────────────────────────────────────────────────────

/**
 * Restore a linked profile's blobs from the cloud into localStorage. Does NOT
 * reload — use `pullBackupAndReload` for the UI path (the engine must re-boot to
 * pick up the restored progress). `restored` is false when the cloud has no
 * backup for this player yet (both blobs null).
 */
export async function pullBackup(localUserId: string): Promise<CloudResult<{ restored: boolean }>> {
  const cloudId = getLinkedPlayerId(localUserId)
  if (!cloudId) return { ok: false, error: 'הפרופיל אינו מקושר לענן' }

  const prog = await cloudApi<BackupMeta>(`/api/progress/${encodeURIComponent(cloudId)}`)
  if (!prog.ok) return { ok: false, error: prog.error }
  const prefs = await cloudApi<BackupMeta>(`/api/prefs/${encodeURIComponent(cloudId)}`)
  if (!prefs.ok) return { ok: false, error: prefs.error }

  let restored = false
  if (prog.data?.blob) {
    localStorage.setItem(progressKey(localUserId), prog.data.blob)
    restored = true
  }
  if (prefs.data?.blob) {
    localStorage.setItem(prefsKey(localUserId), prefs.data.blob)
    restored = true
  }
  return { ok: true, data: { restored } }
}

/** Pull + full reload on success (boot rebuilds the engine from the pulled blob,
 *  the same discipline `bridge/backup.ts` uses after a file restore). */
export async function pullBackupAndReload(
  localUserId: string,
): Promise<CloudResult<{ restored: boolean }>> {
  const r = await pullBackup(localUserId)
  if (r.ok && r.data?.restored && typeof window !== 'undefined') {
    window.location.reload()
  }
  return r
}

// ─── Auto-backup (debounced push on change) ───────────────────────────────────

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
let autoBackupInited = false

/** Debounce a background push for `localUserId` — no-op unless signed in + linked. */
export function scheduleAutoBackup(localUserId: string): void {
  if (!isCloudSignedIn() || !getLinkedPlayerId(localUserId)) return
  clearTimeout(debounceTimers[localUserId])
  debounceTimers[localUserId] = setTimeout(() => {
    void pushBackup(localUserId)
  }, AUTO_BACKUP_DEBOUNCE_MS)
}

/**
 * Wire the debounced auto-backup once, on app start (called from App). Listens
 * for a successful progress save and any per-player prefs change and schedules a
 * push for the ACTIVE profile. Guards make it inert without a cloud account/link.
 */
export function initCloudAutoBackup(): void {
  if (autoBackupInited || typeof window === 'undefined') return
  autoBackupInited = true
  const trigger = () => {
    const uid = getCurrentUserId()
    if (uid) scheduleAutoBackup(uid)
  }
  window.addEventListener(SAVE_SUCCESS_EVENT, trigger)
  window.addEventListener(PLAYER_PREFS_CHANGED_EVENT, trigger)
}

/** Subscribe to link-map changes (link / unlink). Fires immediately. */
export function subscribeCloudSync(cb: () => void): () => void {
  cb()
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SYNC_CHANGED_EVENT, cb)
  return () => window.removeEventListener(SYNC_CHANGED_EVENT, cb)
}
