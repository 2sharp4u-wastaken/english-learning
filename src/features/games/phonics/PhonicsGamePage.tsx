import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff } from 'lucide-react'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { PhonicsAllMastered } from './components/PhonicsAllMastered'
import {
  abortPhonicsSession,
  beginPhonicsSession,
  finishPhonicsSession,
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  recordPhonicsAnswer,
  recordPhonicsSpeechAttempt,
  resetPhonicsMastery,
  startPhonicsRecording,
  stopPhonicsRecording,
  type PhonicsQuestion,
  type PhonicsSessionResult,
} from '@/bridge/phonics'
import { cancelSpeech, hardResetSpeech, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, triggerConfetti } from '@/bridge/feedback'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'recording' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500
const GAME_CONTEXT = 'phonics'

/** MC types whose options stay hidden until the prompt audio auto-plays. */
const GATE_TYPES = new Set<PhonicsQuestion['type']>(['hear-pick-word', 'see-pick-sound'])

function PhonicsGlyph({ question }: { question: PhonicsQuestion }) {
  if (question.type === 'hear-pick-word') {
    // The sound is the prompt; the pictures are the options below.
    return (
      <div className="flex flex-col items-center gap-2">
        <span
          dir="ltr"
          data-testid="phonics-sound-display"
          className="font-display text-7xl font-bold tracking-wide text-white sm:text-8xl"
        >
          {question.display}
        </span>
        <span dir="rtl" className="text-sm font-medium text-[color:var(--slate-300)]">
          {question.hebrewSound}
        </span>
      </div>
    )
  }
  // see-pick-sound + say-sound: the picture is the prompt.
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-7xl sm:text-8xl" role="img" aria-label={question.promptWord}>
        {question.emoji}
      </span>
      {question.type === 'say-sound' && question.promptWord ? (
        <span dir="ltr" className="font-display text-3xl font-bold lowercase text-white">
          {question.promptWord}
        </span>
      ) : null}
    </div>
  )
}

