import { useState, useEffect } from 'react'
import type { UserSummary } from '@/bridge/types'
import { getUserSummary } from '@/bridge/progress'

const POLL_INTERVAL = 500

/**
 * React hook that provides a summary of the current user's progress.
 * Polls localStorage for changes at a 500ms interval.
 */
export function useUserProgress(): UserSummary {
  const [summary, setSummary] = useState<UserSummary>(() => getUserSummary())

  useEffect(() => {
    const id = setInterval(() => {
      const next = getUserSummary()
      setSummary((prev) => {
        if (
          prev.streakDays === next.streakDays &&
          prev.wordsLearned === next.wordsLearned &&
          prev.coins === next.coins &&
          prev.totalScore === next.totalScore &&
          prev.totalGamesPlayed === next.totalGamesPlayed
        ) {
          return prev // avoid unnecessary re-renders
        }
        return next
      })
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return summary
}
