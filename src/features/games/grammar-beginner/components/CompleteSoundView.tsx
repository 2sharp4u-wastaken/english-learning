import { Volume2, Check } from 'lucide-react'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'
import type { CompleteSoundQuestion, VerbOption } from '@/bridge/grammar-beginner'
import { getPredicateHebrew } from '@/bridge/grammar-beginner'
import { TranslationFlash } from './TranslationFlash'

interface Props {
  question: CompleteSoundQuestion
  selectedKey: string | null
  locked: boolean
  onPlayContext: () => void
  onPlayVerb: (verb: string) => void
  onSelect: (verb: string) => void
}

/** Type 2: see subject + predicate pictures, pick am/is/are by audio. */
export function CompleteSoundView({
  question,
  selectedKey,
  locked,
  onPlayContext,
  onPlayVerb,
  onSelect,
}: Props) {
  const { showNikud, caseMode } = useTextPrefs()
  const nk = useNikud()
  const subjHe = showNikud ? question.subjectHebrew : stripNikud(question.subjectHebrew)
  const predHe = getPredicateHebrew(question.predicate, question.subjectKey)
  const predHeText = showNikud ? predHe : stripNikud(predHe)
  const enSentence =
    caseMode === 'lowercase'
      ? question.fullSentence.toLowerCase()
      : question.fullSentence.toUpperCase()
  const renderVerb = (verb: string) =>
    caseMode === 'lowercase' ? verb.toLowerCase() : verb.toUpperCase()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
        <p
          dir="ltr"
          data-testid="gb-sentence"
          className="font-display text-2xl font-bold text-white sm:text-3xl"
        >
          {enSentence}
        </p>
        <TranslationFlash hebrew={question.hebrewSentence} visible={locked} />
      </div>

      <div className="mx-auto flex w-full max-w-lg items-center justify-around gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">{question.subjectImage}</span>
          <span dir="rtl" className="text-sm font-bold text-white">
            {subjHe}
          </span>
          <button
            type="button"
            onClick={onPlayContext}
            data-testid="gb-play-subject"
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
          >
            <Volume2 size={12} />
            <span>{nk('השמע')}</span>
          </button>
        </div>
        <span className="font-display text-3xl font-bold text-[color:var(--slate-300)]">
          ___
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">{question.predicate.image}</span>
          <span dir="rtl" className="text-sm font-bold text-white">
            {predHeText}
          </span>
        </div>
      </div>

      <div
        data-testid="gb-options"
        className="mx-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-3"
      >
        {question.options.map((opt: VerbOption) => {
          const isCorrect = opt.verb === question.correctAnswer
          const isSelected = selectedKey === opt.verb
          const showCorrect = locked && isCorrect
          const showWrong = locked && isSelected && !isCorrect
          return (
            <div
              key={opt.verb}
              data-testid="gb-option-group"
              className={cn(
                'flex items-stretch gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition',
                showCorrect && 'border-[color:var(--mint-400)] bg-[color:var(--mint-400)]/15',
                showWrong && 'border-red-400 bg-red-500/15',
              )}
            >
              <button
                type="button"
                onClick={() => onPlayVerb(opt.verb)}
                data-testid="gb-play-verb"
                data-verb={opt.verb}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-base font-bold text-white hover:bg-white/10"
              >
                <Volume2 size={14} />
                <span>{renderVerb(opt.verb)}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelect(opt.verb)}
                disabled={locked}
                data-testid="gb-option"
                data-key={opt.verb}
                className={cn(
                  'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-3 py-2 text-[color:var(--ink-950)] transition',
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
