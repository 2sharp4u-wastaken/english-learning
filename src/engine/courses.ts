/**
 * src/engine/courses.ts — course/unit/topic progression, unlocking, navigation.
 *
 * Slice 4.4.b1 TypeScript reimplementation of `managers/CourseManager.js`. Pure
 * data/logic — no DOM. Two legacy ambient dependencies are now injected so the
 * engine is host-agnostic and testable:
 *  - `progressManager.calculateTopicMastery(words)` (mastery rollup) — passed in
 *    the constructor, same as legacy.
 *  - `window.vocabularyBank` (inferTopicForActivity word resolution) — supplied
 *    via the `vocabularyBank` provider option (defaults to []).
 * Persistence (legacy saveProgress → window.app/localStorage) is the optional
 * `save` host hook. All unlock/completion/inference branching is byte-faithful;
 * `tests/engine-parity-courses.spec.js` is the gate.
 */

export interface CourseTopic {
  id: string
  activities?: string[]
  words?: string[]
  milestone?: { scoreThreshold?: number }
  unlockRequirement?: { topic?: string; mastery?: number }
  [k: string]: unknown
}

export interface CourseUnit {
  id: string
  topics?: CourseTopic[]
  [k: string]: unknown
}

export interface Course {
  id: string
  name?: string
  nameHebrew?: string
  units?: CourseUnit[]
  unlockRequirement?: { course?: string; completionPercentage?: number }
  [k: string]: unknown
}

export interface TopicProgressEntry {
  unlocked?: boolean
  started?: boolean
  mastery?: number
  completedActivities?: string[]
  certificateEarned?: boolean
  completed?: boolean
}

export interface CourseProgressEntry {
  unlocked?: boolean
  startedDate?: string
  currentUnit?: string | null
  currentTopic?: string | null
}

export interface CourseUserProgress {
  courses?: Record<string, CourseProgressEntry>
  topicProgress?: Record<string, TopicProgressEntry>
  certificates?: unknown[]
  coins?: number
  totalCoinsEarned?: number
  [k: string]: unknown
}

/** Minimal contract CourseManager needs from the progress engine. */
export interface CourseProgressManager {
  calculateTopicMastery(words: string[]): number
}

export interface CourseManagerOptions {
  /** Source of the vocabulary bank for inferTopicForActivity word resolution.
   *  Legacy read window.vocabularyBank. Defaults to []. */
  vocabularyBank?: () => Array<{ word: string; [k: string]: unknown }>
  /** Persist hook (legacy saveProgress). Defaults to no-op — the app state layer
   *  owns persistence now. */
  save?: () => void
}

export class CourseManager {
  userProgress: CourseUserProgress
  progressManager: CourseProgressManager
  courses: Map<string, Course> = new Map()
  initialized = false
  private vocabularyBank: () => Array<{ word: string; [k: string]: unknown }>
  private save: () => void

  constructor(
    userProgress: CourseUserProgress,
    progressManager: CourseProgressManager,
    opts: CourseManagerOptions = {},
  ) {
    this.userProgress = userProgress
    this.progressManager = progressManager
    this.vocabularyBank = opts.vocabularyBank ?? (() => [])
    this.save = opts.save ?? (() => {})
  }

  initialize(): void {
    if (this.initialized) return

    if (!this.userProgress.courses) this.userProgress.courses = {}
    if (!this.userProgress.topicProgress) this.userProgress.topicProgress = {}
    Object.values(this.userProgress.topicProgress).forEach((progress) => {
      if (typeof progress.completed !== 'boolean') progress.completed = false
    })
    if (!this.userProgress.certificates) this.userProgress.certificates = []
    if (typeof this.userProgress.coins === 'undefined') {
      this.userProgress.coins = 0
      this.userProgress.totalCoinsEarned = 0
    }

    this.initialized = true
  }

  registerCourse(course: Course): void {
    if (!course.id) {
      console.error('[CourseManager] Course must have an id')
      return
    }

    this.courses.set(course.id, course)

    // Auto-unlock first course if no courses are unlocked
    const unlockedCourses = this.getUnlockedCourses()
    if (unlockedCourses.length === 0 && this.courses.size === 1) {
      this.unlockCourse(course.id)
    }

    this.checkAndUnlockCourses()
  }

