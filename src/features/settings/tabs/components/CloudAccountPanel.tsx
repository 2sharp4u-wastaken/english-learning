import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudOff, LogOut, Download, Trash2, UploadCloud, DownloadCloud, CheckCircle2 } from 'lucide-react'
import {
  cloudLogin,
  cloudRegister,
  cloudSignOut,
  isCloudSignedIn,
  getCloudEmail,
  subscribeCloudAccount,
  cloudExportFamilyData,
  cloudDeleteFamily,
} from '@/bridge/cloudAccount'
import {
  linkAndBackup,
  pushBackup,
  pullBackupAndReload,
  isPlayerLinked,
  subscribeCloudSync,
} from '@/bridge/cloudSync'
import { getAllUsers } from '@/bridge/auth'
import type { User } from '@/bridge/types'

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
  // Closed-beta invite (Phase C): field appears once the server answers
  // 'invite-required', so an open server never shows a confusing extra input.
  const [inviteCode, setInviteCode] = useState('')
  const [inviteNeeded, setInviteNeeded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => subscribeCloudAccount(setSignedIn), [])

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
          גבו את ההתקדמות של כל פרופיל לענן ושחזרו אותה במכשיר אחר.
        </p>
        <ProfileBackupList />
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

/**
 * Per-profile cloud backup (Phase B). Lists the on-device kid profiles; each can
 * be linked to a cloud player (first "הפעלת גיבוי" creates it + pushes), then
 * backed up on demand or restored from the cloud (restore reloads the app so the
 * engine re-boots from the pulled progress).
 */
function ProfileBackupList() {
  // Kid profiles only — the parent/manager account doesn't accrue play progress.
  const kids = getAllUsers().filter((u) => u.role !== 'parent' && u.role !== 'manager')
  const [, force] = useState(0)
  useEffect(() => subscribeCloudSync(() => force((n) => n + 1)), [])

  if (kids.length === 0) {
    return <p className="text-xs text-muted">אין פרופילים לגיבוי עדיין.</p>
  }
  return (
    <ul className="space-y-2" data-testid="cloud-backup-list">
      {kids.map((u) => (
        <ProfileBackupRow key={u.id} user={u} />
      ))}
    </ul>
  )
}

function ProfileBackupRow({ user }: { user: User }) {
  const linked = isPlayerLinked(user.id)
  const [busy, setBusy] = useState<null | 'link' | 'push' | 'pull'>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = useCallback(
    async (kind: 'link' | 'push' | 'pull') => {
      setBusy(kind)
      setMsg(null)
      setErr(null)
      const r =
        kind === 'link'
          ? await linkAndBackup(user.id, user.name, user.initial)
          : kind === 'push'
            ? await pushBackup(user.id)
            : await pullBackupAndReload(user.id)
      setBusy(null)
      if (!r.ok) {
        setErr(r.error ?? 'שגיאה')
        return
      }
      // pull reloads on a real restore; only reach here with a message when there
      // was nothing to restore.
      if (kind === 'pull' && !(r as { data?: { restored?: boolean } }).data?.restored) {
        setMsg('אין גיבוי בענן עדיין')
      } else {
        setMsg(kind === 'link' ? 'הגיבוי הופעל ✓' : kind === 'push' ? 'גובה ✓' : 'שוחזר ✓')
      }
    },
    [user.id, user.name, user.initial],
  )

  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-2.5" data-testid={`cloud-backup-${user.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-text">
          <span
            data-nikud-skip
            className="grid h-6 w-6 place-items-center rounded-full bg-learn/20 text-xs font-bold text-learn"
          >
            {user.initial}
          </span>
          <span data-nikud-skip className="font-medium">
            {user.name}
          </span>
          {linked && (
            <span className="flex items-center gap-1 text-[11px] text-learn">
              <CheckCircle2 size={12} />
              מגובה
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {linked ? (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('push')}
                data-testid={`cloud-push-${user.id}`}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text disabled:opacity-60"
              >
                <UploadCloud size={13} />
                <span>{busy === 'push' ? '…' : 'גיבוי כעת'}</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('pull')}
                data-testid={`cloud-pull-${user.id}`}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text disabled:opacity-60"
              >
                <DownloadCloud size={13} />
                <span>{busy === 'pull' ? '…' : 'שחזור'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('link')}
              data-testid={`cloud-link-${user.id}`}
              className="flex items-center gap-1 rounded-lg bg-learn/90 px-2.5 py-1 text-xs font-medium text-ink-950 transition-colors hover:bg-learn disabled:opacity-60"
            >
              <UploadCloud size={13} />
              <span>{busy === 'link' ? '…' : 'הפעלת גיבוי'}</span>
            </button>
          )}
        </div>
      </div>
      {msg && <p className="mt-1.5 text-[11px] text-learn">{msg}</p>}
      {err && <p className="mt-1.5 text-[11px] text-coral-400">{err}</p>}
    </li>
  )
}
