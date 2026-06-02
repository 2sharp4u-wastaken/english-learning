/**
 * src/engine/gameManager.ts — game session engine: spaced-repetition question
 * selection, pool scoping, the audio-play gate, resume persistence, word-attempt
 * recording, and the finish (endGame) data flow.
 *
 * Slice 4.4.b1 TypeScript reimplementation of the DATA half of `gameLogic.js`
 * (GameManager). Every DOM/render method is dropped — React renders all game UI
 * and completion screens — so `loadQuestion`/`nextQuestion`/`setup*Listeners`/
 * toasts/modals/`updateAllPlayCounters`/the `endGame` completion HTML are gone.
 * What remains is exactly the surface the React bridges drive (see the per-bridge
 * `LegacyGameManager` interfaces): the session-state props they read/write plus
 * the selection / scoping / persistence / recording / finish methods.
 *
 * Ambient legacy deps are injected so the class is host-agnostic + testable
 * (same pattern as appState.ts / courses.ts): `getApp` (was `window.app`),
 * `vocabularyBank` (was `window.vocabularyBank`), `gameDataProvider` (was the
 * module-global `gameData`), `getUserId`, and `isPracticeMode`. The managers
 * (`scoreManager`/`progressManager`/`coinManager`/`courseManager`) are public
 * mutable props set by the boot layer (legacy read them off `window`).
 * `tests/engine-parity-gamemanager.spec.js` pins the deterministic surface +
 * RNG-independent invariants against the booted legacy `window.gameManager`.
 */

export interface WordObj {
  word: string
  translation?: string
  hebrew?: string
  category: string
  image?: string
  imageUrl?: string
  difficulty?: string
  options?: Array<{ word?: string }>
  [k: string]: unknown
}

export const GAME_CONFIG = {
  MAX_QUESTIONS: 10,
  MAX_AUDIO_PLAYS: 8,
  MIN_FILTERED_VOCABULARY: 20,
  WRONG_OPTIONS_COUNT: 3,
  SHUFFLE_PASSES: 3,
  FEEDBACK_DISPLAY_DURATION: 2000,
  DEFAULT_GAME: 'vocabulary',
  DEFAULT_LANGUAGE: 'he',
}

export interface GameManagerOptions {
  /** The app-state layer (was `window.app`): userProgress + save + getWordStats +
   *  updateProgress + checkMilestoneCertificates + showCertificateModal +
   *  getRecommendation. */
  getApp?: () => any
  /** Full vocabulary bank (was `window.vocabularyBank`). */
  vocabularyBank?: () => WordObj[]
  /** Per-game-type filtered data (was the module-global `gameData`). */
  gameDataProvider?: () => Record<string, WordObj[]>
  /** Active user id (was authService / localStorage 'currentUser'). */
  getUserId?: () => string | null
  /** Whether the app is in practice mode (was `SettingsManager.isPracticeMode()`). */
  isPracticeMode?: () => boolean
}

export class GameManager {
  // ── Session state the bridges read/write ──────────────────────────────────
  currentGame: string | null = GAME_CONFIG.DEFAULT_GAME
  currentLanguage = GAME_CONFIG.DEFAULT_LANGUAGE
  isGameActive = false
  isResuming = false
  currentQuestionIndex = 0
  totalQuestions = GAME_CONFIG.MAX_QUESTIONS
  shuffledQuestions: WordObj[] = []
  gameElapsedMs = 0
  gameSessionStartAt: number | null = null
  gameCoinHistoryStartIndex = 0
  lastPersistedScores: Record<string, number> = {}
  currentTopicId: string | null = null
  currentTopicActivity: string | null = null
  currentTopicWords: any[] = []
  _wjReplayMode = false
  audioPlaysLeft: number = GAME_CONFIG.MAX_AUDIO_PLAYS

  settings: any = {}
  selectedCategories: string[] = []
  gameData: Record<string, WordObj[]> = {}

  // ── Manager refs (set by the boot layer) ──────────────────────────────────
  scoreManager: any = null
  progressManager: any = null
  courseManager: any = null
  coinManager: any = null

  private opts: GameManagerOptions

