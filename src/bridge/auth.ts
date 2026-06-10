import type { User, UserRole, Session } from './types'

/**
 * src/bridge/auth.ts — STANDALONE auth owner (Slice 4.4.b2).
 *
 * Until b2 this was an adapter that delegated to the legacy `window.authService`
 * (`auth.js`). b2 retires `auth.js`; this module now owns auth directly:
 * the users database, password hashing, session lifecycle (with idle expiry),
 * and admin CRUD — all reading/writing localStorage. The public bridge contract
 * (`getCurrentUser` / `getCurrentUserId` / `isAuthenticated` / `onAuthChange` /
 * `login` / `logout` / admin helpers) is unchanged, so React hooks and pages are
 * unaffected. The React login UI lives in `src/features/auth/LoginPage.tsx`.
 *
 * Storage keys are the SAME UNPREFIXED keys legacy `auth.js` used — `users`,
 * `currentSession`, `currentUser` (NOT `v2_`-prefixed). Existing sessions and the
 * Playwright suite seed these directly, so the bytes must match.
 *
 * Faithful port of `auth.js`. Two deliberate simplifications, both safe:
 *  - the 2-minute "session about to expire" warning toast and the timeout `alert()`
 *    are dropped — idle expiry is enforced lazily in `isAuthenticated()` and the
 *    500ms `onAuthChange` poll flips the React AuthGate to the login screen within
 *    half a second, which is the desired outcome for a kids' app.
 *  - `logout()` no longer reloads the page; it clears the session and notifies
 *    subscribers, so the React AuthGate shows the login screen and the engine
 *    rebuilds for the next user (`useEngineBoot` re-runs `initEngine` on user-id
 *    change). SPA-clean, no full reload.
 */

// ─── Constants (ported from legacy AuthService) ───────────────────────────────
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes idle timeout
const PASSWORD_SALT = 'englishlearning2024'

// UNPREFIXED localStorage keys — exactly as legacy auth.js used them.
const USERS_KEY = 'users'
const SESSION_KEY = 'currentSession'
const CURRENT_USER_KEY = 'currentUser'
// Per-device parent (admin) password, stored as a hash (Tier 2, backlog §4 —
// replaced the old hard-coded constant that shipped in the public bundle).
// Created by ParentPasswordModal's create mode on first protected access.
// A child gate, not a security boundary: any client-only check is bypassable
// via devtools; real secrecy needs a backend (backlog §6).
const PARENT_PASSWORD_KEY = 'parentPassword'

const AUTH_CHANGED_EVENT = 'auth-changed'

interface AdminResult { success: boolean; message?: string; error?: string }
interface LoginResult { success: boolean; error?: string; user?: User; session?: Session }

// ─── Low-level storage ────────────────────────────────────────────────────────

function readJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getUsers(): Record<string, User> | null {
  return readJSON<Record<string, User>>(USERS_KEY)
}

function saveUsers(users: Record<string, User>): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch (e) {
    console.error('Error saving users:', e)
  }
}

export function getUser(userId: string): User | null {
  const users = getUsers()
  return users ? users[userId] ?? null : null
}

// ─── First-run bootstrap ──────────────────────────────────────────────────────
// INFRA1 (2026-06-10): the legacy hard-coded omer/zohar/idan seeding was removed
// so a published deploy starts with an EMPTY user database — the LoginPage shows
// a "create first profile" form instead (the O/Z/I → omer/zohar/idan migration
// went with it; it only ever ran on an empty DB, which real legacy devices never
// have). Existing devices are untouched: their `users` key already exists.

/**
 * Bootstrap the very first profile on a fresh device. Deliberately NOT gated by
 * the admin password — with zero users there is nobody to authenticate against,
 * and without this the app would be unreachable (users are otherwise only
 * created from Settings → Users, behind login). Refuses once any user exists.
 * The new account's password is null → adopted on first login, like all users.
 */
export function createFirstUser(id: string, name: string, initial: string): AdminResult {
  const existing = getUsers()
  if (existing && Object.keys(existing).length > 0) {
    return { success: false, error: 'Users already exist' }
  }
  if (!/^[a-zA-Z0-9_]+$/.test(id)) {
    return { success: false, error: 'Invalid user id' }
  }
  const users: Record<string, User> = {
    [id]: {
      id,
      name,
      displayName: name,
      initial,
      password: null,
      created: new Date().toISOString(),
      lastLogin: null,
    },
  }
  saveUsers(users)
  return { success: true, message: `User ${name} created successfully` }
}

