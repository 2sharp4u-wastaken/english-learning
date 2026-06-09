import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { StoryReadPhase } from './components/StoryReadPhase'
import { StoryQuizPhase } from './components/StoryQuizPhase'
import { StoryTimeLearnFirst } from './components/StoryTimeLearnFirst'
import {
  abortStoryTimeSession,
  beginStoryTimeSession,
  finishStoryTimeSession,
  recordStoryQuizAnswer,
  type Story,
  type StoryTimeSessionResult,
} from '@/bridge/story-time'
import { cancelSpeech, hardResetSpeech, speak } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'

type Phase = 'read' | 'quiz' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500

export function StoryTimeGamePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<StoryTimeSessionResult | null>(null)
  const [storyIndex, setStoryIndex] = useState(0)
  const [quizIndex, setQuizIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('read')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [exitOpen, setExitOpen] = useState(false)
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)

  const start = useCallback(() => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginStoryTimeSession()
    setSession(result)
    setStoryIndex(0)
    setQuizIndex(0)
    setPhase('read')
    setSelectedIndex(null)
    setFeedback(null)
    setScore(0)
    setCorrect(0)
    setAnswered(0)
    if (result.kind === 'ready') {
      isActiveRef.current = true
    } else {
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
        abortStoryTimeSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  const stories: Story[] = session?.kind === 'ready' ? session.stories : []
  const totalQuiz = session?.kind === 'ready' ? session.totalQuizQuestions : 0
  const currentStory: Story | null = stories[storyIndex] ?? null
  const currentQuestion = currentStory?.questions[quizIndex] ?? null

  // Speak the English question aloud as the child reads the Hebrew one.
  useEffect(() => {
    if (phase !== 'quiz' || !currentQuestion?.questionEn) return
    const id = window.setTimeout(() => {
      void speak(currentQuestion.questionEn as string).catch(() => {})
    }, 300)
    return () => window.clearTimeout(id)
  }, [phase, currentQuestion])

  const handleReadyForQuiz = useCallback(() => {
    cancelSpeech()
    setPhase('quiz')
    setSelectedIndex(null)
    setFeedback(null)
  }, [])

  const finishSession = useCallback(() => {
    if (isActiveRef.current) {
      finishStoryTimeSession()
      isActiveRef.current = false
    }
    setPhase('finished')
  }, [])

  const advanceAfterAnswer = useCallback(() => {
    setSelectedIndex(null)
    setFeedback(null)

    if (!currentStory) return

    const moreInStory = quizIndex + 1 < currentStory.questions.length
    if (moreInStory) {
      setQuizIndex((i) => i + 1)
      setPhase('quiz')
      return
    }

    const moreStories = storyIndex + 1 < stories.length
    if (moreStories) {
      setStoryIndex((i) => i + 1)
      setQuizIndex(0)
      setPhase('read')
      return
    }

    finishSession()
  }, [currentStory, finishSession, quizIndex, stories.length, storyIndex])

  const handleQuizSelect = useCallback(
    (selected: number) => {
      if (!currentStory || !currentQuestion || phase !== 'quiz') return
      setSelectedIndex(selected)
      const outcome = recordStoryQuizAnswer(currentStory, currentQuestion, selected)
      const fb = getGameFeedback(
        'story-time',
        outcome.isCorrect ? 'correct' : 'incorrect',
      )
      setFeedback({
        variant: outcome.isCorrect ? 'correct' : 'incorrect',
        text: fb.text,
      })
      setPhase('answered')
      setAnswered((n) => n + 1)
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
          advanceAfterAnswer()
        }, ADVANCE_DELAY_MS)
      }
    },
    [advanceAfterAnswer, currentQuestion, currentStory, phase],
  )

  const handleNextAfterIncorrect = useCallback(() => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    advanceAfterAnswer()
  }, [advanceAfterAnswer])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (isActiveRef.current) {
      abortStoryTimeSession()
      isActiveRef.current = false
    }
    start()
  }, [start])

  const requestExit = useCallback(() => setExitOpen(true), [])

  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortStoryTimeSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'זמן סיפור',
      icon: '📖',
      score,
      onBack: requestExit,
    }),
    [requestExit, score],
  )

  const progressProps = useMemo(
    () => ({
      current: phase === 'finished' ? totalQuiz : Math.min(answered + 1, totalQuiz || 1),
      total: totalQuiz || 1,
      onReset: handleReset,
    }),
    [answered, handleReset, phase, totalQuiz],
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

  if (session.kind === 'learn-first') {
    return (
      <GameScreenShell header={{ ...headerProps, onBack: () => navigate('/home') }}>
        <StoryTimeLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const showQuiz = phase === 'quiz' || phase === 'answered'

  const footer =
    phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="story-time-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        {nk('השאלה הבאה')}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {currentStory ? (
          showQuiz && currentQuestion ? (
            <StoryQuizPhase
              story={currentStory}
              question={currentQuestion}
              selectedIndex={selectedIndex}
              revealed={phase === 'answered'}
              onSelect={handleQuizSelect}
            />
          ) : (
            <StoryReadPhase
              story={currentStory}
              storyNumber={storyIndex + 1}
              storyCount={stories.length}
              onReady={handleReadyForQuiz}
            />
          )
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
        total={totalQuiz}
        correct={correct}
        onPlayAgain={() => start()}
        onExit={() => navigate('/home')}
      />
    </>
  )
}
