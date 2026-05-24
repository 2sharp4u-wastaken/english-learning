import { useEffect, useState } from 'react'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'
import type { WJStatus, WJSummaryEntry } from '@/bridge/word-journey'

const STEP_MS = 950

const STATUS_META: Record<WJStatus, { label: string; cls: string }> = {
  learned: { label: '✓ נלמד', cls: 'text-[color:var(--mint-400)]' },
  learning: { label: '⏳ לומד', cls: 'text-[color:var(--amber-400)]' },
  new: { label: '✨ חדש', cls: 'text-[color:var(--slate-300)]' },
}

interface Props {
  summary: WJSummaryEntry[]
  hasLearnedWords: boolean
  onPlayAgain: () => void
  onPractice: () => void
  onHome: () => void
}

/** Animated end-of-journey recap: each word card animates in with its picture
 *  and is spoken aloud, tagged with the word's new status. */
export function WJCelebration({ summary, hasLearnedWords, onPlayAgain, onPractice, onHome }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    const timers: number[] = []
    summary.forEach((entry, i) => {
      timers.push(
        window.setTimeout(() => {
          setRevealed(i + 1)
          void speakWord(entry.word.toLowerCase(), 'word-journey', { allowOverlap: true })
        }, i * STEP_MS),
      )
    })
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      cancelSpeech()
    }
  }, [summary])

  const learnedCount = summary.filter((s) => s.status === 'learned').length

  return (
    <div dir="rtl" className="flex flex-1 flex-col items-center gap-5 py-2">
      <div className="text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-white">מסע הושלם!</h2>
        <p className="mt-1 text-sm text-[color:var(--slate-300)]">
          תרגלת {summary.length} מילים{learnedCount > 0 ? ` · ${learnedCount} נלמדו` : ''}
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2">
        {summary.map((entry, i) => {
          const meta = STATUS_META[entry.status]
          const show = i < revealed
          const english =
            caseMode === 'lowercase' ? entry.word.toLowerCase() : entry.word.toUpperCase()
          const hebrew = showNikud ? entry.hebrew : stripNikud(entry.hebrew)
          return (
            <div
              key={`${entry.word}_${entry.category}`}
              data-testid="wj-celebration-word"
              className={cn(
                'flex items-center gap-3 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-3 backdrop-blur transition-all duration-500',
                show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              <span className="flex size-12 items-center justify-center">
                <WordJourneyPicture word={entry} className="max-h-12 object-contain" />
              </span>
              <span dir="ltr" className="flex-1 text-start font-display text-lg font-bold text-white">
                {english}
              </span>
              <span className="text-base text-[color:var(--slate-300)]">{hebrew}</span>
              <span className={cn('whitespace-nowrap text-sm font-bold', meta.cls)}>{meta.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex w-full max-w-md flex-col gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          data-testid="wj-play-again"
          className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          ← התחילו מסע מילים נוסף
        </button>
        {hasLearnedWords ? (
          <button
            type="button"
            onClick={onPractice}
            data-testid="wj-practice"
            className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-bold text-white transition hover:bg-white/10"
          >
            🔁 תרגול מילים שנלמדו
          </button>
        ) : null}
        <button
          type="button"
          onClick={onHome}
          data-testid="wj-home"
          className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-bold text-white transition hover:bg-white/10"
        >
          🏠 חזרה הביתה
        </button>
      </div>
    </div>
  )
}
