import { AnswerGrid } from '@/features/games/shared/AnswerGrid'
import { useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import type { Story, StoryQuizQuestion } from '@/bridge/story-time'

export interface StoryQuizPhaseProps {
  story: Story
  question: StoryQuizQuestion
  selectedIndex: number | null
  revealed: boolean
  onSelect: (index: number) => void
}

export function StoryQuizPhase({
  story,
  question,
  selectedIndex,
  revealed,
  onSelect,
}: StoryQuizPhaseProps) {
  // Quiz options are English word-level answers (slot words + literal phrases),
  // so they respect the abc/ABC case toggle like every other game's English
  // text. The Hebrew title + question run through `nk()` so the nikud toggle
  // adds/strips vowel points on them too (Theme A — bug-dump 2026-06-07).
  const { caseMode } = useTextPrefs()
  const nk = useNikud()
  const applyCase = (s: string) =>
    caseMode === 'lowercase' ? s.toLowerCase() : s.toUpperCase()
  return (
    <section
      data-testid="story-time-quiz"
      className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-[color:var(--ink-900)]/70 p-5 backdrop-blur sm:p-6"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <p
          dir="rtl"
          data-testid="story-time-context-title"
          className="text-sm font-medium text-[color:var(--slate-300)]"
        >
          📖 {nk(story.title)}
        </p>
        <h3
          dir="rtl"
          data-testid="story-time-question"
          className="text-xl font-bold text-white sm:text-2xl"
        >
          {nk(question.question)}
        </h3>
      </header>

      <AnswerGrid
        options={question.options.map((opt) => ({ label: applyCase(opt), ariaLabel: opt }))}
        onSelect={onSelect}
        selectedIndex={selectedIndex}
        correctIndex={question.correctIndex}
        revealed={revealed}
        columns={question.options.length === 2 ? 2 : 3}
        autoFocusFirst
      />
    </section>
  )
}
