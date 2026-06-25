/**
 * src/engine/appState.ts — application state: user-progress load/save/migrate,
 * settings, word stats, score/milestone updates, and manager wiring.
 *
 * Slice 4.4.b1 TypeScript reimplementation of the DATA half of `app.js`
 * (AppManager). Every `render*`/`showScreen`/DOM method is dropped — React owns
 * those pages — and the few DOM side effects that data methods used to trigger
 * (high-score toast, certificate modal, gallery/courses refresh) become host
 * hooks (default no-op). This is the localStorage I/O boundary: it reads/writes
 * the same `v2_*` keys with the same shapes so existing saves migrate intact.
 *
 * Ambient legacy deps are injected so the class is host-agnostic + testable
 * (same pattern as courses.ts): `getUserId` (was authService / localStorage),
 * `vocabularyBank` (was `window.vocabularyBank`), `allCourses`, and the manager
 * factory used by `initializeManagers`. `tests/engine-parity-appstate.spec.js`
 * replays the data scenarios through the booted legacy `window.app` and asserts
 * deep-equal.
 */

export const V2_STORAGE_PREFIX = 'v2_'

export interface WordObj {
  word: string
  translation: string
  category: string
  image?: string
  imageUrl?: string
  [k: string]: unknown
}

export interface AppSettings {
  soundEnabled: boolean
  speechRate: number
  autoPlayAudio: boolean
  showPhonetics: boolean
  language: string
  [k: string]: unknown
}

export interface MilestoneCertificate {
  id: string
  topicId: string
  topicName: string
  earnedDate: string
  score: number
  timestamp: number
  isMilestone: boolean
  milestoneCount?: number
}

/** Minimal manager surface AppState wires/drives. */
export interface AppManagers {
  scoreManager?: any
  progressManager?: any
  courseManager?: any
  certificateManager?: any
  coinManager?: any
}

export interface AppStateOptions {
  /** Resolve the active user id (legacy: authService.getCurrentUserId() →
   *  localStorage 'currentUser' → 'O'). */
  getUserId?: () => string | null
  /** The full vocabulary bank (legacy `window.vocabularyBank`). */
  vocabularyBank?: () => WordObj[]
  /** All course definitions to register (legacy module-level `allCourses`). */
  allCourses?: any[]
  /** Build the managers given the loaded userProgress + a save hook. Defaults to
   *  a no-op (managers stay null) so the class can be exercised in isolation. */
  createManagers?: (userProgress: any, save: () => void) => AppManagers
  /** High-score / course-unlock notifications (legacy `showAchievement`). */
  onAchievement?: (message: string) => void
  /** Celebration modal for a newly earned certificate (legacy `showCertificateModal`). */
  onCertificateModal?: (topicName: string, score: number) => void
  /** Re-render the certificate gallery (legacy `renderCertificateGallery`). */
  onCertificateGalleryRefresh?: () => void
  /** Re-render the courses screen (legacy `renderCoursesScreen`). */
  onCoursesRefresh?: () => void
  /** Push freshly applied settings into the game engine (legacy
   *  `window.gameManager.applySettings`). */
  onSettingsApplied?: (settings: AppSettings) => void
}

export type CertDifficulty = 'easy' | 'normal' | 'hard'

