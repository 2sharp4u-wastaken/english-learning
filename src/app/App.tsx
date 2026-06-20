import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './router'
import { UpdateBanner } from './UpdateBanner'
import { warmUpConfetti } from '@/bridge/feedback'
import { useEngineBoot } from '@/hooks/useEngineBoot'
import { useAuthSession } from '@/hooks/useAuthSession'
import { LoginPage } from '@/features/auth/LoginPage'

/**
 * Slice 4.4.b2: React owns auth. When no user is authenticated, render the React
 * login screen instead of the app shell (replaces the legacy `#login-modal`).
 * `useAuthSession` resolves the current user synchronously on mount, so a valid
 * existing session renders the app immediately with no login flash.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthSession()
  if (!isAuthenticated) return <LoginPage />
  return <>{children}</>
}

export function App() {
  // Slice 4.4.b1: React now owns engine startup (no more legacy app.js/gameLogic.js
  // boot scripts). This instantiates src/engine/* once data + auth are ready.
  useEngineBoot()

  // Warm canvas-confetti once so the first celebration doesn't stutter.
  useEffect(() => {
    const id = window.setTimeout(warmUpConfetti, 1200)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <>
      <Providers>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </Providers>
      <UpdateBanner />
    </>
  )
}