  constructor(opts: GameManagerOptions = {}) {
    this.opts = opts
  }

  private app(): any {
    return this.opts.getApp?.() ?? null
  }
  private bank(): WordObj[] {
    return this.opts.vocabularyBank?.() ?? []
  }
  private userId(): string {
    return this.opts.getUserId?.() ?? localStorage.getItem('currentUser') ?? 'default'
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  getDefaultSettings(): any {
    return {
      selectedCategories: ['animals', 'colors', 'numbers', 'food', 'minecraft', 'gaming', 'roblox'],
      autoPlay: true,
      questionsPerGame: GAME_CONFIG.MAX_QUESTIONS,
      clickRepeatCount: GAME_CONFIG.WRONG_OPTIONS_COUNT,
      audioPlaysAllowed: GAME_CONFIG.MAX_AUDIO_PLAYS,
      theme: 'classic',
      showPictures: false,
      showConfetti: true,
    }
  }

  applySettings(settings: any): void {
    this.settings = settings
    this.totalQuestions = settings.questionsPerGame || GAME_CONFIG.MAX_QUESTIONS
    this.audioPlaysLeft = this.getAudioPlayLimit(this.currentGame ?? undefined)
    this.clickRepeatCount = settings.clickRepeatCount || GAME_CONFIG.WRONG_OPTIONS_COUNT
    this.showPictures = settings.showPictures || false
    this.selectedCategories = settings.selectedCategories || []
  }
  clickRepeatCount = GAME_CONFIG.WRONG_OPTIONS_COUNT
  showPictures = false

  // ── Game-data load (category filter + difficulty gate) ─────────────────────

  /**
   * Build the per-game-type pools the bridges read via `getScopedQuestionPool` /
   * `getPracticeWords`. Faithful to legacy `GameManager.loadGameData`
   * (gameLogic.js:1522): category-filter the relevant banks by `selectedCategories`
   * and apply the difficulty gate to vocabulary/listening/picture-match (grammar,
   * reading, pronunciation, abc are NOT gated). Reads the live raw bank from the
   * host (`gameDataProvider` → `window.gameData`) on every call, so re-running after
   * `refreshCustomWords` (which mutates that bank in place) surfaces newly-added
   * words. Must run AFTER `applySettings` so `selectedCategories` is current.
   */
  loadGameData(): void {
    const raw = this.opts.gameDataProvider?.() ?? {}
    if (!raw || !raw.vocabulary) {
      console.error('gameData is not loaded yet')
      return
    }

    const byCategory = (items: WordObj[] = []): WordObj[] =>
      this.selectedCategories && this.selectedCategories.length > 0
        ? items.filter((item) => this.selectedCategories.includes(item.category))
        : items

    const filteredVocabulary = this.applyDifficultyGate(byCategory(raw.vocabulary), 'vocabulary')
    const filteredListening = this.applyDifficultyGate(byCategory(raw.listening), 'listening')
    const filteredPictureMatch = this.applyDifficultyGate(byCategory(raw['picture-match'] || []), 'picture-match')

    this.gameData = {
      vocabulary: [...filteredVocabulary],
      grammar: [...(raw.grammar || [])],
      pronunciation: byCategory(raw.pronunciation),
      listening: filteredListening,
      reading: byCategory(raw.reading),
      abc: raw.abc || [],
      'picture-match': filteredPictureMatch,
    }
  }

  // ── Tier + audio gate ────────────────────────────────────────────────────

  getGameTier(gameType: string): 'learn' | 'practice' | 'challenge' {
    const learnGames = new Set(['word-journey', 'abc'])
    const practiceGames = new Set(['listening', 'picture-match', 'memory', 'grammar-beginner', 'practice', 'true-or-not'])
    const challengeGames = new Set(['reading', 'pronunciation', 'fill-blanks', 'scramble', 'grammar', 'vocabulary', 'story-time'])

    if (learnGames.has(gameType)) return 'learn'
    if (practiceGames.has(gameType)) return 'practice'
    if (challengeGames.has(gameType)) return 'challenge'
    return 'practice'
  }

  getAudioPlayLimit(gameType: string = this.currentGame ?? ''): number {
    switch (this.getGameTier(gameType)) {
      case 'learn':
        return Infinity
      case 'challenge':
        return 5
      case 'practice':
      default:
        return 8
    }
  }

  resetAudioPlayCounter(gameType: string = this.currentGame ?? ''): number {
    this.audioPlaysLeft = this.getAudioPlayLimit(gameType)
    return this.audioPlaysLeft
  }

  consumeAudioPlay(_gameType: string = this.currentGame ?? ''): boolean {
    if (!Number.isFinite(this.audioPlaysLeft)) {
      return true
    }
    if (this.audioPlaysLeft <= 0) {
      return false
    }
    this.audioPlaysLeft--
    return true
  }

  // ── Resume / persistence ───────────────────────────────────────────────────

  getEffectiveTotalQuestions(gameType: string): number {
    if (gameType === 'word-journey' && Array.isArray(this.shuffledQuestions) && this.shuffledQuestions.length > 0) {
      return this.shuffledQuestions.length
    }
    return this.totalQuestions
  }

  saveGameState(): boolean {
    if (!this.isGameActive || !this.currentGame) {
      console.warn('Cannot save: isGameActive=', this.isGameActive, 'currentGame=', this.currentGame)
      return false
    }
    if (this.currentGame === 'practice') return false
    if (!this.shuffledQuestions || this.shuffledQuestions.length === 0) return false

    const userId = this.userId()
    const sessionElapsed = this.gameSessionStartAt ? Date.now() - this.gameSessionStartAt : 0
    const totalElapsed = (this.gameElapsedMs || 0) + sessionElapsed
    this.gameElapsedMs = totalElapsed
    this.gameSessionStartAt = null

    const gameState: any = {
      gameType: this.currentGame,
      currentQuestionIndex: this.currentQuestionIndex,
      score: this.scoreManager.getScore(this.currentGame),
      totalQuestions: this.getEffectiveTotalQuestions(this.currentGame),
      timestamp: Date.now(),
      shuffledQuestions: this.shuffledQuestions,
      gameElapsedMs: totalElapsed,
      selectedCategories: [...(this.selectedCategories || [])],
      currentTopicId: this.currentTopicId,
      currentTopicActivity: this.currentTopicActivity,
      currentTopicWords: [...(this.currentTopicWords || [])],
    }

    localStorage.setItem(`savedGame_${userId}_${this.currentGame}`, JSON.stringify(gameState))
    return true
  }

  loadGameState(gameType: string): any {
    if (gameType === 'practice') return null

    const userId = this.userId()
    const saved = localStorage.getItem(`savedGame_${userId}_${gameType}`)
    if (!saved) return null

    try {
      const gameState = JSON.parse(saved)
      const ageHours = (Date.now() - gameState.timestamp) / (1000 * 60 * 60)
      if (ageHours > 24) {
        this.deleteGameState(gameType)
        return null
      }
      return gameState
    } catch (error) {
      console.error('Error loading game state:', error)
      return null
    }
  }

  deleteGameState(gameType: string): void {
    const userId = this.userId()
    localStorage.removeItem(`savedGame_${userId}_${gameType}`)
  }

  // ── Course-activity context ──────────────────────────────────────────────

  setCourseActivityContext({
    topicId = null,
    activityType = null,
    topicWords = [],
  }: { topicId?: string | null; activityType?: string | null; topicWords?: any[] } = {}): void {
    this.currentTopicId = topicId || null
    this.currentTopicActivity = activityType || null
    this.currentTopicWords = Array.isArray(topicWords) ? [...topicWords] : []
  }

  clearCourseActivityContext(): void {
    this.currentTopicId = null
    this.currentTopicActivity = null
    this.currentTopicWords = []
  }

  // ── Word-attempt recording ───────────────────────────────────────────────

  recordWordAttempt(
    word: string,
    category: string,
    isCorrect: boolean,
    responseTime: number,
    gameType: string,
  ): void {
    if (!this.progressManager) {
      console.warn('Cannot record word attempt: ProgressManager not initialized')
      return
    }

    this.progressManager.recordWordAttempt(
      word,
      category,
      isCorrect,
      gameType,
      responseTime > 0 ? responseTime / 1000 : 0,
    )

    // Persist immediately so practice data survives page navigation/reload.
    const app = this.app()
    if (app?.userProgress) {
      app.userProgress.wordMastery = this.progressManager.wordMastery
      app.saveUserProgress?.()
    }
  }

  // ── Pool scoping + difficulty gate ─────────────────────────────────────────

  applyDifficultyGate(items: WordObj[], gameType: string): WordObj[] {
    if (!Array.isArray(items) || items.length === 0) return items
    if (this.settings?.difficultyAutoGate === false) return items
    if (gameType === 'word-journey') return items
    const learnedCount = Object.keys(this.progressManager?.learnedWords || {}).length
    if (learnedCount >= 50) return items
    const maxLen = learnedCount < 15 ? 7 : 9
    const checkOptions = learnedCount < 15 && (gameType === 'picture-match' || gameType === 'listening')

    const filtered = items.filter((item) => {
      const word = item?.word || ''
      if (word.length > maxLen) return false
      if (checkOptions && Array.isArray(item.options)) {
        const longOpts = item.options.filter((o) => (o?.word || '').length > 5).length
        if (longOpts >= 2) return false
      }
      return true
    })
    return filtered.length > 0 ? filtered : items
  }

  getActiveTopicWords(): WordObj[] {
    const bank = this.bank()
    const directWords = Array.isArray(this.currentTopicWords) ? this.currentTopicWords : []

    if (directWords.length > 0) {
      return directWords
        .map((entry: any) => {
          if (entry?.word && entry?.category) return entry
          const normalized = String(entry || '').toLowerCase()
          return bank.find((word) => word.word.toLowerCase() === normalized) || null
        })
        .filter(Boolean) as WordObj[]
    }

    if (!this.currentTopicId || !this.courseManager) {
      return []
    }

    const topicData = this.courseManager.getTopic(this.currentTopicId)
    if (!topicData?.topic?.words) {
      return []
    }

    return topicData.topic.words
      .map((word: string) => bank.find((entry) => entry.word.toLowerCase() === String(word).toLowerCase()) || null)
      .filter(Boolean) as WordObj[]
  }

  getScopedQuestionPool(gameType: string): WordObj[] {
    const basePool = [...(this.gameData[gameType] || [])]
    if (!this.currentTopicId || this.currentTopicActivity !== gameType) {
      return basePool
    }

    const topicKeys = new Set(this.getActiveTopicWords().map((word) => `${word.word.toLowerCase()}_${word.category}`))

    if (topicKeys.size === 0) {
      return basePool
    }

    return basePool.filter((word) => topicKeys.has(`${word.word?.toLowerCase()}_${word.category}`))
  }

  getPracticeWords(_options: { refreshData?: boolean } = {}): WordObj[] {
    // refreshData reloads category/settings/gameData from the host; in the React
    // app the bridge owns that refresh, so the engine just reads current gameData.
    const allWords = this.gameData.vocabulary || []
    const app = this.app()

    const withStats = allWords.map((word) => ({
      word,
      stats: this.progressManager
        ? this.progressManager.getWordStats(word.word, word.category)
        : app?.getWordStats(word.word, word.category),
    }))

    const strugglingWords = withStats
      .filter(({ stats }) => stats && stats.totalAttempts > 0 && stats.masteryLevel < 0.5)
      .sort((a, b) => {
        const accA = a.stats.totalAttempts > 0 ? a.stats.correctAttempts / a.stats.totalAttempts : 0
        const accB = b.stats.totalAttempts > 0 ? b.stats.correctAttempts / b.stats.totalAttempts : 0
        return accA - accB
      })
      .map(({ word }) => word)

    return strugglingWords
  }

  getWordJourneyWords(): WordObj[] {
    const rawBank = this.bank()
    const paceMap: Record<string, number> = { slow: 3, normal: 5, fast: 8 }
    const wordCount = paceMap[(this.settings || {}).learningPace] || 5
    let candidatePool: WordObj[] = []

    if (this.currentTopicId && this.courseManager) {
      const topicData = this.courseManager.getTopic(this.currentTopicId)
      if (topicData?.topic?.words) {
        const topicWords = topicData.topic.words
          .map((w: string) => rawBank.find((v) => v.word === w))
          .filter(Boolean) as WordObj[]
        if (topicWords.length >= 3) {
          candidatePool = topicWords
        }
      }
    }

    if (candidatePool.length === 0) {
      candidatePool = rawBank.filter(
        (w) => !this.selectedCategories?.length || this.selectedCategories.includes(w.category),
      )
    }
    if (candidatePool.length === 0) return []

    const today = new Date().toISOString().slice(0, 10)
    const pm = this.progressManager

    if (this._wjReplayMode) {
      const learnedOnly = candidatePool.filter((w) => pm?.isWordLearned?.(w.word, w.category))
      if (learnedOnly.length >= 3) {
        for (let i = learnedOnly.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[learnedOnly[i], learnedOnly[j]] = [learnedOnly[j], learnedOnly[i]]
        }
        return learnedOnly.slice(0, wordCount)
      }
      this._wjReplayMode = false
    }

    const scored = candidatePool.map((w) => {
      let mastery = pm ? pm.getWordStats(w.word, w.category)?.masteryLevel || 0 : 0

      if (pm?.isWordLearned?.(w.word, w.category)) {
        const entry = pm.learnedWords?.[`${w.word.toLowerCase()}_${w.category}`]
        if (entry?.graduatedDate === today) {
          mastery = Math.max(mastery, 0.9)
        }
      }

      return { word: w, mastery, _rnd: 0 }
    })

    scored.forEach((s) => {
      s._rnd = Math.random()
    })
    scored.sort((a, b) => (a.mastery !== b.mastery ? a.mastery - b.mastery : a._rnd - b._rnd))

    return scored.slice(0, wordCount).map((s) => s.word)
  }

  // ── Spaced-repetition selection ────────────────────────────────────────────

  _getLearnedWordSet(): Set<string> {
    const pm = this.progressManager || this.app()?.progressManager
    if (pm?.getIntroducedWordKeys) {
      return pm.getIntroducedWordKeys()
    }
    const learnedWords = this.app()?.userProgress?.learnedWords || {}
    return new Set(Object.keys(learnedWords))
  }

  saveLastSessionWordKeys(gameType: string): void {
    const app = this.app()
    if (!app?.userProgress) return
    const wordKeys = (this.shuffledQuestions || []).map((q) => `${q.word}_${q.category}`)
    if (!app.userProgress.lastSessionWordKeys) {
      app.userProgress.lastSessionWordKeys = {}
    }
    app.userProgress.lastSessionWordKeys[gameType] = wordKeys
    app.saveUserProgress?.()
  }

  smartQuestionSelection(array: WordObj[]): WordObj[] {
    const questions = [...array]
    const gameType = this.currentGame
    const app = this.app()

    const selectRandom = (arr: WordObj[], n: number) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, Math.min(n, arr.length))
    }

