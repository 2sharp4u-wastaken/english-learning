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

// Code-split safety net: a lazy chunk can fail to load when the page is holding
// chunk URLs a newer deploy removed (the classic PWA + code-splitting trap), or on
// a transient network drop. Reload to pull the fresh index + chunk graph. The
// timestamp guard reloads at most once per 10s so a genuinely-down server shows the
// error instead of looping. Without this, a stale service-worker cache referencing
// deleted chunks hard-crashes every game route ("Failed to fetch dynamically
// imported module").
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem('vite-preload-reload-at') || 0)
  if (Date.now() - last < 10_000) return
  sessionStorage.setItem('vite-preload-reload-at', String(Date.now()))
  window.location.reload()
})

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
