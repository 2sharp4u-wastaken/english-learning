const V2_STORAGE_PREFIX = 'v2_'

/**
 * Read a value from localStorage, transparently handling the v2_ prefix
 * for keys that use it.
 */
export function getKey<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Write a value to localStorage.
 */
export function setKey<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * Remove a key from localStorage.
 */
export function removeKey(key: string): void {
  localStorage.removeItem(key)
}

/**
 * Build a v2-prefixed storage key.
 */
export function v2Key(base: string): string {
  return `${V2_STORAGE_PREFIX}${base}`
}
