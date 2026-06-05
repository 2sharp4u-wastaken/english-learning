import { useState, useEffect } from 'react'
import type { GameUnlockEntry } from '@/bridge/types'
import { getAllGameUnlocks } from '@/bridge/games'

const POLL_INTERVAL = 500

/**
 * React hook that provides the unlock state of all games.
 *
 * `getAllGameUnlocks()` reads the LIVE engine's progress first (`bridge/progress`
 * prefers `getApp().userProgress`, falling back to localStorage). On a fresh login
 * the engine isn't built yet when Home first mounts, so the initial read returns
 * `{}` — and since an *absent* entry counts as unlocked, the grid briefly shows
 * EVERY gated game as open and clickable until the next poll catches up (FU-4.1;
 * same engine-ready race as FU-HOME-continue). Recomputing on the `engine-ready`
 * event closes that window immediately instead of waiting up to `POLL_INTERVAL`.
 *
 * The 500ms poll is still needed so in-session unlocks (`checkAndUnlockGames`
 * during gameplay) surface without a navigation.
 */
export function useGameUnlocks(): Record<string, GameUnlockEntry> {
  const [unlocks, setUnlocks] = useState<Record<string, GameUnlockEntry>>(() => getAllGameUnlocks())

  useEffect(() => {
    const refresh = () => {
      const next = getAllGameUnlocks()
      setUnlocks((prev) => {
        // Shallow comparison on serialized form to avoid unnecessary re-renders
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(next)
        if (prevKeys.length !== nextKeys.length) return next
        for (const k of prevKeys) {
          if (prev[k]?.unlocked !== next[k]?.unlocked) return next
        }
        return prev
      })
    }
    // Recompute once on mount (the engine may have become ready in the gap between
    // the initial render and this effect attaching), then on every engine-ready.
    refresh()
    window.addEventListener('engine-ready', refresh)
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => {
      window.removeEventListener('engine-ready', refresh)
      clearInterval(id)
    }
  }, [])

  return unlocks
}
