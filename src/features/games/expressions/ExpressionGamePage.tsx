import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApp, getGameManager } from '@/engine/instances'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { PhraseBuilder } from './PhraseBuilder'
import {
  abortExpressionSession,
  buildExpressionSession,
  finishExpressionSession,
  recordExpressionAnswer,
  type ExpressionMode,
  type ExpressionQuestion,
  type ExpressionSession,
} from '@/bridge/expressionGame'
import { cancelSpeech, hardResetSpeech, speak, speakWord } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  playAnswerSfx,
  triggerConfetti,
} from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

const ADVANCE_DELAY_MS = 1500
const POINTS_PER_CORRECT = 10

const MODE_META: Record<ExpressionMode, { title: string; icon: string; prompt: string }> = {
  meaning: { title: 'התאמת משמעות', icon: '🧩', prompt: 'מה הפירוש של הביטוי?' },
  truefalse: { title: 'נכון או לא?', icon: '✅', prompt: 'האם הפירוש נכון?' },
  blank: { title: 'השלימו את הביטוי', icon: '✍️', prompt: 'איזה ביטוי משלים את המשפט?' },
  build: { title: 'בנו את הביטוי', icon: '🧱', prompt: 'סדרו את המילים לפי הפירוש' },
  swap: { title: 'החליפו בביטוי', icon: '🔄', prompt: 'איזה ביטוי אפשר להגיד במקום?' },
}

