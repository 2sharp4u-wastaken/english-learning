import { useCallback, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { SectionCard } from '../components/SectionCard'
import { CustomWordsPanel } from './components/CustomWordsPanel'
import { WordImagesPanel } from './components/WordImagesPanel'
import { QATestingPanel } from './components/QATestingPanel'

export function AdvancedToolsTab() {
  const { resetSettings } = useSettings()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

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

      <SectionCard
        title="תמונות ותרגומים"
        description="החלפת תמונות ותרגומים למילים קיימות. הכול נשמר בדפדפן — ללא צורך בשרת."
      >
        <WordImagesPanel />
      </SectionCard>

      {/* M12 Slice A: parent/QA testing affordance — opens locked content without
          grinding to the thresholds. Behind the parent password (this tab). */}
      <SectionCard
        title="כלי בדיקה (QA)"
        description="פתיחת תוכן נעול לצורך בדיקה, בלי לשחק עד הסף. הכלי משנה את ההתקדמות של המשתמש הנוכחי — לא מיועד לילדים."
      >
        <QATestingPanel />
      </SectionCard>

      {/* M6: moved here from the kid-visible settings header. */}
      <SectionCard
        title="תחזוקה"
        description="הורדת יומן האפליקציה לדיווח על תקלה, ואיפוס ההגדרות לברירת המחדל (לא נוגע בהתקדמות הילדים)."
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
    </div>
  )
}
