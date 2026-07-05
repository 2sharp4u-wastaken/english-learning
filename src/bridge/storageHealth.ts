import { SAVE_ERROR_EVENT, SAVE_RECOVERED_EVENT } from '../lib/storageEvents'

/**
 * src/bridge/storageHealth.ts — surface progress-save failures to the UI
 * (design-flaws fix, 2026-07-05).
 *
 * `AppState.persistUserProgress` dispatches SAVE_ERROR_EVENT when the
 * localStorage write throws (quota exceeded / privacy mode) and
 * SAVE_RECOVERED_EVENT when a later write succeeds. Before this, a failed save
 * was a silent `console.error` — the child kept playing while NOTHING
 * persisted. `useStorageHealth` + the AppShell banner consume this bridge.
 */

let saveFailed = false

export function getSaveFailed(): boolean {
  return saveFailed
}

/** Subscribe to save-health changes. Returns an unsubscribe function. */
export function onStorageHealthChange(callback: (failed: boolean) => void): () => void {
  const onError = () => {
    saveFailed = true
    callback(true)
  }
  const onRecovered = () => {
    saveFailed = false
    callback(false)
  }
  window.addEventListener(SAVE_ERROR_EVENT, onError)
  window.addEventListener(SAVE_RECOVERED_EVENT, onRecovered)
  return () => {
    window.removeEventListener(SAVE_ERROR_EVENT, onError)
    window.removeEventListener(SAVE_RECOVERED_EVENT, onRecovered)
  }
}

/**
 * Ask the browser to protect this origin's storage from eviction. All child
 * progress lives in localStorage; without persistence the browser may evict it
 * under storage pressure (months of a kid's progress, silently gone). Chrome
 * grants by heuristics (installed PWA / engagement), Firefox may prompt.
 * Best-effort: a false/absent answer is fine — we just tried.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
