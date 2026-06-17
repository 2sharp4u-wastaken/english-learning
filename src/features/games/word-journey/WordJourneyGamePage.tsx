import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApp, getGameManager } from '@/engine/instances'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { WJStageBar } from './components/WJStageBar'
import { DiscoverStage } from './components/DiscoverStage'
import { ListenMatchStage } from './components/ListenMatchStage'
import { SpellStage } from './components/SpellStage'
import { SayWordStage } from './components/SayWordStage'
import { RecallStage } from './components/RecallStage'
import { WJCelebration } from './components/WJCelebration'
import { cancelSpeech, hardResetSpeech } from '@/bridge/audio'
import { useNikud } from '@/bridge/nikud'
import {
  abortWordJourney,
  beginWordJourney,
  finishWordJourney,
  loadWJProgress,
  recordWJAttempt,
  resumeWordJourney,
  saveWJProgress,
  setReplayMode,
  type WJSavedProgress,
  type WJStageId,
  type WJSummaryEntry,
  type WJWord,
  type WordJourneyReady,
  type WordJourneyResult,
} from '@/bridge/word-journey'

const STAGE_ORDER: WJStageId[] = ['discover', 'listen-match', 'spell-tiles', 'say-word', 'recall']

export function WordJourneyGamePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<WordJourneyResult | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'celebrating'>('playing')
  const [score, setScore] = useState(0)
  const [summary, setSummary] = useState<WJSummaryEntry[]>([])
  const [exitOpen, setExitOpen] = useState(false)
  const correctRef = useRef(0)
  const totalScoredRef = useRef(0)
  const isActiveRef = useRef(false)
  // Mirrors of the live session/progress, read by the unmount cleanup to persist
  // resumable state (the reported "resets on exit" fix). Refs because the cleanup
  // closure must see the latest values without re-subscribing.
  const sessionRef = useRef<WordJourneyReady | null>(null)
  const stageRef = useRef(0)
  const scoreRef = useRef(0)
  const phaseRef = useRef<'playing' | 'celebrating'>('playing')
  const replayRef = useRef(false)

  /** Persist the current journey so a return continues it, unless we're in a
   * replay/practice run, celebrating, or there's no live session. */
  const saveResume = useCallback(() => {
    if (replayRef.current) return
    if (phaseRef.current !== 'playing') return
    const s = sessionRef.current
    if (!s || s.kind !== 'ready') return
    if (stageRef.current >= STAGE_ORDER.length) return
    saveWJProgress({
      session: s,
      stageIndex: stageRef.current,
      score: scoreRef.current,
      correct: correctRef.current,
      totalScored: totalScoredRef.current,
    })
  }, [])

  const start = useCallback((opts?: { replay?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    setReplayMode(!!opts?.replay)
    replayRef.current = !!opts?.replay
    const result = beginWordJourney()
    setSession(result)
    setStageIndex(0)
    setPhase('playing')
    setScore(0)
    setSummary([])
    sessionRef.current = result.kind === 'ready' ? result : null
    stageRef.current = 0
    scoreRef.current = 0
    phaseRef.current = 'playing'
    correctRef.current = 0
    totalScoredRef.current = 0
    isActiveRef.current = result.kind === 'ready'
  }, [])

  const resume = useCallback(
    (saved: WJSavedProgress) => {
      hardResetSpeech()
      cancelSpeech()
      setReplayMode(false)
      replayRef.current = false
      const ready = resumeWordJourney(saved)
      if (!ready) {
        start()
        return
      }
      const result: WordJourneyResult = ready
      setSession(result)
      setStageIndex(saved.stageIndex)
      setPhase('playing')
      setScore(saved.score)
      setSummary([])
      sessionRef.current = ready
      stageRef.current = saved.stageIndex
      scoreRef.current = saved.score
      phaseRef.current = 'playing'
      correctRef.current = saved.correct
      totalScoredRef.current = saved.totalScored
      isActiveRef.current = true
    },
    [start],
  )

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
      const saved = loadWJProgress()
      if (saved) resume(saved)
      else start()
    }
    tryStart()
    return () => {
      cancelled = true
      if (isActiveRef.current) {
        saveResume()
        abortWordJourney()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start, resume, saveResume])

  const words: WJWord[] = session?.kind === 'ready' ? session.words : []

  const handleAnswer = useCallback((word: WJWord, isCorrect: boolean, points: number) => {
    recordWJAttempt(word, isCorrect, points)
    totalScoredRef.current += 1
    if (isCorrect) {
      correctRef.current += 1
      scoreRef.current += points
      setScore((s) => s + points)
    }
  }, [])

  const finishNow = useCallback(() => {
    if (!isActiveRef.current) return
    const res = finishWordJourney(words, correctRef.current, totalScoredRef.current)
    isActiveRef.current = false
    phaseRef.current = 'celebrating'
    setSummary(res.summary)
    setPhase('celebrating')
  }, [words])

  const handleStageComplete = useCallback(() => {
    setStageIndex((prev) => {
      const next = prev + 1
      if (next >= STAGE_ORDER.length) {
        finishNow()
        return prev
      }
      stageRef.current = next
      return next
    })
  }, [finishNow])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) return
    if (isActiveRef.current) {
      abortWordJourney()
      isActiveRef.current = false
    }
    start()
  }, [start])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    if (isActiveRef.current) {
      saveResume()
      abortWordJourney()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [navigate, saveResume])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  const stage = phase === 'playing' ? STAGE_ORDER[stageIndex] : null

  const headerProps = useMemo(
    () => ({
      title: 'מסע מילים',
      icon: '🗺️',
      score,
      onBack: requestExit,
    }),
    [requestExit, score],
  )

  const progressProps = useMemo(
    () => ({
      current: stageIndex + 1,
      total: STAGE_ORDER.length,
      onReset: handleReset,
      // Stage bar lives on its OWN full-width row under the fill bar (M3) — the
      // old `center` slot squeezed all 5 stages into ~80px on a phone (illegible
      // blob). Full width fits the icons; the bar itself goes icons-only +
      // current-stage label on narrow screens.
      below: stage ? <WJStageBar activeStage={stage} /> : undefined,
    }),
    [handleReset, stage, stageIndex],
  )

  const nk = useNikud()

  if (!session) {
    return (
      <GameScreenShell header={headerProps}>
        <div className="flex flex-1 items-center justify-center text-[color:var(--slate-300)]">{nk('טוען…')}</div>
      </GameScreenShell>
    )
  }

  if (session.kind === 'no-words') {
    return (
      <GameScreenShell header={headerProps}>
        <div dir="rtl" className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-5xl">🗺️</div>
          <p className="text-lg font-bold text-white">{nk('אין מספיק מילים למסע')}</p>
          <p className="text-sm text-[color:var(--slate-300)]">
            {nk('בחרו עוד קטגוריות בהגדרות כדי להתחיל מסע מילים.')}
          </p>
        </div>
      </GameScreenShell>
    )
  }

  if (phase === 'celebrating') {
    return (
      <>
        <GameScreenShell header={headerProps}>
          <WJCelebration
            summary={summary}
            onPlayAgain={() => start()}
            onHome={() => navigate('/home')}
          />
        </GameScreenShell>
        <ExitConfirmDialog open={exitOpen} onConfirm={confirmExit} onCancel={cancelExit} />
      </>
    )
  }

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps}>
        <div className="flex flex-1 flex-col gap-4">
          {stage === 'discover' ? (
            <DiscoverStage words={words} onComplete={handleStageComplete} />
          ) : stage === 'listen-match' ? (
            <ListenMatchStage
              items={session.listenMatch}
              onAnswer={handleAnswer}
              onComplete={handleStageComplete}
            />
          ) : stage === 'spell-tiles' ? (
            <SpellStage items={session.spell} onAnswer={handleAnswer} onComplete={handleStageComplete} />
          ) : stage === 'say-word' ? (
            <SayWordStage words={words} onAnswer={handleAnswer} onComplete={handleStageComplete} />
          ) : (
            <RecallStage words={session.recall} onAnswer={handleAnswer} onComplete={handleStageComplete} />
          )}
        </div>
      </GameScreenShell>
      <ExitConfirmDialog open={exitOpen} onConfirm={confirmExit} onCancel={cancelExit} />
    </>
  )
}
