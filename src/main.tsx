import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { cn } from './lib/cn'
import './styles/globals.css'

function App() {
  return (
    <section
      data-theme="dark"
      className="px-4 py-6 sm:px-6"
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <div
        className={cn(
          'mx-auto max-w-4xl rounded-2xl border border-white/10 bg-surface/95 p-6 text-text shadow-panel backdrop-blur',
          'sm:p-8',
        )}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full bg-learn/15 px-3 py-1 text-sm font-semibold text-learn">
              Phase 0 · Slice 0.2
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-3xl leading-tight text-text sm:text-4xl">
                Styling foundation is active inside the React boundary.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Tailwind utilities, RTL defaults, scoped reset rules, and theme tokens are now
                wired under <code>#react-root</code> without touching the legacy layout.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm font-semibold sm:min-w-64">
            <div className="rounded-xl bg-white/5 px-4 py-3 text-learn">למידה</div>
            <div className="rounded-xl bg-white/5 px-4 py-3 text-practice">תרגול</div>
            <div className="rounded-xl bg-white/5 px-4 py-3 text-challenge">אתגר</div>
            <div className="rounded-xl bg-white/5 px-4 py-3 text-test">מבחן</div>
          </div>
        </div>
      </div>
    </section>
  )
}

const root = document.getElementById('react-root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
