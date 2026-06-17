import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudOff, LogOut } from 'lucide-react'
import {
  cloudLogin,
  cloudRegister,
  cloudSignOut,
  isCloudSignedIn,
  getCloudEmail,
  subscribeCloudAccount,
  cloudListPlayers,
  type CloudPlayer,
} from '@/bridge/cloudAccount'

/**
 * Cloud account ("חשבון בענן / גיבוי") — Phase A. An OPTIONAL family account
 * (parent email + password) that will back up progress to multiple devices
 * (Phase B). The app works fully offline without it. Lives in the parent area.
 */
export function CloudAccountPanel() {
  const [signedIn, setSignedIn] = useState(isCloudSignedIn)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<CloudPlayer[] | null>(null)

  useEffect(() => subscribeCloudAccount(setSignedIn), [])

  const refreshPlayers = useCallback(async () => {
    if (!isCloudSignedIn()) return
    const r = await cloudListPlayers()
    if (r.ok) setPlayers(r.data ?? [])
  }, [])

  useEffect(() => {
    if (signedIn) void refreshPlayers()
    else setPlayers(null)
  }, [signedIn, refreshPlayers])

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (busy) return
      setBusy(true)
      setError(null)
      const fn = mode === 'register' ? cloudRegister : cloudLogin
      const r = await fn(email, password)
      setBusy(false)
      if (!r.ok) {
        setError(r.error ?? 'שגיאה')
        return
      }
      setEmail('')
      setPassword('')
    },
    [busy, mode, email, password],
  )

  if (signedIn) {
    return (
      <div className="space-y-3" data-testid="cloud-account-signed-in">
        <div className="flex items-center gap-2 text-sm text-text">
          <Cloud size={16} className="text-learn" />
          <span>מחובר/ת כ־</span>
          <span dir="ltr" data-nikud-skip className="font-medium">
            {getCloudEmail()}
          </span>
        </div>
        <p className="text-xs text-muted">
          גיבוי ההתקדמות בין מכשירים יופעל בקרוב (שלב הבא). החשבון מוכן.
        </p>
        {players && players.length > 0 && (
          <ul className="space-y-1 text-sm text-muted">
            {players.map((p) => (
              <li key={p.id} data-nikud-skip>
                • {p.name}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => cloudSignOut()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
        >
          <LogOut size={14} />
          <span>התנתקות</span>
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="cloud-account-form">
      <div className="flex items-center gap-2 text-sm text-muted">
        <CloudOff size={16} />
        <span>{mode === 'register' ? 'יצירת חשבון משפחה חדש' : 'התחברות לחשבון קיים'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="email"
          dir="ltr"
          placeholder="email@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          dir="ltr"
          placeholder="סיסמה"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="text-xs text-coral-400">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError(null)
          }}
          className="text-xs text-muted underline underline-offset-2 hover:text-text"
        >
          {mode === 'login' ? 'אין חשבון? יצירת חשבון' : 'יש חשבון? התחברות'}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-learn/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-learn disabled:opacity-60"
        >
          {mode === 'register' ? 'יצירת חשבון' : 'התחברות'}
        </button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/25'
