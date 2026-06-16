import { useCallback, useEffect, useRef, useState } from 'react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { SpellingComparison } from '@/features/games/shared/SpellingComparison'
import { LetterSlots } from '@/features/games/shared/LetterSlots'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speak, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { POINTS, type WJSpellItem, type WJWord } from '@/bridge/word-journey'

const WORD_REVEAL_MS = 2500
const CORRECT_ADVANCE_MS = 2400

interface Props {
  items: WJSpellItem[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 3 — slot the letters into place (shared LetterSlots, same mechanic as
 *  the Reading game): voice the word on a correct answer, show the letter-by-
 *  letter comparison on a wrong one. */
export function SpellStage({ items, onAnswer, onComplete }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [index, setIndex] = useState(0)
  const [built, setBuilt] = useState('')
  const [clearNonce, setClearNonce] = useState(0)
  const [phase, setPhase] = useState<'building' | 'correct' | 'wrong'>('building')
  const [wordVisible, setWordVisible] = useState(true)
  const [feedback, setFeedback] = useState<{ variant: 'correct' | 'incorrect'; text: string } | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)

  const item = items[index]

  useEffect(() => {
    setBuilt('')
    setClearNonce(0)
    setPhase('building')
    setFeedback(null)
    setWordVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setWordVisible(false), WORD_REVEAL_MS)
    // Deferred auto-play (StrictMode-safe — see DiscoverStage).
    const playId = window.setTimeout(() => {
      void speakWord(item.word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
    }, 200)
    return () => {
      window.clearTimeout(playId)
      cancelSpeech()
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [item])

  const advance = useCallback(() => {
    if (index + 1 < items.length) setIndex((i) => i + 1)
    else onComplete()
  }, [index, items.length, onComplete])

  const check = () => {
    if (phase !== 'building' || built.length === 0) return
    const isCorrect = built.toLowerCase() === item.word.word.toLowerCase()
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
        {nk('פריט')} {index + 1} {nk('מתוך')} {items.length}
      </p>
      <div className="game-twopane flex flex-1 flex-col gap-4">
        <div className="game-twopane-prompt flex flex-col items-center">
          <MediaPromptCard
            prompt={showNikud ? 'הַרְכִּיבוּ אֶת הַמִּלָּה' : 'הרכיבו את המילה'}
            media={<WordJourneyPicture word={item.word} />}
            // Keep the word in the layout and just hide it (visibility) once revealed,
            // so the card never contracts when it vanishes — a collapse here shoved the
            // letter pile up mid-tap (mis-selected letters / accidental בדוק). Same
            // reserve-space pattern the Reading game already uses.
            word={displayWord}
            wordHidden={!wordVisible}
            translation={hebrew || undefined}
            onPlayAudio={() => void speakWord(item.word.word.toLowerCase(), 'word-journey')}
            audioLabel="השמע מילה"
            audioIconOnly
          />
        </div>
        <div className="game-twopane-interaction flex flex-1 flex-col gap-4">
          {phase === 'wrong' ? (
            <SpellingComparison
              target={item.word.word}
              attempt={built}
              caseMode={caseMode}
              showNikud={showNikud}
            />
          ) : (
            <LetterSlots
              target={item.word.word}
              tiles={item.tiles}
              caseMode={caseMode}
              result={phase === 'correct' ? 'correct' : null}
              disabled={phase !== 'building'}
              resetKey={`${index}:${clearNonce}`}
              onChange={setBuilt}
              onPlaceLetter={(l) => void speak(l.toLowerCase())}
            />
          )}

          {phase === 'building' ? (
            <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setClearNonce((n) => n + 1)}
                disabled={built.length === 0}
                data-testid="wj-spell-clear"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nk('נקה')}
              </button>
              <button
                type="button"
                onClick={check}
                disabled={built.length === 0}
                data-testid="wj-spell-check"
                className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nk('בדוק')}
              </button>
            </div>
          ) : phase === 'wrong' ? (
            <button
              type="button"
              onClick={advance}
              data-testid="wj-spell-next"
              className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
            >
              {nk('הבא')}
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? <FeedbackBanner variant={feedback.variant} message={feedback.text} visible /> : null}
    </div>
  )
}
