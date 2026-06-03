import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, triggerConfetti } from '@/bridge/feedback'
import { useNikud } from '@/bridge/nikud'
import { POINTS, type WJListenMatchItem, type WJWord } from '@/bridge/word-journey'

const ADVANCE_MS = 1300
const MAX_PLAYS = 3

interface Props {
  items: WJListenMatchItem[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 2 — hear the word, pick its picture (listening-game shape). */
export function ListenMatchStage({ items, onAnswer, onComplete }: Props) {
  const nk = useNikud()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [playsLeft, setPlaysLeft] = useState(MAX_PLAYS)
  const [feedback, setFeedback] = useState<{ variant: 'correct' | 'incorrect'; text: string } | null>(null)
  const timer = useRef<number | null>(null)

  const item = items[index]
  const correctIndex = item.options.findIndex((o) => o.word === item.word.word)

  // Auto-play on each item, then open the option gate.
  useEffect(() => {
    setRevealed(false)
    setSelected(null)
    setGateOpen(false)
    setPlaysLeft(MAX_PLAYS)
    setFeedback(null)
    let cancelled = false
    // Deferred auto-play (StrictMode-safe — see DiscoverStage).
    const playId = window.setTimeout(() => {
      void (async () => {
        try {
          await speakWord(item.word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setGateOpen(true)
          setPlaysLeft((n) => Math.max(0, n - 1))
        }
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(playId)
      cancelSpeech()
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [item])

  const replay = useCallback(() => {
    if (playsLeft <= 0) return
    setPlaysLeft((n) => Math.max(0, n - 1))
    void speakWord(item.word.word.toLowerCase(), 'word-journey')
  }, [item, playsLeft])

  const advance = useCallback(() => {
    if (index + 1 < items.length) setIndex((i) => i + 1)
    else onComplete()
  }, [index, items.length, onComplete])

  const handleSelect = (i: number) => {
    if (revealed || !gateOpen) return
    const isCorrect = i === correctIndex
    setSelected(i)
    setRevealed(true)
    const fb = getGameFeedback('word-journey', isCorrect ? 'correct' : 'incorrect')
    setFeedback({ variant: isCorrect ? 'correct' : 'incorrect', text: fb.text })
    onAnswer(item.word, isCorrect, isCorrect ? POINTS.listenMatch : 0)
    if (isCorrect && getShowConfetti()) triggerConfetti()
    if (isCorrect) {
      timer.current = window.setTimeout(advance, ADVANCE_MS)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p dir="rtl" className="text-center text-sm font-medium text-[color:var(--slate-300)]">
        {nk('פריט')} {index + 1} {nk('מתוך')} {items.length}
      </p>
      <MediaPromptCard
        prompt="הקשיבו ובחרו את התמונה הנכונה"
        onPlayAudio={replay}
        audioDisabled={playsLeft <= 0}
        audioLabel="השמע שוב"
        audioHint={playsLeft > 0 ? `השמעות נותרו: ${playsLeft}` : 'נגמרו ההשמעות'}
        audioIconOnly
      />
      <AnswerGrid
        variant="media"
        columns={item.options.length <= 2 ? 2 : 4}
        hidden={!gateOpen}
        revealed={revealed}
        selectedIndex={selected}
        correctIndex={revealed ? correctIndex : null}
        disabled={revealed}
        onSelect={handleSelect}
        options={item.options.map((o) => ({
          key: `${o.word}_${o.category}`,
          ariaLabel: o.word,
          media: <WordJourneyPicture word={o} className="max-h-20 rounded-xl object-contain" />,
        }))}
      />
      {revealed && feedback?.variant === 'incorrect' ? (
        <button
          type="button"
          onClick={advance}
          data-testid="wj-listen-next"
          className="mx-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          <Volume2 className="size-4" aria-hidden />
          {nk('הבא')}
        </button>
      ) : null}
      {feedback ? (
        <FeedbackBanner variant={feedback.variant} message={feedback.text} visible />
      ) : null}
    </div>
  )
}
