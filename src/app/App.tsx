import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './router'
import { warmUpConfetti } from '@/bridge/feedback'

export function App() {
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