  getCourse(courseId: string): Course | null {
    return this.courses.get(courseId) || null
  }

  getAllCourses(): Course[] {
    return Array.from(this.courses.values())
  }

  getUnlockedCourses(): Course[] {
    return this.getAllCourses().filter((course) => this.isCourseUnlocked(course.id))
  }

  isCourseUnlocked(courseId: string): boolean {
    return this.userProgress.courses![courseId]?.unlocked || false
  }

  meetsCourseUnlockRequirement(course: Course): boolean {
    if (!course?.unlockRequirement) return true

    const { course: requiredCourseId, completionPercentage = 100 } = course.unlockRequirement
    if (!requiredCourseId) return true

    return this.getCourseProgress(requiredCourseId) >= completionPercentage
  }

  getCourseUnlockRequirementText(courseOrId: Course | string): string {
    const course = typeof courseOrId === 'string' ? this.getCourse(courseOrId) : courseOrId
    if (!course?.unlockRequirement) return ''

    const { course: requiredCourseId, completionPercentage = 100 } = course.unlockRequirement
    const requiredCourse = requiredCourseId ? this.getCourse(requiredCourseId) : null
    const requiredName = requiredCourse?.nameHebrew || requiredCourse?.name || requiredCourseId

    return `נפתח אחרי ${completionPercentage}% ב-${requiredName}`
  }

  checkAndUnlockCourses(): string[] {
    const newlyUnlocked: string[] = []

    this.getAllCourses().forEach((course) => {
      if (this.isCourseUnlocked(course.id)) return
      if (!this.meetsCourseUnlockRequirement(course)) return

      this.unlockCourse(course.id)
      newlyUnlocked.push(course.id)
    })

    return newlyUnlocked
  }

  unlockCourse(courseId: string): void {
    if (!this.userProgress.courses![courseId]) {
      this.userProgress.courses![courseId] = {
        unlocked: true,
        startedDate: new Date().toISOString().split('T')[0],
        currentUnit: null,
        currentTopic: null,
      }
    } else {
      this.userProgress.courses![courseId].unlocked = true
    }

    // Unlock first topic in first unit
    const course = this.getCourse(courseId)
    if (course && course.units && course.units.length > 0) {
      const firstUnit = course.units[0]
      if (firstUnit.topics && firstUnit.topics.length > 0) {
        const firstTopic = firstUnit.topics[0]
        this.unlockTopic(firstTopic.id)
        this.userProgress.courses![courseId].currentUnit = firstUnit.id
        this.userProgress.courses![courseId].currentTopic = firstTopic.id
      }
    }

    this.saveProgress()
  }

  getCourseProgress(courseId: string): number {
    const course = this.getCourse(courseId)
    if (!course || !course.units) return 0

    let totalTopics = 0
    let completedTopics = 0

    course.units.forEach((unit) => {
      if (unit.topics) {
        unit.topics.forEach((topic) => {
          totalTopics++
          if (this.isTopicCompleted(topic.id)) completedTopics++
        })
      }
    })

    return totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
  }

  getTopic(topicId: string): { topic: CourseTopic; unit: CourseUnit; course: Course } | null {
    for (const course of this.courses.values()) {
      if (!course.units) continue

      for (const unit of course.units) {
        if (!unit.topics) continue

        const topic = unit.topics.find((t) => t.id === topicId)
        if (topic) return { topic, unit, course }
      }
    }
    return null
  }

  isTopicUnlocked(topicId: string): boolean {
    const progress = this.userProgress.topicProgress![topicId]
    return progress?.unlocked || false
  }

  isTopicCompleted(topicId: string): boolean {
    const progress = this.userProgress.topicProgress![topicId]
    if (!progress) return false

    const data = this.getTopic(topicId)
    if (!data) return false

    const { topic } = data
    if (!topic.activities) return false

    const completedActivities = progress.completedActivities || []
    return topic.activities.every((activity) => completedActivities.includes(activity))
  }

  unlockTopic(topicId: string): void {
    if (!this.userProgress.topicProgress![topicId]) {
      this.userProgress.topicProgress![topicId] = {
        unlocked: true,
        started: false,
        mastery: 0,
        completedActivities: [],
        certificateEarned: false,
        completed: false,
      }
    } else {
      this.userProgress.topicProgress![topicId].unlocked = true
    }

    this.saveProgress()
  }

