import { Volume2, Check } from 'lucide-react'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { cn } from '@/lib/cn'
import type { SentenceOption, SoundsRightQuestion } from '@/bridge/grammar-beginner'

interface Props {
  question: SoundsRightQuestion
  selectedKey: string | null
  locked: boolean
  onPlaySentence: (sentence: string) => void
  onSelect: (sentence: string) => void
}

/** Type 3: pick the grammatically correct sentence from audio-only options. */
export function SoundsRightView({
  question,
  selectedKey,
  locked,
  onPlaySentence,
  onSelect,
}: Props) {
  const { showNikud } = useTextPrefs()
  const subjHe = showNikud ? question.subjectHebrew : stripNikud(question.subjectHebrew)
  const predHe = showNikud ? question.predicateHebrew : stripNikud(question.predicateHebrew)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p
        dir="rtl"
        className="text-center text-base font-semibold text-[color:var(--slate-300)]"
      >
        מה נשמע נכון?
      </p>

      <div className="mx-auto flex w-full max-w-lg items-center justify-around gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">{question.subjectImage}</span>
          <span dir="rtl" className="text-sm font-bold text-white">
            {subjHe}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">{question.predicateImage}</span>
          <span dir="rtl" className="text-sm font-bold text-white">
            {predHe}
          </span>
        </div>
      </div>

      <div
        data-testid="gb-options"
        className="mx-auto flex w-full max-w-lg flex-col gap-3"
      >
        {question.options.map((opt: SentenceOption, idx: number) => {
          const isCorrect = opt.sentence === question.correctAnswer
          const isSelected = selectedKey === opt.sentence
          const showCorrect = locked && isCorrect
          const showWrong = locked && isSelected && !isCorrect
          return (
            <div
              key={opt.sentence}
              data-testid="gb-option-group"
              className={cn(
                'flex items-stretch gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition',
                showCorrect && 'border-[color:var(--mint-400)] bg-[color:var(--mint-400)]/15',
                showWrong && 'border-red-400 bg-red-500/15',
              )}
            >
              <button
                type="button"
                onClick={() => onPlaySentence(opt.sentence)}
                data-testid="gb-play-sentence"
                data-sentence={opt.sentence}
                aria-label={`אפשרות ${idx + 1}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-white hover:bg-white/10"
              >
                <Volume2 size={18} />
                <span className="font-display text-base font-bold">
                  אפשרות {idx + 1}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelect(opt.sentence)}
                disabled={locked}
                data-testid="gb-option"
                data-key={opt.sentence}
                className={cn(
                  'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-4 py-3 text-[color:var(--ink-950)] transition',
                  !locked && 'hover:brightness-110',
                  locked && 'opacity-60',
                )}
                aria-label="בחר"
              >
                <Check size={18} strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
