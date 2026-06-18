import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { MobileTopBar } from './MobileTopBar'
import { MobileBottomNav } from './MobileBottomNav'
import { PageContainer } from './PageContainer'
import { BugReportWidget } from '@/features/feedback/BugReportWidget'
import { isReactGame } from '@/features/games/reactGames'
import { usePlayerPrefs } from '@/hooks/usePlayerPrefs'
import { playLoginChime } from '@/bridge/feedback'

export function AppShell() {
  const { pathname } = useLocation()
  const { prefs } = usePlayerPrefs()
  const isGameRoute = pathname.startsWith('/game/')
  const gameId = isGameRoute ? pathname.slice('/game/'.length) : null

  // Apply the logged-in player's look (theme/contrast/motion/text) to #react-root
  // so it covers every authenticated route (hub + games). The element themes.css
  // targets is #react-root itself; bigText scales the rem base via an <html>
  // class (the #react-root scope can't move rem). Resets on logout (unmount).
  useEffect(() => {
    const root = document.getElementById('react-root')
    if (!root) return
    root.setAttribute('data-theme', prefs.theme)
    root.setAttribute('data-contrast', String(prefs.highContrast))
    root.setAttribute('data-reduced-motion', String(prefs.reducedMotion))
    document.documentElement.classList.toggle('app-big-text', prefs.bigText)
    return () => {
      root.setAttribute('data-theme', 'dark')
      root.removeAttribute('data-contrast')
      root.removeAttribute('data-reduced-motion')
      document.documentElement.classList.remove('app-big-text')
    }
  }, [prefs.theme, prefs.highContrast, prefs.reducedMotion, prefs.bigText])

  // Reset scroll to the top on every route change (M17 / beta #14). #react-root
  // is the app's scroll layer (see the fixed-overflow effect below), so a deep
  // scroll on one tab page used to carry into the next (scroll Settings to the
  // bottom → switch to Home → land at Home's bottom). One app-shell-level reset
  // covers every tab page.
  useEffect(() => {
    document.getElementById('react-root')?.scrollTo(0, 0)
  }, [pathname])

  // Login/welcome chime — once when the authenticated shell mounts (i.e. per
  // sign-in; the shell persists across hub/game navigation and unmounts only on
  // logout). The login button is a user gesture, so audio is allowed to start.
  useEffect(() => {
    playLoginChime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // A "React-driven" route is anything that renders inside #react-root —
  // i.e. every hub route plus any game whose ID is in REACT_GAME_IDS. Legacy
  // games need the class removed so their DOM (#listening-game etc.) shows.
  const isReactDriven = !isGameRoute || isReactGame(gameId)

  useEffect(() => {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) return

    // Make #react-root a full-viewport scroll layer with the app background.
    // (The legacy-DOM `react-shell-active` suppression that used to ride along
    // here was retired in Slice 4.5 when the legacy `.app-layout` markup +
    // `styles.css` were deleted — there's nothing left to hide.)

    if (!isReactDriven) {
      reactRoot.style.position = ''
      reactRoot.style.inset = ''
      reactRoot.style.zIndex = ''
      reactRoot.style.overflowY = ''
      reactRoot.style.background = ''
      return
    }

    reactRoot.style.position = 'fixed'
    reactRoot.style.inset = '0'
    reactRoot.style.zIndex = '20'
    reactRoot.style.overflowY = 'auto'
    reactRoot.style.background = 'var(--color-canvas)'

    return () => {
      reactRoot.style.position = ''
      reactRoot.style.inset = ''
      reactRoot.style.zIndex = ''
      reactRoot.style.overflowY = ''
      reactRoot.style.background = ''
    }
  }, [isReactDriven])

  if (isGameRoute) {
    return (
      <>
        <Outlet />
        <BugReportWidget />
      </>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <TopNav />
      <MobileTopBar />
      <PageContainer>
        <Outlet />
      </PageContainer>
      <MobileBottomNav />
      <BugReportWidget />
    </div>
  )
}
