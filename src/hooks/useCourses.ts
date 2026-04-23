import { useState, useEffect, useRef } from 'react'
import {
  getAllCourses,
  isCourseUnlocked,
  getCourseProgress,
  isTopicUnlocked,
  isTopicCompleted,
  getTopicMastery,
  getTopicProgress,
  refreshCourseUnlocks,
  type Course,
  type TopicProgressData,
} from '@/bridge/courses'

export interface CourseSnapshot {
  courses: Course[]
  unlocked: Record<string, boolean>
  progress: Record<string, number>
  topicUnlocked: Record<string, boolean>
  topicCompleted: Record<string, boolean>
  topicMastery: Record<string, number>
  topicProgress: Record<string, TopicProgressData | null>
}

function buildSnapshot(): CourseSnapshot {
  refreshCourseUnlocks()
  const courses = getAllCourses()

  const unlocked: Record<string, boolean> = {}
  const progress: Record<string, number> = {}
  const topicUnlockedMap: Record<string, boolean> = {}
  const topicCompletedMap: Record<string, boolean> = {}
  const topicMasteryMap: Record<string, number> = {}
  const topicProgressMap: Record<string, TopicProgressData | null> = {}

  for (const course of courses) {
    unlocked[course.id] = isCourseUnlocked(course.id)
    progress[course.id] = getCourseProgress(course.id)

    for (const unit of course.units ?? []) {
      for (const topic of unit.topics ?? []) {
        topicUnlockedMap[topic.id] = isTopicUnlocked(topic.id)
        topicCompletedMap[topic.id] = isTopicCompleted(topic.id)
        topicMasteryMap[topic.id] = getTopicMastery(topic.id)
        topicProgressMap[topic.id] = getTopicProgress(topic.id)
      }
    }
  }

  return {
    courses,
    unlocked,
    progress,
    topicUnlocked: topicUnlockedMap,
    topicCompleted: topicCompletedMap,
    topicMastery: topicMasteryMap,
    topicProgress: topicProgressMap,
  }
}

/**
 * Hook that provides course data with 500ms polling for cross-system reactivity.
 */
export function useCourses(): CourseSnapshot {
  const [snapshot, setSnapshot] = useState<CourseSnapshot>(buildSnapshot)
  const prevJson = useRef('')

  useEffect(() => {
    const tick = () => {
      const next = buildSnapshot()
      const json = JSON.stringify(next)
      if (json !== prevJson.current) {
        prevJson.current = json
        setSnapshot(next)
      }
    }

    // Initial
    tick()

    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  return snapshot
}
