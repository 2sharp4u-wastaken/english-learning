import { useSettings } from '@/hooks/useSettings'
import type { ExitBehavior } from '@/bridge/types'
import { SectionCard } from '../components/SectionCard'
import { Toggle } from '../components/Toggle'
import { RadioCards, type RadioOption } from '../components/RadioCards'

const EXIT_OPTIONS: RadioOption<ExitBehavior>[] = [
  { value: 'autosave',     label: 'שמירה אוטומטית', description: 'יציאה מיידית — ההתקדמות נשמרת אוטומטית' },
  { value: 'confirmation', label: 'בקשת אישור',      description: 'הצגת חלון אישור לפני יציאה ממשחק' },
]

export function AdvancedTab() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="space-y-4">
      <SectionCard title="תצוגה">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="ניקוד עברי"
            description="הצג סימני ניקוד על מילים בעברית"
            checked={settings.showNikud !== false}
            onChange={(v) => updateSettings({ showNikud: v })}
          />
          <Toggle
            label="אותיות קטנות באנגלית"
            description="הצג מילים באנגלית באותיות קטנות כברירת מחדל"
            checked={settings.lowercaseMode === true}
            onChange={(v) => updateSettings({ lowercaseMode: v })}
          />
          <Toggle
            label="קונפטי על תשובה נכונה"
            description="אנימציית חגיגה כאשר ילד עונה נכון"
            checked={settings.showConfetti !== false}
            onChange={(v) => updateSettings({ showConfetti: v })}
          />
        </div>
      </SectionCard>

      <SectionCard title="התנהגות יציאה ממשחק">
        <RadioCards
          columns={2}
          options={EXIT_OPTIONS}
          value={(settings.exitBehavior ?? 'autosave') as ExitBehavior}
          onChange={(v) => updateSettings({ exitBehavior: v })}
        />
      </SectionCard>

      <SectionCard
        title="מתקדם להורה"
        description="הפעלה עלולה להפר את מסלול הלמידה המובנה של הילד."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="עקיפת נעילות משחקים"
            description="אפשר לילד לגשת לכל המשחקים ללא תלות ברמות נעילה"
            checked={settings.gameUnlockOverride === true}
            onChange={(v) => updateSettings({ gameUnlockOverride: v })}
          />
          <Toggle
            label="התאמת אורך מילים אוטומטית"
            description="ילד מתחיל מקבל מילים קצרות; הסינון נפתח עם ההתקדמות"
            checked={settings.difficultyAutoGate !== false}
            onChange={(v) => updateSettings({ difficultyAutoGate: v })}
          />
        </div>
      </SectionCard>
    </div>
  )
}
