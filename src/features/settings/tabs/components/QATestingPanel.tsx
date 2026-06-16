import { useCallback, useState } from 'react'
import { Sparkles, Unlock, Wand2, Eraser } from 'lucide-react'
import {
  getQAStatus,
  seedLearnedWords,
  unlockExpressionTier,
  unlockAllGames,
  clearLearnedWords,
  type QAStatus,
} from '@/bridge/qa'

/**
 * Parent/QA "unlock for testing" panel (backlog M12 sub-item, Slice A). Lives in
 * the parent-gated כלי הורה tab; opens locked content without grinding to the
 * thresholds. Drives the CURRENT user's live engine progress via `bridge/qa.ts`.
 *
 * Adult/QA chrome — deliberately plain Hebrew. It manipulates the playing child's
 * progress, so the copy is explicit that it's a testing tool, not kid-facing.
 */
export function QATestingPanel() {
  const [status, setStatus] = useState<QAStatus>(() => getQAStatus())
  const [confirmingClear, setConfirmingClear] = useState(false)

  const refresh = useCallback(() => setStatus(getQAStatus()), [])

  const seed = useCallback(
    (count: number) => {
      seedLearnedWords(count)
      refresh()
    },
    [refresh],
  )

  const expressions = useCallback(() => {
    unlockExpressionTier()
    refresh()
  }, [refresh])

  const unlockGames = useCallback(() => {
    unlockAllGames()
    refresh()
  }, [refresh])

  const clear = useCallback(() => {
    clearLearnedWords()
    setConfirmingClear(false)
    refresh()
  }, [refresh])

  const SEED_AMOUNTS = [10, 30, 50]

  return (
    <div className="space-y-4">
      {/* Live readout */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted"
        data-testid="qa-status"
      >
        <span>
          נלמדו: <strong className="text-text">{status.introduced}</strong>
        </span>
        <span>
          בשליטה: <strong className="text-text">{status.learned}</strong>
        </span>
        <span>
          מאגר: <strong className="text-text">{status.bankSize}</strong>
        </span>
        <span>
          ביטויים:{' '}
          <strong className={status.expressionsUnlocked ? 'text-learn' : 'text-coral-400'}>
            {status.expressionsUnlocked ? 'פתוח' : `נעול (צריך ${status.expressionsNeeded})`}
          </strong>
        </span>
      </div>

      {/* Seed learned words */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-text">
          <Sparkles size={14} />
          סימון מילים כנלמדו
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {SEED_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => seed(n)}
              data-testid={`qa-seed-${n}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
            >
              +{n} מילים
            </button>
          ))}
          <button
            type="button"
            onClick={() => seed(status.bankSize)}
            data-testid="qa-seed-all"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            כל המאגר
          </button>
        </div>
      </div>

      {/* One-tap unlocks */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-text">פתיחה מהירה</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expressions}
            data-testid="qa-unlock-expressions"
            className="flex items-center gap-1.5 rounded-lg bg-learn/90 px-3 py-1.5 text-xs font-medium text-ink-950 transition-colors hover:bg-learn"
          >
            <Wand2 size={14} />
            פתיחת טירת ביטויים
          </button>
          <button
            type="button"
            onClick={unlockGames}
            data-testid="qa-unlock-games"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            <Unlock size={14} />
            פתיחת כל המשחקים
          </button>
        </div>
      </div>

      {/* Undo */}
      <div className="space-y-2 border-t border-white/8 pt-3">
        {!confirmingClear ? (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            data-testid="qa-clear"
            className="flex items-center gap-1.5 rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-xs font-medium text-coral-400 transition-colors hover:bg-coral-400/15"
          >
            <Eraser size={14} />
            ניקוי המילים שנלמדו
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-coral-400/25 bg-coral-400/5 p-3">
            <span className="text-xs text-text">לנקות את כל המילים שנלמדו? (ABC יישמר; ציונים ותעודות לא יושפעו.)</span>
            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg px-3 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-text"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={clear}
                data-testid="qa-clear-confirm"
                className="rounded-lg bg-coral-400/90 px-3 py-1 text-xs font-medium text-ink-950 transition-colors hover:bg-coral-400"
              >
                ניקוי
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
