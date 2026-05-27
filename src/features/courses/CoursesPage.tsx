import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Clock,
  GraduationCap,
  Lock,
  CheckCircle2,
  Play,
} from 'lucide-react'
import { useCourses, type CourseSnapshot } from '@/hooks/useCourses'
import { getCourseUnlockText, type Course, type CourseUnit, type CourseTopic } from '@/bridge/courses'
import { startTopicActivity } from '@/bridge/courseSession'
import { cn } from '@/lib/cn'

// React games that scope cleanly to a topic's words via getScopedQuestionPool — only
// these activity badges are launchable from a topic (Slice C1 MVP). Others stay static.
const LAUNCHABLE_ACTIVITIES = new Set(['vocabulary', 'listening', 'picture-match'])

// ─── Activity label map ─────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  vocabulary: 'אוצר מילים',
  listening: 'הקשבה',
  memory: 'זיכרון',
  scramble: 'סידור',
  'fill-blanks': 'השלמה',
  grammar: 'דקדוק',
  pronunciation: 'הגייה',
  reading: 'קריאה',
  abc: 'ABC',
  'true-or-not': 'נכון או לא?',
  'story-time': 'זמן סיפור',
  'picture-match': 'מילה לתמונה',
  'grammar-beginner': 'דקדוק למתחילים',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-learn/15 text-learn border-learn/20',
  intermediate: 'bg-practice/15 text-practice border-practice/20',
  advanced: 'bg-challenge/15 text-challenge border-challenge/20',
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CoursesPage() {
  const snap = useCourses()
  const { courses } = snap

  const stats = useMemo(() => {
    let totalTopics = 0
    let completedTopics = 0
    for (const course of courses) {
      for (const unit of course.units ?? []) {
        for (const topic of unit.topics ?? []) {
          totalTopics++
          if (snap.topicCompleted[topic.id]) completedTopics++
        }
      }
    }
    return { totalTopics, completedTopics, totalCourses: courses.length }
  }, [courses, snap.topicCompleted])

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-surface/90 px-6 py-12 text-center shadow-panel">
        <span className="text-4xl">📚</span>
        <p className="font-display text-lg font-semibold text-text">אין קורסים זמינים</p>
        <p className="text-sm text-muted">קורסים יופיעו כאן כשהם יתווספו למערכת.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.15),transparent_30%)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-practice/15">
              <GraduationCap size={22} className="text-practice" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">
                הקורסים שלי
              </h1>
              <p className="text-sm text-muted">
                {stats.completedTopics} מתוך {stats.totalTopics} נושאים הושלמו
              </p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-practice transition-all duration-500"
                style={{
                  width: `${stats.totalTopics > 0 ? Math.round((stats.completedTopics / stats.totalTopics) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{stats.totalCourses} קורסים</span>
              <span>
                {stats.totalTopics > 0
                  ? `${Math.round((stats.completedTopics / stats.totalTopics) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Course cards */}
      <div className="space-y-4">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} snap={snap} />
        ))}
      </div>
    </div>
  )
}

// ─── Course Card ────────────────────────────────────────────────────────────

