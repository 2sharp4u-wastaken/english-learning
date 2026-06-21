import { cn } from '@/lib/cn'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  /** data-testid on the switch control — a nikud-proof handle for tests (the
   *  accessible name comes from the label, which nikudDOM mutates at runtime). */
  testId?: string
}

export function Toggle({ checked, onChange, label, description, disabled, testId }: Props) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-xl border border-white/8 bg-white/5 p-3 transition-colors',
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-white/8',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-testid={testId}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-learn' : 'bg-white/15',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
            // RTL-aware: when checked, knob moves to start edge (right in RTL)
            checked ? 'end-0.5' : 'start-0.5',
          )}
        />
      </button>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm font-medium text-text">{label}</div>
        {description && <div className="text-xs text-muted">{description}</div>}
      </div>
    </label>
  )
}
