import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { TrueOrNotLearnFirst } from './components/TrueOrNotLearnFirst'
import {
  abortTrueOrNotSession,
  beginTrueOrNotSession,
  clearTrueOrNotAudioState,
  finishTrueOrNotSession,
  loadTrueOrNotAudioState,
  recordTrueOrNotAnswer,
  saveTrueOrNotAudioState,
  type TrueOrNotQuestion,
  type TrueOrNotSessionResult,
} from '@/bridge/true-or-not'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { getActiveCourseSession, clearCourseSession } from '@/bridge/courseSession'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500

function DisplayedPicture({
  question,
}: {
  question: TrueOrNotQuestion
}) {
  // The displayed image may belong to a different word (mismatch round). Look
  // up overrides by the displayed image's identity, not the prompted word —
  // otherwise mismatch rounds would render the prompt's image under an
  // override and give the answer away.
  const overrides =
    ((window as any).wordImageOverrides as Record<string, string> | undefined) ?? {}
  const displayUrl = question.displayImageUrl
  // For the mismatch case we don't know which word's override to consult (the
  // bridge stores the imageUrl directly), so just trust displayImageUrl as-is.
  const effectiveUrl =
    displayUrl ?? (question.isMatch ? overrides[`${question.category}:${question.word}`] : undefined)
  if (effectiveUrl) {
    return (
      <img
        src={effectiveUrl}
        alt=""
        className="word-image max-h-40 rounded-2xl object-contain"
      />
    )
  }
  return (
    <span className="text-6xl" role="img" aria-label="">
      {question.displayPicture || '🔤'}
    </span>
  )
}

export function TrueOrNotGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<TrueOrNotSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  // No reveal gate — the prompt word + image are visible immediately, just
  // like legacy True-or-Not. We still track plays for the per-question audio
  // budget so refresh doesn't grant unlimited replays.
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    if (opts?.fresh) clearTrueOrNotAudioState()
    const result = beginTrueOrNotSession(opts ?? {})
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
      const restored = loadTrueOrNotAudioState(result.resumeIndex)
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
    setSelectedIndex(null)
    setFeedback(null)
  }, [])

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
        typeof app.userProgress.learnedWords === 'object'
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
      if (isActiveRef.current) {
        abortTrueOrNotSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  useEffect(() => {
    if (phase !== 'awaiting' && phase !== 'answered') return
    saveTrueOrNotAudioState({
      questionIndex: index,
      playsSoFar: autoPlayedRef.current ? 1 : 0,
      audioPlaysLeft,
    })
  }, [audioPlaysLeft, index, phase])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: TrueOrNotQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  const playWord = useCallback(() => {
    if (!current) return
    if (audioPlaysLeft <= 0) return
    setAudioPlaysLeft((n) => Math.max(0, n - 1))
    void speakWord(current.word, 'true-or-not')
  }, [audioPlaysLeft, current])

  useEffect(() => {
    if (!current) return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      void speakWord(current.word, 'true-or-not', { allowOverlap: true })
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
  }, [current])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (isActiveRef.current) {
      abortTrueOrNotSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [start])

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    clearTrueOrNotAudioState()
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishTrueOrNotSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [total])

  const handleAnswer = useCallback(
    (selected: number) => {
      if (!current || phase !== 'awaiting') return
      setSelectedIndex(selected)
      const outcome = recordTrueOrNotAnswer(current, selected)
      const fb = getGameFeedback(
        'true-or-not',
        outcome.isCorrect ? 'correct' : 'incorrect',
      )
      setFeedback({
        variant: outcome.isCorrect ? 'correct' : 'incorrect',
        text: fb.text,
      })
      setPhase('answered')
      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
      }
      if (fb.audio) void speak(fb.audio)
      if (outcome.isCorrect) {
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
        advanceTimer.current = window.setTimeout(() => {
          advanceTimer.current = null
          advance()
        }, ADVANCE_DELAY_MS)
      }
    },
    [advance, current, phase],
  )

  const handleNextAfterIncorrect = useCallback(() => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    advance()
  }, [advance])

  const requestExit = useCallback(() => setExitOpen(true), [])

  // Route back to /courses (clearing the legacy course context) when launched from the
  // Courses page; otherwise home. Read at call time to avoid a stale closure.
  const goExit = useCallback(() => {
    const cs = getActiveCourseSession()
    if (cs) {
      clearCourseSession()
      navigate(cs.returnTo)
    } else {
      navigate('/home')
    }
  }, [navigate])

  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortTrueOrNotSession()
      isActiveRef.current = false
    }
    goExit()
  }, [goExit])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'נכון או לא?',
      icon: '✅',
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
      <GameScreenShell header={headerProps}>
        <TrueOrNotLearnFirst learnedCount={session.learnedCount} />
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
  const answerOptions = current
    ? [
        { key: 'yes', label: '✓ כן', ariaLabel: 'כן, מתאים' },
        { key: 'no', label: '✗ לא', ariaLabel: 'לא, לא מתאים' },
      ]
    : []

  const audioHint =
    audioPlaysLeft <= 0 ? 'נגמרו ההשמעות' : `השמעות נותרו: ${audioPlaysLeft}`

  const footer =
    phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="true-or-not-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        {nk('השאלה הבאה')}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div className="flex flex-1 flex-col gap-4">
            <MediaPromptCard
              prompt="האם התמונה מתאימה למילה?"
              word={promptWord}
              media={<DisplayedPicture question={current} />}
              onPlayAudio={playWord}
              audioDisabled={audioPlaysLeft <= 0}
              audioLabel="השמע מילה"
              audioIconOnly
              audioHint={audioHint}
            />
            <AnswerGrid
              options={answerOptions}
              onSelect={handleAnswer}
              selectedIndex={selectedIndex}
              correctIndex={current.correct}
              revealed={phase === 'answered'}
              columns={2}
              autoFocusFirst
            />
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
        onExit={goExit}
      />
    </>
  )
}
