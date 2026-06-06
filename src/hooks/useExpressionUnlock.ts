import { useEffect, useState } from 'react'
import { getExpressionUnlock, type ExpressionUnlock } from '@/bridge/expressionGame'

const POLL_INTERVAL = 500

/**
 * Live expression-gate state for the Home "ביטויים" tier (Slice 5.3). Mirrors
 * useGameUnlocks: the gate reads the engine's derived-learned count, which isn't
 * available on a fresh login until `engine-ready`, so recompute on that event
 * (plus a poll so a word learned mid-session opens the tier without a reload).
 */
export function useExpressionUnlock(): ExpressionUnlock {
  const [state, setState] = useState<ExpressionUnlock>(() => getExpressionUnlock())

  useEffect(() => {
    const refresh = () => {
      const next = getExpressionUnlock()
      setState((prev) =>
        prev.unlocked === next.unlocked &&
        prev.learnedCount === next.learnedCount &&
        prev.hasContent === next.hasContent
          ? prev
          : next,
      )
    }
    refresh()
    window.addEventListener('engine-ready', refresh)
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => {
      window.removeEventListener('engine-ready', refresh)
      clearInterval(id)
    }
  }, [])

  return state
}