    const lastSessionKeys = new Set<string>(
      (gameType && app?.userProgress?.lastSessionWordKeys?.[gameType]) || [],
    )
    const freshWords =
      lastSessionKeys.size > 0
        ? questions.filter((q) => !lastSessionKeys.has(`${q.word}_${q.category}`))
        : questions
    const recentWords =
      lastSessionKeys.size > 0 ? questions.filter((q) => lastSessionKeys.has(`${q.word}_${q.category}`)) : []

    const categorized: Record<'due' | 'new' | 'struggling' | 'learning' | 'mastered', WordObj[]> = {
      due: [],
      new: [],
      struggling: [],
      learning: [],
      mastered: [],
    }

    freshWords.forEach((q) => {
      const wordStats = this.progressManager
        ? this.progressManager.getWordStats(q.word, q.category)
        : app?.getWordStats(q.word, q.category)
      const mastery = wordStats?.masteryLevel || 0
      q.masteryLevel = mastery

      if (this.progressManager?.isWordDue?.(q.word, q.category)) categorized.due.push(q)
      else if (mastery === 0) categorized.new.push(q)
      else if (mastery < 0.5) categorized.struggling.push(q)
      else if (mastery < 0.8) categorized.learning.push(q)
      else categorized.mastered.push(q)
    })

