import { useState, useEffect, useRef } from 'react'
import { Lock, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { hasParentPassword, setParentPassword } from '@/bridge/auth'

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

const MIN_LENGTH = 4

/**
 * Parent gate for protected surfaces (Tier 2, backlog §4). Two modes, decided
 * per open by whether this device has a stored parent password:
 *  - "verify": classic single password prompt. There is intentionally NO
 *    unauthenticated "forgot password" reset (issue #10) — like any standard
 *    admin account, the password can't be reset without first authenticating.
 *    The parent CHANGES it from inside the parent area (כלי הורה → תחזוקה); a
 *    truly-forgotten password is recovered by clearing the app's data.
 *  - "create": first-access setup (only when NO parent password exists yet —
 *    onboarding / migration) — choose a password, enter it twice; it is stored
 *    hashed, then flows into the SAME onSubmit so the pending gated action
 *    proceeds without a second prompt. Once a password exists this never shows.
 */
export function ParentPasswordModal({
  open,
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: Props) {
  const [mode, setMode] = useState<'verify' | 'create'>('verify')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setMode(hasParentPassword() ? 'verify' : 'create')
    setPassword('')
    setConfirm('')
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

  const creating = mode === 'create'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (creating) {
      if (password.length < MIN_LENGTH) {
        setError(`סיסמה קצרה מדי — לפחות ${MIN_LENGTH} תווים`)
        return
      }
      if (password !== confirm) {
        setError('הסיסמאות אינן תואמות')
        setConfirm('')
        return
      }
    }
    setBusy(true)
    try {
      if (creating) setParentPassword(password)
      const result = await onSubmit(password)
      if (result) {
        setError(result)
        setPassword('')
        setConfirm('')
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
              {creating ? 'יצירת סיסמת הורה' : title ?? 'הגדרות מוגנות'}
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
            {creating
              ? 'אין עדיין סיסמת הורה במכשיר הזה. בחרו סיסמה — היא תידרש לכל הגדרה מוגנת.'
              : description ?? 'יש להזין את סיסמת ההורה כדי להציג את ההגדרות המוגנות.'}
          </p>
          <div className="space-y-1.5">
            <label htmlFor="parent-password" className="block text-xs font-medium text-muted">
              {creating ? 'סיסמה חדשה' : 'סיסמה'}
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
            {creating && (
              <>
                <label
                  htmlFor="parent-password-confirm"
                  className="block pt-1 text-xs font-medium text-muted"
                >
                  אימות סיסמה
                </label>
                <input
                  id="parent-password-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (error) setError(null)
                  }}
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-text outline-none transition-colors',
                    error
                      ? 'border-coral-400/60 focus:border-coral-400'
                      : 'border-white/10 focus:border-white/25',
                  )}
                />
              </>
            )}
            {error && <p className="text-xs text-coral-400">{error}</p>}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="ms-auto flex items-center gap-2">
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
                {creating ? 'שמירה' : submitLabel ?? 'פתיחה'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
