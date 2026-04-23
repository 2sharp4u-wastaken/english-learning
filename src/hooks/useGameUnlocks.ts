import { useState, useEffect } from 'react'
import type { GameUnlockEntry } from '@/bridge/types'
import { getAllGameUnlocks } from '@/bridge/games'

const POLL_INTERVAL = 500

/**
 * React hook that provides the unlock state of all games.
 * Polls localStorage for changes at a 500ms interval.
 */
export function useGameUnlocks(): Record<string, GameUnlockEntry> {
  const [unlocks, setUnlocks] = useState<Record<string, GameUnlockEntry>>(() => getAllGameUnlocks())

  useEffect(() => {
    const id = setInterval(() => {
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
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return unlocks
}
