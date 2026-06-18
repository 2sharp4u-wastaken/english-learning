import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GameHeader, type GameHeaderProps } from './GameHeader'
import { GameHero } from './GameHero'
import { QuestionProgress, type QuestionProgressProps } from './QuestionProgress'
import { useCompactViewport } from './useCompactViewport'

export interface GameScreenShellProps {
  /**
   * Header config. `title`, `icon`, and `subtitle` are forwarded to
   * `<GameHero>` (rendered above the header card). `score`, `coins`, and
   * `onBack` stay in `<GameHeader>` (the controls row).
   */
  header: GameHeaderProps
  progress?: QuestionProgressProps
  children: ReactNode
  /**
   * Optional prompt/media block (the picture + word + audio). When provided,
   * `<main>` becomes a two-pane layout in short LANDSCAPE viewports — prompt on
   * one side, the interaction (`children`) on the other — so nothing scrolls
   * off-screen (M3). Portrait stacks them as before. Games that don't pass it
   * keep the single-column layout. See globals.css `.game-twopane`.
   */
  prompt?: ReactNode
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
  prompt,
  footer,
  className,
  fitViewport = true,
}: GameScreenShellProps) {
  const compact = useCompactViewport()
  const mainRef = useRef<HTMLElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)

  // M3-c (beta #16/#19): on a small phone in PORTRAIT the play area can overflow
  // and the child doesn't know to scroll. Auto-hide the decorative top chrome
  // (game title + progress) once they DO scroll `<main>` down — like a mobile
  // browser's address bar — freeing that height for the question/answers; it
  // slides back in at the top. Compact-only (small phones), and it never engages
  // when nothing overflows (scrollTop stays 0). The pinned control header + footer
  // stay put so back/Next are always reachable.
  const [chromeHidden, setChromeHidden] = useState(false)

  // M3: reset the scroll position when the question advances, so a previous
  // question's scroll offset doesn't carry over and hide the new question's top
  // (the small-phone failure mode). Keyed on the progress counter every game
  // already passes; games without `progress` are single-screen and unaffected.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
    setChromeHidden(false)
  }, [progress?.current])

  useEffect(() => {
    const el = mainRef.current
    if (!el || !compact || !fitViewport) {
      setChromeHidden(false)
      return
    }
    // Collapsing the chrome grows <main>, which re-clamps scrollTop toward 0 and
    // would instantly fire a "scroll up → un-hide" event (a flicker). Ignore
    // scroll events for the transition window right after a toggle so only a real
    // user scroll flips the state.
    let muteUntil = 0
    const onScroll = () => {
      if (performance.now() < muteUntil) return
      const y = el.scrollTop
      // Hysteresis so a hovering scroll position doesn't flicker the chrome.
      if (y > 28) {
        // Only collapse if doing so leaves real scroll room — otherwise hiding
        // the chrome makes the content fit exactly, killing the scroll the child
        // would need to bring the chrome back (it'd stay stuck hidden). When the
        // overflow is smaller than the chrome, just let the few px scroll.
        const chromeH = chromeRef.current?.offsetHeight ?? 0
        const overflow = el.scrollHeight - el.clientHeight
        if (overflow <= chromeH + 16) return
        setChromeHidden((prev) => {
          if (!prev) muteUntil = performance.now() + 260
          return true
        })
      } else if (y < 6) {
        setChromeHidden((prev) => {
          if (prev) muteUntil = performance.now() + 260
          return false
        })
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [compact, fitViewport])

  return (
    <div
      data-theme="dark"
      data-testid="game-screen-shell"
      data-fit-viewport={fitViewport ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
      className={cn('flex flex-col', fitViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}
      style={{ backgroundImage: 'var(--gradient-app)' }}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6',
          compact ? 'gap-1.5 pt-2' : 'gap-3 pt-4',
          fitViewport ? 'min-h-0 pb-3' : 'pb-6',
        )}
      >
        <GameHeader {...header} compact={compact} />
        {/* Collapsible decorative chrome (title + progress) — slides away on
            scroll-down in compact portrait (M3-c). max-h gives the transition a
            target; overflow-hidden clips it while collapsing. */}
        <div
          ref={chromeRef}
          data-testid="game-chrome"
          data-chrome-hidden={chromeHidden ? 'true' : 'false'}
          className={cn(
            'flex flex-col',
            compact ? 'gap-1.5' : 'gap-3',
            // Collapse-on-scroll only on small phones; desktop/tablet keep the
            // full hero with no height clamp.
            compact && 'overflow-hidden transition-all duration-200 ease-out',
            compact && (chromeHidden ? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-40 opacity-100'),
          )}
        >
          <GameHero
            title={header.title}
            subtitle={header.subtitle}
            icon={header.icon}
            aside={header.heroAside}
            compact={compact}
          />
          {progress ? <QuestionProgress {...progress} compact={compact} /> : null}
        </div>
        <main
          ref={mainRef}
          className={cn(
            'flex flex-1 flex-col',
            fitViewport && 'min-h-0 overflow-y-auto',
            // Two-pane in short landscape (CSS in globals.css) when a prompt
            // slot is given; portrait/no-prompt stays the single column. gap-4
            // only in the prompt path so non-migrated games are untouched.
            prompt && 'gap-4 game-twopane',
            className,
          )}
        >
          {prompt ? (
            <>
              <div className="game-twopane-prompt flex flex-col items-center">{prompt}</div>
              <div className="game-twopane-interaction flex flex-1 flex-col">{children}</div>
            </>
          ) : (
            children
          )}
        </main>
        {footer ? <div className={cn(fitViewport && 'shrink-0', compact ? 'pt-1' : 'pt-2')}>{footer}</div> : null}
      </div>
    </div>
  )
}