  startTopic(topicId: string): void {
    if (!this.userProgress.topicProgress![topicId]) this.unlockTopic(topicId)
    this.userProgress.topicProgress![topicId].started = true
    this.saveProgress()
  }

  completeActivity(
    topicId: string,
    activityType: string,
    score: number,
  ): {
    topicId: string
    topic: CourseTopic
    thresholdMet: boolean
    threshold: number
    activityCompletedNow: boolean
    topicCompletedNow: boolean
  } | null {
    const data = this.getTopic(topicId)
    if (!data) return null
    const { topic } = data

    if (!(topic.activities || []).includes(activityType)) return null

    if (!this.userProgress.topicProgress![topicId]) this.unlockTopic(topicId)

    const progress = this.userProgress.topicProgress![topicId]
    progress.started = true

    const threshold = topic.milestone?.scoreThreshold ?? 70
    if (score < threshold) {
      if (topic.words?.length) {
        progress.mastery = this.progressManager.calculateTopicMastery(topic.words)
      }
      this.saveProgress()
      return {
        topicId,
        topic,
        thresholdMet: false,
        threshold,
        activityCompletedNow: false,
        topicCompletedNow: false,
      }
    }

    const wasActivityCompleted = (progress.completedActivities || []).includes(activityType)
    const wasTopicCompleted = this.isTopicCompleted(topicId)

    if (!progress.completedActivities) progress.completedActivities = []
    if (!progress.completedActivities.includes(activityType)) {
      progress.completedActivities.push(activityType)
    }

    if (topic.words?.length) {
      progress.mastery = this.progressManager.calculateTopicMastery(topic.words)
    }

    const isNowCompleted = this.isTopicCompleted(topicId)
    progress.completed = isNowCompleted

    if (isNowCompleted && !wasTopicCompleted) this.onTopicCompleted(topicId)

    this.saveProgress()

    return {
      topicId,
      topic,
      thresholdMet: true,
      threshold,
      activityCompletedNow: !wasActivityCompleted,
      topicCompletedNow: isNowCompleted && !wasTopicCompleted,
    }
  }

  onTopicCompleted(topicId: string): void {
    const data = this.getTopic(topicId)
    if (!data) return

    const progress = this.userProgress.topicProgress![topicId]
    if (!progress) return

    const { unit } = data
    progress.completed = true

    // Unlock next topic in sequence
    const currentTopicIndex = unit.topics!.findIndex((t) => t.id === topicId)
    if (currentTopicIndex !== -1 && currentTopicIndex < unit.topics!.length - 1) {
      const nextTopic = unit.topics![currentTopicIndex + 1]
      this.unlockTopic(nextTopic.id)
    }

    this.checkAndUnlockCourses()
    this.saveProgress()
  }

  checkUnlockRequirements(topic: CourseTopic): boolean {
    if (!topic.unlockRequirement) return true

    const { topic: requiredTopicId, mastery: requiredMastery } = topic.unlockRequirement
    const progress = requiredTopicId ? this.userProgress.topicProgress![requiredTopicId] : undefined

    if (!progress) return false
    return (progress.mastery ?? 0) >= (requiredMastery ?? 0)
  }

  getNextRecommendedActivity():
    | { topic: CourseTopic; unit: CourseUnit; course: Course; activityType: string | undefined }
    | null {
    for (const course of this.getUnlockedCourses()) {
      if (!course.units) continue

      for (const unit of course.units) {
        if (!unit.topics) continue

        for (const topic of unit.topics) {
          if (this.isTopicUnlocked(topic.id) && !this.isTopicCompleted(topic.id)) {
            const completedActivities = this.userProgress.topicProgress![topic.id]?.completedActivities || []
            const activityType =
              (topic.activities || []).find((activity) => !completedActivities.includes(activity)) ||
              topic.activities?.[0]

            return { topic, unit, course, activityType }
          }
        }
      }
    }
    return null
  }

  getNextRecommendedTopic() {
    return this.getNextRecommendedActivity()
  }

