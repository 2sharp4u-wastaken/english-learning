import { useState, useEffect, useRef } from 'react'
import { Lock, X } from 'lucide-react'
import { cn } from '@/lib/cn'

// onSubmit returns null on success, or an error message to display.
// May be sync or async — async supports flows that verify the password AND
// run a gated action (e.g. deleteUser) before closing.
type Verifier = (password: string) => string | null | Promise<string | null>

interface Props {
  open: boolean
  title?: string
  description?: string
  submitLabel?: string
  onClose: () => void
  onSubmit: Verifier
}

export function ParentPasswordModal({
  open,
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError(null)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await onSubmit(password)
      if (result) {
        setError(result)
        setPassword('')
        inputRef.current?.focus()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2 text-text">
            <Lock size={18} />
            <span className="font-display text-base font-semibold">
              {title ?? 'הגדרות מוגנות'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-white/5 hover:text-text"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <p className="text-sm text-muted">
            {description ?? 'הזן את סיסמת ההורה כדי להציג את ההגדרות המוגנות.'}
          </p>
          <div className="space-y-1.5">
            <label htmlFor="parent-password" className="block text-xs font-medium text-muted">
              סיסמה
            </label>
            <input
              id="parent-password"
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              className={cn(
                'w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-text outline-none transition-colors',
                error
                  ? 'border-coral-400/60 focus:border-coral-400'
                  : 'border-white/10 focus:border-white/25',
              )}
            />
            {error && <p className="text-xs text-coral-400">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-learn/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-learn disabled:opacity-60"
            >
              {submitLabel ?? 'פתיחה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
