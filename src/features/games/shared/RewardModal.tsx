import { useEffect } from 'react'
import { Coins, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { speak } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'

interface Tier {
  message: string
  emoji: string
}

const TIERS: Array<{ min: number } & Tier> = [
  { min: 100, message: 'Perfect',     emoji: '🌟' },
  { min: 90,  message: 'Outstanding', emoji: '🏆' },
  { min: 80,  message: 'Excellent',   emoji: '🎉' },
  { min: 70,  message: 'Great job',   emoji: '👏' },
  { min: 60,  message: 'Well done',   emoji: '✨' },
  { min: 50,  message: 'Nice effort', emoji: '💪' },
  { min: 40,  message: 'Keep going',  emoji: '🚀' },
  { min: 30,  message: "Don't give up", emoji: '🌱' },
  { min: 20,  message: 'You can do it', emoji: '🌈' },
  { min: 0,   message: "Let's try again", emoji: '🎯' },
]

function tierFor(pct: number): Tier {
  return TIERS.find((t) => pct >= t.min) ?? TIERS[TIERS.length - 1]
}

export interface RewardModalProps {
  open: boolean
  title?: string
  message?: string
  score: number
  coins?: number
  total?: number
  correct?: number
  onPlayAgain?: () => void
  onExit: () => void
  onClose?: () => void
  className?: string
}

export function RewardModal({
  open,
  title,
  message,
  score,
  coins,
  total,
  correct,
  onPlayAgain,
  onExit,
  onClose,
  className,
}: RewardModalProps) {
  const nk = useNikud()
  const hasTally = typeof correct === 'number' && typeof total === 'number' && total > 0
  const pct = hasTally ? Math.round((correct! / total!) * 100) : null
  const tier = pct == null ? null : tierFor(pct)
  const headline = title ?? (tier ? `${tier.message}! ${tier.emoji}` : 'Done! 🎉')

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (onClose ?? onExit)()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, onExit])

  useEffect(() => {
    if (!open) return
    if (title) return // caller-supplied title — let the caller handle audio
    if (pct == null || !tier) return
    void speak(`${tier.message}!`)
  }, [open, pct, tier, title])

  if (!open) return null

  const dismiss = onClose ?? onExit

  return (
    <div
      role="presentation"
      data-testid="reward-modal-backdrop"
      onClick={dismiss}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-modal-title"
        data-testid="reward-modal"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--ink-900)] p-6 text-center shadow-[var(--shadow-panel)]',
          'animate-[feedbackReveal_0.3s_ease-out]',
          className,
        )}
        style={{ backgroundImage: 'var(--gradient-app)' }}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            data-testid="reward-modal-close"
            className="absolute end-3 top-3 rounded-full bg-white/5 p-1.5 text-[color:var(--slate-300)] transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--amber-400)] to-[color:var(--coral-400)] text-white shadow-lg">
          <Sparkles className="size-8" />
        </div>

        <h2
          id="reward-modal-title"
          data-testid="reward-modal-title"
          dir="ltr"
          className="text-2xl font-bold text-white"
        >
          {headline}
        </h2>
        {message ? (
          <p className="mt-2 text-sm text-[color:var(--slate-200)]">{nk(message)}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Stat
            icon={<Trophy className="size-4" />}
            label="ניקוד"
            value={score}
            tone="amber"
            testId="reward-score"
          />
          {typeof coins === 'number' ? (
            <Stat
              icon={<Coins className="size-4" />}
              label="מטבעות"
              value={coins}
              tone="mint"
              testId="reward-coins"
            />
          ) : null}
          {typeof correct === 'number' && typeof total === 'number' ? (
            <Stat
              label="תשובות נכונות"
              value={`${correct} / ${total}`}
              tone="blue"
              testId="reward-correct"
              className="sm:col-span-2"
            />
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {onPlayAgain ? (
            <button
              type="button"
              onClick={onPlayAgain}
              data-testid="reward-modal-play-again"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-5 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
            >
              <RotateCcw className="size-4" />
              {nk('שחק שוב')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExit}
            data-testid="reward-modal-exit"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/10"
          >
            {nk('למסך הבית')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
  testId,
  className,
}: {
  icon?: React.ReactNode
  label: string
  value: string | number
  tone: 'amber' | 'mint' | 'blue'
  testId: string
  className?: string
}) {
  const nk = useNikud()
  const toneClass = {
    amber: 'text-[color:var(--amber-400)]',
    mint: 'text-[color:var(--mint-400)]',
    blue: 'text-[color:var(--blue-400)]',
  }[tone]
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--slate-300)]">
        {icon}
        {nk(label)}
      </span>
      <span dir="ltr" className={cn('text-lg font-bold', toneClass)}>{value}</span>
    </div>
  )
}
