import { useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'

interface NikudToggleProps {
  /** Compact mode shrinks padding for the mobile top bar. */
  compact?: boolean
  className?: string
}

/**
 * Site-wide nikud (Hebrew vowel marks) toggle. Surfaces the same control
 * GameHeader uses, so toggling on the home page persists into game routes
 * and vice versa. Reads/writes via `useTextPrefs` so all subscribers
 * re-render on change.
 */
export function NikudToggle({ compact = false, className }: NikudToggleProps) {
  const { showNikud, toggleNikud } = useTextPrefs()
  return (
    <button
      type="button"
      onClick={toggleNikud}
      data-testid="topbar-nikud-toggle"
      aria-pressed={showNikud}
      title="הצג/הסתר ניקוד (אֶ/א)"
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 font-bold text-muted transition hover:bg-white/10 hover:text-text',
        compact ? 'h-8 min-w-[3rem] px-2 text-xs' : 'h-9 min-w-[3.25rem] px-3 text-sm',
        className,
      )}
    >
      <span className={showNikud ? 'text-text' : 'opacity-40'}>אֶ</span>
      <span className="opacity-40">/</span>
      <span className={!showNikud ? 'text-text' : 'opacity-40'}>א</span>
    </button>
  )
}
