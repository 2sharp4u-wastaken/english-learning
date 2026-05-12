import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { ReadingLearnFirst } from './components/ReadingLearnFirst'
import {
  abortReadingSession,
  beginReadingSession,
  clearReadingAudioState,
  finishReadingSession,
  loadReadingAudioState,
  recordReadingAnswer,
  saveReadingAudioState,
  type ReadingQuestion,
  type ReadingSessionResult,
} from '@/bridge/reading'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

interface LetterToken {
  /** Stable per-bank-build key so duplicate letters render as distinct buttons. */
  key: string
  /** Letter as stored in legacy data (uppercase). */
  letter: string
  used: boolean
}

const ADVANCE_DELAY_MS = 1500
const WORD_REVEAL_MS = 3000

function buildLetterBank(question: ReadingQuestion): LetterToken[] {
  const wordLetters = question.word.split('')
  const extras = Array.isArray(question.extraLetters) ? question.extraLetters : []
  // Combine and Fisher-Yates shuffle (matches legacy reading-game.js).
  const all = [...wordLetters, ...extras]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.map((letter, index) => ({
    key: `${index}-${letter}`,
    letter,
    used: false,
  }))
}

function ReadingPicture({ question }: { question: ReadingQuestion }) {
  const overrides =
    ((window as any).wordImageOverrides as Record<string, string> | undefined) ?? {}
  const overrideKey = `${question.category}:${question.word.toLowerCase()}`
  const effective = question.imageUrl || overrides[overrideKey]
  if (effective) {
    return (
      <img
        src={effective}
        alt=""
        className="word-image max-h-40 rounded-2xl object-contain"
      />
    )
  }
  return (
    <span className="text-6xl" role="img" aria-label="">
      {question.picture || '🔤'}
    </span>
  )
}

