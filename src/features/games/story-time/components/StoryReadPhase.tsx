import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Pause, Play, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { cancelSpeech, speak, speakHebrew, speakWord } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'
import { useTextPrefs } from '@/bridge/textPrefs'
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
  const nk = useNikud()
  const { caseMode } = useTextPrefs()
  // Display-only case transform for the English sentences. NEVER feed the cased
  // string to TTS — uppercase words get spelled out letter-by-letter (see
  // feedback_tts_uppercase_spells_letters); audio always uses the originals.
  const applyCase = useCallback(
    (s: string) => (caseMode === 'lowercase' ? s.toLowerCase() : s.toUpperCase()),
    [caseMode],
  )
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)
  const [pulseKey, setPulseKey] = useState<string | null>(null)
  const [playingSentence, setPlayingSentence] = useState<number | null>(null)
  const [narrating, setNarrating] = useState(false)
  // Bumped to invalidate an in-flight narration loop (toggle off, single-tap, unmount).
  const narrateGenRef = useRef(0)

  // Stop any running narration when the read phase unmounts.
  useEffect(() => () => { narrateGenRef.current++ }, [])

  const stopNarration = useCallback(() => {
    narrateGenRef.current++
    cancelSpeech()
    setNarrating(false)
  }, [])

  /** Read the whole story aloud, sentence by sentence, highlighting each. */
  const playWholeStory = useCallback(() => {
    if (narrating) {
      stopNarration()
      setPlayingSentence(null)
      return
    }
    const gen = ++narrateGenRef.current
    cancelSpeech()
    setNarrating(true)
    void (async () => {
      try {
        for (let i = 0; i < story.sentences.length; i++) {
          if (gen !== narrateGenRef.current) return
          setPlayingSentence(i)
          await speak(story.sentences[i])
          if (gen !== narrateGenRef.current) return
          await new Promise((r) => window.setTimeout(r, 250))
        }
      } catch {
        /* ignore */
      } finally {
        if (gen === narrateGenRef.current) {
          setNarrating(false)
          setPlayingSentence(null)
        }
      }
    })()
  }, [narrating, stopNarration, story.sentences])

  const highlightMap = useMemo(() => {
    const m = new Map<string, StoryHighlight>()
    for (const h of story.highlights) m.set(h.word.toLowerCase(), h)
    return m
  }, [story])

  const tappedKeyRef = useMemo(() => ({ current: '' as string }), [story.id])

  const onHighlightTap = useCallback(
    (h: StoryHighlight, sentenceIdx: number, tokenIdx: number) => {
      stopNarration()
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
      }, 2600)
      // Play the English word, then the Hebrew translation (E4, bug-dump 2026-06-07).
      void (async () => {
        try {
          await speakWord(h.word.toLowerCase(), 'story-time')
          await speakHebrew(h.translation)
        } catch {
          /* ignore */
        }
      })()
    },
    [stopNarration, tappedKeyRef],
  )

  const onSpeakSentence = useCallback(
    (sentence: string, idx: number) => {
      stopNarration()
      setPlayingSentence(idx)
      window.setTimeout(() => {
        setPlayingSentence((current) => (current === idx ? null : current))
      }, 1000)
      void speak(sentence).catch(() => {})
    },
    [stopNarration],
  )

  return (
    <section
      data-testid="story-time-read"
      className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 backdrop-blur sm:p-6"
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <h2
          dir="rtl"
          data-testid="story-time-title"
          className="flex items-center gap-3 text-4xl font-bold text-white sm:text-5xl"
        >
          <BookOpen className="size-9 text-[color:var(--blue-400)]" aria-hidden />
          {story.title}
        </h2>
        <p dir="rtl" className="text-lg text-[color:var(--slate-300)] sm:text-xl">
          {nk('סיפור')} {storyNumber} {nk('מתוך')} {storyCount}
        </p>

        <button
          type="button"
          onClick={playWholeStory}
          data-testid="story-time-play-all"
          aria-pressed={narrating}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-bold shadow-md transition',
            narrating
              ? 'bg-[color:var(--amber-400)] text-[color:var(--ink-950)] hover:brightness-110'
              : 'bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] hover:brightness-110',
          )}
        >
          {narrating ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          <span dir="rtl">{nk(narrating ? 'עצור' : 'הקרא את כל הסיפור')}</span>
        </button>

        <p
          dir="rtl"
          data-testid="story-time-hint"
          className="text-base text-[color:var(--amber-400)] sm:text-lg"
        >
          👆 {nk('לחץ על מילים מודגשות כדי לשמוע אותן')}
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
              data-active={playingSentence === sIdx ? 'true' : 'false'}
              className={cn(
                '-mx-2 flex flex-wrap items-baseline gap-x-1 rounded-lg px-2 py-1.5 transition-colors',
                playingSentence === sIdx &&
                  'bg-[color:var(--amber-400)]/20 ring-1 ring-[color:var(--amber-400)]/40',
              )}
            >
              <button
                type="button"
                onClick={() => onSpeakSentence(sentence, sIdx)}
                data-testid="story-sentence-play"
                data-sentence-idx={sIdx}
                aria-label="השמע משפט"
                className="me-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] shadow-sm transition hover:brightness-110"
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
                          'inline-flex cursor-pointer items-center gap-1 rounded-full bg-[color:var(--blue-400)]/25 px-2 py-0.5 align-middle font-semibold text-[color:var(--blue-100)] shadow-sm ring-1 ring-[color:var(--blue-400)]/40 transition hover:bg-[color:var(--blue-400)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]/70',
                          isPulsing && 'scale-110 bg-[color:var(--mint-400)]/50 text-white ring-[color:var(--mint-400)]/60',
                        )}
                      >
                        <Volume2 className="size-3 shrink-0 opacity-80" aria-hidden />
                        {applyCase(token)}
                      </button>
                      {showTooltip ? (
                        <span
                          dir="rtl"
                          data-testid="story-word-tooltip"
                          className="absolute start-1/2 top-full z-10 mt-1 -translate-x-1/2 rounded-md bg-[color:var(--ink-950)] px-2 py-1 text-xs font-semibold text-white shadow-md"
                        >
                          {nk(h.translation)}
                        </span>
                      ) : null}
                    </span>
                  )
                }
                return <span key={tIdx}>{applyCase(token)}</span>
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
          ✅ {nk('מוכן לשאלות')}
        </button>
      </div>
    </section>
  )
}
