import { useEffect, useState } from 'react'

/**
 * True when the viewport is too SHORT to afford the full game chrome — small
 * portrait phones AND any landscape phone (where height collapses to ~360px).
 * Drives the compact mode in GameScreenShell/GameHero so the pinned chrome
 * (hero title, paddings) shrinks and the question stops being pushed off-screen.
 * (M3, 2026-06-14.) Keyed on viewport HEIGHT, not width, on purpose — landscape
 * is wide but short, and that's the worst case.
 *
 * Threshold raised 600→700 (2026-06-16) after beta reports #3/#4: a 320×680
 * portrait phone (above the old 600 cutoff) couldn't fit Word Journey's chrome +
 * prompt + Next button → had to scroll. 700 catches phones (whose browser
 * innerHeight is ≤~700 after the URL bar) while staying BELOW the common laptop
 * / test-default viewport height (720) so desktops keep the full, richer hero.
 * The landscape two-pane media query (globals.css) stays at 600 — that's
 * landscape-specific and every landscape phone is well under it.
 */
export function useCompactViewport(maxHeightPx = 700): boolean {
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
