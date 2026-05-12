import { useNavigate } from 'react-router-dom'

export interface ListeningLearnFirstProps {
  learnedCount: number
}

export function ListeningLearnFirst({ learnedCount }: ListeningLearnFirstProps) {
  const navigate = useNavigate()
  return (
    <section
      data-testid="listening-learn-first"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-8 text-center backdrop-blur"
    >
      <div className="text-5xl" aria-hidden>
        🔒
      </div>
      <h2 className="text-2xl font-bold text-white">עוד מעט!</h2>
      <p className="text-base text-[color:var(--slate-200)]">
        למדת <strong>{learnedCount}</strong> מילים עד כה.
      </p>
      <p className="text-sm text-[color:var(--slate-300)]">
        כדי לשחק במשחק ההאזנה צריך ללמוד לפחות 4 מילים. בוא נמשיך במסע
        המילים!
      </p>
      <button
        type="button"
        onClick={() => navigate('/game/word-journey')}
        data-testid="listening-learn-first-cta"
        className="rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-6 py-2.5 text-sm font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
      >
        🗺️ למסע המילים
      </button>
    </section>
  )
}
