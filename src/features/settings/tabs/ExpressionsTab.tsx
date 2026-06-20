import { useSettings } from '@/hooks/useSettings'
import { DEFAULT_REGISTERS, type Register } from '@/bridge/expressions'
import { SectionCard } from '../components/SectionCard'
import { Toggle } from '../components/Toggle'
import { ExpressionsPanel } from './components/ExpressionsPanel'

/**
 * Parent-locked "ביטויים" tab (Phase 5, Slice 5.2). Two parts:
 *  1. Controls — a master on/off plus per-register toggles (kid-friendly / casual /
 *     edgy). The expressions bridge reads these; games (Slice 5.3) honor them.
 *  2. Manager — browse every expression and fix its Hebrew meaning (ExpressionsPanel).
 */

const REGISTER_COPY: Record<Register, { label: string; description: string }> = {
  'kid-friendly': {
    label: 'ידידותי לגיל הרך',
    description: 'ניבים ופעלים נפוצים ומתאימים לכל גיל (למשל "give up", "piece of cake").',
  },
  casual: {
    label: 'יומיומי',
    description: 'סלנג קליל ונפוץ (למשל "awesome", "no way", "hang out").',
  },
  edgy: {
    label: 'נועז',
    description: 'סלנג עכשווי של בני נוער (למשל "no cap", "that\'s fire", "got beef").',
  },
}

export function ExpressionsTab() {
  const { settings, updateSettings } = useSettings()

  const enabled = settings.expressionsEnabled !== false
  const registers = { ...DEFAULT_REGISTERS, ...(settings.expressionRegisters ?? {}) }

  const setRegister = (reg: Register, value: boolean) => {
    updateSettings({ expressionRegisters: { ...registers, [reg]: value } })
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="ביטויים, ניבים וסלנג"
        description="הפעלה וכיבוי של תוכן הביטויים ובחירת הסגנונות שיוצגו לשחקן/ית. כברירת מחדל מוצגים רק ביטויים ידידותיים לגיל הרך."
      >
        <div className="space-y-2">
          <Toggle
            label="הפעלת ביטויים"
            description="מתג ראשי לכל תוכן הביטויים. כיבוי מסתיר את כולם מהמשחקים."
            checked={enabled}
            testId="expr-enabled-toggle"
            onChange={(v) => updateSettings({ expressionsEnabled: v })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(REGISTER_COPY) as Register[]).map((reg) => (
              <Toggle
                key={reg}
                label={REGISTER_COPY[reg].label}
                description={REGISTER_COPY[reg].description}
                checked={enabled && registers[reg]}
                disabled={!enabled}
                testId={`expr-register-${reg}`}
                onChange={(v) => setRegister(reg, v)}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="עריכת תרגומים"
        description="עיון בכל הביטויים והתאמת המשמעות בעברית — בחירה מבין האפשרויות או הקלדת תרגום משלך. השינויים נשמרים בדפדפן."
      >
        <ExpressionsPanel />
      </SectionCard>
    </div>
  )
}