export function PhonicsGamePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<PhonicsSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selected, setSelected] = useState<number | null>(null)
  const [audioRevealed, setAudioRevealed] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [speechTranscript, setSpeechTranscript] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)
  const advanceTimer = useRef<number | null>(null)
  const recognitionSupported = useMemo(() => isSpeechRecognitionAvailable(), [])

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current != null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }, [])

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginPhonicsSession(opts ?? {})
    setSession(result)
    setFeedback(null)
    setSelected(null)
    setSpeechTranscript(null)
    setRecordError(null)
    setAudioRevealed(false)
    autoPlayedRef.current = false
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
    } else {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('idle')
      isActiveRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() && !!app && !!app.userProgress && !!app.userProgress.wordMastery
      if (!ready && attempts < 30) {
        attempts++
        window.setTimeout(tryStart, 100)
        return
      }
      start()
    }
    tryStart()
    return () => {
      cancelled = true
      clearAdvanceTimer()
      if (isCurrentlyRecording()) void stopPhonicsRecording()
      if (isActiveRef.current) {
        abortPhonicsSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [clearAdvanceTimer, start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: PhonicsQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  // ─── Auto-play the prompt word + reveal options ───────────────────────────
  useEffect(() => {
    if (!current || phase !== 'awaiting') return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      if (current.type === 'say-sound') {
        // No audio gate — the kid speaks; nothing to auto-play.
        return
      }
      setAudioRevealed(true)
      if (current.sayWord) {
        void speakWord(current.sayWord.toLowerCase(), GAME_CONTEXT, { allowOverlap: true })
      }
    }

    let attempts = 0
    const tryFire = () => {
      if (cancelled || autoPlayedRef.current) return
      const sm = (window as any).speechManager
      const ready = sm?.englishVoice || (sm?.voices && sm.voices.length > 0)
      if (ready || attempts >= 10) {
        fire()
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
  }, [current, phase])

  const replayAudio = useCallback(() => {
    if (!current) return
    setAudioRevealed(true)
    if (current.sayWord) {
      void speakWord(current.sayWord.toLowerCase(), GAME_CONTEXT)
    }
  }, [current])

  const advance = useCallback(() => {
    clearAdvanceTimer()
    cancelSpeech()
    setFeedback(null)
    setSelected(null)
    setSpeechTranscript(null)
    setRecordError(null)
    setAudioRevealed(false)
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishPhonicsSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [clearAdvanceTimer, total])

  const settleAnswer = useCallback(
    (isCorrect: boolean, q: PhonicsQuestion) => {
      const fb = getGameFeedback(GAME_CONTEXT, isCorrect ? 'correct' : 'incorrect')
      setFeedback({ variant: isCorrect ? 'correct' : 'incorrect', text: fb.text })
      setPhase('answered')

      if (isCorrect) {
        setScore((s) => s + 10)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
        clearAdvanceTimer()
        advanceTimer.current = window.setTimeout(advance, ADVANCE_DELAY_MS)
      } else {
        // Voice the right word so the mistake teaches (ABC say-letter parity).
        void (async () => {
          await new Promise((r) => window.setTimeout(r, 350))
          if (q.sayWord) await speakWord(q.sayWord.toLowerCase(), GAME_CONTEXT)
        })()
      }
    },
    [advance, clearAdvanceTimer],
  )

  const handleSelect = useCallback(
    (idx: number) => {
      if (!current || phase !== 'awaiting' || !audioRevealed) return
      if (current.type === 'say-sound') return
      setSelected(idx)
      const outcome = recordPhonicsAnswer(current, idx)
      settleAnswer(outcome.isCorrect, current)
    },
    [audioRevealed, current, phase, settleAnswer],
  )

  const handleRecordToggle = useCallback(async () => {
    if (!current || current.type !== 'say-sound') return
    if (!recognitionSupported) {
      setRecordError('זיהוי דיבור אינו נתמך בדפדפן הזה.')
      return
    }
    if (phase === 'recording' && isCurrentlyRecording()) {
      try {
        await stopPhonicsRecording()
      } catch {
        /* ignore */
      }
      return
    }
    if (phase !== 'awaiting') return

    setRecordError(null)
    setSpeechTranscript(null)
    cancelSpeech()
    await new Promise((r) => window.setTimeout(r, 100))
    setPhase('recording')

    let result: { transcript: string; confidence: number }
    try {
      result = await startPhonicsRecording()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPhase('awaiting')
      if (msg === 'RECORDING_CANCELLED') return
      setRecordError(msg || 'הקלטה נכשלה.')
      return
    }

    const outcome = recordPhonicsSpeechAttempt(current, result)
    setSpeechTranscript(outcome.transcript || '(לא זוהה)')
    settleAnswer(outcome.isCorrect, current)
  }, [current, phase, recognitionSupported, settleAnswer])

  const handleNext = useCallback(() => {
    advance()
  }, [advance])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    clearAdvanceTimer()
    if (isCurrentlyRecording()) void stopPhonicsRecording()
    if (isActiveRef.current) {
      abortPhonicsSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [clearAdvanceTimer, start])

  const handleStartOver = useCallback(() => {
    resetPhonicsMastery()
    start({ fresh: true })
  }, [start])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    clearAdvanceTimer()
    if (isCurrentlyRecording()) void stopPhonicsRecording()
    if (isActiveRef.current) {
      abortPhonicsSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [clearAdvanceTimer, navigate])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'משחק צלילים',
      icon: '🔡',
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

  const nk = useNikud()

  if (!session) {
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 items-center justify-center text-[color:var(--slate-300)]">
          {nk('טוען…')}
        </div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'all-mastered') {
    return (
      <GameScreenShell header={headerProps}>
        <PhonicsAllMastered onStartOver={handleStartOver} onExit={() => navigate('/home')} />
      </GameScreenShell>
    )
  }

  const isSaySound = current?.type === 'say-sound'
  const isRecording = phase === 'recording'
  const showNextButton = phase === 'answered' && feedback?.variant === 'incorrect'

  const footer = showNextButton ? (
    <button
      type="button"
      onClick={handleNext}
      data-testid="phonics-next"
      className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
    >
      {nk('השאלה הבאה')}
    </button>
  ) : null

  const currentType = current?.type
  const answerOptions =
    current?.options?.map((o, i) =>
      currentType === 'hear-pick-word'
        ? {
            // Picture only — no word text. Showing the word would let the child
            // eye-scan the spelling for the target digraph instead of matching
            // by ear, defeating the listen-for-the-sound goal.
            key: i,
            ariaLabel: o.word,
            media: (
              <span className="text-5xl sm:text-6xl" role="img" aria-label={o.word}>
                {o.emoji}
              </span>
            ),
          }
        : { key: i, label: o.label, sublabel: o.sublabel },
    ) ?? []

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div key={index} className="flex flex-1 flex-col gap-4">
            <MediaPromptCard
              prompt={current.instruction}
              media={<PhonicsGlyph question={current} />}
              onPlayAudio={isSaySound ? undefined : replayAudio}
              audioDisabled={phase === 'answered'}
              audioLabel="השמע שוב"
              audioIconOnly
            />

            {isSaySound ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRecordToggle()}
                  disabled={phase === 'answered' || !recognitionSupported}
                  data-testid="phonics-record"
                  data-recording={isRecording ? 'true' : 'false'}
                  aria-label={isRecording ? 'עצור הקלטה' : 'התחל הקלטה'}
                  className={cn(
                    'flex size-20 items-center justify-center rounded-full font-bold text-white shadow-lg transition',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isRecording
                      ? 'animate-pulse bg-gradient-to-br from-rose-500 to-rose-700'
                      : 'bg-gradient-to-br from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] hover:brightness-110',
                  )}
                >
                  {isRecording ? (
                    <MicOff className="size-8" aria-hidden />
                  ) : (
                    <Mic className="size-8" aria-hidden />
                  )}
                </button>
                <p
                  data-testid="phonics-record-status"
                  dir="rtl"
                  className="text-sm font-medium text-[color:var(--slate-300)] sm:text-base"
                >
                  {nk(
                    isRecording
                      ? 'מקליט… לחץ שוב לעצירה'
                      : phase === 'answered'
                        ? speechTranscript
                          ? `שמעתי: ${speechTranscript}`
                          : 'התוצאה מוכנה'
                        : recognitionSupported
                          ? 'לחץ על המיקרופון ואמור את המילה'
                          : 'הדפדפן אינו תומך בזיהוי דיבור',
                  )}
                </p>
                {recordError ? (
                  <p
                    data-testid="phonics-record-error"
                    dir="rtl"
                    className="max-w-md text-center text-sm font-medium text-rose-300"
                  >
                    {nk(recordError)}
                  </p>
                ) : null}
                {!recognitionSupported ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    data-testid="phonics-skip"
                    className="rounded-full bg-white/10 px-6 py-2 text-sm font-bold text-white transition hover:bg-white/15"
                  >
                    {nk('דלג')}
                  </button>
                ) : null}
              </div>
            ) : current.options ? (
              <AnswerGrid
                options={answerOptions}
                onSelect={handleSelect}
                selectedIndex={selected}
                correctIndex={current.correct ?? null}
                revealed={phase === 'answered'}
                disabled={phase !== 'awaiting'}
                hidden={GATE_TYPES.has(current.type) && !audioRevealed}
                variant={current.type === 'hear-pick-word' ? 'media' : 'text'}
                columns={current.type === 'hear-pick-word' ? 2 : 3}
                autoFocusFirst
              />
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