export class AppState {
  /**
   * Two milestone-certificate TRACKS (cert-level recalibration, 2026-06-25):
   *   - `met` (discovery): driven by words *introduced* (≥1 attempt) — fast-growing.
   *     Cheap, frequent dopamine for young learners.
   *   - `mastered` (prestige): driven by derived-Learned words (`getDerivedLearnedCount`)
   *     — slow-growing, the "real" achievement. Reuses the legacy prestige cert IDs so
   *     any grandfathered award survives.
   * Each track has 5 FIXED tiers with STABLE ids. The per-tier threshold COUNT comes
   * from `MILESTONE_THRESHOLDS[track][certDifficulty]`, never the id — so changing the
   * parent difficulty preset can only ever ADD a newly-qualifying tier and never
   * revokes an earned one (award logic is purely additive). WHY two tracks + presets:
   * docs/backlog.md "Certificate / level recalibration".
   */
  static MILESTONE_TIERS: Record<'met' | 'mastered', { id: string; name: string; icon: string }[]> = {
    met: [
      { id: 'milestone-met-1', name: 'פגשתי מילה!', icon: '🌱' },
      { id: 'milestone-met-2', name: 'מגלה מילים', icon: '🔍' },
      { id: 'milestone-met-3', name: 'אספן מילים', icon: '🎒' },
      { id: 'milestone-met-4', name: 'חוקר מילים', icon: '🗺️' },
      { id: 'milestone-met-5', name: 'ים של מילים', icon: '🌈' },
    ],
    mastered: [
      { id: 'milestone-first-word', name: 'הצעד הראשון', icon: '🌱' },
      { id: 'milestone-word-explorer', name: 'לומד/ת מצטיין/ת', icon: '⭐' },
      { id: 'milestone-word-master', name: 'מומחה מילים', icon: '🌟' },
      { id: 'milestone-word-champion', name: 'אלוף המילים', icon: '🏆' },
      { id: 'milestone-word-legend', name: 'אגדת המילים', icon: '👑' },
    ],
  }

  /** Per-tier threshold counts by track + parent difficulty preset (5 tiers each). */
  static MILESTONE_THRESHOLDS: Record<'met' | 'mastered', Record<CertDifficulty, number[]>> = {
    met: {
      easy: [1, 5, 15, 30, 60],
      normal: [1, 10, 25, 50, 100],
      hard: [1, 25, 50, 100, 200],
    },
    mastered: {
      easy: [1, 3, 10, 20, 40],
      normal: [1, 5, 15, 30, 60],
      hard: [1, 10, 25, 50, 100],
    },
  }

  static GAME_MILESTONES = [
    {
      id: 'milestone-abc-hero',
      topicId: 'milestone-abc-hero',
      topicName: '🔤 ABC Hero',
      predicate: (gameType: string, score: number) => gameType === 'abc' && score === 100,
    },
    {
      id: 'milestone-sentence-builder',
      topicId: 'milestone-sentence-builder',
      topicName: '🧩 Sentence Builder',
      predicate: (gameType: string, score: number) =>
        ['scramble', 'fill-blanks'].includes(gameType) && score === 100,
    },
    {
      id: 'milestone-perfect-listener',
      topicId: 'milestone-perfect-listener',
      topicName: '🎧 Perfect Listener',
      predicate: (gameType: string, score: number) => gameType === 'listening' && score === 100,
    },
  ]

  currentUser: string | null = null
  userProgress: any = null
  settings: AppSettings

  scoreManager: any = null
  progressManager: any = null
  courseManager: any = null
  certificateManager: any = null
  coinManager: any = null

  private opts: AppStateOptions

  constructor(opts: AppStateOptions = {}) {
    this.opts = opts
    this.settings = this.loadSettings()
  }

  // ── User id resolution ───────────────────────────────────────────────────

  private resolveUserId(): string {
    if (this.opts.getUserId) {
      const id = this.opts.getUserId()
      if (id) return id
    }
    if (this.currentUser) return this.currentUser
    return localStorage.getItem('currentUser') || 'O'
  }

  // ── Progress load / save / migrate ─────────────────────────────────────────

  loadUserProgress(): any {
    const userId = this.resolveUserId()
    const storageKey = `${V2_STORAGE_PREFIX}userProgress_${userId}`
    const saved = localStorage.getItem(storageKey)

    if (saved) {
      try {
        const progress = JSON.parse(saved)
        return this.migrateUserProgress(progress)
      } catch (error) {
        console.error('Error loading user progress:', error)
        return this.getDefaultProgress()
      }
    }
    return this.getDefaultProgress()
  }

