/**
 * src/engine/coins.ts — coin economy (balance, awards, streak, daily bonus).
 *
 * Slice 4.4.b1 TypeScript reimplementation of `managers/CoinManager.js`. Operates
 * on a `userProgress` object (the single source of truth, persisted by the app
 * state layer). DOM concerns from the legacy manager (updateCoinDisplay /
 * showCoinAnimation / playCoinSound) are gone — React renders the balance; a host
 * can subscribe to changes via the optional `onChange` hook. Economy numbers and
 * branching are byte-faithful; `tests/engine-parity-coins.spec.js` is the gate.
 */

export interface CoinHistoryEntry {
  amount: number
  reason: string
  gameType?: string | null
  timestamp: number
  date: string
  balance: number
}

export interface CoinUserProgress {
  coins: number
  totalCoinsEarned: number
  coinHistory: CoinHistoryEntry[]
  lastLoginDate?: string | null
  streakDays?: number
}

export interface CoinManagerOptions {
  /** Source of the current game type stamped onto history (legacy read
   *  window.gameManager?.currentGame). Defaults to null. */
  currentGameType?: () => string | null
  /** Called after any balance change so a host (React) can re-render. */
  onChange?: () => void
  /** Persist hook (legacy saveProgress). Defaults to no-op — the app state
   *  layer owns persistence now. */
  save?: () => void
}

/** Reward values (legacy CoinManager.rewards). */
export const COIN_REWARDS = {
  correctAnswer: 10,
  correctAnswerRetry: 5,
  perfectAnswer: 15,
  completeActivity: 20,
  completeTopic: 50,
  completeUnit: 100,
  dailyLogin: 10,
  streakBonus: 50, // 7-day streak
  perfectGame: 30, // 100% score
  firstTry: 5,
  speedBonus: 10,
  comboBonus: 20,
} as const

export class CoinManager {
  userProgress: CoinUserProgress
  readonly rewards = COIN_REWARDS
  initialized = false
  private currentGameType: () => string | null
  private onChange: () => void
  private save: () => void

  constructor(userProgress: CoinUserProgress, opts: CoinManagerOptions = {}) {
    this.userProgress = userProgress
    this.currentGameType = opts.currentGameType ?? (() => null)
    this.onChange = opts.onChange ?? (() => {})
    this.save = opts.save ?? (() => {})
  }

  initialize(): void {
    if (this.initialized) return
    if (typeof this.userProgress.coins === 'undefined') this.userProgress.coins = 0
    if (typeof this.userProgress.totalCoinsEarned === 'undefined') this.userProgress.totalCoinsEarned = 0
    if (!this.userProgress.coinHistory) this.userProgress.coinHistory = []
    this.checkDailyBonus()
    this.onChange()
    this.initialized = true
  }

  awardCoins(amount: number, reason = 'reward', _showAnimation = true): number {
    if (amount <= 0) return this.userProgress.coins

    this.userProgress.coins += amount
    this.userProgress.totalCoinsEarned += amount

    this.userProgress.coinHistory.push({
      amount,
      reason,
      gameType: this.currentGameType(),
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      balance: this.userProgress.coins,
    })

    if (this.userProgress.coinHistory.length > 100) {
      this.userProgress.coinHistory = this.userProgress.coinHistory.slice(-100)
    }

    this.onChange()
    this.save()
    return this.userProgress.coins
  }

  spendCoins(amount: number, reason = 'purchase'): boolean {
    if (amount <= 0) return false
    if (this.userProgress.coins < amount) return false

    this.userProgress.coins -= amount
    this.userProgress.coinHistory.push({
      amount: -amount,
      reason,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      balance: this.userProgress.coins,
    })

    this.onChange()
    this.save()
    return true
  }

  getBalance(): number {
    return this.userProgress.coins || 0
  }

  getTotalEarned(): number {
    return this.userProgress.totalCoinsEarned || 0
  }

  awardCorrectAnswer(isFirstTry = true, isFast = false): number {
    let amount = isFirstTry ? this.rewards.correctAnswer : this.rewards.correctAnswerRetry
    if (isFirstTry && isFast) amount += this.rewards.speedBonus
    this.awardCoins(amount, 'correct answer')
    return amount
  }

  awardPerfectAnswer(): number {
    this.awardCoins(this.rewards.perfectAnswer, 'perfect answer')
    return this.rewards.perfectAnswer
  }

  awardActivityComplete(): number {
    this.awardCoins(this.rewards.completeActivity, 'activity complete')
    return this.rewards.completeActivity
  }

  awardTopicComplete(): number {
    this.awardCoins(this.rewards.completeTopic, 'topic complete')
    return this.rewards.completeTopic
  }

  awardPerfectGame(): number {
    this.awardCoins(this.rewards.perfectGame, 'perfect game')
    return this.rewards.perfectGame
  }

  awardStreakBonus(streakDays: number): number {
    const amount = Math.floor(streakDays / 7) * this.rewards.streakBonus
    if (amount > 0) this.awardCoins(amount, `${streakDays}-day streak`)
    return amount
  }

  checkDailyBonus(): void {
    const today = new Date().toISOString().split('T')[0]
    const lastLogin = this.userProgress.lastLoginDate
    if (lastLogin !== today) {
      this.userProgress.lastLoginDate = today
      this.awardCoins(this.rewards.dailyLogin, 'daily login', false)
      this.updateStreak(lastLogin ?? null, today)
      this.save()
    }
  }

  updateStreak(lastLogin: string | null, today: string): void {
    if (!lastLogin) {
      this.userProgress.streakDays = 1
      return
    }
    const lastDate = new Date(lastLogin)
    const currentDate = new Date(today)
    const dayDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 1) {
      this.userProgress.streakDays = (this.userProgress.streakDays || 0) + 1
      if (this.userProgress.streakDays % 7 === 0) {
        this.awardStreakBonus(this.userProgress.streakDays)
      }
    } else if (dayDiff > 1) {
      this.userProgress.streakDays = 1
    }
  }

  getHistory(limit = 20): CoinHistoryEntry[] {
    return this.userProgress.coinHistory.slice(-limit).reverse()
  }

  getCoinsEarnedToday(): number {
    const today = new Date().toISOString().split('T')[0]
    return this.userProgress.coinHistory
      .filter((entry) => entry.date === today && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0)
  }

  getStats(): { currentBalance: number; totalEarned: number; earnedToday: number; streak: number; historyLength: number } {
    return {
      currentBalance: this.getBalance(),
      totalEarned: this.getTotalEarned(),
      earnedToday: this.getCoinsEarnedToday(),
      streak: this.userProgress.streakDays || 0,
      historyLength: this.userProgress.coinHistory.length,
    }
  }

  reset(): void {
    this.userProgress.coins = 0
    this.userProgress.totalCoinsEarned = 0
    this.userProgress.coinHistory = []
    this.onChange()
    this.save()
  }
}
