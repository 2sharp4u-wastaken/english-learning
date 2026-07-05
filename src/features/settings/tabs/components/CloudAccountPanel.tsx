import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudOff, LogOut, Download, Trash2 } from 'lucide-react'
import {
  cloudLogin,
  cloudRegister,
  cloudSignOut,
  isCloudSignedIn,
  getCloudEmail,
  subscribeCloudAccount,
  cloudListPlayers,
  cloudExportFamilyData,
  cloudDeleteFamily,
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
  // Closed-beta invite (Phase C): field appears once the server answers
  // 'invite-required', so an open server never shows a confusing extra input.
  const [inviteCode, setInviteCode] = useState('')
  const [inviteNeeded, setInviteNeeded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

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
      const r =
        mode === 'register'
          ? await cloudRegister(email, password, inviteCode || undefined)
          : await cloudLogin(email, password)
      setBusy(false)
      if (!r.ok) {
        if (r.code === 'invite-required') {
          setInviteNeeded(true)
          setError(inviteCode ? 'קוד ההזמנה שגוי' : 'ההרשמה בשלב זה בהזמנה בלבד — נדרש קוד הזמנה')
        } else {
          setError(r.error ?? 'שגיאה')
        }
        return
      }
      setEmail('')
      setPassword('')
      setInviteCode('')
      setInviteNeeded(false)
    },
    [busy, mode, email, password, inviteCode],
  )

  const handleExport = useCallback(async () => {
    setError(null)
    const r = await cloudExportFamilyData()
    if (!r.ok) setError(r.error ?? 'שגיאה')
  }, [])

  const handleDelete = useCallback(async () => {
    setError(null)
    const r = await cloudDeleteFamily()
    setDeleteConfirm(false)
    if (!r.ok) setError(r.error ?? 'שגיאה')
  }, [])

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => cloudSignOut()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            <LogOut size={14} />
            <span>התנתקות</span>
          </button>
          {/* Data rights (Phase C): take the data out / erase it — kids' data. */}
          <button
            type="button"
            onClick={() => void handleExport()}
            data-testid="cloud-export-data"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            <Download size={14} />
            <span>ייצוא נתוני הענן</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            data-testid="cloud-delete-account"
            className="flex items-center gap-1.5 rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-xs font-medium text-coral-400 transition-colors hover:bg-coral-400/15"
          >
            <Trash2 size={14} />
            <span>מחיקת החשבון בענן</span>
          </button>
        </div>
        {error && <p className="text-xs text-coral-400">{error}</p>}
        {deleteConfirm ? (
          <div className="space-y-2 rounded-lg border border-coral-400/25 bg-coral-400/5 p-3">
            <p className="text-sm text-text">
              למחוק את חשבון הענן לצמיתות? כל השחקנים/ות והגיבויים בענן יימחקו. הפרופילים במכשיר הזה
              לא נמחקים. לא ניתן לבטל.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                data-testid="cloud-delete-account-confirm"
                className="rounded-lg bg-coral-400/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-coral-400"
              >
                כן, מחק את החשבון
              </button>
            </div>
          </div>
        ) : null}
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
      {mode === 'register' && inviteNeeded && (
        <input
          type="text"
          dir="ltr"
          placeholder="קוד הזמנה"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          data-testid="cloud-invite-code"
          className={inputClass}
        />
      )}
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
