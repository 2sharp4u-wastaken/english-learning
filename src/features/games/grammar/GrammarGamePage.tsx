import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordTable, type WordTableRow } from '@/features/games/shared/WordTable'
import { SentenceText } from '@/features/games/shared/NewWordPill'
import { detectNewWords } from '@/bridge/newWords'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import {
  abortGrammarSession,
  beginGrammarSession,
  finishGrammarSession,
  recordGrammarAnswer,
  type GrammarQuestion,
  type GrammarSessionResult,
} from '@/bridge/grammar'
import { cancelSpeech, hardResetSpeech, speak } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { useTextPrefs } from '@/bridge/textPrefs'
import { applyNikud, useNikud } from '@/bridge/nikud'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

function shuffleOptions(
  options: string[],
  correctIndexInput: number,
): { order: string[]; correctIndex: number } {
  const correctAnswer = options[correctIndexInput]
  const shuffled = [...options]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return { order: shuffled, correctIndex: shuffled.indexOf(correctAnswer) }
}

function splitSentence(sentence: string): { before: string; after: string } {
  const parts = sentence.split('___')
  const before = parts[0] ?? ''
  // Strip trailing dot to match legacy grammar-game.js:44
  const after = (parts[1] ?? '').replace(/\.$/, '')
  return { before, after }
}

