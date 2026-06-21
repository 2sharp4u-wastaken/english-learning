import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { DEFAULT_REGISTERS, type Register } from '@/bridge/expressions'
import { cn } from '@/lib/cn'
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
  const [editorOpen, setEditorOpen] = useState(false)

  const enabled = settings.expressionsEnabled !== false
  const registers = { ...DEFAULT_REGISTERS, ...(settings.expressionRegisters ?? {}) }

  const setRegister = (reg: Register, value: boolean) => {
    updateSettings({ expressionRegisters: { ...registers, [reg]: value } })
  }

  return (
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

      {/* "עריכת תרגומים" — nested as a collapsible subsection, starts closed */}
      <div className="-mx-5 -mb-5 mt-4 border-t border-white/8 sm:-mx-6 sm:-mb-6">
        <button
          type="button"
          onClick={() => setEditorOpen((v) => !v)}
          aria-expanded={editorOpen}
          data-testid="expr-translations-toggle"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-white/3 sm:px-6"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="font-display text-base font-semibold text-text">עריכת תרגומים</p>
            {!editorOpen && (
              <p className="text-sm text-muted">עיון בכל הביטויים והתאמת המשמעות בעברית</p>
            )}
          </div>
          <ChevronDown
            size={20}
            className={cn('mt-0.5 shrink-0 text-muted transition-transform', editorOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {editorOpen && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <p className="mb-3 text-sm text-muted">
              בחירה מבין האפשרויות או הקלדת תרגום משלך. השינויים נשמרים בדפדפן.
            </p>
            <ExpressionsPanel />
          </div>
        )}
      </div>
    </SectionCard>
  )
}
