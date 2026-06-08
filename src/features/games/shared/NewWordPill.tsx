import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { speakHebrew, speakWord } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'
import type { NewWord } from '@/bridge/newWords'

/**
 * A single tappable "new word" pill (bug-dump 2026-06-07 E8) — the same blue
 * speaker-pill look Story Time uses (E4/E6). Tap → Hebrew tooltip + plays the
 * English word then its Hebrew translation. Self-contained (owns its tooltip
 * timer) so it can drop into any sentence fragment.
 */
export interface NewWordPillProps {
  /** Already case-transformed display text (may carry trailing punctuation). */
  display: string
  /** English word, lowercased before TTS. */
  word: string
  /** Hebrew translation (raw — nk()'d here). */
  hebrew: string
  /** Audio game-context tag (for budget/voice selection). */
  gameContext?: string
}

export function NewWordPill({ display, word, hebrew, gameContext = 'grammar' }: NewWordPillProps) {
  const nk = useNikud()
  const [show, setShow] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const onTap = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setShow(true)
    timerRef.current = window.setTimeout(() => setShow(false), 2600)
    void (async () => {
      try {
        await speakWord(word.toLowerCase(), gameContext)
        await speakHebrew(hebrew)
      } catch {
        /* ignore */
      }
    })()
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={onTap}
        data-testid="new-word-pill"
        data-word={word}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[color:var(--blue-400)]/25 px-2 py-0.5 align-middle font-semibold text-[color:var(--blue-100)] shadow-sm ring-1 ring-[color:var(--blue-400)]/40 transition hover:bg-[color:var(--blue-400)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/70"
      >
        <Volume2 className="size-3 shrink-0 opacity-80" aria-hidden />
        {display}
      </button>
      {show ? (
        <span
          dir="rtl"
          data-testid="new-word-tooltip"
          className="absolute start-1/2 top-full z-10 mt-1 -translate-x-1/2 rounded-md bg-[color:var(--ink-950)] px-2 py-1 text-xs font-semibold text-white shadow-md"
        >
          {nk(hebrew)}
        </span>
      ) : null}
    </span>
  )
}

const PUNCT_EDGE = /^[.,!?;:'"()]+|[.,!?;:'"()]+$/g

/**
 * Render a sentence fragment, turning any token that matches `newWords` (keyed by
 * lowercased word) into a {@link NewWordPill} and leaving the rest as plain text.
 * `renderWord` applies the case toggle (callers pass their own).
 */
export function SentenceText({
  text,
  newWords,
  renderWord,
  gameContext,
}: {
  text: string
  newWords: Map<string, NewWord>
  renderWord: (s: string) => string
  gameContext?: string
}) {
  if (!text) return null
  const tokens = text.split(/(\s+)/)
  return (
    <>
      {tokens.map((tok, i) => {
        const clean = tok.replace(PUNCT_EDGE, '').toLowerCase()
        const nw = clean ? newWords.get(clean) : undefined
        if (nw) {
          return (
            <NewWordPill
              key={i}
              display={renderWord(tok)}
              word={nw.word}
              hebrew={nw.hebrew}
              gameContext={gameContext}
            />
          )
        }
        return <span key={i}>{renderWord(tok)}</span>
      })}
    </>
  )
}
