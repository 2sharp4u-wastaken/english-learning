import { useMemo } from 'react'
import { Check, Volume2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { speakHebrew, speakWord } from '@/bridge/audio'

export interface WordTableRow {
  /** English word/phrase (stored case; the component applies the case toggle). */
  word: string
  /** Hebrew translation/gloss (raw — the component wraps it in nk()). */
  hebrew: string
  /** Answer-game marker: 'correct' → green ✓, 'wrong' → red ✗ (the wrong pick).
   *  Omit for a plain list (e.g. Story Time highlights). */
  mark?: 'correct' | 'wrong'
}

export interface WordTableProps {
  rows: WordTableRow[]
  /** Optional heading, wrapped in nk() internally. */
  title?: string
  /** Override the default play (English word, then Hebrew). */
  onPlay?: (row: WordTableRow) => void
  className?: string
}

/**
 * Shared "word → Hebrew → play" review table (bug-dump 2026-06-07 F2/F3, feeds
 * the E7/E8 Grammar redesign). One row per word: Hebrew (right), English
 * (middle, with an optional ✓/✗ mark), a 🔊 play button (left). Owns the case
 * toggle (English only), nikud (Hebrew + title via nk()), de-dupe, and the
 * default English→Hebrew audio. See docs/word-table-spec.md.
 */
export function WordTable({ rows, title, onPlay, className }: WordTableProps) {
  const { caseMode } = useTextPrefs()
  const nk = useNikud()

  const deduped = useMemo(() => {
    const seen = new Set<string>()
    const out: WordTableRow[] = []
    for (const r of rows) {
      const key = r.word.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
    return out
  }, [rows])

  if (deduped.length === 0) return null

  const tx = (s: string) => (caseMode === 'lowercase' ? s.toLowerCase() : s.toUpperCase())

  const play = (row: WordTableRow) => {
    if (onPlay) {
      onPlay(row)
      return
    }
    void (async () => {
      try {
        // Lowercase before TTS — uppercase words get spelled out letter-by-letter.
        await speakWord(row.word.toLowerCase(), 'vocabulary')
        await speakHebrew(row.hebrew)
      } catch {
        /* ignore */
      }
    })()
  }

  return (
    <section
      data-testid="word-table"
      dir="rtl"
      className={cn(
        'mx-auto flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 px-3 backdrop-blur',
        className,
      )}
    >
      {title ? (
        <p className="py-2 text-center text-sm font-medium text-[color:var(--slate-300)]">
          {nk(title)}
        </p>
      ) : null}
      <ul className="divide-y divide-white/5">
        {deduped.map((row) => (
          <li
            key={row.word.toLowerCase()}
            data-testid="word-table-row"
            data-word={row.word}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span dir="rtl" className="text-base font-semibold text-[color:var(--slate-100)]">
              {nk(row.hebrew)}
            </span>

            <span dir="ltr" className="flex items-center gap-1.5">
              {row.mark === 'correct' ? (
                <Check className="size-4 text-[color:var(--mint-400)]" strokeWidth={3} aria-hidden />
              ) : row.mark === 'wrong' ? (
                <X className="size-4 text-rose-400" strokeWidth={3} aria-hidden />
              ) : null}
              <span
                className={cn(
                  'font-display text-base font-bold',
                  row.mark === 'wrong' ? 'text-rose-300' : 'text-white',
                )}
              >
                {tx(row.word)}
              </span>
            </span>

            <button
              type="button"
              onClick={() => play(row)}
              data-testid="word-table-play"
              aria-label={`השמע ${row.word}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] shadow-sm transition hover:brightness-110"
            >
              <Volume2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