    recentWords.forEach((q) => {
      const wordStats = this.progressManager
        ? this.progressManager.getWordStats(q.word, q.category)
        : app?.getWordStats(q.word, q.category)
      q.masteryLevel = wordStats?.masteryLevel || 0
    })

    const selected: WordObj[] = []
    const targetCount = Math.min(questions.length, 50)
    const weights = { struggling: 0.4, new: 0.3, learning: 0.2, mastered: 0.1 }

    if (freshWords.length > 0) {
      const freshTarget = Math.min(freshWords.length, targetCount)

      selected.push(...selectRandom(categorized.due, freshTarget))

      const remaining = freshTarget - selected.length
      if (remaining > 0) {
        const counts = {
          struggling: Math.ceil(remaining * weights.struggling),
          new: Math.ceil(remaining * weights.new),
          learning: Math.ceil(remaining * weights.learning),
          mastered: Math.ceil(remaining * weights.mastered),
        }

        selected.push(...selectRandom(categorized.struggling, counts.struggling))
        selected.push(...selectRandom(categorized.new, counts.new))
        selected.push(...selectRandom(categorized.learning, counts.learning))
        selected.push(...selectRandom(categorized.mastered, counts.mastered))
      }

      if (selected.length < freshTarget) {
        const selectedKeys = new Set(selected.map((q) => `${q.word}_${q.category}`))
        const freshRemaining = freshWords.filter((q) => !selectedKeys.has(`${q.word}_${q.category}`))
        selected.push(...selectRandom(freshRemaining, freshTarget - selected.length))
      }
    }

