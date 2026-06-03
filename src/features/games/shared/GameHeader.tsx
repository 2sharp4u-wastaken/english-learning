import type { ReactNode } from 'react'
import { ChevronRight, Coins, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'

/**
 * `title`, `subtitle`, `icon` are still accepted for API compatibility but are
 * no longer rendered here — they live in `<GameHero>` above the header card
 * (canonical placement adopted 2026-05-23). `GameScreenShell` reads these
 * fields and renders the hero. Keeping them on `GameHeaderProps` lets each
 * game page declare a single `headerProps` object the shell forwards to both.
 */
export interface GameHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  /** Forwarded by GameScreenShell to <GameHero aside>; not rendered here. */
  heroAside?: ReactNode
  score?: number
  coins?: number
  onBack?: () => void
  className?: string
}

export function GameHeader({
  score,
  coins,
  onBack,
  className,
}: GameHeaderProps) {
  const navigate = useNavigate()
  const { caseMode, showNikud, toggleCase, toggleNikud } = useTextPrefs()
  const nk = useNikud()

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
        <span>{nk('חזרה')}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleCase}
          data-testid="header-case-toggle"
          aria-pressed={caseMode === 'lowercase'}
          title="החלף רישיות (ABC / abc)"
          className="flex h-9 items-center gap-1 rounded-full bg-white/5 px-3 text-xs font-bold text-[color:var(--slate-200)] transition hover:bg-white/10 hover:text-white"
        >
          <span className={caseMode === 'uppercase' ? 'text-white' : 'opacity-40'}>ABC</span>
          <span className="opacity-40">/</span>
          <span className={caseMode === 'lowercase' ? 'text-white' : 'opacity-40'}>abc</span>
        </button>
        <button
          type="button"
          onClick={toggleNikud}
          data-testid="header-nikud-toggle"
          aria-pressed={showNikud}
          title="הצג/הסתר ניקוד (אֶ/א)"
          className="flex h-9 min-w-[3.25rem] items-center justify-center gap-1 rounded-full bg-white/5 px-3 text-sm font-bold text-[color:var(--slate-200)] transition hover:bg-white/10 hover:text-white"
        >
          <span className={showNikud ? 'text-white' : 'opacity-40'}>אֶ</span>
          <span className="opacity-40">/</span>
          <span className={!showNikud ? 'text-white' : 'opacity-40'}>א</span>
        </button>
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
