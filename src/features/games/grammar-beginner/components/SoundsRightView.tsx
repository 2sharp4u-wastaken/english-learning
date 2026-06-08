import { Volume2, Check } from 'lucide-react'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'
import type { SentenceOption, SoundsRightQuestion } from '@/bridge/grammar-beginner'
import { TranslationFlash } from './TranslationFlash'

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
  const nk = useNikud()
  const subjHe = showNikud ? question.subjectHebrew : stripNikud(question.subjectHebrew)
  const predHe = showNikud ? question.predicateHebrew : stripNikud(question.predicateHebrew)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p
        dir="rtl"
        className="text-center text-base font-semibold text-[color:var(--slate-300)]"
      >
        {nk('מה נשמע נכון?')}
      </p>

      <div className="mx-auto flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex items-center justify-around gap-2">
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
        <TranslationFlash hebrew={question.hebrewSentence} visible={locked} />
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
              dir="ltr"
              className={cn(
                'flex items-stretch gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition',
                showCorrect && 'border-[color:var(--mint-400)] bg-[color:var(--mint-400)]/15',
                showWrong && 'border-red-400 bg-red-500/15',
              )}
            >
              {/* Speaker is play-only, on the LEFT; the option itself is the
                  answer affordance with a blue ✓ (D5, bug-dump 2026-06-07). */}
              <button
                type="button"
                onClick={() => onPlaySentence(opt.sentence)}
                data-testid="gb-play-sentence"
                data-sentence={opt.sentence}
                aria-label={`השמע אפשרות ${idx + 1}`}
                className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-3 text-white hover:bg-white/10"
              >
                <Volume2 size={18} />
              </button>
              <button
                type="button"
                onClick={() => onSelect(opt.sentence)}
                disabled={locked}
                data-testid="gb-option"
                data-key={opt.sentence}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-white transition',
                  !locked && 'hover:bg-white/10',
                  locked && 'opacity-60',
                )}
              >
                <span dir="rtl" className="font-display text-base font-bold">
                  {nk('אפשרות')} {idx + 1}
                </span>
                <Check
                  size={18}
                  strokeWidth={3}
                  className="text-[color:var(--blue-400)]"
                  aria-hidden
                />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
