/**
 * Manual "check for update" for the PWA (M22 follow-up).
 *
 * The automatic path (src/main.tsx) only notices an update when the browser's
 * own byte-diff of /sw.js finds a new worker — which, since the build bakes the
 * git SHA into sw.js's CACHE_VERSION (vite.config.ts), now happens on every real
 * deploy. This lets the user *force* that check on demand instead of waiting for
 * the next navigation. If a new worker is found it installs + (via skipWaiting)
 * activates, firing `controllerchange` → the existing UpdateBanner.
 */
export type UpdateCheckResult = 'updating' | 'current' | 'unsupported'

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported'
  }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'unsupported' // dev (no SW registered) or registration failed

  await reg.update() // ask the browser to re-fetch + byte-compare /sw.js now

  // If the re-fetch found a new worker it's already installing/waiting; the
  // controllerchange listener in main.tsx will raise the banner from here.
  if (reg.installing || reg.waiting) return 'updating'
  return 'current'
}
