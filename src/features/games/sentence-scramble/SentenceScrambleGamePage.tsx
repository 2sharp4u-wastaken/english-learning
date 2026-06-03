import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2 } from 'lucide-react'
import { GameScreenShell } from '@/features/games/shared/GameScreenShell'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { RewardModal } from '@/features/games/shared/RewardModal'
import { ExitConfirmDialog } from '@/features/games/shared/ExitConfirmDialog'
import { ScrambleLearnFirst } from './components/ScrambleLearnFirst'
import {
  abortScrambleSession,
  beginScrambleSession,
  finishScrambleSession,
  recordScrambleAnswer,
  type ScrambleQuestion,
  type ScrambleSessionResult,
} from '@/bridge/sentence-scramble'
import { cancelSpeech, hardResetSpeech, speak } from '@/bridge/audio'
import {
  getGameFeedback,
  getShowConfetti,
  triggerConfetti,
} from '@/bridge/feedback'
import { useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'awaiting' | 'answered' | 'finished'

interface FeedbackState {
  variant: 'correct' | 'incorrect'
  text: string
}

interface WordToken {
  /** Stable per-question key so duplicate words render distinctly. */
  key: string
  /** Display text, punctuation stripped. */
  word: string
}

const REVEAL_WORD_STAGGER_MS = 180

function stripPunct(w: string): string {
  return w.replace(/[.,!?;:]+$/, '')
}

function buildShuffledBank(question: ScrambleQuestion): WordToken[] {
  const cleaned = question.words.map(stripPunct)
  const indexed = cleaned.map((word, i) => ({ key: `q-${i}-${word}`, word }))
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indexed[i], indexed[j]] = [indexed[j], indexed[i]]
  }
  return indexed
}

