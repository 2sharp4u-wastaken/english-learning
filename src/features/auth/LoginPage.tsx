import { useState } from 'react'
import { GraduationCap, ArrowRight, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { createFirstUser, getAllUsers, getUser, needsPasswordSetup, login } from '@/bridge/auth'
import { useNikud } from '@/bridge/nikud'
import type { User } from '@/bridge/types'
import './login.css'

/**
 * React login screen (Slice 4.4.b2) — replaces the legacy `#login-modal` markup
 * + `AuthUIController` in `auth.js`. Two steps: user-select grid → password entry.
 * Its `.auth-*` styles moved from the legacy `styles.css` into the scoped
 * `./login.css` when `styles.css` was deleted in Slice 4.5; the look is unchanged.
 * Icons are Lucide (font-awesome retired in 4.5).
 *
 * Hebrew chrome is wrapped in `nk()` and the subtree is marked
 * `data-react-nikud-owned` so `utils/nikudDOM.js` leaves it alone (FU-4.4-nikud).
 * On successful `login()` the bridge dispatches `auth-changed`; the parent
 * `AuthGate`'s `useAuthSession` flips to the app and this component unmounts.
 *
 * First-run (INFRA1, 2026-06-10): the bridge no longer seeds default users, so a
 * fresh device/deploy starts with an empty database. When there are zero users
 * this page shows a "create first profile" form (`createFirstUser` — the one
 * non-admin-gated creation path; later users come from Settings → Users). The
 * new profile then flows into the normal first-login password setup.
 */
export function LoginPage() {
  const nk = useNikud()
  const [users, setUsers] = useState<User[]>(() => getAllUsers())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // First-run create-profile form (only rendered when the user DB is empty).
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')

  const selectedUser = selectedUserId ? getUser(selectedUserId) : null
  const isFirstTime = selectedUserId ? needsPasswordSetup(selectedUserId) : false

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    setPassword('')
    setError('')
    setShowPassword(false)
  }

  function backToSelection() {
    setSelectedUserId(null)
    setPassword('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId) {
      setError('Please select a user first / אנא בחר משתמש תחילה')
      return
    }
    const trimmed = password.trim()
    if (!trimmed) {
      setError('Please enter a password / אנא הכנס סיסמה')
      return
    }
    const result = login(selectedUserId, trimmed)
    if (!result.success) {
      setError(result.error ?? 'סיסמה שגויה / Incorrect password')
    }
    // On success the AuthGate re-renders and unmounts this component.
  }

  function handleCreateFirst(e: React.FormEvent) {
    e.preventDefault()
    const id = newId.trim()
    const name = newName.trim()
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      setError('שם המשתמש באנגלית בלבד: אותיות, מספרים וקו תחתון / English letters, numbers and underscore only')
      return
    }
    if (!name) {
      setError('נא להזין שם תצוגה / Please enter a display name')
      return
    }
    const result = createFirstUser(id, name, id.charAt(0).toUpperCase())
    if (!result.success) {
      setError(result.error ?? 'שגיאה ביצירת הפרופיל / Could not create the profile')
      return
    }
    setUsers(getAllUsers())
    // Flow straight into the normal first-login password setup for the new profile.
    selectUser(id)
  }

  return (
    <div className="auth-modal" data-react-nikud-owned data-testid="login-modal">
      <div className="auth-modal-content">
        <div className="auth-header">
          <GraduationCap className="auth-icon" size={45} style={{ color: '#63e6c6' }} aria-hidden />
          <h2>English Learning Games</h2>
          <p className="auth-subtitle">{nk('משחקים ללימוד אנגלית')}</p>
        </div>

        {users.length === 0 && !selectedUserId ? (
          <div className="auth-screen" data-testid="first-run-screen">
            <h3>{nk('יצירת פרופיל ראשון')} / Create First Profile</h3>
            <p className="password-hint">
              {nk('אין עדיין פרופילים במכשיר הזה — ניצור פרופיל ראשון כדי להתחיל. אפשר להוסיף עוד פרופילים אחר כך מתוך ההגדרות.')}
            </p>
            <form className="login-form" onSubmit={handleCreateFirst} style={{ marginTop: 18 }}>
              <div className="form-group">
                <label htmlFor="first-user-id">{nk('שם משתמש (אנגלית)')} / Username</label>
                <input
                  id="first-user-id"
                  type="text"
                  className="password-input"
                  dir="ltr"
                  placeholder="e.g. dana"
                  autoComplete="off"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="first-user-name">{nk('שם תצוגה (עברית)')} / Display name</label>
                <input
                  id="first-user-name"
                  type="text"
                  className="password-input"
                  placeholder={nk('למשל: דנה')}
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="auth-error" data-testid="auth-error">
                  {error}
                </div>
              )}
              <button type="submit" className="auth-btn" data-testid="create-first-user">
                <UserPlus size={18} aria-hidden />
                <span>{nk('יצירת פרופיל')} / Create</span>
              </button>
            </form>
          </div>
        ) : !selectedUserId ? (
          <div className="auth-screen" data-testid="user-selection-screen">
            <h3>Select User / {nk('בחר משתמש')}</h3>
            <div className="user-selection-grid">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="user-select-card"
                  data-testid="user-select-card"
                  onClick={() => selectUser(user.id)}
                >
                  <div className="user-select-avatar">{user.initial}</div>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="auth-screen" data-testid="password-entry-screen">
            <button type="button" className="back-btn" onClick={backToSelection} aria-label="Back">
              <ArrowRight size={18} aria-hidden />
            </button>
            <div className="user-login-info">
              <div className="login-avatar">{selectedUser?.initial}</div>
              <h3>{selectedUser?.name}</h3>
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password-input">Password / {nk('סיסמה')}</label>
                <div className="password-input-wrapper">
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    className="password-input"
                    placeholder="Enter password / הכנס סיסמה"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </div>
                {isFirstTime && (
                  <p className="password-hint">
                    First time? Create a password to protect your account.
                    <br />
                    {nk('פעם ראשונה? צור סיסמה כדי להגן על החשבון שלך.')}
                  </p>
                )}
              </div>
              {error && (
                <div className="auth-error" data-testid="auth-error">
                  {error}
                </div>
              )}
              <button type="submit" className="auth-btn" data-testid="login-submit">
                <LogIn size={18} aria-hidden />
                <span>Login / {nk('התחבר')}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
