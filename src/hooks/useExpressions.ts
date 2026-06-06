import { useState, useEffect, useCallback } from 'react'
import {
  getExpressionBank,
  getExpressionsByType,
  type Expression,
  type ExpressionType,
} from '@/bridge/expressions'

/**
 * React hook exposing the register-filtered expression bank.
 *
 * The bank is populated by data/_loader.js, which may finish AFTER React mounts.
 * Like useGameUnlocks (re-reads on `engine-ready`), this re-reads on the
 * `game-data-ready` window event so the list isn't empty if we mount first.
 *
 * No game consumes this yet (Slice 5.1 is data plumbing); the hook exists so 5.3
 * games can `const { expressions } = useExpressions()` without touching globals.
 */
export function useExpressions() {
  const [expressions, setExpressions] = useState<Expression[]>(() => getExpressionBank())

  const refresh = useCallback(() => {
    setExpressions(getExpressionBank())
  }, [])

  useEffect(() => {
    // Re-read once data is ready (handles React-mounts-before-loader ordering).
    if (typeof window !== 'undefined' && (window as { __gameDataReady?: boolean }).__gameDataReady) {
      refresh()
    }
    window.addEventListener('game-data-ready', refresh)
    return () => window.removeEventListener('game-data-ready', refresh)
  }, [refresh])

  const byType = useCallback(
    (type: ExpressionType) => getExpressionsByType(type),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expressions],
  )

  return { expressions, byType, refresh }
}
