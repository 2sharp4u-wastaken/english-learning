// Course-launch gateway: lets the React Courses page start a topic's activity scoped
// to that topic's words, and lets game pages detect course mode + route back to /courses.
//
// Invariants (see master-plan Slice C1):
//  - NEVER route through legacy performGameSwitch — it clears the course context when
//    currentTopicActivity !== gameType. We set the context directly so it survives into
//    the React game and its async endGame (which credits the topic via getProgressUpdateContext).
//  - Clear the context only on USER-triggered exit (RewardModal exit / abort), never
//    synchronously at finish — endGame reads the context late and async.

export interface TopicActivityLaunch {
  topicId: string
  activityType: string
  topicWords: string[]
}

export interface ActiveCourseSession {
  topicId: string
  activityType: string
  returnTo: '/courses'
}

interface LegacyGameManager {
  currentTopicId: string | null
  currentTopicActivity: string | null
  isResuming: boolean
  deleteGameState(gameType: string): void
  setCourseActivityContext(ctx: { topicId: string; activityType: string; topicWords: string[] }): void
  clearCourseActivityContext(): void
}

interface LegacyCourseManager {
  startTopic(topicId: string): void
}

function getGameManager(): LegacyGameManager | null {
  return (window as any).gameManager ?? null
}

function getCourseManager(): LegacyCourseManager | null {
  // No `window.appManager` global exists — the CourseManager is `window.courseManager`
  // (gameLogic) / `window.app.courseManager` (app.js). See bridge/courses.ts.
  const w = window as any
  return w.courseManager ?? w.app?.courseManager ?? null
}

/**
 * Begin a course-scoped activity: mark the topic started, clear any stale saved game,
 * and set the legacy course-activity context so the game pool scopes to the topic words.
 * The caller then navigates to `/game/<activityType>`.
 */
export function startTopicActivity({ topicId, activityType, topicWords }: TopicActivityLaunch): void {
  getCourseManager()?.startTopic(topicId)

  const mgr = getGameManager()
  if (!mgr) return
  mgr.deleteGameState(activityType)
  mgr.isResuming = false
  mgr.setCourseActivityContext({ topicId, activityType, topicWords })
}

/**
 * The active course session, if a topic activity is currently in progress. Returns null
 * during free-play (no topic context set).
 */
export function getActiveCourseSession(): ActiveCourseSession | null {
  const mgr = getGameManager()
  if (!mgr?.currentTopicId || !mgr.currentTopicActivity) return null
  return {
    topicId: mgr.currentTopicId,
    activityType: mgr.currentTopicActivity,
    returnTo: '/courses',
  }
}

/**
 * True when the given game is running inside a course session for itself — used by game
 * bridges to skip the learn-first / learned-word filter and the mid-game resume.
 */
export function isCourseMode(gameType: string): boolean {
  const mgr = getGameManager()
  return !!mgr?.currentTopicId && mgr.currentTopicActivity === gameType
}

/** Clear the legacy course-activity context. Call only on user-triggered exit. */
export function clearCourseSession(): void {
  getGameManager()?.clearCourseActivityContext()
}
