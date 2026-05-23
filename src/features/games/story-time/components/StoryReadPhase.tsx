import { useCallback, useMemo, useState } from 'react'
import { BookOpen, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { speak, speakWord } from '@/bridge/audio'
import type { Story, StoryHighlight } from '@/bridge/story-time'

export interface StoryReadPhaseProps {
  story: Story
  storyNumber: number
  storyCount: number
  onReady: () => void
}

interface ActiveTooltip {
  sentenceIdx: number
  tokenIdx: number
  translation: string
}

const PUNCT_TAIL = /[.,!?;:'"]+$/

export function StoryReadPhase({
  story,
  storyNumber,
  storyCount,
  onReady,
}: StoryReadPhaseProps) {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)
  const [pulseKey, setPulseKey] = useState<string | null>(null)
  const [playingSentence, setPlayingSentence] = useState<number | null>(null)

  const highlightMap = useMemo(() => {
    const m = new Map<string, StoryHighlight>()
    for (const h of story.highlights) m.set(h.word.toLowerCase(), h)
    return m
  }, [story])

  const tappedKeyRef = useMemo(() => ({ current: '' as string }), [story.id])

  const onHighlightTap = useCallback(
    (h: StoryHighlight, sentenceIdx: number, tokenIdx: number) => {
      const key = `${sentenceIdx}:${tokenIdx}`
      tappedKeyRef.current = key
      setPulseKey(key)
      window.setTimeout(() => {
        setPulseKey((current) => (current === key ? null : current))
      }, 600)
      setActiveTooltip({ sentenceIdx, tokenIdx, translation: h.translation })
      window.setTimeout(() => {
        setActiveTooltip((t) =>
          t && t.sentenceIdx === sentenceIdx && t.tokenIdx === tokenIdx ? null : t,
        )
      }, 1500)
      void speakWord(h.word.toLowerCase(), 'story-time').catch(() => {})
    },
    [tappedKeyRef],
  )

  const onSpeakSentence = useCallback((sentence: string, idx: number) => {
    setPlayingSentence(idx)
    window.setTimeout(() => {
      setPlayingSentence((current) => (current === idx ? null : current))
    }, 1000)
    void speak(sentence).catch(() => {})
  }, [])

  return (
    <section
      data-testid="story-time-read"
      className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 backdrop-blur sm:p-6"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <h2
          dir="rtl"
          data-testid="story-time-title"
          className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl"
        >
          <BookOpen className="size-6 text-[color:var(--blue-400)]" aria-hidden />
          {story.title}
        </h2>
        <p dir="rtl" className="text-sm text-[color:var(--slate-300)]">
          סיפור {storyNumber} מתוך {storyCount}
        </p>
        <p
          dir="rtl"
          data-testid="story-time-hint"
          className="text-sm text-[color:var(--amber-400)] sm:text-base"
        >
          👆 לחץ על מילים מודגשות כדי לשמוע אותן
        </p>
      </header>

      <div
        data-testid="story-time-text"
        dir="ltr"
        className="flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 text-lg leading-relaxed text-white sm:text-xl"
      >
        {story.sentences.map((sentence, sIdx) => {
          const tokens = sentence.split(/(\s+)/)
          return (
            <p
              key={sIdx}
              data-testid="story-sentence"
              className="flex flex-wrap items-baseline gap-x-1"
            >
              <button
                type="button"
                onClick={() => onSpeakSentence(sentence, sIdx)}
                data-testid="story-sentence-play"
                data-sentence-idx={sIdx}
                aria-label="השמע משפט"
                className={cn(
                  'me-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] shadow-sm transition hover:brightness-110',
                  playingSentence === sIdx && 'animate-pulse',
                )}
              >
                <Volume2 className="size-4" aria-hidden />
              </button>
              {tokens.map((token, tIdx) => {
                const cleanToken = token.replace(PUNCT_TAIL, '').toLowerCase()
                const h = highlightMap.get(cleanToken)
                if (h) {
                  const key = `${sIdx}:${tIdx}`
                  const isPulsing = pulseKey === key
                  const showTooltip =
                    activeTooltip?.sentenceIdx === sIdx && activeTooltip?.tokenIdx === tIdx
                  return (
                    <span key={tIdx} className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => onHighlightTap(h, sIdx, tIdx)}
                        data-testid="story-highlight"
                        data-word={h.word}
                        className={cn(
                          'cursor-pointer rounded-md bg-[color:var(--blue-400)]/20 px-1 font-semibold text-[color:var(--blue-200)] underline decoration-[color:var(--blue-400)]/60 decoration-2 underline-offset-2 transition hover:bg-[color:var(--blue-400)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/60',
                          isPulsing && 'scale-110 bg-[color:var(--mint-400)]/40 text-white',
                        )}
                      >
                        {token}
                      </button>
                      {showTooltip ? (
                        <span
                          dir="rtl"
                          data-testid="story-word-tooltip"
                          className="absolute start-1/2 top-full z-10 mt-1 -translate-x-1/2 rounded-md bg-[color:var(--ink-950)] px-2 py-1 text-xs font-semibold text-white shadow-md"
                        >
                          {h.translation}
                        </span>
                      ) : null}
                    </span>
                  )
                }
                return <span key={tIdx}>{token}</span>
              })}
            </p>
          )
        })}
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReady}
          data-testid="story-time-ready"
          className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          ✅ מוכן לשאלות
        </button>
      </div>
    </section>
  )
}