function CourseCard({ course, snap }: { course: Course; snap: CourseSnapshot }) {
  const [expanded, setExpanded] = useState(false)
  const unlocked = snap.unlocked[course.id] ?? false
  const progress = snap.progress[course.id] ?? 0

  const lockText = useMemo(
    () => (unlocked ? '' : getCourseUnlockText(course.id)),
    [course.id, unlocked],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel">
      {/* Card header (clickable if unlocked) */}
      <button
        type="button"
        data-testid="course-card-header"
        data-course={course.id}
        onClick={() => unlocked && setExpanded((prev) => !prev)}
        className={cn(
          'w-full text-right transition-colors',
          unlocked ? 'cursor-pointer hover:bg-white/[0.03]' : 'cursor-default',
        )}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-2xl">
              {course.icon || '📚'}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-text">
                  {course.nameHebrew || course.name}
                </h2>
                {unlocked ? (
                  <ChevronDown
                    size={18}
                    className={cn(
                      'shrink-0 text-muted transition-transform duration-200',
                      expanded && 'rotate-180',
                    )}
                  />
                ) : (
                  <Lock size={16} className="shrink-0 text-muted/60" />
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted">
                {course.descriptionHebrew || course.description}
              </p>
            </div>
          </div>

          {/* Difficulty + progress */}
          <div className="mt-3 flex items-center gap-3">
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                DIFFICULTY_COLORS[course.difficulty] ?? 'border-white/10 bg-white/5 text-muted',
              )}
            >
              {DIFFICULTY_LABELS[course.difficulty] ?? course.difficulty}
            </span>

            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-practice transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted">{progress}%</span>
            </div>
          </div>

          {/* Lock requirement text */}
          {!unlocked && lockText && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Lock size={14} />
              <span>{lockText}</span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && unlocked && (
        <div className="border-t border-white/8 bg-white/[0.015]">
          <div className="p-4 sm:p-5">
            <div className="space-y-5">
              {(course.units ?? []).map((unit) => (
                <UnitSection key={unit.id} unit={unit} snap={snap} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit Section ───────────────────────────────────────────────────────────

function UnitSection({
  unit,
  snap,
}: {
  unit: CourseUnit
  snap: CourseSnapshot
}) {
  const unitStats = useMemo(() => {
    let total = 0
    let completed = 0
    for (const topic of unit.topics ?? []) {
      total++
      if (snap.topicCompleted[topic.id]) completed++
    }
    return { total, completed }
  }, [unit.topics, snap.topicCompleted])

  return (
    <div className="space-y-3">
      {/* Unit header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{unit.icon || '📖'}</span>
          <h3 className="font-display text-base font-semibold text-text">
            {unit.nameHebrew || unit.name}
          </h3>
        </div>
        <span className="text-xs text-muted">
          {unitStats.completed}/{unitStats.total}
        </span>
      </div>

      {/* Topic cards */}
      <div className="space-y-2">
        {(unit.topics ?? []).map((topic) => (
          <TopicCard key={topic.id} topic={topic} snap={snap} />
        ))}
      </div>
    </div>
  )
}

// ─── Topic Card ─────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  snap,
}: {
  topic: CourseTopic
  snap: CourseSnapshot
}) {
  const navigate = useNavigate()
  const unlocked = snap.topicUnlocked[topic.id] ?? false
  const completed = snap.topicCompleted[topic.id] ?? false
  const mastery = snap.topicMastery[topic.id] ?? 0
  const tp = snap.topicProgress[topic.id]
  const completedActivities = tp?.completedActivities ?? []

  const launchActivity = (activityType: string) => {
    startTopicActivity({ topicId: topic.id, activityType, topicWords: topic.words ?? [] })
    navigate(`/game/${activityType}`)
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        completed
          ? 'border-learn/20 bg-learn/[0.04]'
          : unlocked
            ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
            : 'border-white/6 bg-white/[0.015]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Topic icon */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
            completed ? 'bg-learn/15' : unlocked ? 'bg-white/8' : 'bg-white/5 grayscale',
          )}
        >
          {topic.icon || '📖'}
        </div>

        {/* Topic body */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-sm font-medium', unlocked ? 'text-text' : 'text-muted')}>
              {topic.nameHebrew || topic.name}
            </span>
            {completed ? (
              <CheckCircle2 size={16} className="shrink-0 text-learn" />
            ) : unlocked ? (
              <span className="text-xs text-muted">{topic.words.length} מילים</span>
            ) : (
              <Lock size={14} className="shrink-0 text-muted/40" />
            )}
          </div>

          {/* Activity badges — launchable ones (unlocked + scopable game) become buttons */}
          <div className="flex flex-wrap gap-1.5">
            {(topic.activities ?? []).map((act) => {
              const done = completedActivities.includes(act)
              const label = ACTIVITY_LABELS[act] ?? act
              const launchable = unlocked && LAUNCHABLE_ACTIVITIES.has(act)

              if (launchable) {
                return (
                  <button
                    key={act}
                    type="button"
                    data-testid="topic-activity-launch"
                    data-activity={act}
                    data-topic={topic.id}
                    onClick={() => launchActivity(act)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                      done
                        ? 'bg-learn/15 text-learn hover:bg-learn/25'
                        : 'bg-practice/15 text-practice hover:bg-practice/25',
                    )}
                  >
                    <Play size={10} className="shrink-0 fill-current" />
                    {label}
                  </button>
                )
              }

              return (
                <span
                  key={act}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    done
                      ? 'bg-learn/15 text-learn'
                      : unlocked
                        ? 'bg-white/8 text-muted'
                        : 'bg-white/4 text-muted/50',
                  )}
                >
                  {label}
                </span>
              )
            })}
          </div>

          {/* Mastery bar (show when > 0 and topic is unlocked) */}
          {unlocked && mastery > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    completed ? 'bg-learn' : 'bg-practice',
                  )}
                  style={{ width: `${mastery}%` }}
                />
              </div>
              <span className="text-[11px] text-muted">{mastery}%</span>
            </div>
          )}

          {/* Estimated time */}
          {unlocked && !completed && topic.estimatedMinutes && (
            <div className="flex items-center gap-1 text-xs text-muted/70">
              <Clock size={12} />
              <span>~{topic.estimatedMinutes} דקות</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
