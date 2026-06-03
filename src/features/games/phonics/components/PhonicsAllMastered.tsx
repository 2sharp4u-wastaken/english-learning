import { RotateCcw, Home } from 'lucide-react'
import { useNikud } from '@/bridge/nikud'

interface PhonicsAllMasteredProps {
  /** Wipe `*_phonics` mastery then begin a fresh run. */
  onStartOver: () => void
  onExit: () => void
}

/**
 * Shown when generatePhonicsQuestions returns [] — every sound is at mastery
 * ≥ 0.8. Mirrors the ABC all-mastered panel with its two actions: reset / home.
 */
export function PhonicsAllMastered({ onStartOver, onExit }: PhonicsAllMasteredProps) {
  const nk = useNikud()
  return (
    <div
      data-testid="phonics-all-mastered"
      dir="rtl"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      <div className="text-6xl" aria-hidden>
        🎧
      </div>
      <h2 className="font-display text-3xl font-bold text-white">{nk('!כל הכבוד')}</h2>
      <h3 className="text-xl font-semibold text-[color:var(--amber-400)]">
        {nk('!הכרת את כל הצלילים')}
      </h3>
      <p className="text-base text-[color:var(--slate-300)]">
        {nk('את/ה מזהה עכשיו צלילים מורכבים כמו sh, ch, th וגם צלילי תנועה כמו ee ו-oo.')}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStartOver}
          data-testid="phonics-start-over"
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-6 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          <RotateCcw className="size-5" aria-hidden />
          {nk('התחל מחדש')}
        </button>
        <button
          type="button"
          onClick={onExit}
          data-testid="phonics-back-home"
          className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-white/15"
        >
          <Home className="size-5" aria-hidden />
          {nk('חזור לדף הבית')}
        </button>
      </div>
    </div>
  )
}
