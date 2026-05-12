import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { MobileTopBar } from './MobileTopBar'
import { MobileBottomNav } from './MobileBottomNav'
import { PageContainer } from './PageContainer'
import { isReactGame } from '@/features/games/reactGames'

export function AppShell() {
  const { pathname } = useLocation()
  const isGameRoute = pathname.startsWith('/game/')
  const gameId = isGameRoute ? pathname.slice('/game/'.length) : null
  // A "React-driven" route is anything that renders inside #react-root —
  // i.e. every hub route plus any game whose ID is in REACT_GAME_IDS. Legacy
  // games need the class removed so their DOM (#listening-game etc.) shows.
  const isReactDriven = !isGameRoute || isReactGame(gameId)

  useEffect(() => {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) return

    // Legacy DOM suppression: toggle a class on body. CSS in globals.css
    // hides #top-header / #welcome-screen / #user-hub-screen / .app-layout
    // with !important. Class-based hiding survives the legacy
    // top-header.js cssText overwrites; inline display:none did not.

    if (!isReactDriven) {
      reactRoot.style.position = ''
      reactRoot.style.inset = ''
      reactRoot.style.zIndex = ''
      reactRoot.style.overflowY = ''
      reactRoot.style.background = ''
      document.body.classList.remove('react-shell-active')
      return
    }

    reactRoot.style.position = 'fixed'
    reactRoot.style.inset = '0'
    reactRoot.style.zIndex = '20'
    reactRoot.style.overflowY = 'auto'
    reactRoot.style.background = 'var(--color-canvas)'
    document.body.classList.add('react-shell-active')

    return () => {
      reactRoot.style.position = ''
      reactRoot.style.inset = ''
      reactRoot.style.zIndex = ''
      reactRoot.style.overflowY = ''
      reactRoot.style.background = ''
      document.body.classList.remove('react-shell-active')
    }
  }, [isReactDriven])

  if (isGameRoute) {
    return <Outlet />
  }

  return (
    <div
      data-theme="dark"
      className="flex min-h-screen flex-col"
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <TopNav />
      <MobileTopBar />
      <PageContainer>
        <Outlet />
      </PageContainer>
      <MobileBottomNav />
    </div>
  )
}
