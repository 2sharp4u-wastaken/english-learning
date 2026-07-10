import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { speakHebrew, speakWord } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'
import type { NewWord, GlossWord } from '@/bridge/newWords'

/**
 * A single tappable word (bug-dump 2026-06-07 E8; #60). Tap → Hebrew tooltip +
 * plays the English word then its Hebrew translation. Self-contained (owns its
 * tooltip timer) so it can drop into any sentence fragment. Two looks:
 *  - `variant='pill'` — the prominent blue speaker-pill for NEW (unlearned) words.
 *  - `variant='quiet'` — a subtle dotted-underline word for everything else that's
 *    still glossable (#60 Tier B: learned words / words past the inline pill cap),
 *    so the "these are NEW words" signal isn't drowned out.
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
  /** Visual tier — 'pill' (new word) or 'quiet' (tap-to-hear). Default 'pill'. */
  variant?: 'pill' | 'quiet'
}

export function NewWordPill({ display, word, hebrew, gameContext = 'grammar', variant = 'pill' }: NewWordPillProps) {
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

  const quiet = variant === 'quiet'

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={onTap}
        data-testid={quiet ? 'quiet-word' : 'new-word-pill'}
        data-word={word}
        className={
          quiet
            ? 'cursor-pointer rounded px-0.5 align-baseline font-medium text-inherit underline decoration-dotted decoration-[color:var(--blue-400)]/50 underline-offset-2 transition hover:bg-[color:var(--blue-400)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/60'
            : 'inline-flex cursor-pointer items-center gap-1 rounded-full bg-[color:var(--blue-400)]/25 px-2 py-0.5 align-middle font-semibold text-[color:var(--blue-100)] shadow-sm ring-1 ring-[color:var(--blue-400)]/40 transition hover:bg-[color:var(--blue-400)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/70'
        }
      >
        {!quiet && <Volume2 className="size-3 shrink-0 opacity-80" aria-hidden />}
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
 *
 * #60 two-tier: a matched word renders as a prominent `pill` when it's `isNew` AND
 * within `maxPills` (the inline highlight budget); every other match — learned
 * words, or new words past the budget — renders as a `quiet` tap-to-hear word so
 * the "new" signal stays legible. A plain `NewWord` map (no `isNew`) is treated as
 * all-new (backward compatible).
 */
export function SentenceText({
  text,
  newWords,
  renderWord,
  gameContext,
  maxPills = Infinity,
}: {
  text: string
  newWords: Map<string, NewWord | GlossWord>
  renderWord: (s: string) => string
  gameContext?: string
  /** Max prominent pills before new words fall back to the quiet look. */
  maxPills?: number
}) {
  if (!text) return null
  const tokens = text.split(/(\s+)/)
  let pillsUsed = 0
  return (
    <>
      {tokens.map((tok, i) => {
        const clean = tok.replace(PUNCT_EDGE, '').toLowerCase()
        const nw = clean ? newWords.get(clean) : undefined
        if (nw) {
          const isNew = 'isNew' in nw ? nw.isNew : true
          const asPill = isNew && pillsUsed < maxPills
          if (asPill) pillsUsed++
          return (
            <NewWordPill
              key={i}
              display={renderWord(tok)}
              word={nw.word}
              hebrew={nw.hebrew}
              gameContext={gameContext}
              variant={asPill ? 'pill' : 'quiet'}
            />
          )
        }
        return <span key={i}>{renderWord(tok)}</span>
      })}
    </>
  )
}
