/**
 * src/engine/progress.ts — the learning brain: word mastery, the V3 mastery-driven
 * lifecycle (New/Learning/Learned/Due), spaced-review scheduling, topic/course
 * progress, certificates, and game-unlock gates.
 *
 * Slice 4.4.b1 TypeScript reimplementation of `managers/ProgressManager.js`. This
 * is the highest-stakes module — a subtly-wrong rule degrades the child's
 * experience silently (a word that never resurfaces, a game that won't unlock).
 * Every rule is byte-faithful to the legacy module; `tests/engine-parity-progress.spec.js`
 * replays the learning-lifecycle scenarios through both and asserts deep-equal.
 * See docs/learning-flow-redesign.md for the lifecycle model.
 */

export interface WordStats {
  word: string
  category: string
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  consecutiveCorrect: number
  lastSeen: string | null
  lastResult: 'correct' | 'incorrect' | null
  masteryLevel: number
  gameTypeStats: Record<string, { correct: number; total: number }>
  responseTimes: number[]
  averageResponseTime: number | null
  reviewStage: number
  reachedLearned: boolean
  lapses: number
  justMastered?: boolean
  [k: string]: unknown
}

export interface LearnedWordEntry {
  graduatedDate: string
  journeyScore: number
  journeyCompletions: number
  reinforcedIn: string[]
  lastPracticed: string
  grandfathered?: boolean
}

/**
 * Per-phrase mastery for Phase 5 expression games (Slice 5.3). Deliberately
 * lighter than WordStats — expressions are a side-channel, not part of the
 * New/Learning/Learned vocabulary lifecycle, and are keyed by `phrase` (NOT
 * `word_category`). Tracked separately so vocabulary mastery is never polluted.
 */
export interface ExprStats {
  phrase: string
  seen: number
  correct: number
  mastered: boolean
  lastSeen: string | null
}

interface Thresholds {
  mastered: number
  learning: number
  struggling: number
  minAttempts: number
  consecutiveForMastery: number
}

export class ProgressManager {
  wordMastery: Record<string, WordStats> = {}
  /** Phase 5 expression mastery, keyed by phrase (see ExprStats). */
  expressionMastery: Record<string, ExprStats> = {}
  topicProgress: Record<string, any> = {}
  courseProgress: Record<string, any> = {}
  certificates: any[] = []
  learnedWords: Record<string, LearnedWordEntry> = {}
  wordJourneyProgress: Record<string, any> = {}
  gameUnlocks: Record<string, any> = {}

  readonly thresholds: Thresholds = {
    mastered: 0.8,
    learning: 0.5,
    struggling: 0.0,
    minAttempts: 3,
    consecutiveForMastery: 2,
  }

  readonly reviewIntervalsDays = [3, 7, 14, 30]

  initialize(userProgress: any): void {
    if (!userProgress) return
    this.wordMastery = userProgress.wordMastery || {}
    this.expressionMastery = userProgress.expressionMastery || {}
    this.topicProgress = userProgress.topicProgress || {}
    this.courseProgress = userProgress.courses || {}
    this.certificates = userProgress.certificates || []
    this.learnedWords = userProgress.learnedWords || {}
    this.wordJourneyProgress = userProgress.wordJourneyProgress || {}
    this.gameUnlocks = userProgress.gameUnlocks || {}
    this.migrateToLifecycleModel()
  }

  // ── Word mastery tracking ──────────────────────────────────────────────────

