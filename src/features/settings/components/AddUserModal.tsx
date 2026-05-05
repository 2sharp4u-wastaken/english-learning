import { useState, useEffect, useRef } from 'react'
import { UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (args: {
    id: string
    name: string
    displayName: string
    initial: string
    password: string
  }) => Promise<string | null>   // null on success, or error message
}

export function AddUserModal({ open, onClose, onSubmit }: Props) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [initial, setInitial] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setId('')
    setName('')
    setInitial('')
    setPassword('')
    setError(null)
    setBusy(false)
    const t = setTimeout(() => firstInputRef.current?.focus(), 50)
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

  function validate(): string | null {
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      return 'שם משתמש יכול להכיל אותיות אנגליות, מספרים וקו תחתון בלבד.'
    }
    if (!name.trim()) return 'נא להזין שם תצוגה.'
    if (!initial || initial.length !== 1) return 'יש להזין אות אחת בלבד לראשי תיבות.'
    if (!password) return 'נא להזין סיסמת הורה.'
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const localError = validate()
    if (localError) {
      setError(localError)
      return
    }
    setBusy(true)
    try {
      const result = await onSubmit({
        id: id.trim(),
        name: name.trim(),
        displayName: name.trim(),   // legacy uses the same value for both
        initial: initial.toUpperCase(),
        password,
      })
      if (result) {
        setError(result)
        setPassword('')
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
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2 text-text">
            <UserPlus size={18} />
            <span className="font-display text-base font-semibold">הוספת משתמש חדש</span>
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
        <form onSubmit={submit} className="space-y-3 p-5">
          <Field
            label="שם משתמש (אנגלית)"
            hint="אותיות, מספרים וקו תחתון בלבד"
          >
            <input
              ref={firstInputRef}
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              dir="ltr"
              className={inputClass}
            />
          </Field>
          <Field label="שם תצוגה (עברית)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="ראשי תיבות" hint="אות אחת באנגלית">
            <input
              type="text"
              value={initial}
              onChange={(e) => setInitial(e.target.value.slice(0, 1))}
              dir="ltr"
              maxLength={1}
              className={cn(inputClass, 'w-16 text-center')}
            />
          </Field>
          <Field label="סיסמת הורה" hint="נדרשת לאישור יצירת המשתמש">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && <p className="text-xs text-coral-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
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
              צור משתמש
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/25'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted/70">{hint}</p>}
    </div>
  )
}
