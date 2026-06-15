import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { SpellingComparison } from '@/features/games/shared/SpellingComparison'
import { LetterSlots } from '@/features/games/shared/LetterSlots'
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
import { useNikud } from '@/bridge/nikud'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

// Longer than the usual 1.5s so the correct word is fully spoken (praise sound
// then the word itself) before the next question loads.
const ADVANCE_DELAY_MS = 2400
const WORD_REVEAL_MS = 3000

function buildTiles(question: ReadingQuestion): string[] {
  const extras = Array.isArray(question.extraLetters) ? question.extraLetters : []
  const all = [...question.word.split(''), ...extras]
  // Fisher-Yates shuffle (matches legacy reading-game.js).
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
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
        className="word-image max-h-20 rounded-2xl object-contain sm:max-h-24"
      />
    )
  }
  return (
    <span className="text-4xl sm:text-5xl" role="img" aria-label="">
      {question.picture || '🔤'}
    </span>
  )
}

export function ReadingGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<ReadingSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  // Letter-building state (slots live in the shared LetterSlots component; this
  // tracks the built word it reports + a nonce to clear it).
  const [built, setBuilt] = useState('')
  const [clearNonce, setClearNonce] = useState(0)
  const [attempts, setAttempts] = useState(0)
  // English word reveal cycles: visible on each new question / after a wrong
  // answer, then auto-hidden after WORD_REVEAL_MS. Hebrew stays visible.
  const [wordVisible, setWordVisible] = useState(true)
  // Per-question audio budget (mirrors true-or-not — no reveal gate, since
  // the English word + picture serve as exposure).
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  // Sneak peek (F1): child-tapped button re-flashes the hidden word for a short
  // moment, up to a per-question budget. Config is read once per session.
  const sneakPeek = useMemo(() => {
    const s = getSettings()
    return {
      enabled: s.sneakPeekEnabled ?? true,
      durationMs: Math.round((s.sneakPeekDuration ?? 0.5) * 1000),
      budget: s.sneakPeekBudget ?? 3,
    }
  }, [])
  const [peeksLeft, setPeeksLeft] = useState<number>(() => sneakPeek.budget)
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
    setBuilt('')
    setAttempts(0)
    setFeedback(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    let attemptsCount = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() &&
        !!app &&
        !!app.userProgress &&
        typeof app.userProgress.learnedWords === 'object'
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

  // Fresh shuffled tiles per question (slot/used state lives in LetterSlots).
  const tiles = useMemo(() => (current ? buildTiles(current) : []), [current])

  // Reset per-question state when the current question changes.
  useEffect(() => {
    if (!current) return
    setBuilt('')
    setAttempts(0)
    setPeeksLeft(sneakPeek.budget)
    startWordHideTimer()
  }, [current, startWordHideTimer, sneakPeek.budget])

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
    // Lowercase before TTS — all-caps short strings get spelled out as
    // letters by most speech engines (legacy reading-game.js:74).
    void speakWord(current.word.toLowerCase(), 'reading')
  }, [audioPlaysLeft, current])

  // Re-flash the hidden word for a short moment (sneak peek). Only meaningful
  // once the word has auto-hidden and while still building — disabled otherwise.
  const peek = useCallback(() => {
    if (!sneakPeek.enabled) return
    if (phase !== 'awaiting' || wordVisible || peeksLeft <= 0) return
    setPeeksLeft((n) => Math.max(0, n - 1))
    clearWordHideTimer()
    setWordVisible(true)
    wordHideTimer.current = window.setTimeout(() => {
      setWordVisible(false)
      wordHideTimer.current = null
    }, sneakPeek.durationMs)
  }, [clearWordHideTimer, peeksLeft, phase, sneakPeek, wordVisible])

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
      void speakWord(current.word.toLowerCase(), 'reading', { allowOverlap: true })
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

  const handleCheck = useCallback(() => {
    if (!current || phase !== 'awaiting' || built.length === 0) return
    const builtWord = built
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
      // Voice the correct word as positive reinforcement (praise sound first,
      // then the word itself) so the child hears what they just spelled right.
      void (async () => {
        try {
          if (fb.audio) await speak(fb.audio)
          await speakWord(current.word.toLowerCase(), 'reading')
        } catch {
          /* ignore */
        }
      })()
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        advance()
      }, ADVANCE_DELAY_MS)
    } else {
      // Wrong answer: show the letter-by-letter comparison (rendered below) so
      // the child sees which letters were off, replay the word, and re-reveal
      // the English word. Index already advanced in the bridge — Next button
      // (no retry), matching legacy reading-game.js semantics.
      setAttempts((a) => a + 1)
      startWordHideTimer()
      try {
        if (fb.audio) void speak(fb.audio)
        void speakWord(current.word.toLowerCase(), 'reading', { allowOverlap: true })
      } catch {
        /* ignore */
      }
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
          {nk('טוען…')}
        </div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'learn-first') {
    return (
      <GameScreenShell header={{ ...headerProps, onBack: () => navigate('/home') }}>
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

  // Rendered inline under the letter bank (not a pinned footer) so the whole
  // game reads as one compact, top-aligned cluster — no big gap before a
  // bottom-pinned bar. Content fits one screen, so pinning isn't needed.
  const actions =
    phase === 'awaiting' ? (
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-3">
        {sneakPeek.enabled ? (
          <button
            type="button"
            onClick={peek}
            disabled={wordVisible || peeksLeft <= 0}
            data-testid="reading-peek"
            aria-label="הצצה במילה"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden>👁</span>
            {nk('הצצה')}
            <span className="tabular-nums" dir="ltr">
              ({peeksLeft})
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setClearNonce((n) => n + 1)}
          disabled={!canClear}
          data-testid="reading-clear"
          className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nk('נקה')}
        </button>
        <button
          type="button"
          onClick={handleCheck}
          disabled={!canCheck}
          data-testid="reading-check"
          className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nk('בדוק')}
        </button>
      </div>
    ) : phase === 'answered' && feedback?.variant === 'incorrect' ? (
      <button
        type="button"
        onClick={handleNextAfterIncorrect}
        data-testid="reading-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        {nk('השאלה הבאה')}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell
        header={headerProps}
        progress={progressProps}
        prompt={
          current ? (
            <MediaPromptCard
              prompt={showNikud ? 'הַרְכִּיבוּ אֶת הַמִּלָּה' : 'הרכיבו את המילה'}
              media={<ReadingPicture question={current} />}
              word={renderLetter(current.word)}
              wordHidden={!wordVisible}
              translation={promptHebrew || undefined}
              onPlayAudio={playWord}
              audioDisabled={audioPlaysLeft <= 0}
              audioLabel="השמע מילה"
              audioIconOnly
              audioHint={audioHint}
              className="mx-auto w-full max-w-md gap-2 p-4"
            />
          ) : undefined
        }
      >
        {current ? (
          <div className="flex flex-1 flex-col items-center gap-4 pt-1">
            {phase === 'answered' && feedback?.variant === 'incorrect' ? (
              <SpellingComparison
                target={current.word}
                attempt={built}
                caseMode={caseMode}
                showNikud={showNikud}
              />
            ) : (
              <LetterSlots
                target={current.word}
                tiles={tiles}
                caseMode={caseMode}
                result={phase === 'answered' && feedback?.variant === 'correct' ? 'correct' : null}
                disabled={phase !== 'awaiting'}
                resetKey={`${index}:${clearNonce}`}
                onChange={setBuilt}
                onPlaceLetter={(l) => void speak(l.toLowerCase())}
              />
            )}

            {actions}
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
