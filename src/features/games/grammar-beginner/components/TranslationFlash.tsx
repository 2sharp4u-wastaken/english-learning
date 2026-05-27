import { useTextPrefs, stripNikud } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'

/**
 * Hebrew translation reveal — shown post-answer *inside* the prompt card,
 * directly under the English sentence (rather than as a separate floating
 * pill), so it reads as part of the sentence the way other games present text.
 */
export function TranslationFlash({ hebrew, visible }: { hebrew: string; visible: boolean }) {
  const { showNikud } = useTextPrefs()
  const text = showNikud ? hebrew : stripNikud(hebrew)
  if (!visible || !text) return null
  return (
    <p
      key={text}
      data-testid="gb-translation"
      dir="rtl"
      className={cn(
        'mt-3 border-t border-white/10 pt-3 text-center text-xl font-bold text-[color:var(--mint-300)]',
        'animate-[gbFlash_0.5s_ease-out]',
      )}
    >
      {text}
    </p>
  )
}
