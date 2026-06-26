/**
 * "מה חדש" (What's New) content — the changelog rendered by WhatsNewPage.
 *
 * HOW TO ADD A NEW RELEASE
 * ------------------------
 * Prepend a new object to the top of `RELEASES` (newest first). Keep the copy
 * short and parent-facing — describe the benefit, not the implementation. Each
 * item has a `kind` that controls its colored chip:
 *   'feature'  → ✨ חדש        (a new capability)
 *   'improve'  → ⬆️ שיפור      (an existing thing made better)
 *   'fix'      → 🛠️ תיקון      (a bug fixed)
 *
 * `BASE_FEATURES` is the foundational feature set ("the first version") and is
 * shown as the oldest, pinned card at the bottom of the list.
 */

export type ChangeKind = 'feature' | 'improve' | 'fix'

export interface ChangeItem {
  kind: ChangeKind
  text: string
}

export interface Release {
  /** e.g. "3.0" — shown as a chip. */
  version: string
  /** ISO date "YYYY-MM-DD" — rendered in he-IL. */
  date: string
  /** One-line headline for the release. */
  title: string
  items: ChangeItem[]
}

/** Newest first. Prepend new releases here. */
export const RELEASES: Release[] = [
  {
    version: '3.0.5',
    date: '2026-06-26',
    title: 'שיפורים מהמשובים שלכם',
    items: [
      { kind: 'fix', text: 'מסך הקטגוריות בסטטיסטיקות מציג עכשיו את ההתקדמות האמיתית בכל קטגוריה — כמה מילים נפגשתם בהן וכמה בשליטה.' },
      { kind: 'feature', text: 'באוסף המילים שבפרופיל אפשר עכשיו ללחוץ על מילה ולשמוע אותה — קודם באנגלית ואז בעברית.' },
      { kind: 'improve', text: 'כפתור "מה חדש" זמין עכשיו לכל שחקן/ית ישירות מראש מסך ההגדרות.' },
      { kind: 'improve', text: 'מסכי ההגדרות ברורים יותר — אפשרות נבחרת מודגשת במסגרת, האייקונים גדולים יותר, וקטע הוספת המילים נפתח בלחיצה.' },
      { kind: 'improve', text: 'במשחק האותיות מודגש אם השאלה היא "מה בא אחרי" או "מה בא לפני", והתשובות ממורכזות.' },
      { kind: 'improve', text: 'במסך המטבעות מוצג מספר אחד כל עוד אין על מה להוציא מטבעות — בלי כפילות מבלבלת.' },
    ],
  },
  {
    version: '3.0.4',
    date: '2026-06-26',
    title: 'פתיחת ביטויים לכל שחקן/ית בנפרד',
    items: [
      { kind: 'feature', text: 'בניהול המשתמשים אפשר עכשיו לפתוח את משחקי הביטויים לכל ילד/ה בנפרד — בלי לפתוח את כל התכנים לכולם.' },
    ],
  },
  {
    version: '3.0.3',
    date: '2026-06-25',
    title: 'תעודות הישג חדשות',
    items: [
      { kind: 'feature', text: 'תעודות חדשות על מילים שנפגשתם בהן לאורך הדרך — חגיגה כבר מהמילה הראשונה!' },
      { kind: 'feature', text: 'תעודות יוקרה נפרדות על מילים שאתם באמת שולטים בהן.' },
      { kind: 'feature', text: 'הורים יכולים לבחור כמה קל לקבל תעודות (קל / רגיל / מאתגר) באזור ההורה.' },
      { kind: 'fix', text: 'תעודות מילים מוענקות עכשיו גם בסיום מסע המילים.' },
    ],
  },
  {
    version: '3.0.2',
    date: '2026-06-21',
    title: 'סדר טוב יותר בהגדרות ההורה',
    items: [
      { kind: 'improve', text: 'אזור ההורה נקי ומסודר יותר — הכרטיסים הפחות נפוצים מקופלים כברירת מחדל ונפתחים בלחיצה.' },
      { kind: 'improve', text: 'עריכת תרגומי הביטויים עברה לתוך כרטיס הביטויים — הכל במקום אחד.' },
    ],
  },
  {
    version: '3.0.1',
    date: '2026-06-21',
    title: 'עדכונים אמינים יותר',
    items: [
      { kind: 'improve', text: 'התראת "גרסה חדשה זמינה" מופיעה עכשיו באמת בכל עדכון של המשחק.' },
      { kind: 'feature', text: 'כפתור "בדיקת עדכונים" במסך "מה חדש" — אפשר לבדוק מיד אם יש גרסה חדשה.' },
    ],
  },
  {
    version: '3.0',
    date: '2026-06-18',
    title: 'מראה חדש, התאמה אישית והרבה משחקים',
    items: [
      { kind: 'feature', text: 'עיצוב חדש לגמרי לכל האפליקציה, מהיר וברור יותר.' },
      { kind: 'feature', text: '"המשחק שלי" — כל ילד/ה בוחר/ת ערכת צבעים, דמות, צלילים ועוצמת חגיגה.' },
      { kind: 'feature', text: 'משחקי ביטויים: ניבים, פעלים מורכבים וסלנג ידידותי לילדים.' },
      { kind: 'feature', text: 'אזור הורה מוגן בסיסמה: הוספת מילים, החלפת תמונות וניהול שחקנים.' },
      { kind: 'feature', text: 'אפשר להתקין את המשחק כאפליקציה ולשחק גם בלי אינטרנט.' },
      { kind: 'feature', text: 'כפתור "דיווח על תקלה" בכל מסך — שולח צילום מסך ופרטים בלחיצה.' },
      { kind: 'improve', text: 'תמיכה מלאה במסך לרוחב ובטלפונים קטנים.' },
      { kind: 'improve', text: 'מסע המילים זוכר היכן עצרתם וממשיך מאותו מקום.' },
      { kind: 'improve', text: 'כפתור "הצצה" שמראה את המילה לרגע במשחקי הכתיב.' },
      { kind: 'fix', text: 'תיקון זיהוי הדיבור במשחקי המיקרופון במכשירי אנדרואיד.' },
      { kind: 'fix', text: 'תיקון תמונות צבעים שלא הופיעו במכשירים מסוימים.' },
    ],
  },
]

/** The foundational feature set — the "first version" card. */
export const BASE_FEATURES: { title: string; features: string[] } = {
  title: 'הגרסה הראשונה',
  features: [
    'לימוד אוצר מילים באנגלית לילדים דוברי עברית בגילאי 5–8.',
    'מסלול למידה מובנה: מילים נחשפות, נלמדות ונכנסות לתרגול חוזר.',
    'משחקים מגוונים: אוצר מילים, האזנה, הגייה, קריאה, דקדוק, זיכרון ועוד.',
    'מסע המילים — מסע רב-שלבי ללימוד מילה חדשה מהיכרות ועד כתיב ודיבור.',
    'לימוד אותיות וצלילים (ABC ופוניקה).',
    'מעקב התקדמות, מטבעות, תעודות וניקוד אישי לכל שחקן/ית.',
    'ממשק בעברית מימין לשמאל, עם ניקוד אופציונלי.',
  ],
}
