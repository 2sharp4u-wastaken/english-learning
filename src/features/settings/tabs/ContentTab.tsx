import { SectionCard } from '../components/SectionCard'
import { CustomWordsPanel } from './components/CustomWordsPanel'
import { WordImagesPanel } from './components/WordImagesPanel'
import { ExpressionsTab } from './ExpressionsTab'

/**
 * "תוכן" — everything that authors or overrides the learning CONTENT (settings
 * redesign, 2026-06-21): parent-added words, expression activation + Hebrew
 * meaning edits, and image/translation overrides. Pulled out of the old
 * overloaded כלי הורה tab so content management lives apart from accounts/tools.
 */
export function ContentTab() {
  return (
    <div className="space-y-4">
      {/* Issue #53: starts collapsed — the import form is tall and was always
          open, overloading the page. Tap the header chevron to expand. */}
      <SectionCard
        title="הוספת מילים מותאמות"
        description="ייבוא מילים באנגלית ותרגום אוטומטי לעברית עם Claude. המילים נשמרות בדפדפן ומופיעות מיד במשחקים."
        collapsible
        defaultCollapsed
        headerTestId="content-customwords-toggle"
      >
        <CustomWordsPanel />
      </SectionCard>

      {/* Full expressions block (enable + registers + meaning editor) — kept as a
          cohesive unit rather than split across tabs. */}
      <ExpressionsTab />

      {/* Image/translation overrides: a heavier, rarely-touched power tool, so it
          sits last and starts collapsed (the panel mounts only when expanded). */}
      <SectionCard
        title="תמונות ותרגומים"
        description="החלפת תמונות ותרגומים למילים קיימות. הכול נשמר בדפדפן — ללא צורך בשרת."
        collapsible
        defaultCollapsed
        headerTestId="content-images-toggle"
      >
        <WordImagesPanel />
      </SectionCard>
    </div>
  )
}
