import { useCallback, useEffect, useRef, useState } from 'react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { SpellingComparison } from '@/features/games/shared/SpellingComparison'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speak, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'
import { POINTS, type WJSpellItem, type WJWord } from '@/bridge/word-journey'

const WORD_REVEAL_MS = 2500
const CORRECT_ADVANCE_MS = 2400

interface Token {
  key: string
  letter: string
  used: boolean
}

interface Props {
  items: WJSpellItem[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 3 — build the word from letter tiles (reading-game shape): voice the
 *  word on a correct answer, show the letter-by-letter comparison on a wrong one. */
export function SpellStage({ items, onAnswer, onComplete }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const [index, setIndex] = useState(0)
  const [bank, setBank] = useState<Token[]>([])
  const [built, setBuilt] = useState<Token[]>([])
  const [phase, setPhase] = useState<'building' | 'correct' | 'wrong'>('building')
  const [wordVisible, setWordVisible] = useState(true)
  const [feedback, setFeedback] = useState<{ variant: 'correct' | 'incorrect'; text: string } | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)

  const item = items[index]

  useEffect(() => {
    setBank(item.tiles.map((letter, i) => ({ key: `${i}-${letter}`, letter, used: false })))
    setBuilt([])
    setPhase('building')
    setFeedback(null)
    setWordVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setWordVisible(false), WORD_REVEAL_MS)
    void speakWord(item.word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
    return () => {
      cancelSpeech()
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [item])

  const renderLetter = (l: string) => (caseMode === 'lowercase' ? l.toLowerCase() : l.toUpperCase())

  const pick = (key: string) => {
    if (phase !== 'building') return
    const t = bank.find((b) => b.key === key && !b.used)
    if (!t) return
    setBank((b) => b.map((x) => (x.key === key ? { ...x, used: true } : x)))
    setBuilt((b) => [...b, { ...t, used: true }])
    void speak(t.letter.toLowerCase())
  }

  const removeBuilt = (key: string) => {
    if (phase !== 'building') return
    setBuilt((b) => b.filter((x) => x.key !== key))
    setBank((b) => b.map((x) => (x.key === key ? { ...x, used: false } : x)))
  }

  const clear = () => {
    if (phase !== 'building') return
    setBuilt([])
    setBank((b) => b.map((x) => ({ ...x, used: false })))
  }

  const advance = useCallback(() => {
    if (index + 1 < items.length) setIndex((i) => i + 1)
    else onComplete()
  }, [index, items.length, onComplete])

  const check = () => {
    if (phase !== 'building' || built.length === 0) return
    const builtWord = built.map((t) => t.letter).join('').toLowerCase()
    const isCorrect = builtWord === item.word.word.toLowerCase()
    const fb = getGameFeedback('word-journey', isCorrect ? 'correct' : 'incorrect')
    setFeedback({ variant: isCorrect ? 'correct' : 'incorrect', text: fb.text })
    onAnswer(item.word, isCorrect, isCorrect ? POINTS.spell : 0)
    if (isCorrect) {
      setPhase('correct')
      if (getShowConfetti()) triggerConfetti()
      void (async () => {
        try {
          if (fb.audio) await speak(fb.audio)
          await speakWord(item.word.word.toLowerCase(), 'word-journey')
        } catch {
          /* ignore */
        }
      })()
      advanceTimer.current = window.setTimeout(advance, CORRECT_ADVANCE_MS)
    } else {
      setPhase('wrong')
      void speakWord(item.word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
    }
  }

  const hebrew = showNikud ? item.word.hebrew : stripNikud(item.word.hebrew)
  const displayWord = caseMode === 'lowercase' ? item.word.word.toLowerCase() : item.word.word.toUpperCase()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p dir="rtl" className="text-center text-sm font-medium text-[color:var(--slate-300)]">
        פריט {index + 1} מתוך {items.length}
      </p>
      <MediaPromptCard
        prompt={showNikud ? 'הַרְכִּיבוּ אֶת הַמִּלָּה' : 'הרכיבו את המילה'}
        media={<WordJourneyPicture word={item.word} />}
        word={wordVisible ? displayWord : undefined}
        translation={hebrew || undefined}
        onPlayAudio={() => void speakWord(item.word.word.toLowerCase(), 'word-journey')}
        audioLabel="השמע מילה"
        audioIconOnly
      />

      {phase === 'wrong' ? (
        <SpellingComparison
          target={item.word.word}
          attempt={built.map((t) => t.letter).join('')}
          caseMode={caseMode}
          showNikud={showNikud}
        />
      ) : (
        <div
          data-testid="wj-spell-built"
          dir="ltr"
          className={cn(
            'mx-auto flex min-h-[3.5rem] min-w-[8rem] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 px-4 py-2 text-3xl font-bold tracking-wide text-white backdrop-blur',
            phase === 'correct' && 'border-[color:var(--mint-400)] text-[color:var(--mint-400)]',
          )}
        >
          {built.length === 0 ? (
            <span dir="rtl" className="text-lg font-normal text-[color:var(--slate-300)]">
              בחרו אותיות...
            </span>
          ) : (
            built.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => removeBuilt(t.key)}
                disabled={phase !== 'building'}
                className="inline-flex items-center justify-center rounded-md px-1 transition hover:bg-white/10 disabled:cursor-not-allowed"
              >
                {renderLetter(t.letter)}
              </button>
            ))
          )}
        </div>
      )}

      {phase === 'building' ? (
        <>
          <div dir="ltr" className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2">
            {bank.map((t) => (
              <button
                key={t.key}
                type="button"
                data-testid="wj-spell-letter"
                onClick={() => pick(t.key)}
                disabled={t.used}
                className="inline-flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 sm:size-14 sm:text-3xl"
              >
                {renderLetter(t.letter)}
              </button>
            ))}
          </div>
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={clear}
              disabled={built.length === 0}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              נקה
            </button>
            <button
              type="button"
              onClick={check}
              disabled={built.length === 0}
              data-testid="wj-spell-check"
              className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              בדוק
            </button>
          </div>
        </>
      ) : phase === 'wrong' ? (
        <button
          type="button"
          onClick={advance}
          data-testid="wj-spell-next"
          className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          הבא
        </button>
      ) : null}

      {feedback ? <FeedbackBanner variant={feedback.variant} message={feedback.text} visible /> : null}
    </div>
  )
}
