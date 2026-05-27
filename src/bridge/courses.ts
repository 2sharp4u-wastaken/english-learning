import { getUserProgress } from './progress'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CourseTopic {
  id: string
  name: string
  nameHebrew: string
  icon: string
  words: string[]
  activities: string[]
  unlockRequirement: { topic: string; mastery: number } | null
  certificateId?: string
  milestone?: { scoreThreshold: number }
  estimatedMinutes?: number
}

export interface CourseUnit {
  id: string
  name: string
  nameHebrew: string
  icon: string
  description?: string
  topics: CourseTopic[]
}

export interface Course {
  id: string
  name: string
  nameHebrew: string
  icon: string
  description: string
  descriptionHebrew: string
  difficulty: string
  unlockRequirement?: { course: string; completionPercentage: number }
  units: CourseUnit[]
}

export interface TopicProgressData {
  unlocked: boolean
  started: boolean
  mastery: number
  completedActivities: string[]
  certificateEarned: boolean
  completed: boolean
}

// ─── Legacy global access ───────────────────────────────────────────────────

interface LegacyCourseManager {
  getAllCourses(): Course[]
  getCourse(id: string): Course | null
  isCourseUnlocked(id: string): boolean
  getCourseProgress(id: string): number
  getCourseUnlockRequirementText(courseOrId: string | Course): string
  isTopicUnlocked(id: string): boolean
  isTopicCompleted(id: string): boolean
  getTopicMastery(id: string): number
  checkAndUnlockCourses(): string[]
}

function getCourseManager(): LegacyCourseManager | null {
  // The legacy CourseManager is exposed as `window.courseManager` (gameLogic) and
  // `window.app.courseManager` (app.js). There is NO `window.appManager` global —
  // an earlier reference to it silently returned null, leaving this page on its
  // empty state. Always resolve via the real globals.
  const w = window as any
  return w.courseManager ?? w.app?.courseManager ?? null
}

// ─── Public bridge API ──────────────────────────────────────────────────────

/**
 * Get all courses with their full structure (units, topics, words).
 */
export function getAllCourses(): Course[] {
  const mgr = getCourseManager()
  if (mgr) return mgr.getAllCourses()
  return []
}

/**
 * Check if a course is unlocked.
 */
export function isCourseUnlocked(courseId: string): boolean {
  const mgr = getCourseManager()
  if (mgr) return mgr.isCourseUnlocked(courseId)

  const p = getUserProgress()
  return p?.courses?.[courseId]?.unlocked ?? false
}

/**
 * Get course completion percentage (0–100).
 */
export function getCourseProgress(courseId: string): number {
  const mgr = getCourseManager()
  if (mgr) return mgr.getCourseProgress(courseId)
  return 0
}

/**
 * Get a human-readable unlock requirement for a locked course.
 */
export function getCourseUnlockText(courseId: string): string {
  const mgr = getCourseManager()
  if (mgr) return mgr.getCourseUnlockRequirementText(courseId)
  return ''
}

/**
 * Check if a topic is unlocked.
 */
export function isTopicUnlocked(topicId: string): boolean {
  const mgr = getCourseManager()
  if (mgr) return mgr.isTopicUnlocked(topicId)

  const p = getUserProgress()
  return p?.topicProgress?.[topicId]?.unlocked ?? false
}

/**
 * Check if a topic is completed (all activities done above threshold).
 */
export function isTopicCompleted(topicId: string): boolean {
  const mgr = getCourseManager()
  if (mgr) return mgr.isTopicCompleted(topicId)

  const p = getUserProgress()
  return p?.topicProgress?.[topicId]?.completed ?? false
}

/**
 * Get topic mastery percentage (0–100).
 */
export function getTopicMastery(topicId: string): number {
  const mgr = getCourseManager()
  if (mgr) return mgr.getTopicMastery(topicId)

  const p = getUserProgress()
  const tp = p?.topicProgress?.[topicId]
  return tp ? Math.round((tp as any).mastery * 100) : 0
}

/**
 * Get the raw topic progress entry from userProgress.
 */
export function getTopicProgress(topicId: string): TopicProgressData | null {
  const p = getUserProgress()
  const tp = p?.topicProgress?.[topicId]
  if (!tp) return null
  return {
    unlocked: tp.unlocked ?? false,
    started: tp.started ?? false,
    mastery: tp.mastery ?? 0,
    completedActivities: tp.completedActivities ?? [],
    certificateEarned: tp.certificateEarned ?? false,
    completed: tp.completed ?? false,
  }
}

/**
 * Trigger the legacy course manager to check and unlock any newly eligible courses.
 */
export function refreshCourseUnlocks(): void {
  const mgr = getCourseManager()
  if (mgr) mgr.checkAndUnlockCourses()
}
