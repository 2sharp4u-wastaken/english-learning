import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { ListeningLearnFirst } from './components/ListeningLearnFirst'
import {
  abortListeningSession,
  beginListeningSession,
  clearListeningAudioState,
  finishListeningSession,
  loadListeningAudioState,
  recordListeningAnswer,
  saveListeningAudioState,
  type ListeningQuestion,
  type ListeningSessionResult,
} from '@/bridge/listening'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500
// Listening reveals options after the first play (the auto-play). Legacy
// `games/listening-game.js` reveals immediately after the auto-play utterance
// completes — keep that "1 mandatory play" model rather than vocab's 3-play
// reveal gate so the audio-first UX is preserved.
const REQUIRED_PLAYS_BEFORE_REVEAL = 1

function PromptMedia({ question }: { question: ListeningQuestion }) {
  const overrides =
    ((window as any).wordImageOverrides as Record<string, string> | undefined) ?? {}
  const overrideKey = `${question.category}:${question.word}`
  const effectiveImageUrl =
    overrides[overrideKey] || question.imageUrl || question.image
  if (effectiveImageUrl) {
    return (
      <img
        src={effectiveImageUrl}
        alt={question.word || 'word'}
        className="word-image max-h-40 rounded-2xl object-contain"
      />
    )
  }
  return (
    <span className="text-6xl" role="img" aria-label={question.word}>
      {question.picture || '🔤'}
    </span>
  )
}

export function ListeningGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const [session, setSession] = useState<ListeningSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [playsSoFar, setPlaysSoFar] = useState(0)
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    if (opts?.fresh) clearListeningAudioState()
    const result = beginListeningSession(opts ?? {})
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
      const restored = loadListeningAudioState(result.resumeIndex)
      const settingsBudget = getSettings().audioPlaysAllowed ?? 8
      if (restored) {
        setPlaysSoFar(restored.playsSoFar)
        setAudioPlaysLeft(restored.audioPlaysLeft)
        autoPlayedRef.current = true
      } else {
        setPlaysSoFar(0)
        setAudioPlaysLeft(settingsBudget)
        autoPlayedRef.current = false
      }
    } else {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('idle')
      isActiveRef.current = false
      setPlaysSoFar(0)
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
      const w = window as any
      const ready =
        !!w.gameManager &&
        !!w.app &&
        !!w.app.userProgress &&
        typeof w.app.userProgress.learnedWords === 'object'
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
        abortListeningSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  useEffect(() => {
    if (phase !== 'awaiting' && phase !== 'answered') return
    saveListeningAudioState({
      questionIndex: index,
      playsSoFar,
      audioPlaysLeft,
    })
  }, [audioPlaysLeft, index, phase, playsSoFar])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: ListeningQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]
  const optionsHidden = playsSoFar < REQUIRED_PLAYS_BEFORE_REVEAL

  const playWord = useCallback(
    (countTowardGate: boolean) => {
      if (!current) return
      const gateActive = playsSoFar < REQUIRED_PLAYS_BEFORE_REVEAL
      if (!gateActive && audioPlaysLeft <= 0) return
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      if (countTowardGate) setPlaysSoFar((n) => n + 1)
      void speakWord(current.word, 'listening')
    },
    [audioPlaysLeft, current, playsSoFar],
  )

  useEffect(() => {
    if (!current) return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      setPlaysSoFar((n) => n + 1)
      void speakWord(current.word, 'listening', { allowOverlap: true })
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

  const handleManualPlay = useCallback(() => {
    playWord(true)
  }, [playWord])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (isActiveRef.current) {
      abortListeningSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [start])

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setPlaysSoFar(0)
    setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    clearListeningAudioState()
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishListeningSession()
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
      if (!current || phase !== 'awaiting' || optionsHidden) return
      setSelectedIndex(selected)
      const outcome = recordListeningAnswer(current, selected)
      const fb = getGameFeedback('listening', outcome.isCorrect ? 'correct' : 'incorrect')
      setFeedback({ variant: outcome.isCorrect ? 'correct' : 'incorrect', text: fb.text })
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
    [advance, current, optionsHidden, phase],
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
      abortListeningSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'האזנה',
      icon: '🎧',
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
        <ListeningLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  // Option labels are English words — apply caseMode like vocab applies it to
  // the prompt word. Nikud strip is a no-op for English but harmless.
  const answerOptions = current
    ? current.options.map((label, i) => {
        const cased = caseMode === 'lowercase' ? label.toLowerCase() : label
        return {
          key: i,
          label: showNikud ? cased : stripNikud(cased),
        }
      })
    : []
  const translation = current?.hebrew || current?.translation || ''

  const clicksLeftToReveal = Math.max(
    0,
    REQUIRED_PLAYS_BEFORE_REVEAL - playsSoFar,
  )
  const audioHint =
    optionsHidden && clicksLeftToReveal > 0
      ? `השמע עוד ${clicksLeftToReveal} ${clicksLeftToReveal === 1 ? 'פעם' : 'פעמים'}`
      : audioPlaysLeft <= 0
        ? 'נגמרו ההשמעות'
        : `השמעות נותרו: ${audioPlaysLeft}`

  const footer =
    phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="listening-next"
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
              prompt="האזן ובחר את המילה הנכונה"
              media={<PromptMedia question={current} />}
              translation={translation}
              onPlayAudio={handleManualPlay}
              audioDisabled={audioPlaysLeft <= 0 && playsSoFar >= REQUIRED_PLAYS_BEFORE_REVEAL}
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
              hidden={optionsHidden}
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
        onExit={() => navigate('/home')}
      />
    </>
  )
}