    if (selected.length < targetCount && recentWords.length > 0) {
      const needed = targetCount - selected.length
      const recentSorted = [...recentWords].sort(
        (a, b) => (a.masteryLevel as number) - (b.masteryLevel as number),
      )
      selected.push(...recentSorted.slice(0, needed))
    }

    return this.improvedShuffle(selected)
  }

  improvedShuffle(array: WordObj[]): WordObj[] {
    const shuffled = [...array]

    for (let pass = 0; pass < 5; pass++) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
    }

    for (let i = 1; i < shuffled.length - 1; i++) {
      if (shuffled[i].category && shuffled[i - 1].category && shuffled[i].category === shuffled[i - 1].category) {
        for (let j = i + 1; j < shuffled.length; j++) {
          if (shuffled[j].category && shuffled[j].category !== shuffled[i].category) {
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            break
          }
        }
      }
    }

    for (let i = 1; i < shuffled.length - 1; i++) {
      if (shuffled[i].difficulty === shuffled[i - 1].difficulty && shuffled[i].difficulty === shuffled[i + 1].difficulty) {
        for (let j = i + 2; j < shuffled.length; j++) {
          if (shuffled[j].difficulty !== shuffled[i].difficulty) {
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            break
          }
        }
      }
    }

    return shuffled
  }

  // ── Session-word progress (completion summary data) ──────────────────────────

  private _findVocabularyEntryByWord(word: string, preferredCategory: string | null = null): WordObj | null {
    if (!word) return null
    const normalized = String(word)
      .replace(/[.,!?;:]+$/g, '')
      .toLowerCase()
    const bank = this.bank()

    if (preferredCategory) {
      const preferred = bank.find(
        (entry) => entry.category === preferredCategory && entry.word.toLowerCase() === normalized,
      )
      if (preferred) return preferred
    }

    return bank.find((entry) => entry.word.toLowerCase() === normalized) || null
  }

  getSessionWordProgress(gameType: string): any[] {
    if (!this.progressManager) return []

    const sessionMap = new Map<string, any>()
    const addWord = (word: string, category: string) => {
      if (!word || !category) return
      const key = `${String(word).toLowerCase()}_${category}`
      if (sessionMap.has(key)) return

      const stats = this.progressManager.getWordStats(word, category)
      const learned = this.progressManager.isWordLearned(word, category)
      const learnedEntry = this.progressManager.learnedWords?.[key] || null
      const bankEntry = this._findVocabularyEntryByWord(word, category)
      const accuracy = stats?.totalAttempts
        ? Math.round(((stats.correctAttempts || 0) / stats.totalAttempts) * 100)
        : 0

      sessionMap.set(key, {
        key,
        word,
        category,
        hebrew: bankEntry?.hebrew || bankEntry?.translation || '',
        masteryPct: Math.round((stats?.masteryLevel || 0) * 100),
        accuracyPct: accuracy,
        attempts: stats?.totalAttempts || 0,
        learned,
        journeyScore: learnedEntry?.journeyScore ?? null,
      })
    }

    ;(this.shuffledQuestions || []).forEach((question: any) => {
      if (!question) return

      if (question.word && question.category) {
        addWord(question.word, question.category)
        return
      }

      if (Array.isArray(question.words) && gameType !== 'memory') {
        question.words.forEach((wordObj: any) => {
          if (wordObj?.word && wordObj?.category) {
            addWord(wordObj.word, wordObj.category)
          }
        })
        return
      }

      if (question.blank?.options?.[0]) {
        const vocabEntry = this._findVocabularyEntryByWord(question.blank.options[0], question.theme)
        if (vocabEntry) addWord(vocabEntry.word, vocabEntry.category)
        return
      }

      if (question.predicate?.word) {
        const vocabEntry = this._findVocabularyEntryByWord(question.predicate.word, question.theme)
        if (vocabEntry) addWord(vocabEntry.word, vocabEntry.category)
      }
    })

    return Array.from(sessionMap.values()).slice(0, 8)
  }

  getProgressUpdateContext(gameType: string): { topicId: string | null; activityType: string; words: any[] } {
    return {
      topicId: this.currentTopicId,
      activityType: this.currentTopicActivity || gameType,
      words: this.getSessionWordProgress(gameType).map(({ word, category }) => ({ word, category })),
    }
  }

  getCompletionAnsweredCount(_gameType: string, fallbackTotal: number = this.totalQuestions): number {
    return Math.min(this.currentQuestionIndex, fallbackTotal)
  }

  getCompletionProgressPercent(answeredCount: number, actualCount: number): number {
    if (!actualCount) return 0
    return Math.max(0, Math.min(100, Math.round((answeredCount / actualCount) * 100)))
  }

  getSessionCoinsEarned(): number {
    const history = this.app()?.userProgress?.coinHistory || []
    return history
      .slice(this.gameCoinHistoryStartIndex || 0)
      .filter((entry: any) => entry && entry.amount > 0)
      .reduce((sum: number, entry: any) => sum + entry.amount, 0)
  }

  // ── Score history ────────────────────────────────────────────────────────

  saveGameScoreToHistory(gameType: string, percentage: number): void {
    try {
      const userId = this.userId()
      if (!userId) {
        console.warn('No user ID found, cannot save score to history')
        return
      }

      const historyKey = `${userId}_${gameType}_history`

      let history: number[] = []
      const saved = localStorage.getItem(historyKey)
      if (saved) {
        try {
          history = JSON.parse(saved)
          if (!Array.isArray(history)) history = []
        } catch (e) {
          console.warn('Error parsing history, starting fresh:', e)
          history = []
        }
      }

      history.push(percentage)
      if (history.length > 50) history = history.slice(-50)

      localStorage.setItem(historyKey, JSON.stringify(history))
    } catch (error) {
      console.error('Error saving game score to history:', error)
    }
  }

  // ── Finish (data half — React renders the completion UI) ──────────────────

  async endGame(gameType: string): Promise<void> {
    try {
      // Practice mode: session-based, no scoring/persistence.
      if (gameType === 'practice') {
        this.isGameActive = false
        return
      }

      const app = this.app()

      // Delete saved game state FIRST so a failed endGame never leaves a stale save.
      this.deleteGameState(gameType)

      // Total time: elapsed from saved sessions + current session.
      const sessionElapsed = this.gameSessionStartAt ? Date.now() - this.gameSessionStartAt : 0
      const totalGameTimeMs = (this.gameElapsedMs || 0) + sessionElapsed
      this.gameElapsedMs = 0
      this.gameSessionStartAt = null

      if (app?.userProgress && totalGameTimeMs > 0) {
        const currentLearningTime = app.userProgress.totalLearningTimeMs || 0
        app.userProgress.totalLearningTimeMs = currentLearningTime + totalGameTimeMs
      }

      try {
        this.saveLastSessionWordKeys(gameType)
      } catch {
        /* ignore */
      }

      // Compute score + percentage. The legacy word-journey / story-time special
      // branches keyed off `window.wordJourneyGame` / `window.storyTimeGame`, which
      // React never populates — so the generic branch is the live path for all games.
      const maxPossibleScore = this.totalQuestions * 10
      const finalScore = Math.min(this.scoreManager.getScore(gameType), maxPossibleScore)
      const percentage = Math.round((finalScore / maxPossibleScore) * 100)

      this.saveGameScoreToHistory(gameType, percentage)

      // Persist totalPoints (only the newly completed positive delta).
      if (app?.userProgress) {
        const alreadyCounted = this.lastPersistedScores[gameType] || 0
        const newlyCompletedPoints = Math.max(0, finalScore - alreadyCounted)
        if (newlyCompletedPoints > 0) {
          app.userProgress.totalPoints = (app.userProgress.totalPoints || 0) + newlyCompletedPoints
        }
        this.lastPersistedScores[gameType] = finalScore
        app.saveUserProgress?.()
      }

      // Award completion coins (half in WJ replay mode).
      if (this.coinManager) {
        if (gameType === 'word-journey' && this._wjReplayMode) {
          this.coinManager.awardCoins(Math.floor(this.coinManager.rewards.completeActivity / 2), 'activity complete (practice)')
          if (percentage === 100) {
            this.coinManager.awardCoins(Math.floor(this.coinManager.rewards.perfectGame / 2), 'perfect game (practice)')
          }
        } else {
          this.coinManager.awardActivityComplete()
          if (percentage === 100) {
            this.coinManager.awardPerfectGame()
          }
        }
      }

      // Re-check game unlocks after EVERY completion (review games promote words
      // to Learned under the V3 model). Queue newly unlocked games for the Home
      // celebration modal via sessionStorage.
      if (app?.progressManager) {
        const pm = app.progressManager
        const learnedCount = pm.getLearnedWordCount()
        const topicsDone = pm.getCompletedTopicCount()
        const wm = app.userProgress?.wordMastery || {}
        const abcLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const masteredLetters = [...abcLetters].filter((l) => (wm[`${l}_abc`]?.masteryLevel || 0) >= 0.8).length
        const abcMastery = Math.round((masteredLetters / 26) * 100)
        const newlyUnlocked = pm.checkAndUnlockGames(learnedCount, topicsDone, abcMastery)
        if (newlyUnlocked.length > 0) {
          const data = pm.getProgressData()
          app.userProgress.gameUnlocks = data.gameUnlocks
          app.saveUserProgress?.()
          try {
            const cur = JSON.parse(sessionStorage.getItem('v3_pendingUnlocks') || '[]')
            sessionStorage.setItem(
              'v3_pendingUnlocks',
              JSON.stringify([...new Set([...(Array.isArray(cur) ? cur : []), ...newlyUnlocked])]),
            )
          } catch {
            /* ignore */
          }
        }
      }

      this.isGameActive = false

      // Update overall app achievements/progress (skip in practice mode).
      try {
        const isPracticeMode = this.opts.isPracticeMode?.() ?? false
        if (!isPracticeMode && app?.updateProgress) {
          app.updateProgress(gameType, percentage, this.getProgressUpdateContext(gameType))
        }
      } catch (e) {
        console.warn('Failed to update app progress:', e)
      }
    } catch (error) {
      console.error(`Error ending ${gameType} game:`, error)
    }
  }

  // DOM no-op retained for bridge call-sites that still invoke it.
  updateTotalScoreDisplay(): void {}
}
