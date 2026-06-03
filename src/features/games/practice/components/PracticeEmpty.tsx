import { useNavigate } from 'react-router-dom'
import { useNikud } from '@/bridge/nikud'

export interface PracticeEmptyProps {
  /** How many words the child has Learned (0 → nothing to review yet). */
  learnedCount: number
}

/**
 * Practice draws from Learned ∪ Due words, so the only empty case is "no Learned
 * words yet". Friendlier than the locked picture-match gate — Practice is always
 * available, there's just nothing to review until the child learns something.
 */
export function PracticeEmpty({ learnedCount }: PracticeEmptyProps) {
  const navigate = useNavigate()
  const nk = useNikud()
  return (
    <section
      data-testid="practice-empty"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-8 text-center backdrop-blur"
    >
      <div className="text-5xl" aria-hidden>
        🌱
      </div>
      <h2 className="text-2xl font-bold text-white">{nk('אין עדיין מילים לחזרה')}</h2>
      <p className="text-base text-[color:var(--slate-200)]">
        {nk('למדת')} <strong>{learnedCount}</strong> {nk('מילים עד כה.')}
      </p>
      <p className="text-sm text-[color:var(--slate-300)]">
        {nk('מצב התרגול חוזר על מילים שכבר למדת כדי לחזק אותן. בוא נלמד עוד מילים חדשות במסע המילים, ואז נחזור לתרגל!')}
      </p>
      <button
        type="button"
        onClick={() => navigate('/game/word-journey')}
        data-testid="practice-empty-cta"
        className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-6 py-2.5 text-sm font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        🗺️ {nk('למסע המילים')}
      </button>
    </section>
  )
}
