/**
 * src/engine/score.ts — scoring, points, coin-amount, XP, and percentage rules.
 *
 * Slice 4.4.b1 TypeScript reimplementation of the legacy `managers/ScoreManager.js`.
 * Pure calculator + a per-game score map; no DOM. Behavior is pinned by
 * `tests/engine-pure-logic.spec.js` (legacy) and proven identical to the legacy
 * module by `tests/engine-parity-score.spec.js`. Keep the constants and formulas
 * byte-faithful — the parity spec is the gate.
 */

export type GameType = string

export interface PerformanceRating {
  label: string
  labelEn: string
  emoji: string
  level: 'perfect' | 'excellent' | 'very-good' | 'good' | 'okay' | 'needs-practice'
}

export interface CoinContext {
  isPerfect?: boolean
  streakDays?: number
}

/** Coin amounts awarded per action (legacy ScoreManager.coinRewards). */
export const COIN_REWARDS = {
  correctFirstTry: 10,
  correctRetry: 5,
  completeActivity: 20,
  completeTopic: 50,
  completeUnit: 100,
  dailyLogin: 10,
  streakBonus7: 50,
  streakBonus14: 100,
  streakBonus30: 200,
  perfectGame: 30,
} as const

/** Per-game XP multipliers (legacy getGameXPMultiplier). Default 1.0. */
const XP_MULTIPLIERS: Record<string, number> = {
  vocabulary: 1.0,
  grammar: 1.2,
  'grammar-beginner': 1.0,
  pronunciation: 1.3,
  listening: 1.1,
  reading: 1.2,
  memory: 1.0,
  scramble: 1.5,
  'fill-blanks': 1.3,
  practice: 1.5,
  abc: 0.8,
}

const DEFAULT_GAME_TYPES = [
  'vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening',
  'reading', 'practice', 'abc', 'memory', 'scramble', 'fill-blanks',
  'word-journey', 'picture-match', 'true-or-not', 'story-time',
]

export class ScoreManager {
  scores: Record<string, number> = {}
  readonly coinRewards = COIN_REWARDS

  initialize(): void {
    this.initializeScores(DEFAULT_GAME_TYPES)
  }

  initializeScores(gameTypes: string[]): void {
    gameTypes.forEach((type) => {
      this.scores[type] = 0
    })
  }

  getScore(gameType: GameType): number {
    return this.scores[gameType] || 0
  }

  setScore(gameType: GameType, score: number): void {
    this.scores[gameType] = score
  }

  addPoints(gameType: GameType, points: number): number {
    if (!this.scores[gameType]) this.scores[gameType] = 0
    this.scores[gameType] += points
    return this.scores[gameType]
  }

  resetScore(gameType: GameType): void {
    this.scores[gameType] = 0
  }

  resetAllScores(): void {
    Object.keys(this.scores).forEach((type) => {
      this.scores[type] = 0
    })
  }

  /** Coins for an action, with perfect-activity and daily-login streak bonuses. */
  calculateCoins(action: string, context: CoinContext = {}): number {
    let coins = (this.coinRewards as Record<string, number>)[action] || 0

    if (context.isPerfect && action === 'completeActivity') {
      coins += this.coinRewards.perfectGame
    }

    if (action === 'dailyLogin' && context.streakDays) {
      if (context.streakDays >= 30) coins += this.coinRewards.streakBonus30
      else if (context.streakDays >= 14) coins += this.coinRewards.streakBonus14
      else if (context.streakDays >= 7) coins += this.coinRewards.streakBonus7
    }

    return coins
  }

  calculatePercentage(correct: number, total: number): number {
    if (total === 0) return 0
    return Math.round((correct / total) * 100)
  }

  getPerformanceRating(percentage: number): PerformanceRating {
    if (percentage >= 100) return { label: 'מושלם!', labelEn: 'Perfect!', emoji: '🌟', level: 'perfect' }
    if (percentage >= 90) return { label: 'מעולה!', labelEn: 'Excellent!', emoji: '🎉', level: 'excellent' }
    if (percentage >= 80) return { label: 'טוב מאוד!', labelEn: 'Very Good!', emoji: '👏', level: 'very-good' }
    if (percentage >= 70) return { label: 'טוב!', labelEn: 'Good!', emoji: '👍', level: 'good' }
    if (percentage >= 60) return { label: 'לא רע!', labelEn: 'Not Bad!', emoji: '🙂', level: 'okay' }
    return { label: 'המשך להתאמן!', labelEn: 'Keep Practicing!', emoji: '💪', level: 'needs-practice' }
  }

  calculateXP(correct: number, total: number, gameType: GameType): number {
    const baseXP = correct * 10
    const bonusMultiplier = this.getGameXPMultiplier(gameType)
    const perfectBonus = correct === total ? 20 : 0
    return Math.round(baseXP * bonusMultiplier + perfectBonus)
  }

  getGameXPMultiplier(gameType: GameType): number {
    return XP_MULTIPLIERS[gameType] ?? 1.0
  }

  getAllScores(): Record<string, number> {
    return { ...this.scores }
  }

  restoreScores(savedScores: Record<string, number> | null | undefined): void {
    if (savedScores && typeof savedScores === 'object') {
      this.scores = { ...savedScores }
    }
  }
}

/** Singleton (mirrors legacy `export const scoreManager`). */
export const scoreManager = new ScoreManager()