export function ReadingGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const [session, setSession] = useState<ReadingSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  // Letter-building state.
  const [letterBank, setLetterBank] = useState<LetterToken[]>([])
  const [built, setBuilt] = useState<LetterToken[]>([])
  const [attempts, setAttempts] = useState(0)
  // English word reveal cycles: visible on each new question / after a wrong
  // answer, then auto-hidden after WORD_REVEAL_MS. Hebrew stays visible.
  const [wordVisible, setWordVisible] = useState(true)
  // Per-question audio budget (mirrors true-or-not — no reveal gate, since
  // the English word + picture serve as exposure).
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  const advanceTimer = useRef<number | null>(null)
  const wordHideTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)

  const clearWordHideTimer = useCallback(() => {
    if (wordHideTimer.current != null) {
      window.clearTimeout(wordHideTimer.current)
      wordHideTimer.current = null
    }
  }, [])

  const startWordHideTimer = useCallback(() => {
    clearWordHideTimer()
    setWordVisible(true)
    wordHideTimer.current = window.setTimeout(() => {
      setWordVisible(false)
      wordHideTimer.current = null
    }, WORD_REVEAL_MS)
  }, [clearWordHideTimer])

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    if (opts?.fresh) clearReadingAudioState()
    const result = beginReadingSession(opts ?? {})
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
      const restored = loadReadingAudioState(result.resumeIndex)
      const settingsBudget = getSettings().audioPlaysAllowed ?? 8
      if (restored) {
        setAudioPlaysLeft(restored.audioPlaysLeft)
        autoPlayedRef.current = true
      } else {
        setAudioPlaysLeft(settingsBudget)
        autoPlayedRef.current = false
      }
    } else {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('idle')
      isActiveRef.current = false
      setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
      autoPlayedRef.current = false
    }
    setBuilt([])
    setAttempts(0)
    setFeedback(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    let attemptsCount = 0
    const tryStart = () => {
      if (cancelled) return
      const w = window as any
      const ready =
        !!w.gameManager &&
        !!w.app &&
        !!w.app.userProgress &&
        typeof w.app.userProgress.learnedWords === 'object'
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
      if (advanceTimer.current) {
        window.clearTimeout(advanceTimer.current)
        advanceTimer.current = null
      }
      clearWordHideTimer()
      if (isActiveRef.current) {
        abortReadingSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start, clearWordHideTimer])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: ReadingQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  // Build a fresh letter bank when the current question changes.
  useEffect(() => {
    if (!current) return
    setLetterBank(buildLetterBank(current))
    setBuilt([])
    setAttempts(0)
    startWordHideTimer()
  }, [current, startWordHideTimer])

  // Persist per-question audio counters so a refresh doesn't reset them.
  useEffect(() => {
    if (phase !== 'awaiting' && phase !== 'answered') return
    saveReadingAudioState({
      questionIndex: index,
      playsSoFar: autoPlayedRef.current ? 1 : 0,
      audioPlaysLeft,
    })
  }, [audioPlaysLeft, index, phase])

  const playWord = useCallback(() => {
    if (!current) return
    if (audioPlaysLeft <= 0) return
    setAudioPlaysLeft((n) => Math.max(0, n - 1))
    void speakWord(current.word, 'reading')
  }, [audioPlaysLeft, current])

  // Auto-play on each new question. Mirrors the Slice 3.1 template (voice
  // readiness poll, allowOverlap, suppressed on resume).
  useEffect(() => {
    if (!current) return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      void speakWord(current.word, 'reading', { allowOverlap: true })
    }

    let attemptsCount = 0
    const tryFire = () => {
      if (cancelled || autoPlayedRef.current) return
      const sm = (window as any).speechManager
      const ready = sm?.englishVoice || (sm?.voices && sm.voices.length > 0)
      if (ready || attemptsCount >= 10) {
        fire()
        return
      }
      attemptsCount++
      window.setTimeout(tryFire, 150)
    }

    const id = window.setTimeout(tryFire, 250)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [current])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    clearWordHideTimer()
    if (isActiveRef.current) {
      abortReadingSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [clearWordHideTimer, start])

  const advance = useCallback(() => {
    setFeedback(null)
    setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    clearReadingAudioState()
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishReadingSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [total])

  const handleLetterPick = useCallback(
    (key: string) => {
      if (phase !== 'awaiting') return
      setLetterBank((bank) => {
        const idx = bank.findIndex((t) => t.key === key && !t.used)
        if (idx === -1) return bank
        const next = bank.slice()
        next[idx] = { ...next[idx], used: true }
        setBuilt((b) => [...b, next[idx]])
        // Speak the letter (legacy reading-game.js addLetterToWord behavior).
        void speak(next[idx].letter.toLowerCase())
        return next
      })
    },
    [phase],
  )

  const handleClearBuilt = useCallback(() => {
    if (phase !== 'awaiting') return
    setBuilt([])
    setLetterBank((bank) => bank.map((t) => ({ ...t, used: false })))
  }, [phase])

  const handleCheck = useCallback(() => {
    if (!current || phase !== 'awaiting' || built.length === 0) return
    const builtWord = built.map((t) => t.letter).join('')
    const outcome = recordReadingAnswer(current, builtWord, attempts)
    const fb = getGameFeedback('reading', outcome.isCorrect ? 'correct' : 'incorrect')
    setFeedback({
      variant: outcome.isCorrect ? 'correct' : 'incorrect',
      text: fb.text,
    })
    setPhase('answered')
    if (outcome.isCorrect) {
      setScore((s) => s + outcome.pointsAwarded)
      setCorrect((c) => c + 1)
      if (getShowConfetti()) triggerConfetti()
    } else {
      // Wrong answer: legacy redisplays the English word for 3s and replays
      // audio. The index already advanced in the bridge — show the Next
      // button (no retry) so this matches legacy reading-game.js semantics.
      setAttempts((a) => a + 1)
      startWordHideTimer()
      try {
        void speakWord(current.word, 'reading', { allowOverlap: true })
      } catch {
        /* ignore */
      }
    }
    if (fb.audio) void speak(fb.audio)
    if (outcome.isCorrect) {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        advance()
      }, ADVANCE_DELAY_MS)
    }
  }, [advance, attempts, built, current, phase, startWordHideTimer])

  const handleNextAfterIncorrect = useCallback(() => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    advance()
  }, [advance])

  const requestExit = useCallback(() => setExitOpen(true), [])

  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortReadingSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'קריאה',
      icon: '📖',
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
          טוען…
        </div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'learn-first') {
    return (
      <GameScreenShell header={headerProps}>
        <ReadingLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const renderLetter = (letter: string) =>
    caseMode === 'lowercase' ? letter.toLowerCase() : letter.toUpperCase()

  const promptHebrewRaw = current?.hebrew ?? ''
  const promptHebrew = showNikud ? promptHebrewRaw : stripNikud(promptHebrewRaw)

  const audioHint =
    audioPlaysLeft <= 0 ? 'נגמרו ההשמעות' : `השמעות נותרו: ${audioPlaysLeft}`

  const canCheck = phase === 'awaiting' && built.length > 0
  const canClear = phase === 'awaiting' && built.length > 0

  const footer =
    phase === 'awaiting' ? (
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleClearBuilt}
          disabled={!canClear}
          data-testid="reading-clear"
          className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          נקה
        </button>
        <button
          type="button"
          onClick={handleCheck}
          disabled={!canCheck}
          data-testid="reading-check"
          className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          בדוק
        </button>
      </div>
    ) : phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="reading-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        השאלה הבאה
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div className="flex flex-1 flex-col gap-4">
            <MediaPromptCard
              prompt="הרכיבו את המילה"
              media={<ReadingPicture question={current} />}
              word={wordVisible ? renderLetter(current.word) : undefined}
              translation={promptHebrew || undefined}
              onPlayAudio={playWord}
              audioDisabled={audioPlaysLeft <= 0}
              audioLabel="השמע מילה"
              audioIconOnly
              audioHint={audioHint}
            />

            <div
              data-testid="reading-built-word"
              dir="ltr"
              className={cn(
                'mx-auto flex min-h-[3.5rem] min-w-[8rem] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 px-4 py-2 text-3xl font-bold tracking-wide text-white backdrop-blur',
                phase === 'answered' && feedback?.variant === 'correct' && 'border-[color:var(--mint-400)] text-[color:var(--mint-400)]',
                phase === 'answered' && feedback?.variant === 'incorrect' && 'border-red-400 text-red-300',
              )}
            >
              {built.length === 0 ? (
                <span
                  dir="rtl"
                  className="text-lg font-normal text-[color:var(--slate-300)] sm:text-xl"
                >
                  בחרו אותיות מהבנק…
                </span>
              ) : (
                built.map((t) => <span key={t.key}>{renderLetter(t.letter)}</span>)
              )}
            </div>

            <div
              data-testid="reading-letter-bank"
              dir="ltr"
              className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2"
            >
              {letterBank.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-testid="reading-letter"
                  data-letter={t.letter}
                  onClick={() => handleLetterPick(t.key)}
                  disabled={t.used || phase !== 'awaiting'}
                  className={cn(
                    'inline-flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl font-bold text-white shadow-sm transition hover:brightness-110 sm:size-14 sm:text-3xl',
                    'disabled:cursor-not-allowed disabled:opacity-30',
                  )}
                >
                  {renderLetter(t.letter)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </GameScreenShell>
      {feedback ? (
        <FeedbackBanner
          variant={feedback.variant}
          message={feedback.text}
          visible
        />
      ) : null}
      <ExitConfirmDialog
        open={exitOpen}
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
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
