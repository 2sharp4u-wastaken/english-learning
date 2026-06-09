import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/globals.css'

const root = document.getElementById('react-root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// PWA service worker — production only. In dev the SW would cache Vite's module
// graph and fight HMR, and `/sw.js` isn't served by the dev server anyway (it's
// emitted into dist/ by the build-only copy plugin). Defer to `load` so it never
// competes with first paint — but if `load` already fired (this module can run
// after it), register immediately, else the listener never fires.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failure is non-fatal — the app still runs online */
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
