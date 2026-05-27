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
  /**
   * Lock the game to exactly one screen (100dvh): header/title/progress/footer
   * stay pinned and only the content `<main>` scrolls if it overflows. This
   * keeps the footer (e.g. "next question") always visible so nothing is
   * silently pushed below the fold. Defaults on for all games; pass `false`
   * to fall back to the old page-scroll layout.
   */
  fitViewport?: boolean
}

export function GameScreenShell({
  header,
  progress,
  children,
  footer,
  className,
  fitViewport = true,
}: GameScreenShellProps) {
  return (
    <div
      data-theme="dark"
      data-testid="game-screen-shell"
      data-fit-viewport={fitViewport ? 'true' : 'false'}
      className={cn('flex flex-col', fitViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 pt-4 sm:px-6',
          fitViewport ? 'min-h-0 pb-3' : 'pb-6',
        )}
      >
        <GameHeader {...header} />
        <GameHero
          title={header.title}
          subtitle={header.subtitle}
          icon={header.icon}
          aside={header.heroAside}
        />
        {progress ? <QuestionProgress {...progress} /> : null}
        <main
          className={cn(
            'flex flex-1 flex-col',
            fitViewport && 'min-h-0 overflow-y-auto',
            className,
          )}
        >
          {children}
        </main>
        {footer ? <div className={cn('pt-2', fitViewport && 'shrink-0')}>{footer}</div> : null}
      </div>
    </div>
  )
}
