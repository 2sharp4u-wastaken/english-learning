import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  X,
  BookOpen,
  Lock,
  Unlock,
  Users,
  Gamepad2,
  Sparkles,
} from 'lucide-react'

/**
 * In-app parent guide (M4). Adult-facing → NO nikud (the whole subtree is marked
 * `data-nikud-skip` so `utils/nikudDOM.js` leaves it alone). App-styled and fully
 * offline. Pure (no router hook) so it works in two contexts:
 *  - the `/parent-guide` route via `ParentGuideRoute` (parent area link, direct
 *    URL) — back button navigates home;
 *  - a pre-auth overlay inside the first-run wizard (`overlay`) — LoginPage
 *    renders OUTSIDE the Router, so a router hook here would throw.
 */
export function ParentGuidePage({
  onBack,
  overlay = false,
}: {
  onBack: () => void
  overlay?: boolean
}) {
  return (
    <div
      data-nikud-skip
      data-testid="parent-guide"
      dir="rtl"
      className="mx-auto max-w-2xl space-y-5 pb-10"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-learn/15 text-learn">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">מדריך להורה</h1>
            <p className="text-sm text-muted">כל מה שצריך לדעת על אזור ההורה.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/10 hover:text-text"
        >
          {overlay ? <X size={16} /> : <ArrowRight size={16} />}
          <span>{overlay ? 'סגירה' : 'חזרה'}</span>
        </button>
      </header>

      <GuideCard icon={<Sparkles size={18} />} title="מה האפליקציה עושה">
        משחק ללימוד אנגלית לדוברי עברית בגילאי 5–8. ההתקדמות במסלול למידה מובנה:
        מילים חדשות נחשפות, נלמדות ונכנסות לתרגול חוזר, ומשחקים מתקדמים נפתחים ככל
        שנצבר אוצר מילים. ההתקדמות נשמרת על המכשיר הזה בלבד.
      </GuideCard>

      <GuideCard icon={<Lock size={18} />} title="אזור ההורה והסיסמה">
        ההגדרות החשובות מוגנות בסיסמת ההורה שבחרתם בהתקנה — אותה סיסמה שייכת לחשבון
        ההורה. הזנה אחת פותחת את כל המסכים המוגנים והם נשארים פתוחים לכמה דקות, כך
        שאין צורך להקליד שוב בכל מסך. כשתתחברו עם חשבון ההורה, האזור נפתח אוטומטית.
        לשינוי הסיסמה: כלי הורה ← סיסמת הורה (אפשרי רק כשאתם כבר בתוך אזור ההורה).
        אין איפוס ללא סיסמה — אם שכחתם אותה לגמרי, ניתן לאפס דרך מחיקת נתוני
        האפליקציה במכשיר.
      </GuideCard>

      <GuideCard icon={<Unlock size={18} />} title="פתיחת כל התכנים">
        בהגדרות המוגנות (לשונית "מתקדם") יש מתג "פתיחת כל התכנים". הפעלתו פותחת מיד
        את כל המשחקים והביטויים, ללא תלות בהתקדמות השחקן/ית — נוח להצגה או לבדיקה. כיבוי
        המתג מחזיר את הנעילות הרגילות וההתקדמות נשמרת כפי שהייתה.
      </GuideCard>

      <GuideCard icon={<Users size={18} />} title="ניהול השחקנים/ות">
        בלשונית "משתמשים" אפשר להוסיף עד ארבעה פרופילים, לאפס סיסמה, לאפס נתונים או
        למחוק פרופיל. כל פרופיל שומר התקדמות נפרדת. ההגדרות (כמו תצוגה ומספר שאלות)
        משותפות לכל השחקנים/ות על המכשיר.
      </GuideCard>

      <GuideCard icon={<Gamepad2 size={18} />} title="היכן נמצא מה">
        בהגדרות מוצגת לשחקן/ית רק לשונית "תצוגה" (ניקוד, אותיות וקונפטי) — כל שאר
        ההגדרות מאחורי סיסמת ההורה. בלשונית "כלי הורה" נמצאים הוספת מילים מותאמות,
        החלפת תמונות, הורדת לוגים ואיפוס הגדרות.
      </GuideCard>
    </div>
  )
}

/** Router wrapper for the `/parent-guide` route (back → home). */
export function ParentGuideRoute() {
  const navigate = useNavigate()
  return <ParentGuidePage onBack={() => navigate('/home')} />
}

function GuideCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface/90 p-5 shadow-panel sm:p-6">
      <header className="mb-2 flex items-center gap-2 text-text">
        <span className="text-learn">{icon}</span>
        <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
      </header>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </section>
  )
}
