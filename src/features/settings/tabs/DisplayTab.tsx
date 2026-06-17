import { useSettings } from '@/hooks/useSettings'
import { SectionCard } from '../components/SectionCard'
import { Toggle } from '../components/Toggle'

/**
 * The ONLY kid-facing (unprotected) settings tab (M12 Slice B / M4): harmless
 * display preferences a child can flip without touching content, mechanics, or
 * accounts. Everything that changes WHAT the child learns or HOW the app is run
 * lives behind the parent gate. Settings are global, so a parent sees these too.
 */
export function DisplayTab() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="space-y-4">
      <SectionCard title="תצוגה" description="העדפות תצוגה בסיסיות.">
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
    </div>
  )
}
