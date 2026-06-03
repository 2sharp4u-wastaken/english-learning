import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface ExitConfirmDialogProps {
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  className?: string
}

export function ExitConfirmDialog({
  open,
  title = 'לצאת מהמשחק?',
  message = 'ההתקדמות בשאלה הנוכחית עלולה לא להישמר.',
  confirmLabel = 'יציאה',
  cancelLabel = 'המשך משחק',
  onConfirm,
  onCancel,
  className,
}: ExitConfirmDialogProps) {
  const nk = useNikud()
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="presentation"
      data-testid="exit-dialog-backdrop"
      onClick={onCancel}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-dialog-title"
        aria-describedby="exit-dialog-message"
        data-testid="exit-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-sm rounded-3xl border border-white/10 bg-[color:var(--ink-900)] p-5 text-center shadow-[var(--shadow-panel)]',
          'animate-[feedbackReveal_0.2s_ease-out]',
          className,
        )}
      >
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[color:var(--coral-400)]/15 text-[color:var(--coral-400)]">
          <AlertTriangle className="size-6" />
        </div>
        <h2
          id="exit-dialog-title"
          className="text-lg font-bold text-white"
        >
          {nk(title)}
        </h2>
        <p
          id="exit-dialog-message"
          className="mt-2 text-sm text-[color:var(--slate-200)]"
        >
          {nk(message)}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onCancel}
            data-testid="exit-dialog-cancel"
            autoFocus
            className="flex-1 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-5 py-2.5 text-sm font-bold text-[color:var(--ink-950)] transition hover:brightness-110"
          >
            {nk(cancelLabel)}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="exit-dialog-confirm"
            className="flex-1 rounded-full border border-[color:var(--coral-400)]/40 bg-[color:var(--coral-400)]/10 px-5 py-2.5 text-sm font-semibold text-[color:var(--coral-400)] transition hover:bg-[color:var(--coral-400)]/20"
          >
            {nk(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  )
}
