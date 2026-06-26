import { useEffect, useRef, useState } from 'react'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'
import {
  celebrationLevelForPct,
  getShowConfetti,
  playCelebration,
  triggerCelebration,
} from '@/bridge/feedback'
import type { WJStatus, WJSummaryEntry } from '@/bridge/word-journey'

const STEP_MS = 950

const STATUS_META: Record<WJStatus, { label: string; cls: string }> = {
  learned: { label: '✓ נלמד', cls: 'text-[color:var(--mint-400)]' },
  learning: { label: '⏳ לומד', cls: 'text-[color:var(--amber-400)]' },
  new: { label: '✨ חדש', cls: 'text-[color:var(--slate-300)]' },
}

interface Props {
  summary: WJSummaryEntry[]
  onPlayAgain: () => void
  onHome: () => void
}

/** Animated end-of-journey recap: each word card animates in with its picture
 *  and is spoken aloud, tagged with the word's new status. */
export function WJCelebration({ summary, onPlayAgain, onHome }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [revealed, setRevealed] = useState(0)

  // Clapping fanfare + confetti, scaled by how much of the journey was learned —
  // Word Journey's score screen is custom (not the shared RewardModal), so it gets
  // the same celebration here. The ref guards React StrictMode's dev double-mount
  // (this screen mounts on completion rather than via an `open` toggle).
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (celebratedRef.current || summary.length === 0) return
    celebratedRef.current = true
    const learned = summary.filter((s) => s.status === 'learned').length
    const level = celebrationLevelForPct(Math.round((learned / summary.length) * 100))
    playCelebration(level)
    if (getShowConfetti()) triggerCelebration(level)
  }, [summary])

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
        <h2 className="mt-2 font-display text-2xl font-extrabold text-white">{nk('מסע הושלם!')}</h2>
        <p className="mt-1 text-sm text-[color:var(--slate-300)]">
          {nk(`תרגלת ${summary.length} מילים${learnedCount > 0 ? ` · ${learnedCount} נלמדו` : ''}`)}
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
              <span className={cn('whitespace-nowrap text-sm font-bold', meta.cls)}>{nk(meta.label)}</span>
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
          ← {nk('התחילו מסע מילים נוסף')}
        </button>
        <button
          type="button"
          onClick={onHome}
          data-testid="wj-home"
          className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-bold text-white transition hover:bg-white/10"
        >
          🏠 {nk('חזרה הביתה')}
        </button>
      </div>
    </div>
  )
}
