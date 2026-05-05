import { cn } from '@/lib/cn'

export interface RadioOption<T extends string> {
  value: T
  label: string
  description?: string
}

interface Props<T extends string> {
  options: RadioOption<T>[]
  value: T
  onChange: (next: T) => void
  columns?: 1 | 2 | 3
}

export function RadioCards<T extends string>({ options, value, onChange, columns = 1 }: Props<T>) {
  const gridClass =
    columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : ''

  return (
    <div className={cn('grid grid-cols-1 gap-2', gridClass)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-xl border p-3 text-start transition-colors',
              active
                ? 'border-learn/60 bg-learn/10 text-text'
                : 'border-white/8 bg-white/5 text-muted hover:border-white/20 hover:bg-white/8 hover:text-text',
            )}
          >
            <div className="text-sm font-medium text-text">{opt.label}</div>
            {opt.description && <div className="mt-0.5 text-xs text-muted">{opt.description}</div>}
          </button>
        )
      })}
    </div>
  )
}
