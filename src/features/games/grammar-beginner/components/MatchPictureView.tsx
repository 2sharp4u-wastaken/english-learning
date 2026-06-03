import { Volume2 } from 'lucide-react'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import { cn } from '@/lib/cn'
import type { MatchPictureQuestion, SubjectOption } from '@/bridge/grammar-beginner'
import { getPredicateHebrew } from '@/bridge/grammar-beginner'
import { TranslationFlash } from './TranslationFlash'

interface Props {
  question: MatchPictureQuestion
  selectedKey: string | null
  locked: boolean
  onPlay: () => void
  onSelect: (key: string) => void
}

/** Type 4: hear sentence, match to correct subject picture. */
export function MatchPictureView({ question, selectedKey, locked, onPlay, onSelect }: Props) {
  const { showNikud, caseMode } = useTextPrefs()
  const nk = useNikud()
  const predHe = getPredicateHebrew(question.predicate, question.correctAnswer)
  const predHeText = showNikud ? predHe : stripNikud(predHe)
  const enSentence =
    caseMode === 'lowercase'
      ? question.sentenceAudio.toLowerCase()
      : question.sentenceAudio.toUpperCase()

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
        <button
          type="button"
          onClick={onPlay}
          data-testid="gb-play-sentence"
          className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <Volume2 size={16} />
          <span>{nk('השמע שוב')}</span>
        </button>
        <TranslationFlash hebrew={question.hebrewSentence} visible={locked} />
      </div>

      <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
        <span className="text-5xl">{question.predicate.image}</span>
        <span dir="rtl" className="text-lg font-bold text-white">
          {predHeText}
        </span>
      </div>

      <div
        data-testid="gb-options"
        className="mx-auto grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {question.options.map((opt: SubjectOption) => {
          const isCorrect = opt.key === question.correctAnswer
          const isSelected = selectedKey === opt.key
          const showCorrect = locked && isCorrect
          const showWrong = locked && isSelected && !isCorrect
          const heText = showNikud ? opt.hebrew : stripNikud(opt.hebrew)
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              disabled={locked}
              data-testid="gb-option"
              data-key={opt.key}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-sm transition',
                !locked && 'hover:-translate-y-0.5 hover:bg-white/10',
                showCorrect && 'border-[color:var(--mint-400)] bg-[color:var(--mint-400)]/15',
                showWrong && 'border-red-400 bg-red-500/15',
                locked && !showCorrect && !showWrong && 'opacity-60',
              )}
            >
              <span className="text-5xl">{opt.image}</span>
              <span dir="rtl" className="text-sm font-bold">
                {heText}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