export function ExpressionGamePage({ mode }: { mode: ExpressionMode }) {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const meta = MODE_META[mode]

  const [session, setSession] = useState<ExpressionSession | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  // build mode only
  const [builtWords, setBuiltWords] = useState<string[]>([])
  const [buildResult, setBuildResult] = useState<'correct' | 'incorrect' | null>(null)

  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)

  const start = useCallback(() => {
    hardResetSpeech()
    cancelSpeech()
    const result = buildExpressionSession(mode)
    setSession(result)
    setIndex(0)
    setScore(0)
    setCorrect(0)
    setSelectedIndex(null)
    setFeedback(null)
    setBuiltWords([])
    setBuildResult(null)
    if (result.kind === 'ready') {
      setPhase('awaiting')
      isActiveRef.current = true
    } else {
      setPhase('idle')
      isActiveRef.current = false
    }
  }, [mode])

  // Gate the start on engine readiness (progress + gameManager) like the other games.
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const tryStart = () => {
      if (cancelled) return
      const app = getApp()
      const ready =
        !!getGameManager() && !!app && !!app.userProgress && !!app.progressManager
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
        abortExpressionSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  const questions: ExpressionQuestion[] = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: ExpressionQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  const transform = useCallback(
    (w: string) => {
      const cased = caseMode === 'lowercase' ? w.toLowerCase() : w.toUpperCase()
      return showNikud ? cased : stripNikud(cased)
    },
    [caseMode, showNikud],
  )

  const voicePhrase = useCallback((phrase: string) => {
    void speakWord(phrase.toLowerCase(), 'vocabulary', { allowOverlap: true })
  }, [])

  const finish = useCallback(
    (finalScore: number) => {
      setPhase('finished')
      if (isActiveRef.current) {
        finishExpressionSession(mode, finalScore)
        isActiveRef.current = false
      }
    },
    [mode],
  )

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setBuiltWords([])
    setBuildResult(null)
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        // finish using the freshest score via the functional updater below
        setScore((s) => {
          finish(s)
          return s
        })
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [finish, total])

  const applyOutcome = useCallback(
    (phrase: string, isCorrect: boolean) => {
      recordExpressionAnswer(phrase, isCorrect)
      const fb = getGameFeedback('grammar', isCorrect ? 'correct' : 'incorrect')
      const fallback = isCorrect ? 'כל הכבוד!' : 'לא נורא, ננסה עוד'
      setFeedback({ variant: isCorrect ? 'correct' : 'incorrect', text: fb.text || nk(fallback) })
      playAnswerSfx(isCorrect ? 'correct' : 'incorrect')
      setPhase('answered')
      if (isCorrect) {
        setScore((s) => s + POINTS_PER_CORRECT)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
        voicePhrase(phrase)
      }
      if (fb.audio) void speak(fb.audio)
      if (isCorrect) {
        if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
        advanceTimer.current = window.setTimeout(() => {
          advanceTimer.current = null
          advance()
        }, ADVANCE_DELAY_MS)
      }
    },
    [advance, nk, voicePhrase],
  )

  const handleAnswer = useCallback(
    (selected: number) => {
      if (!current || phase !== 'awaiting') return
      setSelectedIndex(selected)
      applyOutcome(current.phrase, selected === current.correct)
    },
    [applyOutcome, current, phase],
  )

  const handleCheckBuild = useCallback(() => {
    if (!current || phase !== 'awaiting' || !current.answerWords) return
    const isCorrect =
      builtWords.join(' ').toLowerCase() === current.answerWords.join(' ').toLowerCase()
    setBuildResult(isCorrect ? 'correct' : 'incorrect')
    applyOutcome(current.phrase, isCorrect)
  }, [applyOutcome, builtWords, current, phase])

  const handleNextAfterIncorrect = useCallback(() => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    advance()
  }, [advance])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) return
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (isActiveRef.current) {
      abortExpressionSession()
      isActiveRef.current = false
    }
    start()
  }, [start])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const goHome = useCallback(() => navigate('/home'), [navigate])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      abortExpressionSession()
      isActiveRef.current = false
    }
    goHome()
  }, [goHome])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({ title: meta.title, icon: meta.icon, score, onBack: requestExit }),
    [meta.icon, meta.title, requestExit, score],
  )
  const progressProps = useMemo(
    () => ({
      current: phase === 'finished' ? total : Math.min(index + 1, total || 1),
      total: total || 1,
      onReset: handleReset,
    }),
    [handleReset, index, phase, total],
  )

  // ── Gate / loading screens ──────────────────────────────────────────────────

  if (!session) {
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 items-center justify-center text-[color:var(--slate-300)]">
          {nk('טוען…')}
        </div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'locked') {
    const { learnedCount, needed } = session.unlock
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-6xl" aria-hidden>
            🔒
          </span>
          <p dir="rtl" className="max-w-sm text-lg font-semibold text-[color:var(--slate-100)]">
            {nk('הביטויים נפתחים אחרי שלומדים 50 מילים')}
          </p>
          <p dir="rtl" className="text-2xl font-bold text-[color:var(--amber-400)]">
            <span dir="ltr">{`${learnedCount} / ${needed}`}</span>
          </p>
        </div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'not-enough') {
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-6xl" aria-hidden>
            💬
          </span>
          <p dir="rtl" className="max-w-sm text-lg font-semibold text-[color:var(--slate-100)]">
            {nk('אין מספיק ביטויים זמינים — אפשר לבקש ממבוגר להפעיל עוד סוגים בהגדרות')}
          </p>
        </div>
      </GameScreenShell>
    )
  }

  // ── Active question ─────────────────────────────────────────────────────────

  const isBuild = mode === 'build'
  const buildReady = !!current?.answerWords && builtWords.length === current.answerWords.length

  // English option labels (blank mode) get the case transform; Hebrew (meaning) stays.
  const answerOptions =
    current && !isBuild
      ? current.options.map((label, i) => ({
          key: i,
          // blank + swap options are English phrases → apply the case transform.
          label: mode === 'blank' || mode === 'swap' ? transform(label) : label,
          sublabel: current.sublabels?.[i],
        }))
      : []

  const footer = (() => {
    if (isBuild && phase === 'awaiting') {
      return (
        <button
          type="button"
          onClick={handleCheckBuild}
          disabled={!buildReady}
          data-testid="expr-build-check"
          className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nk('בדקו')}
        </button>
      )
    }
    if (phase === 'answered' && feedback?.variant === 'incorrect') {
      return (
        <button
          type="button"
          onClick={handleNextAfterIncorrect}
          data-testid="expr-next"
          className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          {nk('השאלה הבאה')}
        </button>
      )
    }
    return null
  })()

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={footer}>
        {current ? (
          <div className="flex flex-1 flex-col gap-4">
            <MediaPromptCard
              prompt={meta.prompt}
              // meaning/truefalse: show the English phrase; blank: the blanked sentence; build: hide.
              word={isBuild ? undefined : transform(current.promptText)}
              // truefalse: the candidate meaning under judgement; build: the target meaning.
              translation={
                mode === 'truefalse'
                  ? current.candidateMeaning
                  : isBuild
                    ? current.promptText
                    : undefined
              }
              onPlayAudio={mode === 'blank' ? undefined : () => voicePhrase(current.audioPhrase)}
              audioLabel="השמע ביטוי"
              audioIconOnly
            />

            {isBuild ? (
              <PhraseBuilder
                scrambledWords={current.scrambledWords ?? []}
                onChange={setBuiltWords}
                result={buildResult}
                resetKey={index}
                transform={transform}
                disabled={phase !== 'awaiting'}
                onSpeakWord={(w) => voicePhrase(w)}
              />
            ) : (
              <AnswerGrid
                options={answerOptions}
                onSelect={handleAnswer}
                selectedIndex={selectedIndex}
                correctIndex={current.correct}
                revealed={phase === 'answered'}
                columns={mode === 'truefalse' ? 2 : undefined}
                autoFocusFirst
              />
            )}

            {isBuild && phase === 'answered' && buildResult === 'incorrect' ? (
              <p dir="ltr" className="text-center text-base font-semibold text-emerald-200">
                {current.answerWords?.map((w) => transform(w)).join(' ')}
              </p>
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
        onPlayAgain={start}
        onExit={goHome}
      />
    </>
  )
}
