import type { User, UserRole, Session } from './types'
import { getKey } from './storage'

// ─── Legacy global access ────────────────────────────────────────────────────

interface AdminResult { success: boolean; message?: string; error?: string }

interface LegacyAuthService {
  getCurrentUser(): User | null
  getCurrentUserId(): string | null
  getCurrentSession(): Session | null
  isAuthenticated(): boolean
  getUsers(): Record<string, User> | null
  getUser(id: string): User | null
  login(userId: string, password: string): { success: boolean; error?: string; user?: User; session?: Session }
  logout(): void
  verifyAdminPassword(password: string): boolean
  addUser(id: string, name: string, displayName: string, initial: string, adminPassword: string): AdminResult
  resetUserPassword(userId: string, adminPassword: string): AdminResult
  deleteUser(userId: string, adminPassword: string): AdminResult
  saveUsers(users: Record<string, User>): void
}

function getAuthService(): LegacyAuthService | null {
  return (window as any).authService ?? null
}

function requireAuthService(): LegacyAuthService {
  const svc = getAuthService()
  if (!svc) throw new Error('AuthService not initialized')
  return svc
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * Get the currently authenticated user, or null if no session.
 * Reads from the legacy AuthService global first, falls back to localStorage.
 */
export function getCurrentUser(): User | null {
  const svc = getAuthService()
  if (svc) {
    return svc.getCurrentUser() ?? null
  }
  // Fallback: read session from localStorage directly
  const session = getKey<Session>('currentSession')
  if (!session?.authenticated) return null
  const users = getKey<Record<string, User>>('users')
  return users?.[session.userId] ?? null
}

/**
 * Get the current user ID, or null.
 */
export function getCurrentUserId(): string | null {
  const svc = getAuthService()
  if (svc) return svc.getCurrentUserId()
  const session = getKey<Session>('currentSession')
  return session?.userId ?? null
}

/**
 * Check whether a user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  const svc = getAuthService()
  if (svc) return svc.isAuthenticated()
  const session = getKey<Session>('currentSession')
  return session?.authenticated === true
}

/**
 * Subscribe to auth changes. Returns an unsubscribe function.
 * During the legacy phase, this polls for changes every 500ms.
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

  // Initial check
  check()

  const intervalId = setInterval(check, 500)
  return () => clearInterval(intervalId)
}

/**
 * Get all registered users.
 */
export function getAllUsers(): User[] {
  const svc = getAuthService()
  if (svc?.getUsers) {
    const users = svc.getUsers()
    return users ? Object.values(users) : []
  }
  // Fallback: read from localStorage (auth.js stores users at the unprefixed 'users' key).
  const users = getKey<Record<string, User>>('users')
  return users ? Object.values(users) : []
}

/**
 * Log out the current user.
 * Delegates to the legacy AuthService if available, otherwise clears session from localStorage.
 */
export function logout(): void {
  const svc = getAuthService()
  if (svc) {
    svc.logout()
    return
  }
  // Fallback: clear session manually
  localStorage.removeItem('currentUser')
  localStorage.removeItem('v2_currentSession')
}

// ─── Admin CRUD ─────────────────────────────────────────────────────────────

/**
 * Verify the admin password against the legacy AuthService.
 */
export function verifyAdminPassword(password: string): boolean {
  const svc = getAuthService()
  return svc?.verifyAdminPassword(password) ?? false
}

/**
 * Whether the currently-logged-in user is a parent or manager — used to
 * auto-unlock protected settings without a password prompt.
 */
export function isCurrentUserAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'parent' || user?.role === 'manager'
}

/**
 * Create a new user account. Requires the admin password.
 */
export function addUser(
  id: string,
  name: string,
  displayName: string,
  initial: string,
  adminPassword: string,
): AdminResult {
  return requireAuthService().addUser(id, name, displayName, initial, adminPassword)
}

/**
 * Reset a user's password (they will set a new one on next login).
 * Requires the admin password.
 */
export function resetUserPassword(userId: string, adminPassword: string): AdminResult {
  return requireAuthService().resetUserPassword(userId, adminPassword)
}

/**
 * Delete a user and their localStorage data. Requires the admin password.
 */
export function deleteUser(userId: string, adminPassword: string): AdminResult {
  return requireAuthService().deleteUser(userId, adminPassword)
}

/**
 * Toggle / assign a role for a user. Not gated by admin password on its
 * own — callers must verify admin before invoking.
 */
export function setUserRole(userId: string, role: UserRole | null): AdminResult {
  const svc = requireAuthService()
  const users = svc.getUsers()
  if (!users || !users[userId]) {
    return { success: false, error: 'User not found' }
  }
  if (role) {
    users[userId].role = role
  } else {
    delete users[userId].role
  }
  svc.saveUsers(users)
  return { success: true }
}
