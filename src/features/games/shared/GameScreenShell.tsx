import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GameHeader, type GameHeaderProps } from './GameHeader'
import { QuestionProgress, type QuestionProgressProps } from './QuestionProgress'

export interface GameScreenShellProps {
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
        {progress ? <QuestionProgress {...progress} /> : null}
        <main className={cn('flex flex-1 flex-col', className)}>{children}</main>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </div>
    </div>
  )
}
