import { useState } from 'react'
import { GraduationCap, ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react'
import { getAllUsers, getUser, needsPasswordSetup, login } from '@/bridge/auth'
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
 */
export function LoginPage() {
  const nk = useNikud()
  const [users] = useState<User[]>(() => getAllUsers())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="auth-modal" data-react-nikud-owned data-testid="login-modal">
      <div className="auth-modal-content">
        <div className="auth-header">
          <GraduationCap className="auth-icon" size={45} style={{ color: '#63e6c6' }} aria-hidden />
          <h2>English Learning Games</h2>
          <p className="auth-subtitle">{nk('משחקים ללימוד אנגלית')}</p>
        </div>

        {!selectedUserId ? (
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