// ─── Password ─────────────────────────────────────────────────────────────────

/** Simple obfuscation — not cryptographically secure, sufficient for local parental controls. */
function hashPassword(password: string): string {
  return btoa(PASSWORD_SALT + password + PASSWORD_SALT)
}

function verifyPassword(password: string, hashed: string): boolean {
  return hashPassword(password) === hashed
}

function setUserPassword(userId: string, password: string): boolean {
  const users = getUsers()
  if (users && users[userId]) {
    users[userId].password = hashPassword(password)
    saveUsers(users)
    return true
  }
  return false
}

/** Whether a user has not yet chosen a password (first login sets it). */
export function needsPasswordSetup(userId: string): boolean {
  const user = getUser(userId)
  return !!user && user.password === null
}

// ─── Session ───────────────────────────────────────────────────────────────────

function getCurrentSession(): Session | null {
  return readJSON<Session>(SESSION_KEY)
}

/**
 * Log a user in. First login (password === null) sets the entered password.
 * On success writes the session + currentUser, stamps lastLogin, and notifies
 * subscribers (so the React AuthGate flips immediately, not on the next poll).
 */
export function login(userId: string, password: string): LoginResult {
  const user = getUser(userId)
  if (!user) {
    return { success: false, error: 'משתמש לא קיים / User not found' }
  }

  if (user.password === null) {
    // First-time setup: adopt the entered password.
    setUserPassword(userId, password)
  } else if (!verifyPassword(password, user.password)) {
    return { success: false, error: 'סיסמה שגויה / Incorrect password' }
  }

  const session: Session = {
    userId,
    userName: user.name,
    displayName: user.displayName,
    initial: user.initial,
    loginTime: Date.now(),
    lastActivity: Date.now(),
    authenticated: true,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(CURRENT_USER_KEY, userId) // back-compat

  const users = getUsers()
  if (users && users[userId]) {
    users[userId].lastLogin = new Date().toISOString()
    saveUsers(users)
  }

  lastActivityTime = Date.now()

  // Legacy dispatched `user-logged-in` (useEngineBoot's comment references it).
  window.dispatchEvent(new CustomEvent('user-logged-in', { detail: { userId, user } }))
  notifyAuthChanged()

  return { success: true, user: getUser(userId) ?? user, session }
}

/** Clear the session and notify subscribers (no page reload — see file header). */
export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
  // currentUser is intentionally left for back-compat (legacy did the same).
  notifyAuthChanged()
}

/** Whether a valid, non-expired session exists. Lazily expires on idle timeout. */
export function isAuthenticated(): boolean {
  const session = getCurrentSession()
  if (!session || !session.authenticated) return false

  const timeSinceActivity = Date.now() - (session.lastActivity || session.loginTime)
  if (timeSinceActivity > SESSION_TIMEOUT) {
    logout()
    return false
  }
  return true
}

export function getCurrentUser(): User | null {
  const session = getCurrentSession()
  if (session && isAuthenticated()) {
    return getUser(session.userId)
  }
  return null
}

export function getCurrentUserId(): string | null {
  const session = getCurrentSession()
  return session ? session.userId : null
}

let lastActivityTime = Date.now()

