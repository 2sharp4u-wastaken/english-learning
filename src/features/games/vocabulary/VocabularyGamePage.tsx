import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { getActiveCourseSession, clearCourseSession } from '@/bridge/courseSession'
import { VocabularyLearnFirst } from './components/VocabularyLearnFirst'
import {
  abortVocabularySession,
  beginVocabularySession,
  clearVocabAudioState,
  finishVocabularySession,
  loadVocabAudioState,
  recordVocabularyAnswer,
  saveVocabAudioState,
  type VocabularyQuestion,
  type VocabularySessionResult,
} from '@/bridge/vocabulary'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500
const REQUIRED_PLAYS_BEFORE_REVEAL = 3

export function VocabularyGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<VocabularySessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  // Audio gate: hide options until the player hears the word
  // REQUIRED_PLAYS_BEFORE_REVEAL times (matches legacy vocab pre-V2 gate).
  const [playsSoFar, setPlaysSoFar] = useState(0)
  // Per-question audio plays budget from settings.audioPlaysAllowed.
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    if (opts?.fresh) clearVocabAudioState()
    const result = beginVocabularySession(opts ?? {})
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
      // Restore per-question audio counters if this is a resume of the same
      // question. Otherwise start fresh.
      const restored = loadVocabAudioState(result.resumeIndex)
      const settingsBudget = getSettings().audioPlaysAllowed ?? 8
      if (restored) {
        setPlaysSoFar(restored.playsSoFar)
        setAudioPlaysLeft(restored.audioPlaysLeft)
        // Resumed mid-question — the user already heard the word in the
        // previous session. Suppress the auto-play so a refresh can't be used
        // to cheat through the gate by silently bumping playsSoFar past the
        // threshold (Chrome blocks autoplay after a hard refresh anyway).
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
    // Legacy app.js initializes `window.app.userProgress` (and
    // `gameManager.progressManager`) asynchronously after page load. If React
    // mounts before that finishes — typical on a hard refresh of /game/* —
    // V2 gating reads `learnedWords = {}` and incorrectly flashes the
    // "learn-first" empty state. Poll briefly until the legacy state is
    // ready, then start the session.
    let cancelled = false
    let attempts = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() &&
        !!app &&
        !!app.userProgress &&
        // app.userProgress is set early; learnedWords is the field V2 gating
        // actually consults — wait for it specifically.
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
        abortVocabularySession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  // Persist per-question audio counters so a refresh doesn't reset them
  // (otherwise the user could refresh to get unlimited plays + auto-reveal).
  useEffect(() => {
    if (phase !== 'awaiting' && phase !== 'answered') return
    saveVocabAudioState({
      questionIndex: index,
      playsSoFar,
      audioPlaysLeft,
    })
  }, [audioPlaysLeft, index, phase, playsSoFar])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: VocabularyQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]
  const optionsHidden = playsSoFar < REQUIRED_PLAYS_BEFORE_REVEAL

  const playWord = useCallback(
    (countTowardGate: boolean) => {
      if (!current) return
      // Budget accounts for ALL plays on this question (gate + voluntary).
      // settings.audioPlaysAllowed is the total per-question ceiling. Gate
      // plays are mandatory and always go through, even if the budget is
      // already at 0 from a misconfigured setting (audioPlaysAllowed < 3).
      const gateActive = playsSoFar < REQUIRED_PLAYS_BEFORE_REVEAL
      if (!gateActive && audioPlaysLeft <= 0) return
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      if (countTowardGate) setPlaysSoFar((n) => n + 1)
      void speakWord(current.word, 'vocabulary')
    },
    [audioPlaysLeft, current, playsSoFar],
  )

  // Auto-play on each new question; counts toward the reveal gate.
  //
  // `allowOverlap: true` bypasses legacy speech queue's `pending` short-circuit
  // (legacy speak() returns immediately if `synthesis.pending` is true, which
  // can linger after the post-answer feedback utterance and silently swallow
  // the next question's auto-play). Manual play button keeps the default so
  // rapid taps don't pile up.
  //
  // Voice readiness: `speechManager.selectVoices()` targets "Google UK English
  // Male", which Chrome loads asynchronously via `onvoiceschanged`. If we
  // fire too early, Chrome substitutes whatever en-* voice is already loaded
  // and the word sounds different from later plays. Poll briefly until the
  // target voice (or any voice) is available before kicking off the
  // utterance — capped so a missing voice never blocks the game.
  useEffect(() => {
    if (!current) return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      // First play of a fresh question consumes a budget slot and counts
      // toward the audio gate.
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      setPlaysSoFar((n) => n + 1)
      void speakWord(current.word, 'vocabulary', { allowOverlap: true })
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
      abortVocabularySession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [start])

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setPlaysSoFar(0)
    setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    clearVocabAudioState()
    autoPlayedRef.current = false
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
      if (!current || phase !== 'awaiting' || optionsHidden) return
      setSelectedIndex(selected)
      const outcome = recordVocabularyAnswer(current, selected)
      const fb = getGameFeedback('vocabulary', outcome.isCorrect ? 'correct' : 'incorrect')
      setFeedback({ variant: outcome.isCorrect ? 'correct' : 'incorrect', text: fb.text })
      setPhase('answered')
      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti('vocabulary')
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
      abortVocabularySession()
      isActiveRef.current = false
    }
    goExit()
  }, [goExit])

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
        <VocabularyLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const answerOptions = current
    ? current.options.map((label, i) => ({
        key: i,
        label: showNikud ? label : stripNikud(label),
      }))
    : []
  const displayedWord = current
    ? caseMode === 'lowercase'
      ? current.word.toLowerCase()
      : current.word.toUpperCase()
    : ''

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
        data-testid="vocabulary-next"
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
              word={displayedWord}
              onPlayAudio={handleManualPlay}
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
        onExit={goExit}
      />
    </>
  )
}
