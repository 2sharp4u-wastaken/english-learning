import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import {
  abortGrammarBeginnerSession,
  beginGrammarBeginnerSession,
  finishGrammarBeginnerSession,
  recordGrammarBeginnerAnswer,
  type GrammarBeginnerQuestion,
  type GrammarBeginnerSessionResult,
} from '@/bridge/grammar-beginner'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { WhoSaysItView } from './components/WhoSaysItView'
import { CompleteSoundView } from './components/CompleteSoundView'
import { SoundsRightView } from './components/SoundsRightView'
import { MatchPictureView } from './components/MatchPictureView'
import { cn } from '@/lib/cn'
import { useNikud } from '@/bridge/nikud'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const GAME_CONTEXT = 'grammar-beginner'

export function GrammarBeginnerGamePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<GrammarBeginnerSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  const isActiveRef = useRef(false)
  const autoPlayTimerRef = useRef<number | null>(null)

  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current != null) {
      window.clearTimeout(autoPlayTimerRef.current)
      autoPlayTimerRef.current = null
    }
  }, [])

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginGrammarBeginnerSession(opts ?? {})
    setSession(result)
    setFeedback(null)
    setSelected(null)
    setIndex(result.resumeIndex)
    setScore(result.resumeScore)
    setCorrect(Math.floor(result.resumeScore / 10))
    setPhase('awaiting')
    isActiveRef.current = true
  }, [])

  useEffect(() => {
    let cancelled = false
    let attemptsCount = 0
    const tryStart = () => {
      if (cancelled) return
      const w = window as any
      const ready = !!w.gameManager && !!w.app && !!w.app.userProgress
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
      clearAutoPlayTimer()
      if (isActiveRef.current) {
        abortGrammarBeginnerSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [clearAutoPlayTimer, start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: GrammarBeginnerQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  // ─── Auto-play on each new question ───────────────────────────────────────
  const autoPlay = useCallback((q: GrammarBeginnerQuestion) => {
    if (q.type === 'who-says-it' || q.type === 'match-picture') {
      void speak(q.sentenceAudio)
    } else if (q.type === 'complete-sound') {
      void (async () => {
        await speakWord(q.subjectAudio, GAME_CONTEXT)
        await new Promise((r) => window.setTimeout(r, 500))
        await speakWord(q.predicate.word, GAME_CONTEXT)
      })()
    }
    // 'sounds-right' has no auto-play (legacy parity)
  }, [])

  useEffect(() => {
    if (!current || phase !== 'awaiting') return
    setSelected(null)
    setFeedback(null)
    clearAutoPlayTimer()
    autoPlayTimerRef.current = window.setTimeout(() => autoPlay(current), 300)
    return () => clearAutoPlayTimer()
  }, [autoPlay, clearAutoPlayTimer, current, index, phase])

  // ─── Per-view audio handlers ──────────────────────────────────────────────
  const playSentence = useCallback((text: string) => {
    void speak(text)
  }, [])

  const playWhoSaysIt = useCallback(() => {
    if (current?.type === 'who-says-it' || current?.type === 'match-picture') {
      void speak(current.sentenceAudio)
    }
  }, [current])

  const playCompleteSoundContext = useCallback(async () => {
    if (current?.type !== 'complete-sound') return
    await speakWord(current.subjectAudio, GAME_CONTEXT)
    await new Promise((r) => window.setTimeout(r, 500))
    await speakWord(current.predicate.word, GAME_CONTEXT)
  }, [current])

  const playVerb = useCallback((verb: string) => {
    void speakWord(verb, GAME_CONTEXT)
  }, [])

  // ─── Answer submission ────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (answerKey: string) => {
      if (!current || phase !== 'awaiting') return
      setSelected(answerKey)
      setPhase('answered')

      const outcome = recordGrammarBeginnerAnswer(current, answerKey, 0)
      const fb = getGameFeedback(
        GAME_CONTEXT,
        outcome.isCorrect ? 'correct' : 'incorrect',
      )
      setFeedback({
        variant: outcome.isCorrect ? 'correct' : 'incorrect',
        text: fb.text,
      })

      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
      }

      // Play the correct sentence (the Hebrew reveal is rendered inside each
      // view's card, gated on `locked`).
      const correctSentence =
        current.type === 'complete-sound'
          ? current.fullSentence
          : current.sentenceAudio || current.correctAnswer
      if (correctSentence) void speak(correctSentence)
    },
    [current, phase],
  )

  const handleNext = useCallback(() => {
    clearAutoPlayTimer()
    cancelSpeech()
    setFeedback(null)
    setSelected(null)
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishGrammarBeginnerSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [clearAutoPlayTimer, total])

  const handleReset = useCallback(() => {
    if (
      !window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')
    ) {
      return
    }
    clearAutoPlayTimer()
    if (isActiveRef.current) {
      abortGrammarBeginnerSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [clearAutoPlayTimer, start])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    clearAutoPlayTimer()
    if (isActiveRef.current) {
      abortGrammarBeginnerSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [clearAutoPlayTimer, navigate])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'דקדוק למתחילים',
      icon: '🔊',
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

  const locked = phase !== 'awaiting'

  const footer =
    phase === 'answered' ? (
      <button
        type="button"
        onClick={handleNext}
        data-testid="gb-next"
        className={cn(
          'mx-auto block rounded-full px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition',
          'bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] hover:brightness-110',
        )}
      >
        {nk('השאלה הבאה')}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div key={index} className="flex flex-1 flex-col gap-4">
            {current.type === 'who-says-it' && (
              <WhoSaysItView
                question={current}
                selectedKey={selected}
                locked={locked}
                onPlay={playWhoSaysIt}
                onSelect={handleSelect}
              />
            )}
            {current.type === 'complete-sound' && (
              <CompleteSoundView
                question={current}
                selectedKey={selected}
                locked={locked}
                onPlayContext={() => void playCompleteSoundContext()}
                onPlayVerb={playVerb}
                onSelect={handleSelect}
              />
            )}
            {current.type === 'sounds-right' && (
              <SoundsRightView
                question={current}
                selectedKey={selected}
                locked={locked}
                onPlaySentence={playSentence}
                onSelect={handleSelect}
              />
            )}
            {current.type === 'match-picture' && (
              <MatchPictureView
                question={current}
                selectedKey={selected}
                locked={locked}
                onPlay={playWhoSaysIt}
                onSelect={handleSelect}
              />
            )}
          </div>
        ) : null}
      </GameScreenShell>
      {feedback ? (
        <FeedbackBanner variant={feedback.variant} message={feedback.text} visible />
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
