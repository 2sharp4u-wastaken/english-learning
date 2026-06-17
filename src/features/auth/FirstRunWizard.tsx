import { useState } from 'react'
import {
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Users,
  PartyPopper,
  BookOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import { createParentAccount, adminAddUser } from '@/bridge/auth'
import { ParentGuidePage } from '@/features/parent/ParentGuidePage'
import './login.css'

/**
 * First-run onboarding wizard (M4 + M12 Slice B). Shown by `LoginPage` on a fresh
 * device (empty user DB), replacing the bare "create first profile" form.
 *
 * Adult-facing → NO nikud (the subtree is marked `data-nikud-skip` so
 * `utils/nikudDOM.js` leaves it alone). Flow: welcome → create the parent/admin
 * account (name + password — that password IS the device parent credential) →
 * create player profile(s) → finish (+ link to the in-app guide). On finish,
 * `onComplete` refreshes `LoginPage`, which then shows the normal selection grid;
 * the parent already has a password, kids set theirs on first login.
 *
 * Reuses the scoped `.auth-*` classes from `login.css`. Ids are auto-generated
 * (`parent`, `player1`…) since Hebrew names can't be a Latin id; the displayed
 * name is the Hebrew name the parent typed.
 */

const PARENT_ID = 'parent'
const MAX_KIDS = 3 // parent + 3 kids = the 4-user cap (UsersTab MAX_USERS)
const MIN_PASSWORD = 4

type Step = 'welcome' | 'parent' | 'kids' | 'done'

export function FirstRunWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [showGuide, setShowGuide] = useState(false)

  // Parent step
  const [parentName, setParentName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // Kids step
  const [kidNames, setKidNames] = useState<string[]>([''])

  const [error, setError] = useState('')

  function submitParent(e: React.FormEvent) {
    e.preventDefault()
    const name = parentName.trim()
    if (!name) {
      setError('נא להזין שם להורה')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`הסיסמה קצרה מדי — לפחות ${MIN_PASSWORD} תווים`)
      return
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות')
      setConfirm('')
      return
    }
    const result = createParentAccount(PARENT_ID, name, password)
    if (!result.success) {
      setError(result.error ?? 'שגיאה ביצירת חשבון ההורה')
      return
    }
    setError('')
    setStep('kids')
  }

  function submitKids(e: React.FormEvent) {
    e.preventDefault()
    const names = kidNames.map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) {
      setError('נא להוסיף לפחות פרופיל שחקן/ית אחד')
      return
    }
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      const result = adminAddUser(`player${i + 1}`, name, name, name.charAt(0))
      if (!result.success) {
        setError(result.error ?? 'שגיאה ביצירת פרופיל השחקן/ית')
        return
      }
    }
    setError('')
    setStep('done')
  }

  function updateKid(idx: number, value: string) {
    setKidNames((prev) => prev.map((n, i) => (i === idx ? value : n)))
  }

  function addKid() {
    setKidNames((prev) => (prev.length >= MAX_KIDS ? prev : [...prev, '']))
  }

  function removeKid(idx: number) {
    setKidNames((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  if (showGuide) {
    return (
      <div className="auth-modal" data-nikud-skip>
        <div className="auth-modal-content" style={{ maxWidth: 720 }}>
          <ParentGuidePage overlay onBack={() => setShowGuide(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-modal" data-nikud-skip data-testid="first-run-wizard">
      <div className="auth-modal-content">
        <div className="auth-header">
          <GraduationCap className="auth-icon" size={45} style={{ color: '#63e6c6' }} aria-hidden />
          <h2>English Learning Games</h2>
          <p className="auth-subtitle">משחקים ללימוד אנגלית</p>
        </div>

        {step === 'welcome' && (
          <div className="auth-screen" data-testid="wizard-welcome">
            <h3>ברוכים הבאים!</h3>
            <p className="password-hint" style={{ marginTop: 12 }}>
              אפליקציה ללימוד אנגלית לדוברי עברית. בכמה צעדים קצרים ניצור חשבון
              הורה לניהול ההגדרות, ופרופיל לכל שחקן/ית. ההתקדמות נשמרת על המכשיר הזה.
            </p>
            <button
              type="button"
              className="auth-btn"
              data-testid="wizard-start"
              style={{ marginTop: 18 }}
              onClick={() => {
                setError('')
                setStep('parent')
              }}
            >
              <span>בואו נתחיל</span>
              <ArrowLeft size={18} aria-hidden />
            </button>
          </div>
        )}

        {step === 'parent' && (
          <div className="auth-screen" data-testid="wizard-parent">
            <div className="user-login-info" style={{ marginBottom: 14 }}>
              <div className="login-avatar">
                <ShieldCheck size={34} aria-hidden />
              </div>
              <h3>חשבון הורה</h3>
            </div>
            <p className="password-hint">
              חשבון ההורה מנהל את כל ההגדרות המוגנות. הסיסמה שתבחרו כאן היא גם סיסמת
              ההורה — היא תפתח את האזור המוגן בכל מסך.
            </p>
            <form className="login-form" onSubmit={submitParent} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="wiz-parent-name">שם ההורה</label>
                <input
                  id="wiz-parent-name"
                  type="text"
                  className="password-input"
                  autoComplete="off"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="wiz-parent-pw">סיסמת הורה</label>
                <input
                  id="wiz-parent-pw"
                  type="password"
                  className="password-input"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="wiz-parent-pw2">אימות סיסמה</label>
                <input
                  id="wiz-parent-pw2"
                  type="password"
                  className="password-input"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="auth-error" data-testid="wizard-error">
                  {error}
                </div>
              )}
              <button type="submit" className="auth-btn" data-testid="wizard-create-parent">
                <span>המשך</span>
                <ArrowLeft size={18} aria-hidden />
              </button>
            </form>
          </div>
        )}

        {step === 'kids' && (
          <div className="auth-screen" data-testid="wizard-kids">
            <div className="user-login-info" style={{ marginBottom: 14 }}>
              <div className="login-avatar">
                <Users size={34} aria-hidden />
              </div>
              <h3>פרופילים לשחקנים/ות</h3>
            </div>
            <p className="password-hint">
              הוסיפו פרופיל לכל שחקן/ית. כל פרופיל שומר התקדמות נפרדת. הסיסמה תיבחר
              בהתחברות הראשונה. אפשר להוסיף עוד פרופילים מאוחר יותר.
            </p>
            <form className="login-form" onSubmit={submitKids} style={{ marginTop: 16 }}>
              {kidNames.map((name, idx) => (
                <div className="form-group" key={idx}>
                  <label htmlFor={`wiz-kid-${idx}`}>שם השחקן/ית {kidNames.length > 1 ? idx + 1 : ''}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      id={`wiz-kid-${idx}`}
                      type="text"
                      className="password-input"
                      autoComplete="off"
                      value={name}
                      onChange={(e) => updateKid(idx, e.target.value)}
                      autoFocus={idx === 0}
                      data-testid="wizard-kid-input"
                    />
                    {kidNames.length > 1 && (
                      <button
                        type="button"
                        className="back-btn"
                        style={{ marginBottom: 0, flexShrink: 0 }}
                        onClick={() => removeKid(idx)}
                        aria-label="הסרה"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {kidNames.length < MAX_KIDS && (
                <button
                  type="button"
                  onClick={addKid}
                  data-testid="wizard-add-kid"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    color: '#68a8ff',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  <Plus size={16} aria-hidden />
                  <span>הוספת שחקן/ית</span>
                </button>
              )}
              {error && (
                <div className="auth-error" data-testid="wizard-error">
                  {error}
                </div>
              )}
              <button type="submit" className="auth-btn" data-testid="wizard-create-kids">
                <span>סיום</span>
                <ArrowLeft size={18} aria-hidden />
              </button>
            </form>
          </div>
        )}

        {step === 'done' && (
          <div className="auth-screen" data-testid="wizard-done">
            <div className="user-login-info" style={{ marginBottom: 14 }}>
              <div className="login-avatar">
                <PartyPopper size={34} aria-hidden />
              </div>
              <h3>הכול מוכן!</h3>
            </div>
            <p className="password-hint">
              חשבון ההורה והפרופילים נוצרו. את ההגדרות המוגנות תמצאו במסך "הגדרות"
              (סיסמת ההורה תפתח אותן). מומלץ לקרוא את המדריך הקצר להורה.
            </p>
            <button
              type="button"
              className="auth-btn"
              data-testid="wizard-open-guide"
              style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', color: '#d8e2f1' }}
              onClick={() => setShowGuide(true)}
            >
              <BookOpen size={18} aria-hidden />
              <span>מדריך להורה</span>
            </button>
            <button
              type="button"
              className="auth-btn"
              data-testid="wizard-finish"
              style={{ marginTop: 12 }}
              onClick={onComplete}
            >
              <ArrowRight size={18} aria-hidden />
              <span>למסך הכניסה</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
