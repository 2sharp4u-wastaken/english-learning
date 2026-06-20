import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
  /** When true the card body can be expanded/collapsed via its header. */
  collapsible?: boolean
  /** Initial collapsed state (only meaningful with `collapsible`). */
  defaultCollapsed?: boolean
}

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
  collapsible = false,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed)
  const hasHeader = Boolean(title || description || actions)

  // The header is a real <button> only when collapsible, so a tap anywhere on it
  // toggles; otherwise it stays a static block (unchanged from the original).
  const headerInner = (
    <>
      <div className="min-w-0 space-y-1 text-start">
        {title && (
          <h2 className="font-display text-base font-semibold text-text sm:text-lg">{title}</h2>
        )}
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {collapsible ? (
        <ChevronDown
          size={20}
          className={cn(
            'mt-0.5 shrink-0 text-muted transition-transform',
            open ? 'rotate-180' : 'rotate-0',
          )}
          aria-hidden
        />
      ) : (
        actions && <div className="shrink-0">{actions}</div>
      )}
    </>
  )

  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-surface/90 p-5 shadow-panel sm:p-6',
        className,
      )}
    >
      {hasHeader &&
        (collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={cn(
              'flex w-full items-start justify-between gap-3 rounded-lg text-start transition-colors',
              open && 'mb-4',
            )}
          >
            {headerInner}
          </button>
        ) : (
          <header className="mb-4 flex items-start justify-between gap-3">{headerInner}</header>
        ))}
      {(!collapsible || open) && children}
    </section>
  )
}
