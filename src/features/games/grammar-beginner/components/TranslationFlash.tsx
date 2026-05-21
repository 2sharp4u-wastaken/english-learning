import { useTextPrefs, stripNikud } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'

/**
 * Hebrew translation flash banner — mirrors legacy gb-translation + gb-flash.
 * Shown post-answer, animates in then sticks until next question.
 */
export function TranslationFlash({ hebrew, visible }: { hebrew: string; visible: boolean }) {
  const { showNikud } = useTextPrefs()
  const text = showNikud ? hebrew : stripNikud(hebrew)
  if (!visible || !text) return null
  return (
    <div
      key={text}
      data-testid="gb-translation"
      dir="rtl"
      className={cn(
        'mx-auto mt-2 max-w-md rounded-2xl border border-[color:var(--mint-400)]/30',
        'bg-[color:var(--mint-400)]/10 px-5 py-3 text-center text-lg font-bold text-[color:var(--mint-400)]',
        'animate-[gbFlash_0.6s_ease-out]',
      )}
    >
      {text}
    </div>
  )
}
