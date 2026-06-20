import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, RotateCcw, BookOpen, KeyRound, AlertTriangle, Sparkles } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { changeParentPassword, factoryReset } from '@/bridge/auth'
import { SectionCard } from '../components/SectionCard'
import { CustomWordsPanel } from './components/CustomWordsPanel'
import { WordImagesPanel } from './components/WordImagesPanel'
import { QATestingPanel } from './components/QATestingPanel'
import { CloudAccountPanel } from './components/CloudAccountPanel'

const MIN_PASSWORD = 4

export function AdvancedToolsTab() {
  const { resetSettings } = useSettings()
  const navigate = useNavigate()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [factoryConfirm, setFactoryConfirm] = useState(false)

  const handleDownloadLogs = useCallback(() => {
    const logger = (window as any).consoleLogger
    if (logger?.downloadLogs) {
      logger.downloadLogs()
    }
  }, [])

  const handleResetConfirm = useCallback(() => {
    resetSettings()
    setResetConfirmOpen(false)
  }, [resetSettings])

  return (
    <div className="space-y-4">
      <SectionCard
        title="הוספת מילים מותאמות"
        description="ייבוא מילים באנגלית ותרגום אוטומטי לעברית עם Claude. המילים נשמרות בדפדפן ומופיעות מיד במשחקים."
      >
        <CustomWordsPanel />
      </SectionCard>

      {/* M12 Slice A: parent/QA testing affordance — opens locked content without
          grinding to the thresholds. Behind the parent password (this tab). */}
      <SectionCard
        title="כלי בדיקה (QA)"
        description="פתיחת תוכן נעול לצורך בדיקה, בלי לשחק עד הסף. הכלי משנה את ההתקדמות של המשתמש הנוכחי — לא מיועד לשחקנים/ות."
      >
        <QATestingPanel />
      </SectionCard>

      {/* Issue #10: change the parent password from inside the parent area
          (already authenticated — the standard "change password while logged
          in"). There is no unauthenticated reset; a forgotten password is
          recovered by clearing the app's data. */}
      <SectionCard
        title="סיסמת הורה"
        description="שינוי סיסמת ההורה. הסיסמה מגנה על כל ההגדרות והאזור הזה. אם שכחתם אותה לגמרי — ניתן לאפס דרך מחיקת נתוני האפליקציה במכשיר."
      >
        <ChangeParentPassword />
      </SectionCard>

      {/* Tier-3 Phase A: optional cloud family account (multi-device + backup). */}
      <SectionCard
        title="חשבון בענן וגיבוי"
        description="חשבון משפחה (אימייל וסיסמה) שיאפשר שימוש בכמה מכשירים וגיבוי ההתקדמות. אופציונלי — המשחק עובד גם בלי חיבור."
      >
        <CloudAccountPanel />
      </SectionCard>

      {/* M4: in-app parent guide (offline, app-styled). */}
      <SectionCard
        title="מדריך להורה"
        description="הסבר קצר על אזור ההורה, הסיסמה, פתיחת תכנים וניהול השחקנים/ות."
      >
        <button
          type="button"
          onClick={() => navigate('/parent-guide')}
          data-testid="tools-open-guide"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/8 hover:text-text"
        >
          <BookOpen size={14} />
          <span>פתיחת המדריך</span>
        </button>
      </SectionCard>

      {/* What's New + roadmap — informational, content in src/data/whatsNew.ts. */}
      <SectionCard
        title="מה חדש ובקרוב"
        description="רשימת התכונות החדשות בכל גרסה, והמשך הדרך — מה אנחנו עובדים עליו ומתכננים."
      >
        <button
          type="button"
          onClick={() => navigate('/whats-new')}
          data-testid="tools-open-whats-new"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/8 hover:text-text"
        >
          <Sparkles size={14} />
          <span>מה חדש</span>
        </button>
      </SectionCard>

      {/* Image/translation overrides: a heavier, rarely-touched power tool, so it
          sits low and starts collapsed (the panel mounts only when expanded). */}
      <SectionCard
        title="תמונות ותרגומים"
        description="החלפת תמונות ותרגומים למילים קיימות. הכול נשמר בדפדפן — ללא צורך בשרת."
        collapsible
        defaultCollapsed
      >
        <WordImagesPanel />
      </SectionCard>

      {/* M6: moved here from the kid-visible settings header. */}
      <SectionCard
        title="תחזוקה"
        description="הורדת יומן האפליקציה לדיווח על תקלה, ואיפוס ההגדרות לברירת המחדל (לא נוגע בהתקדמות השחקנים/ות)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadLogs}
            data-testid="tools-download-logs"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/8 hover:text-text"
          >
            <Download size={14} />
            <span>הורדת לוגים</span>
          </button>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            data-testid="tools-reset-settings"
            className="flex items-center gap-1.5 rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-xs font-medium text-coral-400 transition-colors hover:bg-coral-400/15"
          >
            <RotateCcw size={14} />
            <span>איפוס הגדרות</span>
          </button>
        </div>
        {resetConfirmOpen ? (
          <div className="mt-3 space-y-2 rounded-lg border border-coral-400/25 bg-coral-400/5 p-3">
            <p className="text-sm text-text">
              פעולה זו תחזיר את כל ההגדרות לברירות המחדל. לא ניתן לבטל.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                data-testid="tools-reset-confirm"
                className="rounded-lg bg-coral-400/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-coral-400"
              >
                איפוס
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {/* Full device reset (issue #10 recovery / clean-slate testing). Wipes ALL
          profiles + progress + the parent password and returns to the first-run
          wizard. Behind the parent area; two-step confirm because it's
          irreversible. */}
      <SectionCard
        title="התחלה מחדש"
        description="מחיקת כל הפרופילים, כל ההתקדמות, ההגדרות וסיסמת ההורה — המכשיר חוזר למצב התחלתי ולאשף ההגדרה הראשוני. אין ביטול."
      >
        {!factoryConfirm ? (
          <button
            type="button"
            onClick={() => setFactoryConfirm(true)}
            data-testid="tools-factory-reset"
            className="flex items-center gap-1.5 rounded-lg border border-coral-400/40 bg-coral-400/10 px-3 py-1.5 text-xs font-medium text-coral-400 transition-colors hover:bg-coral-400/15"
          >
            <AlertTriangle size={14} />
            <span>מחיקת הכול והתחלה מחדש</span>
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-coral-400/40 bg-coral-400/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-coral-400">
              <AlertTriangle size={15} />
              למחוק את כל הפרופילים והנתונים במכשיר? לא ניתן לבטל.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFactoryConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => factoryReset()}
                data-testid="tools-factory-reset-confirm"
                className="rounded-lg bg-coral-400/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-coral-400"
              >
                כן, מחק הכול
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/25'

function ChangeParentPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setMsg({ kind: 'err', text: `סיסמה קצרה מדי — לפחות ${MIN_PASSWORD} תווים` })
      return
    }
    if (password !== confirm) {
      setMsg({ kind: 'err', text: 'הסיסמאות אינן תואמות' })
      setConfirm('')
      return
    }
    changeParentPassword(password)
    setPassword('')
    setConfirm('')
    setMsg({ kind: 'ok', text: 'הסיסמה עודכנה' })
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="change-parent-password">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="new-parent-pw" className="block text-xs font-medium text-muted">
            סיסמה חדשה
          </label>
          <input
            id="new-parent-pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (msg) setMsg(null)
            }}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-parent-pw2" className="block text-xs font-medium text-muted">
            אימות סיסמה
          </label>
          <input
            id="new-parent-pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              if (msg) setMsg(null)
            }}
            className={inputClass}
          />
        </div>
      </div>
      {msg && (
        <p className={msg.kind === 'ok' ? 'text-xs text-learn' : 'text-xs text-coral-400'}>{msg.text}</p>
      )}
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-lg bg-learn/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-learn"
      >
        <KeyRound size={14} />
        <span>עדכון סיסמה</span>
      </button>
    </form>
  )
}
