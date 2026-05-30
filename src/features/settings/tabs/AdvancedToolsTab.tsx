import { SectionCard } from '../components/SectionCard'
import { CustomWordsPanel } from './components/CustomWordsPanel'
import { WordImagesPanel } from './components/WordImagesPanel'

export function AdvancedToolsTab() {
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
    </div>
  )
}
