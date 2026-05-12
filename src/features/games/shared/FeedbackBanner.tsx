import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export type FeedbackVariant = 'correct' | 'incorrect'

export interface FeedbackBannerProps {
  variant: FeedbackVariant
  message: string
  visible: boolean
  autoDismissMs?: number
  onDismiss?: () => void
  className?: string
}

const VARIANT_STYLES: Record<FeedbackVariant, string> = {
  correct:
    'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_18px_45px_-18px_rgba(72,187,120,0.6)]',
  incorrect:
    'border-rose-400/40 bg-rose-500/15 text-rose-100 shadow-[0_18px_45px_-18px_rgba(245,101,101,0.6)]',
}

export function FeedbackBanner({
  variant,
  message,
  visible,
  autoDismissMs,
  onDismiss,
  className,
}: FeedbackBannerProps) {
  useEffect(() => {
    if (!visible || !autoDismissMs || !onDismiss) return
    const id = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(id)
  }, [visible, autoDismissMs, onDismiss])

  if (!visible) return null

  const Icon = variant === 'correct' ? CheckCircle2 : XCircle

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="feedback-banner"
      data-variant={variant}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-20 z-[1000] mx-auto flex max-w-lg items-center justify-center gap-3 rounded-2xl border px-5 py-4 text-xl font-bold backdrop-blur-md transition-all sm:text-2xl',
        'animate-[feedbackReveal_0.25s_ease-out]',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <Icon className="size-6 shrink-0 sm:size-7" aria-hidden />
      {/* Feedback strings come from feedback.js and are written in English
          ("Wonderful! Keep it up!"). The surrounding document is RTL, so
          without an explicit dir="ltr" the bidi algorithm renders trailing
          punctuation at the wrong end ("! Wonderful Keep it up"). */}
      <span dir="ltr">{message}</span>
    </div>
  )
}
