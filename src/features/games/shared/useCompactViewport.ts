import { useEffect, useState } from 'react'

/**
 * True when the viewport is too SHORT to afford the full game chrome — small
 * portrait phones AND any landscape phone (where height collapses to ~360px).
 * Drives the compact mode in GameScreenShell/GameHero so the pinned chrome
 * (hero title, paddings) shrinks and the question stops being pushed off-screen.
 * (M3, 2026-06-14.) Keyed on viewport HEIGHT, not width, on purpose — landscape
 * is wide but short, and that's the worst case.
 */
export function useCompactViewport(maxHeightPx = 600): boolean {
  const query = `(max-height: ${maxHeightPx}px)`
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setCompact(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return compact
}
