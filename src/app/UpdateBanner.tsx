import { useEffect, useState } from 'react'

export function UpdateBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-3 z-[9999] flex items-center justify-between gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-white shadow-xl"
    >
      <span className="text-sm font-semibold">✨ גרסה חדשה זמינה</span>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-blue-700 active:opacity-80"
        >
          עדכן עכשיו
        </button>
        <button
          onClick={() => setVisible(false)}
          aria-label="סגור"
          className="rounded-xl px-2 py-1.5 text-sm opacity-70 active:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