  getWordStats(word: string, category: string): WordStats | null {
    if (!word) return null
    const key = `${word.toLowerCase()}_${category}`
    const legacyKey = `${word}_${category}`
    return this.wordMastery[key] || this.wordMastery[legacyKey] || null
  }

  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    gameType: string,
    responseTime: number | null = null,
  ): WordStats {
    const key = `${word.toLowerCase()}_${category}`
    const wasDue = this.isWordDue(word, category)

    const stats: WordStats = this.wordMastery[key] || this.createDefaultWordStats(word, category)

    stats.totalAttempts++
    if (isCorrect) {
      stats.correctAttempts++
      stats.consecutiveCorrect++
    } else {
      stats.incorrectAttempts++
      stats.consecutiveCorrect = 0
    }

    stats.lastSeen = new Date().toISOString()
    stats.lastResult = isCorrect ? 'correct' : 'incorrect'

    if (!stats.gameTypeStats) stats.gameTypeStats = {}
    if (!stats.gameTypeStats[gameType]) stats.gameTypeStats[gameType] = { correct: 0, total: 0 }
    stats.gameTypeStats[gameType].total++
    if (isCorrect) stats.gameTypeStats[gameType].correct++

    if (responseTime !== null) {
      if (!stats.responseTimes) stats.responseTimes = []
      stats.responseTimes.push(responseTime)
      if (stats.responseTimes.length > 10) stats.responseTimes = stats.responseTimes.slice(-10)
      stats.averageResponseTime = this.calculateAverageResponseTime(stats.responseTimes)
    }

    const previousMastery = stats.masteryLevel || 0
    stats.masteryLevel = this.calculateMastery(stats)
    stats.justMastered =
      previousMastery < this.thresholds.mastered && stats.masteryLevel >= this.thresholds.mastered

    if (typeof stats.reviewStage !== 'number') stats.reviewStage = 0
    if (wasDue) stats.reviewStage = isCorrect ? stats.reviewStage + 1 : 0

    if (typeof stats.lapses !== 'number') stats.lapses = 0
    if (this._isDerivedLearned(stats)) {
      stats.reachedLearned = true
      stats.lapses = 0
    } else if (stats.reachedLearned) {
      if (isCorrect) {
        stats.lapses = 0
      } else {
        stats.lapses += 1
        if (stats.lapses >= 2) {
          stats.reachedLearned = false
          stats.lapses = 0
        }
      }
    }

    this.wordMastery[key] = stats
    return stats
  }

  createDefaultWordStats(word: string, category: string): WordStats {
    return {
      word,
      category,
      totalAttempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      consecutiveCorrect: 0,
      lastSeen: null,
      lastResult: null,
      masteryLevel: 0,
      gameTypeStats: {},
      responseTimes: [],
      averageResponseTime: null,
      reviewStage: 0,
      reachedLearned: false,
      lapses: 0,
    }
  }

  // ── Expression mastery (Phase 5, keyed by phrase) ──────────────────────────

  /**
   * Record one expression-game attempt. Lightweight vs recordWordAttempt: bump
   * seen/correct, flag `mastered` once the child has answered it correctly
   * `consecutiveForMastery`+1 times cumulatively (3). Returns the updated stats.
   */
  recordExpressionAttempt(phrase: string, isCorrect: boolean): ExprStats {
    const key = phrase.trim().toLowerCase()
    const stats: ExprStats = this.expressionMastery[key] || {
      phrase,
      seen: 0,
      correct: 0,
      mastered: false,
      lastSeen: null,
    }
    stats.seen++
    if (isCorrect) stats.correct++
    if (stats.correct >= 3) stats.mastered = true
    stats.lastSeen = new Date().toISOString()
    this.expressionMastery[key] = stats
    return stats
  }

  /** Count of phrases that have reached the mastery threshold. */
  getMasteredExpressionCount(): number {
    return Object.values(this.expressionMastery).filter((s) => s.mastered).length
  }

  calculateMastery(stats: Partial<WordStats> | null): number {
    if (!stats || stats.totalAttempts === 0) return 0
    const accuracy = (stats.correctAttempts as number) / (stats.totalAttempts as number)
    const hasMinAttempts = (stats.totalAttempts as number) >= this.thresholds.minAttempts
    const hasHighAccuracy = accuracy >= 0.9
    const hasConsecutive = (stats.consecutiveCorrect as number) >= this.thresholds.consecutiveForMastery

    let masteryLevel = accuracy
    if (hasMinAttempts && hasHighAccuracy && hasConsecutive) {
      masteryLevel = Math.min(1.0, masteryLevel + 0.1)
    }
    return Math.round(masteryLevel * 100) / 100
  }

  calculateAverageResponseTime(times: number[]): number | null {
    if (!times || times.length === 0) return null
    const sum = times.reduce((a, b) => a + b, 0)
    return Math.round(sum / times.length)
  }

  getWordsByMasteryLevel(level: string, categories: string[] | null = null): WordStats[] {
    const words: WordStats[] = []
    Object.values(this.wordMastery).forEach((stats) => {
      if (categories && !categories.includes(stats.category)) return
      const mastery = stats.masteryLevel || 0
      let matchesLevel = false
      switch (level) {
        case 'mastered':
          matchesLevel = mastery >= this.thresholds.mastered
          break
        case 'learning':
          matchesLevel = mastery >= this.thresholds.learning && mastery < this.thresholds.mastered
          break
        case 'struggling':
          matchesLevel = mastery > 0 && mastery < this.thresholds.learning
          break
        case 'new':
          matchesLevel = mastery === 0
          break
      }
      if (matchesLevel) words.push(stats)
    })
    return words
  }

  getMasteryStats(categories: string[] | null = null) {
    let total = 0
    let mastered = 0
    let learning = 0
    let struggling = 0
    let newWords = 0
    let totalMastery = 0
    Object.values(this.wordMastery).forEach((stats) => {
      if (categories && !categories.includes(stats.category)) return
      total++
      const mastery = stats.masteryLevel || 0
      totalMastery += mastery
      if (mastery >= this.thresholds.mastered) mastered++
      else if (mastery >= this.thresholds.learning) learning++
      else if (mastery > 0) struggling++
      else newWords++
    })
    return {
      total,
      mastered,
      learning,
      struggling,
      newWords,
      averageMastery: total > 0 ? totalMastery / total : 0,
    }
  }

  // ── Topic progress ─────────────────────────────────────────────────────────

  getTopicProgress(topicId: string) {
    return (
      this.topicProgress[topicId] || {
        unlocked: false,
        started: false,
        mastery: 0,
        completedActivities: [],
        certificateEarned: false,
      }
    )
  }

  updateTopicProgress(topicId: string, updates: Record<string, unknown>): void {
    if (!this.topicProgress[topicId]) {
      this.topicProgress[topicId] = {
        unlocked: false,
        started: false,
        mastery: 0,
        completedActivities: [],
        certificateEarned: false,
        completed: false,
      }
    }
    Object.assign(this.topicProgress[topicId], updates)
  }

  completeActivity(topicId: string, activityType: string): void {
    if (!this.topicProgress[topicId]) this.updateTopicProgress(topicId, { started: true })
    const activities = this.topicProgress[topicId].completedActivities || []
    if (!activities.includes(activityType)) {
      activities.push(activityType)
      this.topicProgress[topicId].completedActivities = activities
    }
  }

  isTopicComplete(topicId: string, requiredActivities: string[]): boolean {
    const progress = this.getTopicProgress(topicId)
    return requiredActivities.every((activity) => progress.completedActivities.includes(activity))
  }

  unlockTopic(topicId: string): void {
    this.updateTopicProgress(topicId, { unlocked: true })
  }

  calculateTopicMastery(topicWords: string[] = []): number {
    if (!Array.isArray(topicWords) || topicWords.length === 0) return 0
    const bank = (window as any).vocabularyBank || []
    let totalMastery = 0
    let countedWords = 0
    topicWords.forEach((rawWord) => {
      const normalizedWord = String(rawWord || '').trim().toLowerCase()
      if (!normalizedWord) return
      const bankEntry = bank.find((entry: any) => entry.word.toLowerCase() === normalizedWord)
      const category = bankEntry?.category
      const stats = category ? this.getWordStats(rawWord, category) : null
      const learned = category ? this.isWordLearned(rawWord, category) : false
      totalMastery += learned ? 1 : stats?.masteryLevel || 0
      countedWords++
    })
    if (countedWords === 0) return 0
    return Math.round((totalMastery / countedWords) * 100) / 100
  }

  // ── Course progress ────────────────────────────────────────────────────────

  getCourseProgress(courseId: string) {
    return (
      this.courseProgress[courseId] || {
        unlocked: false,
        startedDate: null,
        currentUnit: null,
        currentTopic: null,
        completedUnits: [],
        completedTopics: [],
      }
    )
  }

  startCourse(courseId: string, firstUnitId: string, firstTopicId: string): void {
    this.courseProgress[courseId] = {
      unlocked: true,
      startedDate: new Date().toISOString(),
      currentUnit: firstUnitId,
      currentTopic: firstTopicId,
      completedUnits: [],
      completedTopics: [],
    }
  }

  updateCoursePosition(courseId: string, unitId: string, topicId: string): void {
    if (this.courseProgress[courseId]) {
      this.courseProgress[courseId].currentUnit = unitId
      this.courseProgress[courseId].currentTopic = topicId
    }
  }

  completeCourseTopicProgress(courseId: string, topicId: string): void {
    const progress = this.courseProgress[courseId]
    if (progress && !progress.completedTopics.includes(topicId)) {
      progress.completedTopics.push(topicId)
    }
  }

  // ── Certificates ───────────────────────────────────────────────────────────

  awardCertificate(certificateId: string, topicId: string, score: number) {
    const certificate = {
      id: certificateId,
      topicId,
      earnedDate: new Date().toISOString(),
      score,
    }
    const existing = this.certificates.find((c) => c.id === certificateId)
    if (!existing) {
      this.certificates.push(certificate)
    } else if (score > existing.score) {
      existing.score = score
      existing.earnedDate = certificate.earnedDate
    }
    return certificate
  }

  hasCertificate(certificateId: string): boolean {
    return this.certificates.some((c) => c.id === certificateId)
  }

  getAllCertificates(): any[] {
    return [...this.certificates]
  }

  // ── Word graduation (V2 learned words) ─────────────────────────────────────

  graduateWord(word: string, category: string, journeyScore: number): void {
    const key = `${word.toLowerCase()}_${category}`
    const today = new Date().toISOString().slice(0, 10)
    const allJourneyStages = ['discover', 'listen-match', 'spell-tiles', 'say-word', 'recall']

    if (this.learnedWords[key]) {
      this.learnedWords[key].journeyCompletions++
      if (journeyScore > this.learnedWords[key].journeyScore) {
        this.learnedWords[key].journeyScore = journeyScore
      }
      this.learnedWords[key].lastPracticed = today
    } else {
      this.learnedWords[key] = {
        graduatedDate: today,
        journeyScore,
        journeyCompletions: 1,
        reinforcedIn: [],
        lastPracticed: today,
      }
    }

    const existingJourney = this.wordJourneyProgress[key] || { completedStages: [], startedDate: today }
    this.wordJourneyProgress[key] = {
      ...existingJourney,
      completedStages: [...new Set([...(existingJourney.completedStages || []), ...allJourneyStages])],
      completed: true,
      completedDate: today,
      lastUpdated: today,
    }
  }

  recordWordReinforcement(word: string, category: string, gameType: string): void {
    const key = `${word.toLowerCase()}_${category}`
    if (!this.learnedWords[key]) return
    const today = new Date().toISOString().slice(0, 10)
    if (!this.learnedWords[key].reinforcedIn.includes(gameType)) {
      this.learnedWords[key].reinforcedIn.push(gameType)
    }
    this.learnedWords[key].lastPracticed = today
  }

  getLearnedWords(): Record<string, LearnedWordEntry> {
    return { ...this.learnedWords }
  }

  recordJourneyStageCompletion(words: { word: string; category: string }[], stageId: string): void {
    if (!Array.isArray(words) || words.length === 0 || !stageId) return
    const today = new Date().toISOString().slice(0, 10)
    words.forEach(({ word, category }) => {
      if (!word || !category) return
      const key = `${word.toLowerCase()}_${category}`
      const existing = this.wordJourneyProgress[key] || { completedStages: [], startedDate: today }
      this.wordJourneyProgress[key] = {
        ...existing,
        completedStages: existing.completedStages.includes(stageId)
          ? existing.completedStages
          : [...existing.completedStages, stageId],
        lastUpdated: today,
      }
    })
  }

  getWordJourneyProgress(): Record<string, any> {
    return { ...this.wordJourneyProgress }
  }

  getLearnedWordCount(): number {
    return Object.keys(this.learnedWords).length
  }

  isWordLearned(word: string, category: string): boolean {
    const key = `${word.toLowerCase()}_${category}`
    return key in this.learnedWords
  }

  getCompletedTopicCount(): number {
    return Object.values(this.topicProgress).filter(
      (t: any) => t?.completed === true || t?.certificateEarned === true,
    ).length
  }

  // ── V3 mastery-driven lifecycle ────────────────────────────────────────────

  _key(word: string, category: string): string {
    return `${String(word ?? '').toLowerCase()}_${category}`
  }

  migrateToLifecycleModel(): void {
    for (const entry of Object.values(this.learnedWords)) {
      if (entry && (entry as any).grandfathered === undefined) entry.grandfathered = true
    }
    for (const stats of Object.values(this.wordMastery)) {
      if (!stats) continue
      if (typeof stats.reviewStage !== 'number') stats.reviewStage = 0
      if (typeof stats.lapses !== 'number') stats.lapses = 0
      if (stats.reachedLearned === undefined) stats.reachedLearned = this._isDerivedLearned(stats)
    }
  }

  isWordIntroduced(word: string, category: string): boolean {
    if (this._key(word, category) in this.learnedWords) return true
    const stats = this.getWordStats(word, category)
    return !!stats && (stats.totalAttempts || 0) > 0
  }

  _isDerivedLearned(stats: WordStats | null): boolean {
    if (!stats) return false
    const t = this.thresholds
    return (
      (stats.totalAttempts || 0) >= t.minAttempts &&
      (stats.masteryLevel || 0) >= t.mastered &&
      (stats.consecutiveCorrect || 0) >= t.consecutiveForMastery
    )
  }

  getWordStatus(word: string, category: string): 'new' | 'learning' | 'learned' {
    const grandfathered = this._key(word, category) in this.learnedWords
    const stats = this.getWordStats(word, category)
    const introduced = grandfathered || (!!stats && (stats.totalAttempts || 0) > 0)
    if (!introduced) return 'new'
    const stickyLearned = !!stats && stats.reachedLearned === true
    if (grandfathered || this._isDerivedLearned(stats) || stickyLearned) return 'learned'
    return 'learning'
  }

  reviewIntervalDays(reviewStage = 0): number {
    const a = this.reviewIntervalsDays
    return a[Math.min(Math.max(reviewStage | 0, 0), a.length - 1)]
  }

  _lastReviewedAt(word: string, category: string): number | null {
    const key = this._key(word, category)
    const lw = this.learnedWords[key]
    const candidates = [this.wordMastery[key]?.lastSeen, lw?.lastPracticed, lw?.graduatedDate]
      .filter(Boolean)
      .map((d) => Date.parse(d as string))
      .filter((n) => !Number.isNaN(n))
    return candidates.length ? Math.max(...candidates) : null
  }

  isWordDue(word: string, category: string, now: number = Date.now()): boolean {
    if (this.getWordStatus(word, category) !== 'learned') return false
    const last = this._lastReviewedAt(word, category)
    if (last === null) return true
    const days = (now - last) / 86400000
    const stage = this.getWordStats(word, category)?.reviewStage || 0
    return days >= this.reviewIntervalDays(stage)
  }

  _eachVocabWord(cb: (word: string, category: string, key: string) => void): void {
    const seen = new Set<string>()
    const visit = (word: string, category: string) => {
      if (!word || category === 'abc') return
      const key = this._key(word, category)
      if (seen.has(key)) return
      seen.add(key)
      cb(word, category, key)
    }
    Object.values(this.wordMastery).forEach((s) => visit(s.word, s.category))
    Object.keys(this.learnedWords).forEach((k) => {
      const idx = k.lastIndexOf('_')
      if (idx > 0) visit(k.slice(0, idx), k.slice(idx + 1))
    })
  }

  getWordsByStatus(status: string, categories: string[] | null = null): { word: string; category: string }[] {
    const out: { word: string; category: string }[] = []
    this._eachVocabWord((word, category) => {
      if (categories && !categories.includes(category)) return
      if (this.getWordStatus(word, category) === status) out.push({ word, category })
    })
    return out
  }

  getDueWords(categories: string[] | null = null): { word: string; category: string }[] {
    const out: { word: string; category: string }[] = []
    this._eachVocabWord((word, category) => {
      if (categories && !categories.includes(category)) return
      if (this.isWordDue(word, category)) out.push({ word, category })
    })
    return out
  }

  getLifecycleCounts(categories: string[] | null = null) {
    const counts = { learning: 0, learned: 0, due: 0, introduced: 0, total: 0 }
    this._eachVocabWord((word, category) => {
      if (categories && !categories.includes(category)) return
      counts.total++
      const status = this.getWordStatus(word, category)
      if (status === 'learning') counts.learning++
      else if (status === 'learned') {
        counts.learned++
        if (this.isWordDue(word, category)) counts.due++
      }
      if (status !== 'new') counts.introduced++
    })
    return counts
  }

  getIntroducedCount(categories: string[] | null = null): number {
    return this.getLifecycleCounts(categories).introduced
  }

  getDerivedLearnedCount(categories: string[] | null = null): number {
    return this.getLifecycleCounts(categories).learned
  }

  getIntroducedWordKeys(categories: string[] | null = null): Set<string> {
    const keys = new Set<string>()
    this._eachVocabWord((word, category, key) => {
      if (categories && !categories.includes(category)) return
      if (this.getWordStatus(word, category) !== 'new') keys.add(key)
    })
    return keys
  }

  getLearnedWordKeys(categories: string[] | null = null): Set<string> {
    const keys = new Set<string>()
    this._eachVocabWord((word, category, key) => {
      if (categories && !categories.includes(category)) return
      if (this.getWordStatus(word, category) === 'learned') keys.add(key)
    })
    return keys
  }

  // ── Game unlocks ───────────────────────────────────────────────────────────

  getGameUnlockStatus(gameType: string): any | null {
    return this.gameUnlocks[gameType] || null
  }

  checkAndUnlockGames(learnedCount: number, topicsDone: number, abcMastery = 0): string[] {
    const today = new Date().toISOString().slice(0, 10)
    const newlyUnlocked: string[] = []

    const introduced = this.getIntroducedCount()
    const learned = this.getDerivedLearnedCount()
    void learnedCount

    const tryUnlock = (gameType: string, condition: boolean) => {
      const entry = this.gameUnlocks[gameType]
      if (entry && !entry.unlocked && condition) {
        entry.unlocked = true
        entry.unlockedDate = today
        newlyUnlocked.push(gameType)
      }
    }

    tryUnlock('listening', introduced >= 5)
    tryUnlock('picture-match', introduced >= 5)
    tryUnlock('true-or-not', introduced >= 5)
    tryUnlock('vocabulary', introduced >= 10)
    tryUnlock('pronunciation', introduced >= 10)
    tryUnlock('reading', introduced >= 10 && abcMastery >= 60)

    tryUnlock('story-time', learned >= 15)
    tryUnlock('fill-blanks', learned >= 30 && topicsDone >= 2)
    tryUnlock('scramble', learned >= 30 && topicsDone >= 2)
    tryUnlock('grammar', learned >= 50 && topicsDone >= 3)

    return newlyUnlocked
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  getProgressData() {
    return {
      wordMastery: { ...this.wordMastery },
      expressionMastery: { ...this.expressionMastery },
      topicProgress: { ...this.topicProgress },
      courses: { ...this.courseProgress },
      certificates: [...this.certificates],
      learnedWords: { ...this.learnedWords },
      wordJourneyProgress: { ...this.wordJourneyProgress },
      gameUnlocks: { ...this.gameUnlocks },
    }
  }

  restoreProgress(data: any): void {
    if (data.wordMastery) this.wordMastery = { ...data.wordMastery }
    if (data.expressionMastery) this.expressionMastery = { ...data.expressionMastery }
    if (data.topicProgress) this.topicProgress = { ...data.topicProgress }
    if (data.courses) this.courseProgress = { ...data.courses }
    if (data.certificates) this.certificates = [...data.certificates]
    if (data.learnedWords) this.learnedWords = { ...data.learnedWords }
    if (data.wordJourneyProgress) this.wordJourneyProgress = { ...data.wordJourneyProgress }
    if (data.gameUnlocks) this.gameUnlocks = { ...data.gameUnlocks }
  }
}

/** Singleton (mirrors legacy `export const progressManager`). */
export const progressManager = new ProgressManager()
