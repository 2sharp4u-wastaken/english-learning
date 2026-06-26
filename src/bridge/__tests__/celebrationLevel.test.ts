import { describe, it, expect } from 'vitest'
import { celebrationLevelForPct } from '../feedback'

// The end-of-game clapping fanfare scales by score category (% correct):
//   level 3 = roaring ovation (>=90), level 2 = applause + fanfare (>=70),
//   level 1 = warm encouraging clap (<70). Shared by RewardModal + WJCelebration.
describe('celebrationLevelForPct', () => {
  it('returns level 3 for a near-perfect / perfect score', () => {
    expect(celebrationLevelForPct(100)).toBe(3)
    expect(celebrationLevelForPct(95)).toBe(3)
    expect(celebrationLevelForPct(90)).toBe(3)
  })

  it('returns level 2 for a good score', () => {
    expect(celebrationLevelForPct(89)).toBe(2)
    expect(celebrationLevelForPct(75)).toBe(2)
    expect(celebrationLevelForPct(70)).toBe(2)
  })

  it('returns level 1 for a lower score (still encouraging)', () => {
    expect(celebrationLevelForPct(69)).toBe(1)
    expect(celebrationLevelForPct(30)).toBe(1)
    expect(celebrationLevelForPct(0)).toBe(1)
  })
})
