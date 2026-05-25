import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GameHeader, type GameHeaderProps } from './GameHeader'
import { GameHero } from './GameHero'
import { QuestionProgress, type QuestionProgressProps } from './QuestionProgress'

export interface GameScreenShellProps {
  /**
   * Header config. `title`, `icon`, and `subtitle` are forwarded to
   * `<GameHero>` (rendered above the header card). `score`, `coins`, and
   * `onBack` stay in `<GameHeader>` (the controls row).
   */
  header: GameHeaderProps
  progress?: QuestionProgressProps
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function GameScreenShell({
  header,
  progress,
  children,
  footer,
  className,
}: GameScreenShellProps) {
  return (
    <div
      data-theme="dark"
      data-testid="game-screen-shell"
      className="flex min-h-screen flex-col"
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 pt-4 pb-6 sm:px-6">
        <GameHeader {...header} />
        <GameHero
          title={header.title}
          subtitle={header.subtitle}
          icon={header.icon}
          aside={header.heroAside}
        />
        {progress ? <QuestionProgress {...progress} /> : null}
        <main className={cn('flex flex-1 flex-col', className)}>{children}</main>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </div>
    </div>
  )
}
