import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './router'
import { warmUpConfetti } from '@/bridge/feedback'
import { useEngineBoot } from '@/hooks/useEngineBoot'

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
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
