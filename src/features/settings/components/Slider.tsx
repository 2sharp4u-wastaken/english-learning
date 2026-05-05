interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  description?: string
  onChange: (next: number) => void
}

export function Slider({ label, value, min, max, step = 1, unit, description, onChange }: Props) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="font-display text-base font-semibold text-text tabular-nums">
          {value}
          {unit && <span className="ms-1 text-xs font-normal text-muted">{unit}</span>}
        </div>
      </div>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[color:var(--color-learn)]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
