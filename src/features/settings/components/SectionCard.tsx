import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export function SectionCard({ title, description, children, className, actions }: Props) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-surface/90 p-5 shadow-panel sm:p-6',
        className,
      )}
    >
      {(title || description || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title && (
              <h2 className="font-display text-base font-semibold text-text sm:text-lg">
                {title}
              </h2>
            )}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
