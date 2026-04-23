import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { MobileTopBar } from './MobileTopBar'
import { MobileBottomNav } from './MobileBottomNav'
import { PageContainer } from './PageContainer'

export function AppShell() {
  const { pathname } = useLocation()
  const isGameRoute = pathname.startsWith('/game/')

  useEffect(() => {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) return

    if (isGameRoute) {
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
  }, [isGameRoute])

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
