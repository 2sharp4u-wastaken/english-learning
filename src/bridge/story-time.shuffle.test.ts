import { afterEach, describe, expect, it, vi } from 'vitest'
import { shuffleQuestionOptions, type Story } from './story-time'

function makeStory(): Story {
  return {
    id: 's1',
    title: 'כותרת',
    sentences: ['The dog ran.'],
    highlights: [],
    questions: [
      // Story data always authors the correct answer at index 0 (bug-dump E3).
      { question: 'מי רץ?', options: ['dog', 'cat', 'fish'], correctIndex: 0 },
      { question: 'מה הצבע?', options: ['red', 'blue', 'green'], correctIndex: 0 },
    ],
  }
}

afterEach(() => vi.restoreAllMocks())

describe('shuffleQuestionOptions (E3 — story quiz option shuffle)', () => {
  it('preserves the correct answer value at the remapped correctIndex', () => {
    const [story] = shuffleQuestionOptions([makeStory()])
    for (const q of story.questions) {
      expect(q.options[q.correctIndex]).toBeDefined()
    }
    // The correct values from the source must still be the marked-correct ones.
    expect(story.questions[0].options[story.questions[0].correctIndex]).toBe('dog')
    expect(story.questions[1].options[story.questions[1].correctIndex]).toBe('red')
  })

  it('keeps the same set of options (nothing added/dropped)', () => {
    const [story] = shuffleQuestionOptions([makeStory()])
    expect([...story.questions[0].options].sort()).toEqual(['cat', 'dog', 'fish'])
  })

  it('actually moves the correct answer off index 0 when the shuffle reorders', () => {
    // Force a deterministic permutation that moves index 0 elsewhere.
    // Fisher-Yates iterates i=2 then i=1; return 0 each time → swaps 2↔0 then 1↔0.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const [story] = shuffleQuestionOptions([makeStory()])
    expect(story.questions[0].correctIndex).not.toBe(0)
    // Correctness invariant still holds under the forced permutation.
    expect(story.questions[0].options[story.questions[0].correctIndex]).toBe('dog')
  })

  it('does not mutate the source story objects', () => {
    const src = makeStory()
    const srcOptionsRef = src.questions[0].options
    shuffleQuestionOptions([src])
    expect(src.questions[0].correctIndex).toBe(0)
    expect(src.questions[0].options).toBe(srcOptionsRef)
    expect(src.questions[0].options).toEqual(['dog', 'cat', 'fish'])
  })
})
