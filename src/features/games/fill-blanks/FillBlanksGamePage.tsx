import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordTable, type WordTableRow } from '@/features/games/shared/WordTable'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { FillBlanksLearnFirst } from './components/FillBlanksLearnFirst'
import {
  abortFillBlanksSession,
  beginFillBlanksSession,
  clearFillBlanksAudioState,
  finishFillBlanksSession,
  getOptionHebrew,
  loadFillBlanksAudioState,
  recordFillBlanksAnswer,
  saveFillBlanksAudioState,
  type FillBlanksQuestion,
  type FillBlanksSessionResult,
} from '@/bridge/fill-blanks'
import { cancelSpeech, hardResetSpeech, speak } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { getSettings } from '@/bridge/settings'
import { useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

function shuffleOptions(options: string[]): { order: string[]; correctIndex: number } {
  const correct = options[0]
  const shuffled = [...options]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return { order: shuffled, correctIndex: shuffled.indexOf(correct) }
}

export function FillBlanksGamePage() {
  const navigate = useNavigate()
  const { caseMode } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<FillBlanksSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [audioPlaysLeft, setAudioPlaysLeft] = useState<number>(() =>
    getSettings().audioPlaysAllowed ?? 8,
  )
  const advanceTimer = useRef<number | null>(null)
  const isActiveRef = useRef(false)
  const autoPlayedRef = useRef(false)

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    if (opts?.fresh) clearFillBlanksAudioState()
    const result = beginFillBlanksSession(opts ?? {})
    setSession(result)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 15))
      setPhase('awaiting')
      isActiveRef.current = true
      const restored = loadFillBlanksAudioState(result.resumeIndex)
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
      if (isActiveRef.current) {
        abortFillBlanksSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: FillBlanksQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  const shuffled = useMemo(() => {
    if (!current) return { order: [] as string[], correctIndex: -1 }
    return shuffleOptions(current.blank.options)
  }, [current])

  useEffect(() => {
    if (phase !== 'awaiting' && phase !== 'answered') return
    saveFillBlanksAudioState({
      questionIndex: index,
      playsSoFar: autoPlayedRef.current ? 1 : 0,
      audioPlaysLeft,
    })
  }, [audioPlaysLeft, index, phase])

  const playSentence = useCallback(() => {
    if (!current) return
    if (audioPlaysLeft <= 0) return
    setAudioPlaysLeft((n) => Math.max(0, n - 1))
    void speak(current.sentence)
  }, [audioPlaysLeft, current])

  useEffect(() => {
    if (!current) return
    if (autoPlayedRef.current) return
    let cancelled = false

    const fire = () => {
      if (cancelled || autoPlayedRef.current) return
      autoPlayedRef.current = true
      setAudioPlaysLeft((n) => Math.max(0, n - 1))
      void speak(current.sentence)
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
    if (isActiveRef.current) {
      abortFillBlanksSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [start])

  const advance = useCallback(() => {
    setFeedback(null)
    setSelectedIndex(null)
    setAudioPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    clearFillBlanksAudioState()
    autoPlayedRef.current = false
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishFillBlanksSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [total])

  const handleSelect = useCallback(
    (i: number) => {
      if (!current || phase !== 'awaiting') return
      const chosen = shuffled.order[i]
      const outcome = recordFillBlanksAnswer(current, chosen)
      setSelectedIndex(i)
      setPhase('answered')
      const fb = getGameFeedback('fill-blanks', outcome.isCorrect ? 'correct' : 'incorrect')
      setFeedback({
        variant: outcome.isCorrect ? 'correct' : 'incorrect',
        text: fb.text,
      })
      if (outcome.isCorrect) {
        setScore((s) => s + outcome.pointsAwarded)
        setCorrect((c) => c + 1)
        if (getShowConfetti()) triggerConfetti()
        try {
          void speak(current.sentence)
        } catch {
          /* ignore */
        }
      } else {
        try {
          void speak(current.blank.options[0])
        } catch {
          /* ignore */
        }
      }
      if (fb.audio) void speak(fb.audio)
    },
    [current, phase, shuffled.order],
  )

  const handleNext = useCallback(() => {
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
      abortFillBlanksSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'השלם את המשפט',
      icon: '✍️',
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
        <FillBlanksLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const renderWord = (word: string) =>
    caseMode === 'lowercase' ? word.toLowerCase() : word.toUpperCase()

  const options = shuffled.order.map((opt, i) => ({
    key: `${index}-${i}-${opt}`,
    label: renderWord(opt),
  }))

  const audioHint =
    audioPlaysLeft <= 0 ? 'נגמרו ההשמעות' : `השמעות נותרו: ${audioPlaysLeft}`

  // Word-review table (F2, bug-dump 2026-06-07): after answering, show the
  // correct option (✓) and — if the child missed — the one they picked (✗),
  // each with its Hebrew gloss + a play button. Hebrew comes from the shared
  // `optionTranslations` map via getOptionHebrew (raw; WordTable nk()'s it).
  // Mirrors the Grammar table (correct + chosen-wrong) per docs/word-table-spec.
  const wordTableRows: WordTableRow[] = []
  if (phase === 'answered' && current) {
    const correctOpt = current.blank.options[0]
    const correctHe = getOptionHebrew(correctOpt)
    if (correctOpt && correctHe) {
      wordTableRows.push({ word: correctOpt, hebrew: correctHe, mark: 'correct' })
    }
    if (selectedIndex != null) {
      const chosen = shuffled.order[selectedIndex]
      if (chosen && chosen.toLowerCase() !== correctOpt.toLowerCase()) {
        const chosenHe = getOptionHebrew(chosen)
        if (chosenHe) wordTableRows.push({ word: chosen, hebrew: chosenHe, mark: 'wrong' })
      }
    }
  }

  const footer =
    phase === 'answered' ? (
      <button
        type="button"
        onClick={handleNext}
        data-testid="fill-blanks-next"
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
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 text-center backdrop-blur">
              <p
                data-testid="fill-blanks-hint"
                className="text-2xl font-semibold text-[color:var(--slate-100)] sm:text-3xl"
              >
                🇮🇱 {nk(current.translation)}
              </p>
              <p
                data-testid="fill-blanks-sentence"
                dir="ltr"
                className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-2xl font-bold text-white sm:text-3xl"
              >
                {current.words.map((w, i) => {
                  if (i === current.blank.position) {
                    const filled =
                      phase === 'answered' && selectedIndex != null
                        ? renderWord(shuffled.order[selectedIndex])
                        : null
                    const isCorrect =
                      phase === 'answered' && selectedIndex === shuffled.correctIndex
                    return (
                      <span
                        key={i}
                        data-testid="fill-blanks-blank"
                        data-state={
                          filled ? (isCorrect ? 'correct' : 'incorrect') : 'empty'
                        }
                        className={cn(
                          'inline-flex min-w-[3.5rem] items-end justify-center border-b-2 px-2 pb-0.5',
                          filled && isCorrect && 'border-emerald-400 text-emerald-300',
                          filled && !isCorrect && 'border-rose-400 text-rose-300',
                          !filled && 'border-[color:var(--blue-400)] text-[color:var(--blue-300)]',
                        )}
                      >
                        {filled ?? '____'}
                      </span>
                    )
                  }
                  return <span key={i}>{renderWord(w)}</span>
                })}
              </p>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={playSentence}
                  disabled={audioPlaysLeft <= 0}
                  data-testid="fill-blanks-play"
                  aria-label="השמע משפט"
                  className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Volume2 className="size-5" aria-hidden />
                </button>
                <span
                  dir="rtl"
                  className="text-sm font-medium text-[color:var(--amber-400)] sm:text-base"
                >
                  {audioHint}
                </span>
              </div>
            </div>

            <AnswerGrid
              options={options}
              onSelect={handleSelect}
              selectedIndex={selectedIndex}
              correctIndex={shuffled.correctIndex}
              revealed={phase === 'answered'}
              disabled={phase !== 'awaiting'}
              variant="text"
              columns={options.length === 2 ? 2 : options.length >= 4 ? 4 : 3}
            />

            {phase === 'answered' && wordTableRows.length > 0 ? (
              <WordTable rows={wordTableRows} title="המילים" />
            ) : null}
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