  migrateUserProgress(oldProgress: any): any {
    // Already at latest version — just patch any fields added after the version was cut
    if (oldProgress.version === 4) {
      if (typeof oldProgress.totalPoints !== 'number') oldProgress.totalPoints = 0
      if (typeof oldProgress.totalLearningTimeMs !== 'number') oldProgress.totalLearningTimeMs = 0
      oldProgress.bestScores = { ...this.getDefaultProgress().bestScores, ...(oldProgress.bestScores || {}) }
      if (!oldProgress.learnedWords) oldProgress.learnedWords = {}
      if (!oldProgress.wordJourneyProgress) oldProgress.wordJourneyProgress = {}
      if (!oldProgress.gameUnlocks) {
        oldProgress.gameUnlocks = this.getDefaultProgress().gameUnlocks
      } else {
        // Merge in any new game unlock entries added after v4 was cut
        const defaults = this.getDefaultProgress().gameUnlocks
        for (const key of Object.keys(defaults)) {
          if (!(key in oldProgress.gameUnlocks)) {
            oldProgress.gameUnlocks[key] = defaults[key]
          }
        }
      }
      return oldProgress
    }

    console.log(`Migrating user progress from v${oldProgress.version || 1} to v4...`)

    let migratedProgress = { ...oldProgress }
    migratedProgress.bestScores = { ...this.getDefaultProgress().bestScores, ...(migratedProgress.bestScores || {}) }

    // v1 → v2 (word mastery)
    if (!migratedProgress.version || migratedProgress.version < 2) {
      migratedProgress.wordMastery = migratedProgress.wordMastery || {}
    }

    // v2 → v3 (course system)
    if (!migratedProgress.version || migratedProgress.version < 3) {
      migratedProgress.courses = migratedProgress.courses || {}
      migratedProgress.topicProgress = migratedProgress.topicProgress || {}
      migratedProgress.certificates = migratedProgress.certificates || []
      migratedProgress.coins = migratedProgress.coins || 0
      migratedProgress.totalCoinsEarned = migratedProgress.totalCoinsEarned || 0
      migratedProgress.coinHistory = migratedProgress.coinHistory || []
      migratedProgress.lastLoginDate = migratedProgress.lastLoginDate || null
      migratedProgress.studentName = migratedProgress.studentName || null
      migratedProgress.totalPoints = migratedProgress.totalPoints || 0
    }

    // v3 → v4 (learning system: learnedWords + gameUnlocks)
    if (!migratedProgress.version || migratedProgress.version < 4) {
      migratedProgress.learnedWords = migratedProgress.learnedWords || {}
      migratedProgress.wordJourneyProgress = migratedProgress.wordJourneyProgress || {}
      migratedProgress.gameUnlocks = migratedProgress.gameUnlocks || this.getDefaultProgress().gameUnlocks
    }

    if (typeof migratedProgress.totalLearningTimeMs !== 'number') {
      migratedProgress.totalLearningTimeMs = 0
    }

    migratedProgress.version = 4

    this.userProgress = migratedProgress
    this.saveUserProgress()

    console.log('Migration complete to v4')
    return migratedProgress
  }

  getDefaultProgress(): any {
    return {
      hasPlayedBefore: false,
      totalGamesPlayed: 0,
      bestScores: {
        'word-journey': 0,
        vocabulary: 0,
        grammar: 0,
        'grammar-beginner': 0,
        pronunciation: 0,
        listening: 0,
        reading: 0,
        abc: 0,
        phonics: 0,
        memory: 0,
        'picture-match': 0,
        scramble: 0,
        'fill-blanks': 0,
        'true-or-not': 0,
        'story-time': 0,
      },
      streakDays: 0,
      lastPlayDate: null,
      totalCorrectAnswers: 0,
      wordMastery: {},
      expressionMastery: {},
      lastSessionWordKeys: {},

      // Course system (v3)
      courses: {},
      topicProgress: {},
      certificates: [],

      // Score totals
      totalPoints: 0,
      totalLearningTimeMs: 0,

      // Coins economy
      coins: 0,
      totalCoinsEarned: 0,
      coinHistory: [],
      lastLoginDate: null,

      // User profile
      studentName: null,

      // V2 learning system (v4)
      learnedWords: {},
      wordJourneyProgress: {},
      gameUnlocks: {
        'word-journey': { unlocked: true, unlockedDate: null },
        abc: { unlocked: true, unlockedDate: null },
        phonics: { unlocked: true, unlockedDate: null },
        memory: { unlocked: true, unlockedDate: null },
        'grammar-beginner': { unlocked: true, unlockedDate: null },
        articles: { unlocked: true, unlockedDate: null },
        progressive: { unlocked: true, unlockedDate: null },
        listening: { unlocked: false, requirement: '5 מילים שנלמדו', requiredCount: 5 },
        'picture-match': { unlocked: false, requirement: '5 מילים שנלמדו', requiredCount: 5 },
        reading: { unlocked: false, requirement: '10 מילים + ABC 60%', requiredCount: 10, requiredAbcMastery: 0.6 },
        pronunciation: { unlocked: false, requirement: '10 מילים שנלמדו', requiredCount: 10 },
        'fill-blanks': { unlocked: false, requirement: '30 מילים + 2 נושאים', requiredCount: 30, requiredTopics: 2 },
        scramble: { unlocked: false, requirement: '30 מילים + 2 נושאים', requiredCount: 30, requiredTopics: 2 },
        grammar: { unlocked: false, requirement: '50 מילים + 3 נושאים', requiredCount: 50, requiredTopics: 3 },
        vocabulary: { unlocked: false, requirement: '10 מילים שנלמדו', requiredCount: 10 },
        'true-or-not': { unlocked: false, requirement: '5 מילים שנלמדו', requiredCount: 5 },
        'story-time': { unlocked: false, requirement: '15 מילים שנלמדו', requiredCount: 15 },
      },

      version: 4,
    }
  }

