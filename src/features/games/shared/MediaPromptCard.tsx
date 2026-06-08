import type { ReactNode } from 'react'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

export interface MediaPromptCardProps {
  /** English word or phrase to display (omit for audio-only listening) */
  word?: string
  /** Hebrew translation (optional — vocab game hides this) */
  translation?: string
  /** Custom media slot — image, picture, or anything else */
  media?: ReactNode
  /** Top-line instruction (e.g. "האזן ובחר את התמונה") */
  prompt?: string
  /** Reserve the word's layout box but hide it (visibility:hidden). Lets a game
   *  flash-then-hide the word without the rest of the card shifting (Reading D3). */
  wordHidden?: boolean
  /** When provided, renders the audio play button */
  onPlayAudio?: () => void
  audioPlaying?: boolean
  audioDisabled?: boolean
  /** Hint shown under the audio button (e.g. "השמע עוד 2 פעמים") */
  audioHint?: string
  audioLabel?: string
  /** When true, the audio button is icon-only (matches the legacy speaker button used by Word Journey, Listening, etc.). */
  audioIconOnly?: boolean
  className?: string
}

export function MediaPromptCard({
  word,
  wordHidden = false,
  translation,
  media,
  prompt,
  onPlayAudio,
  audioPlaying = false,
  audioDisabled = false,
  audioHint,
  audioLabel = 'השמע',
  audioIconOnly = false,
  className,
}: MediaPromptCardProps) {
  const nk = useNikud()
  return (
    <section
      data-testid="media-prompt-card"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 text-center backdrop-blur',
        className,
      )}
    >
      {prompt ? (
        <p
          data-testid="media-prompt-text"
          dir="rtl"
          className="text-lg font-medium text-[color:var(--slate-300)] sm:text-xl"
        >
          {nk(prompt)}
        </p>
      ) : null}

      {media ? (
        <div
          data-testid="media-prompt-media"
          className="flex w-full max-w-xs items-center justify-center"
        >
          {media}
        </div>
      ) : null}

      {word ? (
        <h2
          data-testid="media-prompt-word"
          dir="ltr"
          aria-hidden={wordHidden || undefined}
          className={cn(
            'font-display text-3xl font-bold tracking-wide text-white sm:text-4xl',
            wordHidden && 'invisible',
          )}
        >
          {word}
        </h2>
      ) : null}

      {translation ? (
        <p
          data-testid="media-prompt-translation"
          dir="rtl"
          className="text-2xl font-semibold text-[color:var(--slate-100)] sm:text-3xl"
        >
          {nk(translation)}
        </p>
      ) : null}

      {onPlayAudio ? (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onPlayAudio}
            disabled={audioDisabled}
            data-testid="media-prompt-audio"
            data-playing={audioPlaying ? 'true' : 'false'}
            aria-label={audioLabel}
            className={cn(
              'flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110',
              audioIconOnly ? 'size-12 p-0' : 'px-5 py-2.5 text-sm',
              'disabled:cursor-not-allowed disabled:opacity-60',
              audioPlaying && 'animate-pulse',
            )}
          >
            <Volume2 className={audioIconOnly ? 'size-5' : 'size-4'} aria-hidden />
            {audioIconOnly ? null : nk(audioLabel)}
          </button>
          {audioHint ? (
            <span
              data-testid="media-prompt-audio-hint"
              dir="rtl"
              className="text-sm font-medium text-[color:var(--amber-400)] sm:text-base"
            >
              {nk(audioHint)}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