/** Refresh the idle timer (called on user interaction while authenticated). */
function updateActivity(): void {
  lastActivityTime = Date.now()
  const session = getCurrentSession()
  if (session) {
    session.lastActivity = lastActivityTime
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

// ─── Subscription ──────────────────────────────────────────────────────────────

function notifyAuthChanged(): void {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

/**
 * Subscribe to auth changes. Returns an unsubscribe function. Fires immediately
 * with the current user, then on every `auth-changed` event (instant in-app
 * login/logout) and on a 500ms poll (catches sessions written directly to
 * localStorage — e.g. the test harness — and lazy idle expiry).
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  let lastUserId: string | null | undefined

  const check = () => {
    const user = getCurrentUser()
    const currentId = user?.id ?? null
    if (currentId !== lastUserId) {
      lastUserId = currentId
      callback(user)
    }
  }

  check()

  window.addEventListener(AUTH_CHANGED_EVENT, check)
  const intervalId = setInterval(check, 500)
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, check)
    clearInterval(intervalId)
  }
}

/** Get all registered users. */
export function getAllUsers(): User[] {
  const users = getUsers()
  return users ? Object.values(users) : []
}

// ─── Parent (admin) password — per-device, Tier 2 ───────────────────────────

/** Whether this device has a parent password set up yet. */
export function hasParentPassword(): boolean {
  return localStorage.getItem(PARENT_PASSWORD_KEY) !== null
}

/** Store the per-device parent password (hashed, same scheme as kid passwords). */
export function setParentPassword(password: string): void {
  localStorage.setItem(PARENT_PASSWORD_KEY, hashPassword(password))
}

/**
 * Wipe ONLY the parent password ("שכחתי סיסמה"). The create wizard re-runs on
 * the next protected access. Deliberately reachable without the old password —
 * the gate is against a wandering kid, not an attacker, and a no-reset design
 * risks permanent parent lockout.
 */
export function resetParentPassword(): void {
  localStorage.removeItem(PARENT_PASSWORD_KEY)
}

/** Verify the admin (parent) password. False when none is set up yet. */
export function verifyAdminPassword(password: string): boolean {
  const stored = localStorage.getItem(PARENT_PASSWORD_KEY)
  return stored !== null && verifyPassword(password, stored)
}

/**
 * Whether the currently-logged-in user is a parent or manager — used to
 * auto-unlock protected settings without a password prompt.
 */
export function isCurrentUserAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'parent' || user?.role === 'manager'
}

/** Create a new user account. Requires the admin password. */
export function addUser(
  id: string,
  name: string,
  displayName: string,
  initial: string,
  adminPassword: string,
): AdminResult {
  if (!verifyAdminPassword(adminPassword)) {
    return { success: false, error: 'Incorrect admin password' }
  }
  const users = getUsers() ?? {}
  if (users[id]) {
    return { success: false, error: 'User already exists' }
  }
  users[id] = {
    id,
    name,
    displayName,
    initial,
    password: null,
    created: new Date().toISOString(),
    lastLogin: null,
  }
  saveUsers(users)
  return { success: true, message: `User ${displayName} created successfully` }
}

/** Reset a user's password (they set a new one on next login). Requires admin password. */
export function resetUserPassword(userId: string, adminPassword: string): AdminResult {
  if (!verifyAdminPassword(adminPassword)) {
    return { success: false, error: 'Incorrect admin password' }
  }
  const users = getUsers()
  if (!users || !users[userId]) {
    return { success: false, error: 'User not found' }
  }
  users[userId].password = null
  saveUsers(users)
  return {
    success: true,
    message: `Password reset for ${users[userId].displayName}. They will set a new password on next login.`,
  }
}

/** Delete a user and their localStorage data. Requires admin password. */
export function deleteUser(userId: string, adminPassword: string): AdminResult {
  if (!verifyAdminPassword(adminPassword)) {
    return { success: false, message: 'Incorrect admin password' }
  }
  const users = getUsers()
  if (!users || !users[userId]) {
    return { success: false, message: 'User not found' }
  }
  if (userId === 'manager') {
    return { success: false, message: 'Cannot delete manager account' }
  }
  delete users[userId]
  saveUsers(users)

  // Faithful to legacy: removes the unprefixed legacy data keys.
  localStorage.removeItem(`userProgress_${userId}`)
  const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading']
  gameTypes.forEach((game) => localStorage.removeItem(`scoreHistory_${userId}_${game}`))

  return { success: true, message: 'User deleted successfully' }
}

/**
 * Toggle / assign a role for a user. Not gated by admin password on its own —
 * callers must verify admin before invoking.
 */
export function setUserRole(userId: string, role: UserRole | null): AdminResult {
  const users = getUsers()
  if (!users || !users[userId]) {
    return { success: false, error: 'User not found' }
  }
  if (role) {
    users[userId].role = role
  } else {
    delete users[userId].role
  }
  saveUsers(users)
  return { success: true }
}

// ─── Module init (browser side effects) ─────────────────────────────────────

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  // No first-run seeding here (removed for INFRA1 — see createFirstUser above).

  // Reset the idle timer on interaction so an active session never expires.
  if (typeof document !== 'undefined') {
    const events: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          if (isAuthenticated()) updateActivity()
        },
        { passive: true },
      )
    })
  }
}
