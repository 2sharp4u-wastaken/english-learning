import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { VocabularyLearnFirst } from './components/VocabularyLearnFirst'
import {
  abortVocabularySession,
  beginVocabularySession,
  finishVocabularySession,
  recordVocabularyAnswer,
  type VocabularyQuestion,
  type VocabularySessionResult,
} from '@/bridge/vocabulary'
import { cancelSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500

export function VocabularyGamePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<VocabularySessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)

  const start = useCallback(() => {
    cancelSpeech()
    const result = beginVocabularySession()
    setSession(result)
    setIndex(0)
    setScore(0)
    setCorrect(0)
    setSelectedIndex(null)
    setFeedback(null)
    setPhase(result.kind === 'ready' ? 'awaiting' : 'idle')
    isActiveRef.current = result.kind === 'ready'
  }, [])

  useEffect(() => {
    start()
    return () => {
      if (advanceTimer.current) {
        window.clearTimeout(advanceTimer.current)
        advanceTimer.current = null
      }
      if (isActiveRef.current) {
        abortVocabularySession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: VocabularyQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  // Auto-play the word audio whenever a fresh question becomes available.
  useEffect(() => {
    if (!current) return
    cancelSpeech()
    speakWord(current.word, 'vocabulary')
  }, [current])

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishVocabularySession()
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
      const outcome = recordVocabularyAnswer(current, selected)
      const fb = getGameFeedback('vocabulary', outcome.isCorrect ? 'correct' : 'incorrect')
      setFeedback({ variant: outcome.isCorrect ? 'correct' : 'incorrect', text: fb.text })
      setPhase('answered')
      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
      }
      if (fb.audio) speak(fb.audio)
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

  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortVocabularySession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'אוצר מילים',
      icon: '📚',
      score,
      onBack: requestExit,
    }),
    [requestExit, score],
  )

  const progressProps = useMemo(
    () => ({
      current: phase === 'finished' ? total : Math.min(index + 1, total || 1),
      total: total || 1,
    }),
    [index, phase, total],
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
        <VocabularyLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const answerOptions = current
    ? current.options.map((label, i) => ({ key: i, label }))
    : []

  const footer =
    phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="vocabulary-next"
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
            <MediaPromptCard word={current.word} />
            <AnswerGrid
              options={answerOptions}
              onSelect={handleAnswer}
              selectedIndex={selectedIndex}
              correctIndex={current.correct}
              revealed={phase === 'answered'}
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
        onPlayAgain={start}
        onExit={() => navigate('/home')}
      />
    </>
  )
}
