import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExitConfirmDialog } from './ExitConfirmDialog'
import { FeedbackBanner, type FeedbackVariant } from './FeedbackBanner'
import { GameScreenShell } from './GameScreenShell'
import { RewardModal } from './RewardModal'

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

  const showFeedback = (variant: FeedbackVariant) => {
    setFeedback({
      variant,
      message: variant === 'correct' ? 'כל הכבוד! 🎉' : 'לא נכון, נסה שוב',
    })
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
          },
        }}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center">
          <p className="text-[color:var(--slate-200)]">Slot for game content</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-[color:var(--mint-400)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--mint-400)] hover:bg-[color:var(--mint-400)]/30"
              onClick={() => {
                setCurrent((c) => Math.min(total, c + 1))
                setScore((s) => s + 10)
                showFeedback('correct')
              }}
              data-testid="demo-next"
            >
              הבא
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--coral-400)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--coral-400)] hover:bg-[color:var(--coral-400)]/30"
              onClick={() => showFeedback('incorrect')}
              data-testid="demo-wrong"
            >
              תשובה לא נכונה
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