export function SentenceScrambleGamePage() {
  const navigate = useNavigate()
  const { caseMode } = useTextPrefs()
  const nk = useNikud()
  const [session, setSession] = useState<ScrambleSessionResult | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [exitOpen, setExitOpen] = useState(false)

  const [bank, setBank] = useState<WordToken[]>([])
  const [placed, setPlaced] = useState<WordToken[]>([])
  // Reveal sequence (when wrong) — words append one by one, then 'next' button shows.
  const [revealed, setRevealed] = useState<WordToken[] | null>(null)

  const isActiveRef = useRef(false)
  const dragSrcRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const touchSrcRef = useRef<number | null>(null)
  const touchDestRef = useRef<number | null>(null)
  const touchMovedRef = useRef(false)
  const dragMovedRef = useRef(false)
  const revealTimersRef = useRef<number[]>([])

  const clearRevealTimers = useCallback(() => {
    revealTimersRef.current.forEach((id) => window.clearTimeout(id))
    revealTimersRef.current = []
  }, [])

  const start = useCallback((opts?: { fresh?: boolean }) => {
    hardResetSpeech()
    cancelSpeech()
    const result = beginScrambleSession(opts ?? {})
    setSession(result)
    setFeedback(null)
    setRevealed(null)
    if (result.kind === 'ready') {
      setIndex(result.resumeIndex)
      setScore(result.resumeScore)
      setCorrect(Math.floor(result.resumeScore / 10))
      setPhase('awaiting')
      isActiveRef.current = true
    } else {
      setIndex(0)
      setScore(0)
      setCorrect(0)
      setPhase('idle')
      isActiveRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let attemptsCount = 0
    const tryStart = () => {
      if (cancelled) return
      const w = window as any
      const ready =
        !!w.gameManager &&
        !!w.app &&
        !!w.app.userProgress &&
        typeof w.app.userProgress.learnedWords === 'object'
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
      clearRevealTimers()
      if (isActiveRef.current) {
        abortScrambleSession()
        isActiveRef.current = false
      }
      cancelSpeech()
    }
  }, [clearRevealTimers, start])

  const questions = session?.kind === 'ready' ? session.questions : []
  const total = session?.kind === 'ready' ? session.total : 0
  const current: ScrambleQuestion | null =
    phase === 'finished' || !questions[index] ? null : questions[index]

  // Reset interaction state on each new question + speak the target sentence.
  useEffect(() => {
    if (!current || phase !== 'awaiting') return
    clearRevealTimers()
    setBank(buildShuffledBank(current))
    setPlaced([])
    setRevealed(null)
    setFeedback(null)
    try {
      void speak(current.sentence)
    } catch {
      /* ignore */
    }
  }, [clearRevealTimers, current, index, phase])

  const renderWord = useCallback(
    (word: string) =>
      caseMode === 'lowercase' ? word.toLowerCase() : word.toUpperCase(),
    [caseMode],
  )

  const handleSelectFromBank = useCallback(
    (tokenKey: string) => {
      if (phase !== 'awaiting') return
      const token = bank.find((t) => t.key === tokenKey)
      if (!token) return
      try {
        void speak(token.word)
      } catch {
        /* ignore */
      }
      setBank((prev) => prev.filter((t) => t.key !== tokenKey))
      setPlaced((prev) => [...prev, token])
    },
    [bank, phase],
  )

  const handleRemoveFromAnswer = useCallback(
    (tokenKey: string) => {
      if (phase !== 'awaiting') return
      const token = placed.find((t) => t.key === tokenKey)
      if (!token) return
      try {
        void speak(token.word)
      } catch {
        /* ignore */
      }
      setPlaced((prev) => prev.filter((t) => t.key !== tokenKey))
      setBank((prev) => [...prev, token])
    },
    [phase, placed],
  )

  const playCurrentSentence = useCallback(() => {
    if (placed.length === 0) return
    const text = placed.map((t) => t.word).join(' ')
    try {
      void speak(text)
    } catch {
      /* ignore */
    }
  }, [placed])

  const handleCheck = useCallback(() => {
    if (!current || phase !== 'awaiting') return
    if (placed.length === 0 || placed.length !== current.words.length) return

    const playerWords = placed.map((t) => t.word)
    const outcome = recordScrambleAnswer(current, playerWords)
    setPhase('answered')

    const fb = getGameFeedback('scramble', outcome.isCorrect ? 'correct' : 'incorrect')
    setFeedback({
      variant: outcome.isCorrect ? 'correct' : 'incorrect',
      text: fb.text,
    })
    if (fb.audio) void speak(fb.audio)

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
        void speak(current.sentence)
      } catch {
        /* ignore */
      }
      // Reveal the correct order with a staggered animation (matches legacy).
      const correctWords = current.words.map(stripPunct)
      const correctTokens: WordToken[] = correctWords.map((word, i) => ({
        key: `reveal-${i}-${word}`,
        word,
      }))
      clearRevealTimers()
      setRevealed([])
      correctTokens.forEach((tok, i) => {
        const id = window.setTimeout(() => {
          setRevealed((prev) => (prev ? [...prev, tok] : [tok]))
        }, 500 + i * REVEAL_WORD_STAGGER_MS)
        revealTimersRef.current.push(id)
      })
    }
  }, [clearRevealTimers, current, phase, placed])

  const handleNext = useCallback(() => {
    clearRevealTimers()
    setFeedback(null)
    setRevealed(null)
    setIndex((prev) => {
      const next = prev + 1
      if (next >= total) {
        setPhase('finished')
        if (isActiveRef.current) {
          finishScrambleSession()
          isActiveRef.current = false
        }
        return prev
      }
      setPhase('awaiting')
      return next
    })
  }, [clearRevealTimers, total])

  const handleReset = useCallback(() => {
    if (!window.confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
      return
    }
    clearRevealTimers()
    if (isActiveRef.current) {
      abortScrambleSession()
      isActiveRef.current = false
    }
    start({ fresh: true })
  }, [clearRevealTimers, start])

  const requestExit = useCallback(() => setExitOpen(true), [])

  const confirmExit = useCallback(() => {
    setExitOpen(false)
    clearRevealTimers()
    if (isActiveRef.current) {
      abortScrambleSession()
      isActiveRef.current = false
    }
    navigate('/home')
  }, [clearRevealTimers, navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const headerProps = useMemo(
    () => ({
      title: 'סידור משפטים',
      icon: '🔀',
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

  // Drag handlers for reordering in the answer zone.
  const reorderPlaced = useCallback((src: number, dest: number) => {
    if (src === dest) return
    setPlaced((prev) => {
      const next = [...prev]
      const [moved] = next.splice(src, 1)
      next.splice(dest, 0, moved)
      return next
    })
  }, [])

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
        <ScrambleLearnFirst learnedCount={session.learnedCount} />
      </GameScreenShell>
    )
  }

  const allPlaced =
    phase === 'awaiting' && current ? placed.length === current.words.length : false

  const answerChips: WordToken[] = revealed ?? placed

  const footer =
    phase === 'awaiting' ? (
      <button
        type="button"
        onClick={handleCheck}
        disabled={!allPlaced}
        data-testid="scramble-check"
        className={cn(
          'mx-auto block rounded-full px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition',
          allPlaced
            ? 'bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] hover:brightness-110'
            : 'cursor-not-allowed bg-white/10 text-white/40',
        )}
      >
        {nk('בדוק תשובה')}
      </button>
    ) : phase === 'answered' ? (
      <button
        type="button"
        onClick={handleNext}
        data-testid="scramble-next"
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
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 text-center backdrop-blur">
              <p
                data-testid="scramble-hint"
                className="text-2xl font-semibold text-[color:var(--slate-100)] sm:text-3xl"
              >
                🇮🇱 {current.translation}
              </p>
              <button
                type="button"
                onClick={playCurrentSentence}
                disabled={placed.length === 0 || phase !== 'awaiting'}
                data-testid="scramble-play"
                aria-label="השמע את המשפט שלי"
                className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Volume2 className="size-5" aria-hidden />
              </button>
            </div>

            {/* Answer zone */}
            <div
              data-testid="scramble-answer-zone"
              dir="ltr"
              className="mx-auto flex min-h-[4.5rem] w-full max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-[color:var(--ink-900)]/40 p-3"
            >
              {answerChips.length === 0 ? (
                <span
                  dir="rtl"
                  className="text-sm text-[color:var(--slate-400)] sm:text-base"
                >
                  {nk('הקלק על מילה כדי להוסיף אותה')}
                </span>
              ) : (
                answerChips.map((token, i) => {
                  const isReveal = revealed != null
                  const isCorrectAnswer =
                    phase === 'answered' && feedback?.variant === 'correct'
                  const isIncorrectChip =
                    phase === 'answered' && !isReveal && feedback?.variant === 'incorrect'
                  return (
                    <button
                      key={token.key}
                      type="button"
                      data-testid="scramble-answer-chip"
                      data-state={
                        isReveal
                          ? 'reveal'
                          : isCorrectAnswer
                          ? 'correct'
                          : isIncorrectChip
                          ? 'incorrect'
                          : 'placed'
                      }
                      draggable={phase === 'awaiting'}
                      onClick={() => {
                        if (dragMovedRef.current) return
                        if (phase === 'awaiting') handleRemoveFromAnswer(token.key)
                        else if (isReveal) {
                          try {
                            void speak(token.word)
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                      onDragStart={(e) => {
                        if (phase !== 'awaiting') return
                        dragSrcRef.current = i
                        dragMovedRef.current = false
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        dragSrcRef.current = null
                        setDragOverIndex(null)
                        window.setTimeout(() => {
                          dragMovedRef.current = false
                        }, 0)
                      }}
                      onDragOver={(e) => {
                        if (phase !== 'awaiting') return
                        e.preventDefault()
                        dragMovedRef.current = true
                        e.dataTransfer.dropEffect = 'move'
                        if (
                          dragSrcRef.current !== null &&
                          dragSrcRef.current !== i
                        ) {
                          setDragOverIndex(i)
                        }
                      }}
                      onDrop={(e) => {
                        if (phase !== 'awaiting') return
                        e.preventDefault()
                        const src = dragSrcRef.current
                        if (src !== null && src !== i) reorderPlaced(src, i)
                        setDragOverIndex(null)
                      }}
                      onTouchStart={(e) => {
                        if (phase !== 'awaiting') return
                        const t = e.touches[0]
                        touchSrcRef.current = i
                        touchDestRef.current = null
                        touchMovedRef.current = false
                        ;(e.currentTarget as any)._sx = t.clientX
                        ;(e.currentTarget as any)._sy = t.clientY
                      }}
                      onTouchMove={(e) => {
                        if (phase !== 'awaiting') return
                        const t = e.touches[0]
                        const el = e.currentTarget as any
                        const dx = t.clientX - (el._sx ?? t.clientX)
                        const dy = t.clientY - (el._sy ?? t.clientY)
                        if (!touchMovedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                          touchMovedRef.current = true
                        }
                        if (!touchMovedRef.current) return
                        e.preventDefault()
                        const overEl = document.elementFromPoint(t.clientX, t.clientY)
                        const chipEl = overEl?.closest?.('[data-testid="scramble-answer-chip"]') as
                          | HTMLElement
                          | null
                        if (chipEl && chipEl !== e.currentTarget) {
                          const zone = chipEl.parentElement
                          if (zone) {
                            const chips = Array.from(
                              zone.querySelectorAll<HTMLElement>(
                                '[data-testid="scramble-answer-chip"]',
                              ),
                            )
                            const idx = chips.indexOf(chipEl)
                            touchDestRef.current = idx >= 0 ? idx : null
                            setDragOverIndex(touchDestRef.current)
                          }
                        } else {
                          touchDestRef.current = null
                          setDragOverIndex(null)
                        }
                      }}
                      onTouchEnd={() => {
                        if (phase !== 'awaiting') {
                          touchMovedRef.current = false
                          return
                        }
                        const src = touchSrcRef.current
                        const dest = touchDestRef.current
                        setDragOverIndex(null)
                        if (
                          touchMovedRef.current &&
                          src !== null &&
                          dest !== null &&
                          dest !== src
                        ) {
                          reorderPlaced(src, dest)
                        }
                        touchSrcRef.current = null
                        touchDestRef.current = null
                        window.setTimeout(() => {
                          touchMovedRef.current = false
                        }, 0)
                      }}
                      className={cn(
                        'inline-flex min-h-[2.5rem] items-center rounded-xl px-3 py-1.5 text-lg font-bold shadow-sm transition',
                        'cursor-grab touch-none select-none',
                        isReveal && 'animate-in fade-in zoom-in bg-[color:var(--mint-400)]/80 text-[color:var(--ink-950)]',
                        !isReveal && isCorrectAnswer && 'bg-emerald-500/80 text-white',
                        !isReveal && isIncorrectChip && 'bg-rose-500/80 text-white',
                        !isReveal && phase === 'awaiting' && 'bg-white text-[color:var(--ink-950)] hover:brightness-95',
                        dragOverIndex === i && 'ring-2 ring-[color:var(--blue-400)]',
                      )}
                      style={{ direction: 'ltr' }}
                    >
                      {renderWord(token.word)}
                    </button>
                  )
                })
              )}
            </div>

            {/* Word bank */}
            <div
              data-testid="scramble-word-bank"
              dir="ltr"
              className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/30 p-3"
            >
              {bank.length === 0 && phase === 'awaiting' ? (
                <span
                  dir="rtl"
                  className="text-sm text-[color:var(--slate-400)] sm:text-base"
                >
                  {nk('כל המילים סודרו')}
                </span>
              ) : (
                bank.map((token) => (
                  <button
                    key={token.key}
                    type="button"
                    data-testid="scramble-word-btn"
                    onClick={() => handleSelectFromBank(token.key)}
                    disabled={phase !== 'awaiting'}
                    className={cn(
                      'inline-flex min-h-[2.5rem] items-center rounded-xl bg-gradient-to-br from-[color:var(--blue-400)] to-[color:var(--mint-400)] px-3 py-1.5 text-lg font-bold text-[color:var(--ink-950)] shadow-sm transition hover:brightness-110',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    style={{ direction: 'ltr' }}
                  >
                    {renderWord(token.word)}
                  </button>
                ))
              )}
            </div>
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
