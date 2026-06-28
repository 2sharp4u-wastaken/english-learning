import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff } from 'lucide-react'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { PracticeEmpty } from '@/features/games/practice/components/PracticeEmpty'
import {
  abortPracticeSession,
  beginPracticeSession,
  finishPracticeSession,
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  recordPracticeAttempt,
  startPronunciationRecording,
  stopPronunciationRecording,
  type PracticeQuestion,
  type PracticeSessionResult,
} from '@/bridge/practice'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import { getShowConfetti, playAnswerSfx, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { isAndroid } from '@/lib/platform'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'recording' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

interface ComparisonState {
  target: string
  transcript: string
  accuracy: number
  isCorrect: boolean
  /** Object URL for the captured mic blob — kids tap "שמע את עצמך" to play it
   *  back. `null` if MediaRecorder failed or browser doesn't support it. */
  recordingUrl: string | null
}

function PromptPicture({ question }: { question: PracticeQuestion }) {
  const overrides =
    ((window as any).wordImageOverrides as Record<string, string> | undefined) ?? {}
  const overrideKey = `${question.category}:${question.word}`
  const effectiveImageUrl = overrides[overrideKey] || question.imageUrl
  if (effectiveImageUrl) {
    return (
      <img
        src={effectiveImageUrl}
        alt={question.word}
        className="word-image max-h-32 rounded-xl object-contain"
      />
    )
  }
  return (
    <span className="text-6xl" role="img" aria-label={question.word}>
      {question.picture || '🔤'}
    </span>
  )
}

export function PracticeGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<PracticeSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [comparison, setComparison] = useState<ComparisonState | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)
  const recognitionSupported = useMemo(() => isSpeechRecognitionAvailable(), [])
  // Parallel mic capture for "hear yourself". webkitSpeechRecognition doesn't
  // expose the audio, so we open our own getUserMedia stream + MediaRecorder
  // alongside the recognition call.
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<Blob[]>([])
  const recordingUrlRef = useRef<string | null>(null)

  const stopMediaCapture = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current
      if (!rec || rec.state === 'inactive') {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        resolve(null)
        return
      }
      rec.addEventListener(
        'stop',
        () => {
          const chunks = mediaChunksRef.current
          mediaChunksRef.current = []
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          mediaRecorderRef.current = null
          if (!chunks.length) {
            resolve(null)
            return
          }
          try {
            const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' })
            resolve(URL.createObjectURL(blob))
          } catch {
            resolve(null)
          }
        },
        { once: true },
      )
      try {
        rec.stop()
      } catch {
        resolve(null)
      }
    })
  }, [])

  const startMediaCapture = useCallback(async (): Promise<void> => {
    // M1: a parallel getUserMedia capture starves Android's speech recognition
    // into silence (permission granted, green dot on, recognition hears nothing),
    // so the recording was never picked up on mobile. The hear-yourself replay is
    // therefore desktop-only — on Android we skip the capture entirely and the
    // "שמע את עצמך" button (gated on the recording URL) simply never shows, exactly
    // like Word Journey's say-word stage (which already routes through the
    // Android-gated useMicPlayback hook). See src/lib/platform.ts.
    if (isAndroid()) return
    if (!('mediaDevices' in navigator) || typeof MediaRecorder === 'undefined') {
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const rec = new MediaRecorder(stream)
      mediaChunksRef.current = []
      rec.addEventListener('dataavailable', (ev) => {
        if (ev.data && ev.data.size > 0) mediaChunksRef.current.push(ev.data)
      })
      mediaRecorderRef.current = rec
      rec.start()
    } catch {
      // Mic permission denied or not available — recognition still runs, just
      // no playback. Don't throw; recognition handles its own permission UX.
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
    }
  }, [])

  const releaseRecordingUrl = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current)
      recordingUrlRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    hardResetSpeech()
    cancelSpeech()
    releaseRecordingUrl()
    // Practice sessions are never persisted (legacy parity), so begin is always
    // fresh — no resume index/score to restore.
    const result = beginPracticeSession()
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('awaiting')
      isActiveRef.current = true
      autoPlayedRef.current = false
    } else {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('idle')
      isActiveRef.current = false
      autoPlayedRef.current = false
    }
    setFeedback(null)
    setComparison(null)
    setRecordError(null)
  }, [releaseRecordingUrl])

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() &&
        !!app &&
        !!app.userProgress &&
        typeof app.userProgress.learnedWords === 'object' &&
        !!(window as any).speechManager
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
      if (advanceTimer.current) {
        window.clearTimeout(advanceTimer.current)
        advanceTimer.current = null
      }
      if (isCurrentlyRecording()) {
        void stopPronunciationRecording()
      }
      void stopMediaCapture()
      releaseRecordingUrl()
      if (isActiveRef.current) {
        abortPracticeSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [releaseRecordingUrl, start, stopMediaCapture])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: PracticeQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  const playWord = useCallback(
    (allowOverlap = false) => {
      if (!current) return
      void speakWord(current.word.toLowerCase(), 'practice', { allowOverlap })
    },
    [current],
  )

  // Auto-play the target word when a fresh question appears.
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
        playWord(true)
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
  }, [current, phase, playWord])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (isCurrentlyRecording()) {
      void stopPronunciationRecording()
    }
    void stopMediaCapture()
    releaseRecordingUrl()
    if (isActiveRef.current) {
      abortPracticeSession()
      isActiveRef.current = false
    }
    start()
  }, [releaseRecordingUrl, start, stopMediaCapture])

  const advance = useCallback(() => {
    cancelSpeech()
    releaseRecordingUrl()
    setFeedback(null)
    setComparison(null)
    setRecordError(null)
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishPracticeSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [total])

  const handleRecordToggle = useCallback(async () => {
    if (!current) return
    if (!recognitionSupported) {
      setRecordError('זיהוי דיבור אינו נתמך בדפדפן הזה.')
      return
    }
    if (phase === 'recording' && isCurrentlyRecording()) {
      try {
        await stopPronunciationRecording()
      } catch {
        /* ignore */
      }
      return
    }
    if (phase !== 'awaiting') return

    setRecordError(null)
    setComparison(null)
    releaseRecordingUrl()
    cancelSpeech()
    await new Promise((r) => setTimeout(r, 100))

    setPhase('recording')
    // Start MediaRecorder side-by-side with recognition so we can replay
    // the kid's voice. Failure here is silent — recognition still drives the
    // scoring outcome.
    await startMediaCapture()
    let result: { transcript: string; confidence: number }
    try {
      result = await startPronunciationRecording()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      void stopMediaCapture()
      setPhase('awaiting')
      if (msg === 'RECORDING_CANCELLED') {
        return
      }
      setRecordError(msg || 'הקלטה נכשלה.')
      return
    }

    const recordingUrl = await stopMediaCapture()
    recordingUrlRef.current = recordingUrl
    const outcome = recordPracticeAttempt(current, result)
    setComparison({
      target: current.word,
      transcript: outcome.transcript || '(לא זוהה)',
      accuracy: outcome.accuracy,
      isCorrect: outcome.isCorrect,
      recordingUrl,
    })
    setFeedback({
      variant: outcome.isCorrect ? 'correct' : 'incorrect',
      text: outcome.feedback,
    })
    setPhase('answered')

    playAnswerSfx(outcome.isCorrect ? 'correct' : 'incorrect')

    if (outcome.isCorrect) {
      setScore((s) => s + outcome.pointsAwarded)
      setCorrect((c) => c + 1)
      if (getShowConfetti()) triggerConfetti('practice')
      ;(async () => {
        try {
          if (outcome.audioFeedback) await speak(outcome.audioFeedback)
        } catch {
          /* ignore */
        }
      })()
      // No auto-advance on correct: leave the result up so the child can
      // replay the word / hear themselves and tap "next" when ready.
    } else {
      ;(async () => {
        try {
          if (outcome.audioFeedback) await speak(outcome.audioFeedback)
          await new Promise((r) => setTimeout(r, 400))
          await speakWord(current.word.toLowerCase(), 'practice')
        } catch {
          /* ignore */
        }
      })()
    }
  }, [
    current,
    phase,
    recognitionSupported,
    releaseRecordingUrl,
    startMediaCapture,
    stopMediaCapture,
  ])

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
    if (isCurrentlyRecording()) {
      void stopPronunciationRecording()
    }
    void stopMediaCapture()
    releaseRecordingUrl()
    if (isActiveRef.current) {
      abortPracticeSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate, releaseRecordingUrl, stopMediaCapture])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'תרגול',
      gameId: 'practice',
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

  if (session.kind === 'learn-first') {
    return (
      <GameScreenShell header={{ ...headerProps, onBack: () => navigate('/home') }}>
        <PracticeEmpty learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const promptWordRaw = current
    ? caseMode === 'lowercase'
      ? current.word.toLowerCase()
      : current.word.toUpperCase()
    : undefined
  const promptWord = promptWordRaw
    ? showNikud
      ? promptWordRaw
      : stripNikud(promptWordRaw)
    : undefined
  const promptHebrew = current?.hebrew
    ? showNikud
      ? current.hebrew
      : stripNikud(current.hebrew)
    : undefined

  const isRecordingPhase = phase === 'recording'
  const recordDisabled = phase === 'answered' && comparison
    ? true
    : !recognitionSupported

  const footer =
    phase === 'answered' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="practice-next"
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
            <MediaPromptCard
              prompt="הקשב, לחץ על המיקרופון וחזור על המילה כדי לחזק אותה"
              media={<PromptPicture question={current} />}
              word={promptWord}
              translation={promptHebrew}
              onPlayAudio={() => playWord(false)}
              audioDisabled={isRecordingPhase}
              audioLabel="השמע מילה"
              audioIconOnly
            />

            {phase === 'answered' && comparison ? null : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => void handleRecordToggle()}
                disabled={recordDisabled}
                data-testid="practice-record"
                data-recording={isRecordingPhase ? 'true' : 'false'}
                aria-label={isRecordingPhase ? 'עצור הקלטה' : 'התחל הקלטה'}
                className={cn(
                  'flex size-20 items-center justify-center rounded-full font-bold text-white shadow-lg transition',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isRecordingPhase
                    ? 'bg-gradient-to-br from-rose-500 to-rose-700 animate-pulse'
                    : 'bg-gradient-to-br from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] hover:brightness-110',
                )}
              >
                {isRecordingPhase ? (
                  <MicOff className="size-8" aria-hidden />
                ) : (
                  <Mic className="size-8" aria-hidden />
                )}
              </button>
              <p
                data-testid="practice-status"
                dir="rtl"
                className="text-sm font-medium text-[color:var(--slate-300)] sm:text-base"
              >
                {nk(
                  isRecordingPhase
                    ? 'מקליט… לחץ שוב לעצירה'
                    : phase === 'answered'
                      ? 'התוצאות מוכנות'
                      : recognitionSupported
                        ? 'לחץ על המיקרופון והגד את המילה'
                        : 'הדפדפן אינו תומך בזיהוי דיבור',
                )}
              </p>
              {recordError ? (
                <p
                  data-testid="practice-error"
                  dir="rtl"
                  className="max-w-md text-center text-sm font-medium text-rose-300"
                >
                  {nk(recordError)}
                </p>
              ) : null}
            </div>
            )}

            {phase === 'answered' && comparison ? (
              <section
                data-testid="practice-comparison"
                className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)] p-4 shadow-lg"
              >
                <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
                  <span>{showNikud ? 'צָרִיךְ לוֹמַר' : 'צריך לומר'}</span>
                  <span
                    dir="ltr"
                    className="font-display text-lg font-bold text-white"
                    data-testid="practice-target"
                  >
                    {caseMode === 'lowercase'
                      ? comparison.target.toLowerCase()
                      : comparison.target.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
                  <span>{nk('אמרת')}</span>
                  <span
                    dir="ltr"
                    data-testid="practice-transcript"
                    className={cn(
                      'font-display text-lg font-bold',
                      comparison.isCorrect ? 'text-emerald-300' : 'text-rose-300',
                    )}
                  >
                    {comparison.transcript}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
                  <span>{nk('דיוק')}</span>
                  <span
                    data-testid="practice-accuracy"
                    dir="ltr"
                    className="font-display text-lg font-bold text-[color:var(--amber-400)]"
                  >
                    {Math.round(comparison.accuracy * 100)}%
                  </span>
                </div>
                {/* Issue #41: the in-panel "השמע שוב" was a duplicate of the
                    prompt card's speaker (same playWord), so it's removed. Only the
                    unique "שמע את עצמך" replay (when a recording exists) remains. */}
                {phase === 'answered' && comparison.recordingUrl ? (
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!comparison.recordingUrl) return
                        cancelSpeech()
                        const audio = new Audio(comparison.recordingUrl)
                        audio.play().catch(() => {})
                      }}
                      data-testid="practice-hear-self"
                      aria-label="שמע את עצמך"
                      className="flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-white/15"
                    >
                      <Mic className="size-4" aria-hidden />
                      {nk('שמע את עצמך')}
                    </button>
                  </div>
                ) : null}
              </section>
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
        onPlayAgain={() => start()}
        onExit={() => navigate('/home')}
      />
    </>
  )
}
