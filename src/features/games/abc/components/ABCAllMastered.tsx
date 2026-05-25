import { RotateCcw, Home } from 'lucide-react'

interface ABCAllMasteredProps {
  /** Wipe `*_abc` mastery then begin a fresh run. */
  onStartOver: () => void
  onExit: () => void
}

/**
 * Shown when generateABCQuestions returns [] — every one of the 26 letters is at
 * mastery ≥ 0.8. Mirrors the legacy `showABCMasteryComplete` congratulations
 * panel (gameLogic.js:1221) with its two actions: reset mastery / back home.
 */
export function ABCAllMastered({ onStartOver, onExit }: ABCAllMasteredProps) {
  return (
    <div
      data-testid="abc-all-mastered"
      dir="rtl"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      <div className="text-6xl" aria-hidden>
        🎓
      </div>
      <h2 className="font-display text-3xl font-bold text-white">!מדהים</h2>
      <h3 className="text-xl font-semibold text-[color:var(--amber-400)]">
        !למדת את כל 26 האותיות
      </h3>
      <p className="text-base text-[color:var(--slate-300)]">
        את/ה מכיר/ה עכשיו את כל האותיות הגדולות והקטנות באנגלית.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStartOver}
          data-testid="abc-start-over"
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-6 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          <RotateCcw className="size-5" aria-hidden />
          התחל מחדש
        </button>
        <button
          type="button"
          onClick={onExit}
          data-testid="abc-back-home"
          className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-white/15"
        >
          <Home className="size-5" aria-hidden />
          חזור לדף הבית
        </button>
      </div>
    </div>
  )
}