// Some sentences carry a visual-only hint in (parens) or [brackets] — e.g.
// "I have two ___ (apple)" or a bracketed pronoun. The child sees it, but it
// must NOT be read aloud by TTS (B5, bug-dump 2026-06-07). Strip the bracketed
// runs and tidy the leftover spacing/punctuation before speaking.
function stripSpokenHints(text: string): string {
  return text
    .replace(/[([][^)\]]*[)\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

export function GrammarGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const autoPlayedRef = useRef(false)
  const [session, setSession] = useState<GrammarSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const isActiveRef = useRef(false)

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginGrammarSession(opts ?? {})
    setSession(result)
    setIndex(result.resumeIndex)
    setScore(result.resumeScore)
    setCorrect(Math.floor(result.resumeScore / 10))
    setPhase('awaiting')
    isActiveRef.current = true
    setSelectedIndex(null)
    setFeedback(null)
    autoPlayedRef.current = false
  }, [])

  useEffect(() => {
    let cancelled = false
    let attemptsCount = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() && !!app && !!app.userProgress && !!(window as any).gameData?.grammar
      if (!ready && attemptsCount < 30) {
        attemptsCount++
        window.setTimeout(tryStart, 100)
        return
      }
      start()
    }
    tryStart()
    return () => {
      cancelled = true
      if (isActiveRef.current) {
        abortGrammarSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: GrammarQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  const shuffled = useMemo(() => {
    if (!current) return { order: [] as string[], correctIndex: -1 }
    return shuffleOptions(current.options, current.correct)
  }, [current])

  // E8 (bug-dump 2026-06-07): surface NEW (not-yet-learned) vocab-bank words in
  // the sentence as tappable pills + translation + audio. Exposure-only — not
  // recorded toward mastery. Scan the sentence with the blank dropped (the blank
  // answer is a grammar function word, never a content word).
  const newWordsList = useMemo(
    () => (current ? detectNewWords(current.sentence.replace('___', ' ')) : []),
    [current],
  )
  const newWordsMap = useMemo(
    () => new Map(newWordsList.map((nw) => [nw.word, nw])),
    [newWordsList],
  )

  // Speak the sentence with the blank skipped (comma pause replaces ___).
  const speakPrompt = useCallback((q: GrammarQuestion) => {
    const text = stripSpokenHints(q.sentence.replace('___', ',')).replace(/\s+,/, ',')
    void speak(text)
  }, [])

  // Auto-play once per question, after voices are ready.
  useEffect(() => {
    if (!current || phase !== 'awaiting') return
    if (autoPlayedRef.current) return
    let cancelled = false
    let attempts = 0
    const tryFire = () => {
      if (cancelled || autoPlayedRef.current) return
      const sm = (window as any).speechManager
      const ready = sm?.englishVoice || (sm?.voices && sm.voices.length > 0)
      if (ready || attempts >= 10) {
        autoPlayedRef.current = true
        speakPrompt(current)
        return
      }
      attempts++
      window.setTimeout(tryFire, 150)
    }
    const id = window.setTimeout(tryFire, 250)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [current, phase, speakPrompt])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (isActiveRef.current) {
      abortGrammarSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [start])

  const advance = useCallback(() => {
    cancelSpeech()
    setFeedback(null)
    setSelectedIndex(null)
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishGrammarSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [total])

  const handleSelect = useCallback(
    (i: number) => {
      if (!current || phase !== 'awaiting') return
      const chosen = shuffled.order[i]
      const outcome = recordGrammarAnswer(current, chosen)
      setSelectedIndex(i)
      setPhase('answered')
      const fb = getGameFeedback('grammar', outcome.isCorrect ? 'correct' : 'incorrect')
      setFeedback({
        variant: outcome.isCorrect ? 'correct' : 'incorrect',
        text: fb.text,
      })
      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
      }
      // Legacy plays praise audio (if any) then full correct sentence (both paths).
      const correctAnswer = current.options[current.correct]
      const fullSentence = stripSpokenHints(
        current.sentence.includes('___')
          ? current.sentence.replace('___', correctAnswer)
          : current.sentence,
      )
      ;(async () => {
        try {
          if (outcome.isCorrect && fb.audio) await speak(fb.audio)
          await speak(fullSentence)
        } catch {
          /* ignore */
        }
      })()
    },
    [current, phase, shuffled.order],
  )

  const handleNext = useCallback(() => {
    advance()
  }, [advance])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortGrammarSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'דקדוק',
      icon: '📝',
      score,
      onBack: requestExit,
    }),
    [requestExit, score],
  )

  const progressProps = useMemo(
    () => ({
      current: phase === 'finished' ? total : Math.min(index + 1, total || 1),
      total: total || 1,
      onReset: handleReset,
    }),
    [handleReset, index, phase, total],
  )

  if (!session) {
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 items-center justify-center text-[color:var(--slate-300)]">
          {nk('טוען…')}
        </div>
      </GameScreenShell>
    )
  }

  if (total === 0) {
    return (
      <GameScreenShell header={{ ...headerProps, onBack: () => navigate('/home') }}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[color:var(--slate-200)]">
          <span className="text-5xl">📝</span>
          <p>{nk('אין שאלות דקדוק זמינות.')}</p>
        </div>
      </GameScreenShell>
    )
  }

  const renderWord = (word: string) =>
    caseMode === 'lowercase' ? word.toLowerCase() : word.toUpperCase()

  // Grammar Hebrew (sentence, option glosses, explanation) is authored without
  // nikud and isn't pre-enriched at boot, so route it through `applyNikud` —
  // adds points from the nikud map when ON, strips when OFF (Theme A).
  const renderHebrew = (s: string | undefined | null) => applyNikud(s, showNikud)

  // Map shuffled options back to their original index so we can pull the
  // matching Hebrew gloss from `hebrewOptions` (which is keyed to the
  // original option order, not the shuffled one).
  // Reveal the Hebrew gloss under each option only AFTER answering. Before
  // that it leaks the answer (the gloss matches the Hebrew prompt's subject).
  const revealGlosses = phase === 'answered'
  const options = shuffled.order.map((opt, i) => {
    const originalIndex = current ? current.options.indexOf(opt) : -1
    const hebrewGloss =
      current?.hebrewOptions && originalIndex >= 0
        ? current.hebrewOptions[originalIndex]
        : undefined
    return {
      key: `${index}-${i}-${opt}`,
      label: renderWord(opt),
      sublabel: revealGlosses && hebrewGloss ? renderHebrew(hebrewGloss) : undefined,
    }
  })

  const split = current ? splitSentence(current.sentence) : { before: '', after: '' }
  const correctAnswer = current?.options[current.correct] ?? ''
  // E7 (bug-dump 2026-06-07): always show the FULL Hebrew sentence — drop the
  // blank so the child reads the complete meaning instead of deducing from
  // context. Hebrew present-tense copula sentences omit "to be", so removing
  // `___` yields the natural sentence ("אני ___ שמח" → "אני שמח"); question
  // forms read fine too ("___ הלכת לישון?" → "הלכת לישון?"). The Hebrew gives
  // the meaning; the English blank stays the exercise.
  const hebrewSentenceDisplay = current?.hebrewSentence
    ? renderHebrew(
        current.hebrewSentence
          .replace('___', '')
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([?!.,])/g, '$1')
          .trim(),
      )
    : ''
  const filled = phase === 'answered' && selectedIndex != null
  const wasCorrect = filled && selectedIndex === shuffled.correctIndex
  const blankText = filled
    ? wasCorrect
      ? renderWord(shuffled.order[selectedIndex!])
      : renderWord(correctAnswer)
    : '______'

  const explanation = current
    ? current.hebrewExplanation || current.explanation || ''
    : ''

  // Word-review table (F3 + E7/E8): after answering, show the correct option and
  // — if the child missed — the one they picked, each with its Hebrew gloss + a
  // play button. Hebrew comes from `hebrewOptions` (raw; WordTable nk()'s it).
  const wordTableRows: WordTableRow[] = []
  if (phase === 'answered' && current) {
    const correctHe = current.hebrewOptions?.[current.correct]
    if (correctAnswer && correctHe) {
      wordTableRows.push({ word: correctAnswer, hebrew: correctHe, mark: 'correct' })
    }
    if (selectedIndex != null) {
      const chosen = shuffled.order[selectedIndex]
      if (chosen && chosen !== correctAnswer) {
        const oi = current.options.indexOf(chosen)
        const chosenHe = oi >= 0 ? current.hebrewOptions?.[oi] : undefined
        if (chosenHe) wordTableRows.push({ word: chosen, hebrew: chosenHe, mark: 'wrong' })
      }
    }
    // E8: merge the sentence's NEW vocab words into the same table (no ✓/✗ mark).
    for (const nw of newWordsList) {
      wordTableRows.push({ word: nw.word, hebrew: nw.hebrew })
    }
  }

  const footer =
    phase === 'answered' ? (
      <button
        type="button"
        onClick={handleNext}
        data-testid="grammar-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        {nk('השאלה הבאה')}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div key={index} className="flex flex-1 flex-col gap-4">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 text-center backdrop-blur">
              {hebrewSentenceDisplay ? (
                <p
                  data-testid="grammar-hebrew"
                  className="text-lg font-semibold text-[color:var(--slate-100)] sm:text-xl"
                >
                  🇮🇱 {hebrewSentenceDisplay}
                </p>
              ) : null}
              <p
                data-testid="grammar-sentence"
                dir="ltr"
                className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-2xl font-bold text-white sm:text-3xl"
              >
                <SentenceText
                  text={split.before.trimEnd()}
                  newWords={newWordsMap}
                  renderWord={renderWord}
                  gameContext="grammar"
                />
                <span
                  data-testid="grammar-blank"
                  data-state={filled ? (wasCorrect ? 'correct' : 'incorrect') : 'empty'}
                  className={cn(
                    'inline-flex min-w-[3.5rem] items-end justify-center border-b-2 px-2 pb-0.5',
                    filled && wasCorrect && 'border-emerald-400 text-emerald-300',
                    filled && !wasCorrect && 'border-rose-400 text-rose-300',
                    !filled && 'border-[color:var(--blue-400)] text-[color:var(--blue-300)]',
                  )}
                >
                  {blankText}
                </span>
                <SentenceText
                  text={split.after.trimStart()}
                  newWords={newWordsMap}
                  renderWord={renderWord}
                  gameContext="grammar"
                />
              </p>
              <button
                type="button"
                onClick={() => {
                  if (phase === 'answered') {
                    const correctAnswer = current.options[current.correct]
                    const fullSentence = current.sentence.includes('___')
                      ? current.sentence.replace('___', correctAnswer)
                      : current.sentence
                    void speak(fullSentence)
                  } else {
                    speakPrompt(current)
                  }
                }}
                data-testid="grammar-play"
                aria-label={phase === 'answered' ? 'השמע משפט מלא' : 'השמע משפט'}
                className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
              >
                <Volume2 className="size-5" aria-hidden />
              </button>
              {phase === 'answered' && explanation ? (
                <p
                  data-testid="grammar-explanation"
                  className="text-sm text-[color:var(--slate-300)] sm:text-base"
                >
                  {renderHebrew(explanation)}
                </p>
              ) : null}
            </div>

            <AnswerGrid
              options={options}
              onSelect={handleSelect}
              selectedIndex={selectedIndex}
              correctIndex={shuffled.correctIndex}
              revealed={phase === 'answered'}
              disabled={phase !== 'awaiting'}
              variant="text"
              columns={options.length === 2 ? 2 : options.length >= 4 ? 4 : 3}
            />

            {phase === 'answered' && wordTableRows.length > 0 ? (
              <WordTable rows={wordTableRows} title="המילים" />
            ) : null}
          </div>
        ) : null}
      </GameScreenShell>
      {feedback ? (
        <FeedbackBanner variant={feedback.variant} message={feedback.text} visible />
      ) : null}
      <ExitConfirmDialog open={exitOpen} onConfirm={confirmExit} onCancel={cancelExit} />
      <RewardModal
        open={phase === 'finished'}
        score={score}
        total={total}
        correct={correct}
        onPlayAgain={() => start({ fresh: true })}
        onExit={() => navigate('/home')}
      />
    </>
  )
}
