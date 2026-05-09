import { ChevronRight, Coins, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

export interface GameHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  score?: number
  coins?: number
  onBack?: () => void
  className?: string
}

export function GameHeader({
  title,
  subtitle,
  icon,
  score,
  coins,
  onBack,
  className,
}: GameHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate('/home')
  }

  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[color:var(--ink-900)]/80 px-4 py-3 backdrop-blur',
        className,
      )}
      data-testid="game-header"
    >
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-sm font-medium text-[color:var(--slate-200)] transition hover:bg-white/10 hover:text-white"
        data-testid="game-header-back"
        aria-label="חזרה"
      >
        <ChevronRight className="size-5" />
        <span>חזרה</span>
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
        {icon ? <span className="text-xl leading-none">{icon}</span> : null}
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-base font-semibold text-white">{title}</span>
          {subtitle ? (
            <span className="truncate text-xs text-[color:var(--slate-300)]">{subtitle}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {typeof score === 'number' ? (
          <span
            className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-[color:var(--amber-400)]"
            data-testid="game-header-score"
          >
            <Trophy className="size-4" />
            {score}
          </span>
        ) : null}
        {typeof coins === 'number' ? (
          <span
            className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-sm font-semibold text-[color:var(--mint-400)]"
            data-testid="game-header-coins"
          >
            <Coins className="size-4" />
            {coins}
          </span>
        ) : null}
      </div>
    </header>
  )
}
