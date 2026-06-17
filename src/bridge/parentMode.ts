import { isCurrentUserAdmin, verifyAdminPassword } from './auth'

/**
 * src/bridge/parentMode.ts — one-unlock parent-mode elevation (M12 Slice B).
 *
 * Before this, the parent gate lived in a per-component `useState`
 * (`useParentPassword`), so it re-locked on every navigation — the parent had to
 * re-type the password on each protected screen. This module hoists the unlock
 * into a single module-level store (the same pattern `onAuthChange` uses in
 * `auth.ts`), so ONE successful unlock keeps every protected surface open for the
 * SPA lifetime / until the timeout.
 *
 * "Elevated" means: the current user is a parent/manager (auto-elevated by role)
 * OR a correct parent password was entered within the timeout window. It is a
 * child gate, not a security boundary — every client-only check is bypassable via
 * devtools; real secrecy needs the §6 Tier-3 backend.
 */

// Absolute timeout after a password elevation. Long enough that a parent isn't
// re-prompted while configuring, short enough that a wandering kid doesn't
// inherit an open parent area minutes later. Role-based elevation never expires.
const ELEVATION_TIMEOUT_MS = 15 * 60 * 1000

const PARENT_MODE_EVENT = 'parent-mode-changed'

let elevatedUntil: number | null = null

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PARENT_MODE_EVENT))
  }
}

/** Whether the parent area is currently unlocked (role OR live password elevation). */
export function isParentElevated(): boolean {
  if (isCurrentUserAdmin()) return true
  if (elevatedUntil !== null) {
    if (Date.now() < elevatedUntil) return true
    elevatedUntil = null // lazily expire
  }
  return false
}

/**
 * Attempt to elevate with the parent password. On success, opens the parent area
 * for the timeout window and notifies subscribers. Returns whether it succeeded.
 */
export function elevateParent(password: string): boolean {
  if (!verifyAdminPassword(password)) return false
  elevatedUntil = Date.now() + ELEVATION_TIMEOUT_MS
  notify()
  return true
}

/** Push the password-elevation timeout forward (called on activity in parent UI). */
export function touchElevation(): void {
  if (elevatedUntil !== null && Date.now() < elevatedUntil) {
    elevatedUntil = Date.now() + ELEVATION_TIMEOUT_MS
  }
}

/** Drop any password elevation (role-based elevation is unaffected). */
export function lockParent(): void {
  elevatedUntil = null
  notify()
}

/**
 * Subscribe to parent-mode changes. Fires immediately with the current state,
 * then on every elevate/lock and on `auth-changed` (login/logout recompute the
 * role half — and any password elevation is dropped when the session changes).
 */
export function subscribeParentMode(cb: (elevated: boolean) => void): () => void {
  const handler = () => cb(isParentElevated())
  cb(isParentElevated())
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PARENT_MODE_EVENT, handler)
  window.addEventListener('auth-changed', handler)
  return () => {
    window.removeEventListener(PARENT_MODE_EVENT, handler)
    window.removeEventListener('auth-changed', handler)
  }
}

// Drop password elevation whenever the session changes (logout, user switch) so
// a kid logging in after a parent never inherits an open parent area.
if (typeof window !== 'undefined') {
  window.addEventListener('auth-changed', () => {
    if (elevatedUntil !== null) elevatedUntil = null
  })
}