  inferTopicForActivity(
    activityType: string,
    sessionWords: Array<{ word?: string; category?: string }> = [],
  ): {
    topicId: string
    topic: CourseTopic
    unit: CourseUnit
    course: Course
    matchedCount: number
    coverage: number
  } | null {
    if (!activityType || !Array.isArray(sessionWords) || sessionWords.length === 0) return null

    const bank = this.vocabularyBank() || []
    const sessionWordSet = new Set(
      sessionWords
        .map((entry) => String(entry?.word || '').trim().toLowerCase())
        .filter(Boolean),
    )

    if (sessionWordSet.size === 0) return null

    let bestMatch: {
      topicId: string
      topic: CourseTopic
      unit: CourseUnit
      course: Course
      matchedCount: number
      coverage: number
    } | null = null

    for (const course of this.getUnlockedCourses()) {
      for (const unit of course.units || []) {
        for (const topic of unit.topics || []) {
          if (!this.isTopicUnlocked(topic.id)) continue
          if (!(topic.activities || []).includes(activityType)) continue

          const topicWords = (topic.words || [])
            .map(
              (word) =>
                bank.find((entry) => entry.word.toLowerCase() === String(word).toLowerCase())?.word || word,
            )
            .map((word) => String(word).toLowerCase())

          if (topicWords.length === 0) continue

          const matchedCount = topicWords.filter((word) => sessionWordSet.has(word)).length
          const coverage = matchedCount / topicWords.length

          if (matchedCount < 3 || coverage < 0.6) continue

          if (!bestMatch || matchedCount > bestMatch.matchedCount || coverage > bestMatch.coverage) {
            bestMatch = { topicId: topic.id, topic, unit, course, matchedCount, coverage }
          }
        }
      }
    }

    return bestMatch
  }

  completeGameActivity(
    {
      topicId = null,
      activityType,
      score = 0,
      sessionWords = [],
    }: {
      topicId?: string | null
      activityType?: string
      score?: number
      sessionWords?: Array<{ word?: string; category?: string }>
    } = {},
  ): Record<string, unknown> | null {
    if (!activityType) return null

    let resolvedTopicId = topicId
    let topicData = resolvedTopicId ? this.getTopic(resolvedTopicId) : null

    if (!topicData || !(topicData.topic.activities || []).includes(activityType)) {
      const inferred = this.inferTopicForActivity(activityType, sessionWords)
      if (!inferred) return null
      resolvedTopicId = inferred.topicId
      topicData = inferred
    }

    const result = this.completeActivity(resolvedTopicId!, activityType, score)
    if (!result) return null

    const progress = this.userProgress.topicProgress![resolvedTopicId!] || {}
    const newlyUnlockedCourses = this.checkAndUnlockCourses()

    return {
      ...result,
      topicId: resolvedTopicId,
      topic: topicData.topic,
      unit: topicData.unit,
      course: topicData.course,
      certificateEarned: Boolean(progress.certificateEarned),
      newlyUnlockedCourses,
    }
  }

  getUnitTopics(courseId: string, unitId: string): CourseTopic[] {
    const course = this.getCourse(courseId)
    if (!course || !course.units) return []

    const unit = course.units.find((u) => u.id === unitId)
    return unit?.topics || []
  }

  getTopicMastery(topicId: string): number {
    const progress = this.userProgress.topicProgress![topicId]
    return progress ? Math.round((progress.mastery ?? 0) * 100) : 0
  }

  saveProgress(): void {
    this.save()
  }

  getStats(): {
    totalCourses: number
    unlockedCourses: number
    totalTopics: number
    unlockedTopics: number
    completedTopics: number
    certificatesEarned: number
  } {
    let totalTopics = 0
    let completedTopics = 0
    let unlockedTopics = 0

    this.getAllCourses().forEach((course) => {
      if (!course.units) return
      course.units.forEach((unit) => {
        if (!unit.topics) return
        unit.topics.forEach((topic) => {
          totalTopics++
          if (this.isTopicUnlocked(topic.id)) unlockedTopics++
          if (this.isTopicCompleted(topic.id)) completedTopics++
        })
      })
    })

    return {
      totalCourses: this.courses.size,
      unlockedCourses: this.getUnlockedCourses().length,
      totalTopics,
      unlockedTopics,
      completedTopics,
      certificatesEarned: this.userProgress.certificates!.length,
    }
  }
}
