import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface AnswerOption {
  key?: string | number
  label?: string
  /** Optional secondary label rendered under `label` in a smaller, dimmer
   *  font. Used by the React grammar game (Slice 3.10) to show Hebrew
   *  translations beneath each English option. */
  sublabel?: string
  media?: ReactNode
  ariaLabel?: string
}

export interface AnswerGridProps {
  options: AnswerOption[]
  onSelect: (index: number) => void
  selectedIndex?: number | null
  correctIndex?: number | null
  /** Reveal correct/incorrect styling on selected + correct options */
  revealed?: boolean
  /** Disable all buttons (e.g. while audio plays) */
  disabled?: boolean
  /** Hide buttons but keep layout (used for audio-gated reveals) */
  hidden?: boolean
  columns?: 2 | 3 | 4
  variant?: 'text' | 'media'
  /** Auto-focus the first option when it becomes interactive */
  autoFocusFirst?: boolean
  className?: string
}

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export function AnswerGrid({
  options,
  onSelect,
  selectedIndex = null,
  correctIndex = null,
  revealed = false,
  disabled = false,
  hidden = false,
  columns,
  variant = 'text',
  autoFocusFirst = false,
  className,
}: AnswerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nk = useNikud()
  const cols = columns ?? (options.length === 2 ? 2 : options.length >= 4 ? 4 : 3)

  useEffect(() => {
    if (!autoFocusFirst || disabled || hidden) return
    const first = containerRef.current?.querySelector<HTMLButtonElement>(
      '[data-testid="answer-option"]:not([disabled])',
    )
    first?.focus()
  }, [autoFocusFirst, disabled, hidden, options])

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
      '[data-testid="answer-option"]',
    )
    if (!buttons || buttons.length === 0) return
    let next = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % buttons.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + buttons.length) % buttons.length
    else return
    e.preventDefault()
    buttons[next]?.focus()
  }

  return (
    <div
      ref={containerRef}
      data-testid="answer-grid"
      data-variant={variant}
      data-revealed={revealed ? 'true' : 'false'}
      className={cn(
        'grid w-full gap-3',
        COLUMN_CLASS[cols],
        hidden && 'pointer-events-none opacity-0',
        className,
      )}
    >
      {options.map((option, index) => {
        const isSelected = selectedIndex === index
        const isCorrect = revealed && correctIndex === index
        const isIncorrectChoice = revealed && isSelected && correctIndex !== index
        const buttonDisabled = disabled || revealed

        return (
          <button
            key={option.key ?? index}
            type="button"
            data-testid="answer-option"
            data-index={index}
            data-state={
              isCorrect ? 'correct' : isIncorrectChoice ? 'incorrect' : isSelected ? 'selected' : 'idle'
            }
            disabled={buttonDisabled}
            aria-label={option.ariaLabel ?? option.label}
            aria-pressed={isSelected}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'group relative flex min-h-[3.5rem] min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-base font-semibold transition',
              'border-white/10 bg-white/[0.04] text-white',
              'hover:border-[color:var(--blue-400)]/40 hover:bg-white/[0.08]',
              'focus-visible:border-[color:var(--blue-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/40',
              'disabled:cursor-not-allowed',
              variant === 'media' && 'flex-col p-3',
              isSelected && !revealed && 'border-[color:var(--blue-400)] bg-[color:var(--blue-400)]/15',
              isCorrect && 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100',
              isIncorrectChoice && 'border-rose-400/60 bg-rose-500/15 text-rose-100',
              !revealed && 'disabled:opacity-60',
            )}
          >
            {option.media ? (
              <span className="flex w-full items-center justify-center">{option.media}</span>
            ) : null}
            {option.label || option.sublabel ? (
              <span
                className={cn(
                  'flex w-full min-w-0 flex-col items-center justify-center',
                  option.sublabel ? 'gap-0.5' : '',
                )}
              >
                {option.label ? (
                  <span className="block w-full text-center leading-tight [overflow-wrap:anywhere]">
                    {nk(option.label)}
                  </span>
                ) : null}
                {option.sublabel ? (
                  <span
                    dir="rtl"
                    className="block w-full text-center text-xs font-medium leading-tight text-[color:var(--slate-300)] [overflow-wrap:anywhere]"
                  >
                    {nk(option.sublabel)}
                  </span>
                ) : null}
              </span>
            ) : null}
            {isCorrect ? (
              <Check
                className="absolute end-2 top-2 size-4 text-emerald-300"
                aria-hidden
              />
            ) : null}
            {isIncorrectChoice ? (
              <X className="absolute end-2 top-2 size-4 text-rose-300" aria-hidden />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
