import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { MemoryBoard } from './components/MemoryBoard'
import { MemoryLevelSummary } from './components/MemoryLevelSummary'
import { cancelSpeech, hardResetSpeech, speakHebrew, speakWord } from '@/bridge/audio'
import { getShowConfetti, playAnswerSfx, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import {
  abortMemory,
  beginMemory,
  buildLevelCards,
  finishMemoryGame,
  finishMemoryLevel,
  loadMemoryBests,
  recordMemoryMatch,
  recordMemoryMismatch,
  MEMORY_LEVELS,
  MEMORY_POINTS,
  type MemoryCard,
  type MemoryLevelMetrics,
  type MemoryPersonalBest,
  type MemorySessionResult,
  type MemoryWord,
} from '@/bridge/memory'

type Phase = 'playing' | 'finished'

const FLIP_BACK_MS = 1000
const MATCH_CHECK_MS = 700
const LEVEL_FINISH_MS = 900

export function MemoryGamePage() {
  const navigate = useNavigate()
  const { caseMode, showNikud } = useTextPrefs()

  const [session, setSession] = useState<MemorySessionResult | null>(null)
  const [levelIndex, setLevelIndex] = useState(0)
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [moves, setMoves] = useState(0)
  const [levelScore, setLevelScore] = useState(0)
  const [cumulativeScore, setCumulativeScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const [metrics, setMetrics] = useState<MemoryLevelMetrics | null>(null)
  // Level finished but NOT auto-advanced: board stays up (cards tappable to hear
  // the word) until the child taps "next level" / "finish game".
  const [levelComplete, setLevelComplete] = useState(false)
  const [bests, setBests] = useState<Record<string, MemoryPersonalBest>>({})
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  // Mechanics tracked in refs so the timed match/mismatch callbacks read live
  // values without stale-closure bugs (mirrors the legacy processing lock).
  const poolRef = useRef<MemoryWord[]>([])
  const matchedRef = useRef<Set<number>>(new Set())
  const flipCountRef = useRef<Record<number, number>>({})
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const movesRef = useRef(0)
  const levelScoreRef = useRef(0)
  const startTimeRef = useRef(0)
  const processingRef = useRef(false)
  const isActiveRef = useRef(false)
  const speechGenRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const popupIdRef = useRef(0)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  const setupLevel = useCallback((idx: number) => {
    clearTimers()
    cancelSpeech()
    speechGenRef.current++
    const deck = buildLevelCards(poolRef.current, idx)
    setLevelIndex(idx)
    setCards(deck)
    setFlipped([])
    matchedRef.current = new Set()
    setMatched(new Set())
    flipCountRef.current = {}
    comboRef.current = 0
    maxComboRef.current = 0
    movesRef.current = 0
    setMoves(0)
    levelScoreRef.current = 0
    setLevelScore(0)
    processingRef.current = false
    startTimeRef.current = Date.now()
    setPopup(null)
    setMetrics(null)
    setLevelComplete(false)
    setPhase('playing')
  }, [clearTimers])

  const start = useCallback(() => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginMemory()
    setSession(result)
    setCumulativeScore(0)
    if (result.kind === 'ready') {
      poolRef.current = result.pool
      isActiveRef.current = true
      setupLevel(0)
    } else {
      isActiveRef.current = false
    }
  }, [setupLevel])

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
        Array.isArray(w.vocabularyBank)
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
      clearTimers()
      if (isActiveRef.current) {
        abortMemory()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [start, clearTimers])

  // ── Audio ───────────────────────────────────────────────────────────────────

  const playWordAudio = useCallback((word: MemoryWord) => {
    void speakWord(word.word.toLowerCase(), 'memory', { allowOverlap: true })
  }, [])

  /** Hebrew-only celebration after a match (was "<hebrew> is <english>"). */
  const playMatchedPairAudio = useCallback((word: MemoryWord) => {
    const gen = speechGenRef.current
    void (async () => {
      try {
        await new Promise((r) => setTimeout(r, 400))
        if (gen !== speechGenRef.current) return
        if (word.hebrew) await speakHebrew(word.hebrew)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  // ── Level / game completion ───────────────────────────────────────────────────

  // Level cleared: record metrics + bank score, but DON'T auto-advance. Stay on
  // the board (cards stay flipped, tappable to replay each word) and let the
  // child tap "next level" / "finish game" when ready.
  const completeLevel = useCallback(() => {
    const timeSeconds = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000))
    const result = finishMemoryLevel(
      levelIndex,
      movesRef.current,
      timeSeconds,
      levelScoreRef.current,
      maxComboRef.current,
    )
    setCumulativeScore((c) => c + levelScoreRef.current)
    setMetrics(result)
    setBests(loadMemoryBests())
    setLevelComplete(true)
    if (result.stars >= 3 && getShowConfetti()) triggerConfetti()
  }, [levelIndex])

  const finishGame = useCallback(() => {
    if (isActiveRef.current) {
      finishMemoryGame()
      isActiveRef.current = false
    }
    setPhase('finished')
  }, [])

  // ── Pair resolution ───────────────────────────────────────────────────────────

  const resolvePair = useCallback(
    (i1: number, i2: number) => {
      const c1 = cards[i1]
      const c2 = cards[i2]
      if (!c1 || !c2) {
        processingRef.current = false
        setFlipped([])
        return
      }

      if (c1.pairId === c2.pairId) {
        const firstTry = flipCountRef.current[i1] === 1 && flipCountRef.current[i2] === 1
        comboRef.current += 1
        maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
        const combo = comboRef.current
        const comboBonus = combo >= 2 ? MEMORY_POINTS.comboMultiplier * combo : 0
        const points = MEMORY_POINTS.base + comboBonus + (firstTry ? MEMORY_POINTS.firstTryBonus : 0)
        levelScoreRef.current += points
        setLevelScore(levelScoreRef.current)

        matchedRef.current = new Set([...matchedRef.current, i1, i2])
        setMatched(new Set(matchedRef.current))
        setFlipped([])
        processingRef.current = false

        recordMemoryMatch(c1.word)
        playAnswerSfx('correct')
        playMatchedPairAudio(c1.word)

        const id = ++popupIdRef.current
        const text =
          combo >= 3
            ? `🔥 ×${combo} קומבו! +${points}`
            : combo === 2
              ? `⚡ קומבו! +${points}`
              : firstTry
                ? `🎯 ראשון! +${points}`
                : `+${points}`
        setPopup({ id, text })
        timersRef.current.push(
          window.setTimeout(() => {
            setPopup((p) => (p?.id === id ? null : p))
          }, 1100),
        )

        if (matchedRef.current.size >= cards.length) {
          timersRef.current.push(window.setTimeout(completeLevel, LEVEL_FINISH_MS))
        }
      } else {
        comboRef.current = 0
        recordMemoryMismatch(c1, c2)
        // No "wrong" sound on a mismatch — a non-match in memory isn't a mistake
        // to scold; the cards just flip back.
        timersRef.current.push(
          window.setTimeout(() => {
            setFlipped([])
            processingRef.current = false
          }, FLIP_BACK_MS),
        )
      }
    },
    [cards, completeLevel, playAnswerSfx, playMatchedPairAudio],
  )

  const handleCardClick = useCallback(
    (index: number) => {
      if (processingRef.current) return
      const card = cards[index]
      if (!card) return
      if (matchedRef.current.has(index)) {
        // Replay "the word it shows": the Hebrew (translation) card speaks Hebrew,
        // the English (word) card speaks English.
        if (card.type === 'translation' && card.word.hebrew) {
          void speakHebrew(card.word.hebrew)
        } else {
          playWordAudio(card.word)
        }
        return
      }
      if (flipped.includes(index)) return

      playWordAudio(card.word)
      flipCountRef.current[index] = (flipCountRef.current[index] || 0) + 1
      const next = [...flipped, index]
      setFlipped(next)

      if (next.length === 2) {
        processingRef.current = true
        movesRef.current += 1
        setMoves(movesRef.current)
        timersRef.current.push(window.setTimeout(() => resolvePair(next[0], next[1]), MATCH_CHECK_MS))
      }
    },
    [cards, flipped, playWordAudio, resolvePair],
  )

  // ── Navigation / summary actions ────────────────────────────────────────────────

  const handleNextLevel = useCallback(() => setupLevel(levelIndex + 1), [levelIndex, setupLevel])

  const handlePlayAgain = useCallback(() => {
    if (isActiveRef.current) {
      abortMemory()
      isActiveRef.current = false
    }
    start()
  }, [start])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) return
    handlePlayAgain()
  }, [handlePlayAgain])

  const requestExit = useCallback(() => setExitOpen(true), [])
  const confirmExit = useCallback(() => {
    setExitOpen(false)
    clearTimers()
    if (isActiveRef.current) {
      abortMemory()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [clearTimers, navigate])
  const cancelExit = useCallback(() => setExitOpen(false), [])

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderEnglish = useCallback(
    (word: string) => (caseMode === 'lowercase' ? word.toLowerCase() : word.toUpperCase()),
    [caseMode],
  )
  const renderHebrew = useCallback(
    (text: string) => (showNikud ? text : stripNikud(text)),
    [showNikud],
  )

  const score = cumulativeScore + levelScore
  const totalPairs = MEMORY_LEVELS[levelIndex]?.pairs ?? 0
  const matchedPairs = Math.floor(matched.size / 2)

  const headerProps = useMemo(
    () => ({ title: 'משחק זיכרון', icon: '🧠', score, onBack: requestExit }),
    [requestExit, score],
  )

  const progressProps = useMemo(
    () => ({
      current: phase === 'finished' ? MEMORY_LEVELS.length : levelIndex + 1,
      total: MEMORY_LEVELS.length,
      onReset: handleReset,
    }),
    [handleReset, levelIndex, phase],
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
        <div
          dir="rtl"
          data-testid="memory-learn-first"
          className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
        >
          <div className="text-5xl">🔒</div>
          <p className="text-lg font-bold text-white">עוד מעט!</p>
          <p className="text-sm text-[color:var(--slate-300)]">
            למדת {session.introducedCount} מילים עד כה.
          </p>
          <p className="text-sm text-[color:var(--slate-300)]">
            יש ללמוד עוד מילים ב<strong>מסע המילים</strong> כדי לשחק במשחק הזיכרון.
          </p>
          <button
            type="button"
            onClick={() => navigate('/game/word-journey')}
            className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-6 py-2.5 text-sm font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
          >
            🗺️ מסע המילים
          </button>
        </div>
      </GameScreenShell>
    )
  }

  if (phase === 'finished') {
    return (
      <>
        <GameScreenShell header={headerProps} progress={progressProps}>
          {metrics ? (
            <MemoryLevelSummary
              level={levelIndex + 1}
              totalLevels={MEMORY_LEVELS.length}
              metrics={metrics}
              isLastLevel={phase === 'finished'}
              totalScore={cumulativeScore}
              bests={bests}
              onNext={handleNextLevel}
              onPlayAgain={handlePlayAgain}
              onHome={() => navigate('/home')}
            />
          ) : null}
        </GameScreenShell>
        <ExitConfirmDialog open={exitOpen} onConfirm={confirmExit} onCancel={cancelExit} />
      </>
    )
  }

  const isLastLevel = levelIndex >= MEMORY_LEVELS.length - 1
  const completionFooter =
    levelComplete ? (
      <button
        type="button"
        onClick={isLastLevel ? finishGame : handleNextLevel}
        data-testid="memory-advance"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        {isLastLevel ? '🏁 סיים משחק' : '⏭️ רמה הבאה'}
      </button>
    ) : null

  return (
    <>
      <GameScreenShell header={headerProps} progress={progressProps} footer={completionFooter}>
        <div className="relative flex flex-1 flex-col gap-3">
          <div
            dir="rtl"
            className="mx-auto flex items-center gap-4 rounded-full border border-white/10 bg-[color:var(--ink-900)]/60 px-4 py-1.5 text-sm text-[color:var(--slate-200)]"
          >
            <span>
              רמה <strong className="text-white">{levelIndex + 1}</strong>/{MEMORY_LEVELS.length}
            </span>
            <span>
              זוגות{' '}
              <strong data-testid="memory-pairs" className="text-white">
                {matchedPairs}/{totalPairs}
              </strong>
            </span>
            <span>
              מהלכים <strong className="text-white">{moves}</strong>
            </span>
          </div>

          {levelComplete && metrics ? (
            <div
              dir="rtl"
              data-testid="memory-level-complete"
              className="mx-auto flex flex-col items-center gap-0.5 rounded-2xl border border-[color:var(--mint-400)]/30 bg-[color:var(--mint-400)]/10 px-5 py-2 text-center"
            >
              <div className="text-xl" aria-hidden>
                {'⭐'.repeat(metrics.stars)}
                {'☆'.repeat(Math.max(0, 3 - metrics.stars))}
              </div>
              <p className="text-sm font-bold text-white">כל הזוגות נמצאו! 🎉</p>
              <p className="text-xs text-[color:var(--slate-300)]">
                לחצו על קלף כדי לשמוע שוב — וכשמוכנים, המשיכו
              </p>
            </div>
          ) : null}

          <MemoryBoard
            cards={cards}
            flipped={flipped}
            matched={matched}
            columns={MEMORY_LEVELS[levelIndex]?.columns ?? 4}
            processing={processingRef.current}
            renderEnglish={renderEnglish}
            renderHebrew={renderHebrew}
            onCardClick={handleCardClick}
          />

          {popup ? (
            <div
              key={popup.id}
              data-testid="memory-popup"
              className="pointer-events-none absolute inset-x-0 top-12 z-10 mx-auto w-fit animate-pulse rounded-full bg-[color:var(--mint-400)] px-4 py-1.5 text-base font-black text-[color:var(--ink-950)] shadow-lg"
            >
              {popup.text}
            </div>
          ) : null}
        </div>
      </GameScreenShell>
      <ExitConfirmDialog open={exitOpen} onConfirm={confirmExit} onCancel={cancelExit} />
    </>
  )
}
