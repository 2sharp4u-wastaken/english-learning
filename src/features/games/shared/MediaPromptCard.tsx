import type { ReactNode } from 'react'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MediaPromptCardProps {
  /** English word or phrase to display (omit for audio-only listening) */
  word?: string
  /** Hebrew translation (optional — vocab game hides this) */
  translation?: string
  /** Custom media slot — image, picture, or anything else */
  media?: ReactNode
  /** Top-line instruction (e.g. "האזן ובחר את התמונה") */
  prompt?: string
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
          className="text-sm font-medium text-[color:var(--slate-300)]"
        >
          {prompt}
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
          className="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl"
        >
          {word}
        </h2>
      ) : null}

      {translation ? (
        <p
          data-testid="media-prompt-translation"
          className="text-base text-[color:var(--slate-200)]"
        >
          {translation}
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
            {audioIconOnly ? null : audioLabel}
          </button>
          {audioHint ? (
            <span
              data-testid="media-prompt-audio-hint"
              className="text-xs text-[color:var(--amber-400)]"
            >
              {audioHint}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
