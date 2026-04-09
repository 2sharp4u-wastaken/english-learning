import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Heebo, sans-serif', direction: 'rtl' }}>
      <h1>React shell loaded</h1>
      <p>Phase 0, Slice 0.1 — tooling bootstrap complete.</p>
    </div>
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
