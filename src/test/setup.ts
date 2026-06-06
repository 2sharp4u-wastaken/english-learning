/**
 * Vitest global setup (Slice 4.6).
 *
 * jsdom's `localStorage` is unavailable on an opaque origin and flaky to rely on
 * across versions, so we install a tiny in-memory Storage polyfill when one isn't
 * already present. The engine reads/writes `v2_*` keys in a few constructors;
 * `beforeEach` clears it so unit tests stay isolated.
 */
import { beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

function ensureStorage() {
  const g = globalThis as any
  if (!g.localStorage || typeof g.localStorage.getItem !== 'function') {
    g.localStorage = new MemoryStorage()
  }
}

ensureStorage()

beforeEach(() => {
  ;(globalThis as any).localStorage?.clear?.()
})
