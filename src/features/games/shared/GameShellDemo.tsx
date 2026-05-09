import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnswerGrid, type AnswerOption } from './AnswerGrid'
import { ExitConfirmDialog } from './ExitConfirmDialog'
import { FeedbackBanner, type FeedbackVariant } from './FeedbackBanner'
import { GameScreenShell } from './GameScreenShell'
import { MediaPromptCard } from './MediaPromptCard'
import { RewardModal } from './RewardModal'

type DemoMode = 'text' | 'media' | 'binary'

interface DemoConfig {
  prompt: string
  word?: string
  mediaEmoji?: string
  options: AnswerOption[]
  correctIndex: number
  columns?: 2 | 3 | 4
  variant?: 'text' | 'media'
}

const DEMOS: Record<DemoMode, DemoConfig> = {
  text: {
    prompt: 'בחר את התרגום הנכון',
    word: 'apple',
    options: [
      { label: 'תפוח' },
      { label: 'בננה' },
      { label: 'תות' },
      { label: 'אגס' },
    ],
    correctIndex: 0,
  },
  media: {
    prompt: 'האזן ובחר את התמונה',
    options: [
      { label: 'cat', media: <span className="text-5xl">🐱</span> },
      { label: 'dog', media: <span className="text-5xl">🐶</span> },
      { label: 'bird', media: <span className="text-5xl">🐦</span> },
      { label: 'fish', media: <span className="text-5xl">🐟</span> },
    ],
    correctIndex: 1,
    variant: 'media',
  },
  binary: {
    prompt: 'האם התמונה מתאימה למילה?',
    word: 'sun',
    mediaEmoji: '☀️',
    options: [{ label: 'נכון ✓' }, { label: 'לא נכון ✗' }],
    correctIndex: 0,
    columns: 2,
  },
}

export function GameShellDemo() {
  const navigate = useNavigate()
  const total = 10
  const [current, setCurrent] = useState(3)
  const [score, setScore] = useState(40)
  const [coins, setCoins] = useState(12)
  const [feedback, setFeedback] = useState<{
    variant: FeedbackVariant
    message: string
  } | null>(null)
  const [rewardOpen, setRewardOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)

  const [mode, setMode] = useState<DemoMode>('text')
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const demo = DEMOS[mode]

  const showFeedback = (variant: FeedbackVariant) => {
    setFeedback({
      variant,
      message: variant === 'correct' ? 'כל הכבוד! 🎉' : 'לא נכון, נסה שוב',
    })
  }

  const handleSelect = (index: number) => {
    if (revealed) return
    setSelected(index)
    setRevealed(true)
    const isCorrect = index === demo.correctIndex
    if (isCorrect) {
      setScore((s) => s + 10)
      setCurrent((c) => Math.min(total, c + 1))
    }
    showFeedback(isCorrect ? 'correct' : 'incorrect')
  }

  const resetQuestion = () => {
    setSelected(null)
    setRevealed(false)
  }

  const switchMode = (next: DemoMode) => {
    setMode(next)
    resetQuestion()
  }

  return (
    <>
      <GameScreenShell
        header={{
          title: 'אוצר מילים',
          subtitle: 'הדגמת מעטפת',
          icon: '📚',
          score,
          coins,
          onBack: () => setExitOpen(true),
        }}
        progress={{
          current,
          total,
          onReset: () => {
            setCurrent(1)
            setScore(0)
            resetQuestion()
          },
        }}
      >
        <div className="flex flex-1 flex-col gap-4">
          <div
            className="flex flex-wrap justify-center gap-2"
            data-testid="demo-mode-toggle"
          >
            {(['text', 'media', 'binary'] as DemoMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                data-testid={`demo-mode-${m}`}
                data-active={mode === m ? 'true' : 'false'}
                className={
                  mode === m
                    ? 'rounded-full bg-[color:var(--blue-400)]/30 px-3 py-1 text-xs font-semibold text-white'
                    : 'rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-[color:var(--slate-300)] hover:bg-white/10'
                }
              >
                {m}
              </button>
            ))}
          </div>

          <MediaPromptCard
            prompt={demo.prompt}
            word={demo.word}
            media={
              demo.mediaEmoji ? (
                <span className="text-7xl">{demo.mediaEmoji}</span>
              ) : undefined
            }
            onPlayAudio={() => {}}
            audioHint={mode === 'media' ? 'השמע עוד פעם אחת' : undefined}
          />

          <AnswerGrid
            options={demo.options}
            onSelect={handleSelect}
            selectedIndex={selected}
            correctIndex={revealed ? demo.correctIndex : null}
            revealed={revealed}
            columns={demo.columns}
            variant={demo.variant ?? 'text'}
          />

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-[color:var(--slate-200)] hover:bg-white/10"
              onClick={resetQuestion}
              data-testid="demo-reset-question"
            >
              שאלה חדשה
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--amber-400)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--amber-400)] hover:bg-[color:var(--amber-400)]/30"
              onClick={() => setRewardOpen(true)}
              data-testid="demo-finish"
            >
              סיים משחק
            </button>
          </div>
        </div>
      </GameScreenShell>

      <FeedbackBanner
        variant={feedback?.variant ?? 'correct'}
        message={feedback?.message ?? ''}
        visible={feedback !== null}
        autoDismissMs={1500}
        onDismiss={() => setFeedback(null)}
      />

      <RewardModal
        open={rewardOpen}
        score={score}
        coins={coins}
        correct={current}
        total={total}
        onPlayAgain={() => {
          setRewardOpen(false)
          setCurrent(1)
          setScore(0)
          setCoins(0)
          resetQuestion()
        }}
        onExit={() => {
          setRewardOpen(false)
          navigate('/home')
        }}
        onClose={() => setRewardOpen(false)}
      />

      <ExitConfirmDialog
        open={exitOpen}
        onCancel={() => setExitOpen(false)}
        onConfirm={() => {
          setExitOpen(false)
          navigate('/home')
        }}
      />
    </>
  )
}
