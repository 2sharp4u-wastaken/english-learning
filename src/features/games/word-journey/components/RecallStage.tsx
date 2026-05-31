import { useEffect, useRef, useState } from 'react'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { getShowConfetti, playAnswerSfx, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'
import { POINTS, type WJWord } from '@/bridge/word-journey'

interface Card {
  id: string
  type: 'word' | 'translation'
  wordKey: string
  word: WJWord
}

function buildCards(words: WJWord[]): Card[] {
  const cards: Card[] = []
  words.forEach((w, i) => {
    const wordKey = `${w.word}_${w.category}_${i}`
    cards.push({ id: `w-${i}`, type: 'word', wordKey, word: w })
    cards.push({ id: `t-${i}`, type: 'translation', wordKey, word: w })
  })
  return cards.sort(() => Math.random() - 0.5)
}

interface Props {
  words: WJWord[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 5 — match each word card with its translation card (memory-game shape). */
export function RecallStage({ words, onAnswer, onComplete }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const [cards] = useState<Card[]>(() => buildCards(words))
  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const lockRef = useRef(false)
  const boardLockUntil = useRef(Date.now() + 400)
  const completeTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      cancelSpeech()
      if (completeTimer.current) window.clearTimeout(completeTimer.current)
    }
  }, [])

  const totalPairs = words.length
  const matchedPairs = matched.size / 2

  const onCard = (card: Card) => {
    if (Date.now() < boardLockUntil.current) return
    if (matched.has(card.id)) {
      void speakWord(card.word.word.toLowerCase(), 'word-journey')
      return
    }
    if (lockRef.current || flipped.includes(card.id) || flipped.length >= 2) return

    void speakWord(card.word.word.toLowerCase(), 'word-journey')
    const next = [...flipped, card.id]
    setFlipped(next)

    if (next.length === 2) {
      lockRef.current = true
      setMoves((m) => m + 1)
      const [a, b] = next.map((id) => cards.find((c) => c.id === id)!)
      const isMatch = a.wordKey === b.wordKey && a.type !== b.type
      window.setTimeout(() => {
        if (isMatch) {
          setMatched((prev) => {
            const s = new Set(prev)
            s.add(a.id)
            s.add(b.id)
            if (s.size / 2 >= totalPairs) {
              completeTimer.current = window.setTimeout(onComplete, 1200)
            }
            return s
          })
          onAnswer(a.word, true, POINTS.recallPair)
          // RecallStage never goes through getGameFeedback (no banner — cards just
          // settle), so the success WAV won't fire on its own. Play it explicitly
          // to match the feedback_play_answer_sfx invariant.
          playAnswerSfx('correct')
          if (getShowConfetti()) triggerConfetti()
        }
        setFlipped([])
        lockRef.current = false
      }, isMatch ? 500 : 800)
    }
  }

  const cols = cards.length <= 8 ? 4 : 4

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div
        dir="rtl"
        className="flex items-center justify-center gap-3 text-sm font-medium text-[color:var(--slate-300)]"
      >
        <span>מהלכים: {moves}</span>
        <span className="opacity-40">|</span>
        <span>
          זוגות: {matchedPairs} מתוך {totalPairs}
        </span>
      </div>
      <div
        data-testid="wj-recall-grid"
        className="mx-auto grid w-full max-w-md gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const isUp = flipped.includes(card.id) || matched.has(card.id)
          const isMatched = matched.has(card.id)
          const label =
            card.type === 'word'
              ? caseMode === 'lowercase'
                ? card.word.word.toLowerCase()
                : card.word.word.toUpperCase()
              : showNikud
                ? card.word.hebrew
                : stripNikud(card.word.hebrew)
          return (
            <div
              key={card.id}
              data-testid="wj-recall-card"
              data-up={isUp ? 'true' : 'false'}
              onClick={() => onCard(card)}
              className="aspect-square cursor-pointer [perspective:800px]"
            >
              {/* 3D flip container — legacy memory-card-inner rotateY (styles.css:5820). */}
              <div
                className="relative size-full transition-transform duration-500 [transform-style:preserve-3d]"
                style={{ transform: isUp ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                {/* Back (shown face-down) */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-white/70 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-2xl text-white/90 shadow-md [backface-visibility:hidden]"
                >
                  ?
                </div>
                {/* Front (revealed when flipped) */}
                <div
                  className={cn(
                    'absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-1 text-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]',
                    isMatched
                      ? 'border-[color:var(--mint-400)] bg-gradient-to-br from-[#11998e] to-[#38ef7d]'
                      : 'border-white/80 bg-gradient-to-br from-[#f093fb] to-[#f5576c]',
                  )}
                >
                  <WordJourneyPicture word={card.word} className="max-h-10 object-contain" />
                  <span
                    dir={card.type === 'word' ? 'ltr' : 'rtl'}
                    className="text-xs font-bold text-white sm:text-sm"
                  >
                    {label}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
