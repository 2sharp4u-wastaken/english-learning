import { useSettings } from '@/hooks/useSettings'
import type { LearningPace } from '@/bridge/types'
import { SectionCard } from '../components/SectionCard'
import { Slider } from '../components/Slider'
import { Toggle } from '../components/Toggle'
import { RadioCards, type RadioOption } from '../components/RadioCards'

const PACE_OPTIONS: RadioOption<LearningPace>[] = [
  { value: 'slow',   label: 'איטי',  description: '3 מילים למסע' },
  { value: 'normal', label: 'רגיל',  description: '5 מילים למסע' },
  { value: 'fast',   label: 'מהיר',  description: '8 מילים למסע' },
]

export function GameTab() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="space-y-4">
      <SectionCard
        title="מכניקת משחק"
        description="כמה שאלות בכל סבב, כמה חזרות ניתנות, וכמה פעמים ניתן להשמיע מילה."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Slider
            label="שאלות במשחק"
            min={5}
            max={20}
            value={settings.questionsPerGame}
            onChange={(v) => updateSettings({ questionsPerGame: v })}
          />
          <Slider
            label="מספר חזרות בלחיצה"
            min={1}
            max={5}
            value={settings.clickRepeatCount}
            onChange={(v) => updateSettings({ clickRepeatCount: v })}
            description="כמה פעמים מילה מושמעת בלחיצה אחת"
          />
          <Slider
            label="תקציב השמעות"
            min={3}
            max={15}
            value={settings.audioPlaysAllowed}
            onChange={(v) => updateSettings({ audioPlaysAllowed: v })}
            description="מספר השמעות מקסימלי לשאלה"
          />
        </div>
      </SectionCard>

      <SectionCard title="קצב למידה" description="כמה מילים חדשות להציג במסע מילים.">
        <RadioCards
          columns={3}
          options={PACE_OPTIONS}
          value={(settings.learningPace ?? 'normal') as LearningPace}
          onChange={(v) => updateSettings({ learningPace: v })}
        />
      </SectionCard>

      <SectionCard
        title="הצצה חטופה (קריאה)"
        description="במשחק הקריאה המילה נעלמת אחרי כמה שניות. הצצה חטופה מאפשרת לילד ללחוץ כדי לחשוף את המילה שוב לרגע קצר."
      >
        <Toggle
          label="אפשר הצצה חטופה"
          description="כפתור 👁 במשחק הקריאה שמהבהב את המילה שנעלמה"
          checked={settings.sneakPeekEnabled ?? true}
          onChange={(v) => updateSettings({ sneakPeekEnabled: v })}
        />
        {(settings.sneakPeekEnabled ?? true) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Slider
              label="משך ההצצה"
              min={0.3}
              max={2}
              step={0.1}
              unit="שנ׳"
              value={settings.sneakPeekDuration ?? 0.5}
              onChange={(v) => updateSettings({ sneakPeekDuration: v })}
              description="כמה זמן המילה נחשפת בכל הצצה"
            />
            <Slider
              label="מספר הצצות"
              min={1}
              max={5}
              unit="פעמים"
              value={settings.sneakPeekBudget ?? 3}
              onChange={(v) => updateSettings({ sneakPeekBudget: v })}
              description="כמה הצצות מותרות בכל שאלה"
            />
          </div>
        )}
      </SectionCard>

      <SectionCard title="קול וקריאה">
        <Toggle
          label="ניקוד עברי בקריאה"
          description="הוסף סימני ניקוד לתרגום העברי להקראה טבעית יותר"
          checked={settings.hebrewVocalization}
          onChange={(v) => updateSettings({ hebrewVocalization: v })}
        />
      </SectionCard>
    </div>
  )
}
