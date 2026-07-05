/**
 * src/lib/storageEvents.ts — window event names for storage-health signals
 * (design-flaws fix, 2026-07-05).
 *
 * The engine (`AppState.persistUserProgress`) dispatches these when a progress
 * write throws (quota / privacy mode) and when a later write succeeds again.
 * `src/bridge/storageHealth.ts` subscribes and the AppShell shows a warning
 * banner — a failed save used to be a silent `console.error` while the child
 * kept playing with nothing persisting.
 */
export const SAVE_ERROR_EVENT = 'elg:save-error'
export const SAVE_RECOVERED_EVENT = 'elg:save-recovered'
