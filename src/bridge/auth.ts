import type { User, Session } from './types'
import { getKey } from './storage'

// ─── Legacy global access ────────────────────────────────────────────────────

interface LegacyAuthService {
  getCurrentUser(): User | null
  getCurrentUserId(): string | null
  getCurrentSession(): Session | null
  isAuthenticated(): boolean
  getUsers(): Record<string, User> | null
  getUser(id: string): User | null
  login(userId: string, password: string): { success: boolean; error?: string; user?: User; session?: Session }
  logout(): void
}

function getAuthService(): LegacyAuthService | null {
  return (window as any).authService ?? null
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