  saveUserProgress(): void {
    const userId = this.resolveUserId()

    // Track today's activity date
    const todayStr = new Date().toISOString().slice(0, 10)
    if (!this.userProgress.activityDates) {
      this.userProgress.activityDates = []
    }
    if (!this.userProgress.activityDates.includes(todayStr)) {
      this.userProgress.activityDates.push(todayStr)
      // Keep only last 60 days to limit storage growth
      if (this.userProgress.activityDates.length > 60) {
        this.userProgress.activityDates = this.userProgress.activityDates.slice(-60)
      }
    }

    const storageKey = `${V2_STORAGE_PREFIX}userProgress_${userId}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.userProgress))
    } catch (error) {
      console.error('Error saving user progress:', error)
    }
  }

  // ── Word stats ─────────────────────────────────────────────────────────────

  getWordStats(word: string, category: string): any {
    if (!this.userProgress || !this.userProgress.wordMastery) {
      return null
    }
    const wordKey = `${word}_${category}`
    return this.userProgress.wordMastery[wordKey] || null
  }

  saveWordStats(word: string, category: string, stats: any): void {
    if (!this.userProgress) {
      console.warn('Cannot save word stats: userProgress not initialized')
      return
    }
    if (!this.userProgress.wordMastery) {
      this.userProgress.wordMastery = {}
    }
    const wordKey = `${word}_${category}`
    this.userProgress.wordMastery[wordKey] = stats
    this.saveUserProgress()
  }

  /**
   * Return the subset of vocabulary that a given game type is allowed to use.
   * Gated games get only words the child has graduated; ungated games get the
   * full bank.
   */
  getFilteredWordsForGame(gameType: string): WordObj[] {
    const bank = this.opts.vocabularyBank?.() ?? []

    const UNGATED_GAMES = new Set(['word-journey', 'abc', 'phonics', 'grammar-beginner', 'practice'])
    if (UNGATED_GAMES.has(gameType)) {
      return bank
    }

    // Memory game: hybrid — use learned words when ≥12 available, otherwise full bank
    if (gameType === 'memory') {
      const learnedWords = this.userProgress?.learnedWords || {}
      const learnedBank = bank.filter((w) =>
        Object.prototype.hasOwnProperty.call(learnedWords, `${w.word.toLowerCase()}_${w.category}`),
      )
      return learnedBank.length >= 12 ? learnedBank : bank
    }

    const learnedWords = this.userProgress?.learnedWords || {}
    const learnedKeys = new Set(Object.keys(learnedWords))

    if (learnedKeys.size === 0) {
      return []
    }

    return bank.filter((w) => learnedKeys.has(`${w.word.toLowerCase()}_${w.category}`))
  }

  calculateMastery(wordStats: any): number {
    if (!wordStats || wordStats.totalAttempts === 0) {
      return 0
    }

    const accuracy = wordStats.correctAttempts / wordStats.totalAttempts
    const hasMinAttempts = wordStats.totalAttempts >= 3
    const hasHighAccuracy = accuracy >= 0.9
    const hasConsecutive = wordStats.consecutiveCorrect >= 2

    let masteryLevel = accuracy

    if (hasMinAttempts && hasHighAccuracy && hasConsecutive) {
      masteryLevel = Math.min(1.0, masteryLevel + 0.1)
    }

    return Math.round(masteryLevel * 100) / 100
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  loadSettings(): AppSettings {
    const saved = localStorage.getItem(`${V2_STORAGE_PREFIX}englishLearningSettings`)
    return saved
      ? JSON.parse(saved)
      : {
          soundEnabled: true,
          speechRate: 0.9,
          autoPlayAudio: true,
          showPhonetics: true,
          language: 'en',
        }
  }

  saveSettings(): void {
    localStorage.setItem(`${V2_STORAGE_PREFIX}englishLearningSettings`, JSON.stringify(this.settings))
    this.opts.onSettingsApplied?.(this.settings)
  }

  // ── Progress updates on game finish ──────────────────────────────────────────

  updateProgress(gameType: string, score: number, context: any = {}): void {
    if (!this.userProgress) {
      console.warn('Cannot update progress: userProgress not initialized')
      return
    }

    this.userProgress.totalGamesPlayed++

    if (score > this.userProgress.bestScores[gameType]) {
      this.userProgress.bestScores[gameType] = score
      this.opts.onAchievement?.(`New ${gameType} high score: ${score}!`)
    }

    // Streak is managed by CoinManager.checkDailyBonus() on login.

    this._trackCourseActivityFromGame(gameType, score, context)
    const gameMilestones = this.checkGameMilestoneCertificates(gameType, score)

    // Show celebration modal for newly earned game milestones
    let delay = 1500
    if (gameMilestones.length > 0) {
      for (const cert of gameMilestones) {
        setTimeout(() => this.opts.onCertificateModal?.(cert.topicName, cert.score), delay)
        delay += 2500
      }
    }

    // Word-count milestone certificates (met + mastered tracks). Continue the modal
    // cascade after any game milestones so the celebrations don't overlap.
    this.checkMilestoneCertificates(delay)

    this.saveUserProgress()
  }

  _trackCourseActivityFromGame(gameType: string, score: number, context: any = {}): any {
    if (!this.courseManager) return null

    const result = this.courseManager.completeGameActivity({
      topicId: context.topicId,
      activityType: context.activityType || gameType,
      score,
      sessionWords: context.words || [],
    })

    if (!result?.thresholdMet) {
      return result
    }

    if (result.activityCompletedNow) {
      this.coinManager?.awardActivityComplete()
    }

    if (result.topicCompletedNow && result.topic) {
      const topicName = result.topic.nameHebrew || result.topic.name

      if (
        result.topic.certificateId &&
        this.certificateManager &&
        !this.certificateManager.hasCertificate(result.topic.certificateId)
      ) {
        this.certificateManager.awardCertificate({
          id: result.topic.certificateId,
          topicId: result.topicId,
          topicName,
          score,
        })
      }

      const topicProgress = this.userProgress.topicProgress?.[result.topicId]
      if (topicProgress) {
        topicProgress.certificateEarned = true
      }

      this.coinManager?.awardTopicComplete()
      setTimeout(() => this.opts.onCertificateModal?.(topicName, score), 2000)
      this.opts.onCertificateGalleryRefresh?.()
    }

    if ((result.newlyUnlockedCourses || []).length > 0) {
      result.newlyUnlockedCourses.forEach((courseId: string) => {
        const course = this.courseManager.getCourse(courseId)
        const courseName = course?.nameHebrew || course?.name || courseId
        this.opts.onAchievement?.(`📚 קורס חדש נפתח: ${courseName}`)
      })
      this.opts.onCoursesRefresh?.()
    }

    return result
  }

  // ── Milestone certificates ───────────────────────────────────────────────────

  /** Active certificate difficulty preset (parent setting; defaults to 'normal'). */
  private certDifficulty(): CertDifficulty {
    const v = (this.settings as any)?.certDifficulty
    return v === 'easy' || v === 'hard' ? v : 'normal'
  }

  /**
   * Award word-count milestone certificates across BOTH tracks — `met` (words
   * introduced) and `mastered` (derived-Learned) — using the thresholds for the
   * current `certDifficulty` preset. Idempotent + additive (never revokes), so it's
   * safe to call after every game finish and after a preset change. Fires the
   * celebration modal for each newly-earned cert (staggered, starting at `startDelay`).
   * Counts come from the live ProgressManager, so the caller passes nothing.
   */
  checkMilestoneCertificates(startDelay = 1500): MilestoneCertificate[] {
    if (!this.userProgress) return []
    const pm = this.progressManager
    if (!pm) return []

    if (!this.userProgress.certificates) {
      this.userProgress.certificates = []
    }
    const earnedIds = new Set(this.userProgress.certificates.map((c: any) => c.id))

    const preset = this.certDifficulty()
    const counts: Record<'met' | 'mastered', number> = {
      met: pm.getIntroducedCount?.() ?? 0,
      mastered: pm.getDerivedLearnedCount?.() ?? 0,
    }

    const newlyEarned: MilestoneCertificate[] = []
    for (const track of ['met', 'mastered'] as const) {
      const tiers = AppState.MILESTONE_TIERS[track]
      const thresholds = AppState.MILESTONE_THRESHOLDS[track][preset]
      const count = counts[track]
      tiers.forEach((tier, i) => {
        const need = thresholds[i]
        if (count >= need && !earnedIds.has(tier.id)) {
          const cert: MilestoneCertificate = {
            id: tier.id,
            topicId: tier.id,
            topicName: `${tier.icon} ${tier.name}`,
            earnedDate: new Date().toISOString().split('T')[0],
            score: 100,
            timestamp: Date.now(),
            isMilestone: true,
            milestoneCount: need,
          }
          this.userProgress.certificates.push(cert)
          earnedIds.add(tier.id)
          newlyEarned.push(cert)
          console.log(`[V2] Milestone earned (${track}): ${tier.name} (${need})`)
        }
      })
    }

    if (newlyEarned.length > 0) {
      this.saveUserProgress()
      // Re-sync CertificateManager
      if (this.certificateManager) {
        this.certificateManager.userProgress = this.userProgress
      }
      let delay = startDelay
      for (const cert of newlyEarned) {
        setTimeout(() => this.opts.onCertificateModal?.(cert.topicName, cert.score), delay)
        delay += 2500
      }
      this.opts.onCertificateGalleryRefresh?.()
    }

    return newlyEarned
  }

  checkGameMilestoneCertificates(gameType: string, score: number): MilestoneCertificate[] {
    if (!this.userProgress) return []
    if (!this.userProgress.certificates) {
      this.userProgress.certificates = []
    }

    const earnedIds = new Set(this.userProgress.certificates.map((cert: any) => cert.id))
    const newlyEarned: MilestoneCertificate[] = []

    for (const cert of AppState.GAME_MILESTONES) {
      if (earnedIds.has(cert.id) || !cert.predicate(gameType, score)) {
        continue
      }

      const awarded: MilestoneCertificate = {
        id: cert.id,
        topicId: cert.topicId,
        topicName: cert.topicName,
        earnedDate: new Date().toISOString().split('T')[0],
        score,
        timestamp: Date.now(),
        isMilestone: true,
      }

      this.userProgress.certificates.push(awarded)
      newlyEarned.push(awarded)
    }

    if (newlyEarned.length > 0) {
      if (this.certificateManager) {
        this.certificateManager.userProgress = this.userProgress
      }
      this.opts.onCertificateGalleryRefresh?.()
    }

    return newlyEarned
  }

  // ── Manager wiring ───────────────────────────────────────────────────────────

  initializeManagers(): void {
    if (!this.userProgress) {
      console.error('Cannot initialize managers: userProgress not loaded')
      return
    }

    if (!this.opts.createManagers) {
      return
    }

    const managers = this.opts.createManagers(this.userProgress, () => this.saveUserProgress())
    this.scoreManager = managers.scoreManager ?? null
    this.progressManager = managers.progressManager ?? null
    this.courseManager = managers.courseManager ?? null
    this.certificateManager = managers.certificateManager ?? null
    this.coinManager = managers.coinManager ?? null

    // Register all courses
    if (this.courseManager && this.opts.allCourses) {
      this.opts.allCourses.forEach((course) => {
        this.courseManager.registerCourse(course)
      })
    }
  }
}
