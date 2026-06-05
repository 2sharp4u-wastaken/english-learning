import { useEffect, useState } from 'react'
import type { ContinueTarget } from '@/bridge/types'
import { getContinueTarget } from '@/bridge/games'

/**
 * Reactive "continue" CTA target for the home hero.
 *
 * `getContinueTarget()` reads the LIVE engine (game registry + progress manager).
 * On a fresh login the engine may not be built yet when Home first mounts, so the
 * initial read returns `null` → the hero falls back to Word Journey; on a warm
 * refresh the engine is already up and the read returns the real decision (e.g.
 * the review nudge when words are Due). That race made the CTA flip between loads
 * (FU-HOME-continue). Recomputing on the `engine-ready` event makes both paths
 * converge on the engine-ready value.
 *
 * We deliberately do NOT poll: `getContinueTarget` rotates the review game with
 * `Math.random()`, so recomputing every tick would silently re-target the button
 * (the visible label/icon are stable per kind, but the navigation destination
 * would drift). Home remounts on navigation, so a returning player still gets a
 * fresh decision each visit.
 */
export function useContinueTarget(): ContinueTarget | null {
  const [target, setTarget] = useState<ContinueTarget | null>(() => getContinueTarget())

  useEffect(() => {
    const recompute = () => setTarget(getContinueTarget())
    // Recompute once on mount too, in case the engine became ready in the gap
    // between the initial render and this effect attaching its listener.
    recompute()
    window.addEventListener('engine-ready', recompute)
    return () => window.removeEventListener('engine-ready', recompute)
  }, [])

  return target
}
