/**
 * "בקרוב" (Roadmap / backlog) content — the planned-work view rendered by
 * WhatsNewPage. This is a curated, parent-facing summary of `docs/backlog.md`;
 * keep it short and benefit-oriented (no engineering jargon / internal IDs).
 *
 * HOW TO UPDATE
 * -------------
 * Move an item to `RELEASES` in `whatsNew.ts` once it ships (and delete it from
 * here). Add new planned work below under the right `status`:
 *   'in-progress' → 🔧 בעבודה
 *   'planned'     → 📅 מתוכנן
 *   'considering' → 💡 נשקל
 */

export type RoadmapStatus = 'in-progress' | 'planned' | 'considering'

export interface RoadmapItem {
  status: RoadmapStatus
  title: string
  detail: string
}

export const ROADMAP: RoadmapItem[] = [
  {
    status: 'in-progress',
    title: 'בדיקות על מכשירים אמיתיים',
    detail: 'מעבר על האפליקציה בטלפונים וטאבלטים שונים כדי לוודא שהכול עובד חלק.',
  },
  {
    status: 'planned',
    title: 'חשבון בענן וגיבוי',
    detail: 'חשבון משפחה שיאפשר לשחק בכמה מכשירים ולשמור את ההתקדמות בגיבוי.',
  },
  {
    status: 'planned',
    title: 'טבלאות שיא',
    detail: 'לוח תוצאות משפחתי שמדרג את השחקנים/ות לפי התקדמות וניקוד.',
  },
  {
    status: 'planned',
    title: 'תעודות הישג למסע המילים',
    detail: 'תעודות "אלוף" שייפתחו עם סיום אבני דרך במסע המילים ובמשחקים.',
  },
  {
    status: 'considering',
    title: 'תמונות אמיתיות למילים נוספות',
    detail: 'החלפת אימוג׳י כלליים בתמונות מדויקות יותר לחלק מהמילים.',
  },
  {
    status: 'considering',
    title: 'עדכוני תוכן מרחוק',
    detail: 'הוספת מילים ונושאים חדשים בלי צורך לעדכן את האפליקציה.',
  },
]
