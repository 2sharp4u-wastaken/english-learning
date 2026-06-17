import { useState, useMemo, type ReactNode } from 'react'
import {
  Award,
  BookOpen,
  Calendar,
  Flame,
  Gamepad2,
  Lock,
  Medal,
  MessageCircle,
  Sparkles,
  Star,
  Trophy,
  User,
} from 'lucide-react'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useUserProgress } from '@/hooks/useUserProgress'
import { useGameUnlocks } from '@/hooks/useGameUnlocks'
import { usePlayerPrefs } from '@/hooks/usePlayerPrefs'
import {
  getCertificates,
  getWordsMasteredCount,
  getLearnedCollection,
  getActivityDates,
  getBestScores,
  getVocabularyBank,
  getMasteredExpressionCount,
} from '@/bridge/progress'
import { getGameCatalog } from '@/bridge/games'
import { cn } from '@/lib/cn'

// ─── Level system ───────────────────────────────────────────────────────────

const LEVELS = [
  { min: 0, max: 5, name: 'מתחיל', icon: '🌱' },
  { min: 5, max: 10, name: 'חוקר', icon: '🔍' },
  { min: 10, max: 25, name: 'לומד מיומן', icon: '📖' },
  { min: 25, max: 50, name: 'מומחה', icon: '🌟' },
  { min: 50, max: 100, name: 'אלוף', icon: '🏆' },
  { min: 100, max: 200, name: 'אגדה!', icon: '👑' },
]

function getLevel(wordsLearned: number) {
  for (const lvl of LEVELS) {
    if (wordsLearned < lvl.max) return lvl
  }
  return LEVELS[LEVELS.length - 1]
}

// ─── Achievements definition ────────────────────────────────────────────────

interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  check: (ctx: { totalGamesPlayed: number; bestScores: Record<string, number>; streakDays: number }) => boolean
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_game',
    name: 'צעדים ראשונים',
    description: 'השלם את המשחק הראשון שלך',
    icon: '🎯',
    check: (ctx) => ctx.totalGamesPlayed >= 1,
  },
  {
    id: 'perfect_score',
    name: 'מושלם!',
    description: 'קבל ציון מושלם במשחק כלשהו',
    icon: '💯',
    check: (ctx) => Object.values(ctx.bestScores).some((s) => s === 100),
  },
  {
    id: 'streak_week',
    name: 'לוחם השבוע',
    description: 'שחק 7 ימים ברצף',
    icon: '🔥',
    check: (ctx) => ctx.streakDays >= 7,
  },
  {
    id: 'vocabulary_master',
    name: 'מומחה אוצר מילים',
    description: 'השג ציון 80+ במבחן מילים',
    icon: '📝',
    check: (ctx) => (ctx.bestScores.vocabulary ?? 0) >= 80,
  },
  {
    id: 'grammar_guru',
    name: 'גורו דקדוק',
    description: 'השג ציון 80+ במשחק דקדוק',
    icon: '✏️',
    check: (ctx) => (ctx.bestScores.grammar ?? 0) >= 80,
  },
]

// ─── Game badges ────────────────────────────────────────────────────────────

const GAME_BADGES: { type: string; icon: string; fallbackName: string }[] = [
  { type: 'word-journey', icon: '🗺️', fallbackName: 'מסע המילים' },
  { type: 'abc', icon: '🔤', fallbackName: 'ABC אותיות' },
  { type: 'memory', icon: '🧠', fallbackName: 'משחק זיכרון' },
  { type: 'grammar-beginner', icon: '📐', fallbackName: 'דקדוק למתחילים' },
  { type: 'listening', icon: '👂', fallbackName: 'הקשבה' },
  { type: 'picture-match', icon: '🖼️', fallbackName: 'מילה לתמונה' },
  { type: 'reading', icon: '📖', fallbackName: 'קריאה' },
  { type: 'pronunciation', icon: '🎤', fallbackName: 'הגייה' },
  { type: 'vocabulary', icon: '📝', fallbackName: 'אוצר מילים' },
  { type: 'fill-blanks', icon: '✍️', fallbackName: 'השלם את המשפט' },
  { type: 'scramble', icon: '🔀', fallbackName: 'סידור משפטים' },
  { type: 'grammar', icon: '📐', fallbackName: 'דקדוק' },
  { type: 'true-or-not', icon: '✅', fallbackName: 'נכון או לא?' },
  { type: 'story-time', icon: '📚', fallbackName: 'זמן סיפור' },
]

const ALWAYS_OPEN = new Set(['word-journey', 'abc', 'memory', 'grammar-beginner'])

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'certificates' | 'words' | 'achievements'

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'סקירה', icon: <User size={16} /> },
  { id: 'certificates', label: 'תעודות', icon: <Award size={16} /> },
  { id: 'words', label: 'אוסף מילים', icon: <BookOpen size={16} /> },
  { id: 'achievements', label: 'הישגים', icon: <Trophy size={16} /> },
]

// ─── Main component ─────────────────────────────────────────────────────────

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { displayName, initial } = useAuthSession()
  const summary = useUserProgress()
  const unlocks = useGameUnlocks()
  const { prefs } = usePlayerPrefs()

  const certificates = useMemo(() => getCertificates(), [summary])
  const wordsMastered = useMemo(() => getWordsMasteredCount(), [summary])
  const expressionsMastered = useMemo(() => getMasteredExpressionCount(), [summary])
  const learnedWords = useMemo(() => getLearnedCollection(), [summary])
  const activityDates = useMemo(() => getActivityDates(), [summary])
  const bestScores = useMemo(() => getBestScores(), [summary])
  const vocabBank = useMemo(() => getVocabularyBank(), [])

  const level = getLevel(summary.wordsLearned)
  const levelProgress =
    summary.wordsLearned >= level.max
      ? 100
      : Math.round(((summary.wordsLearned - level.min) / (level.max - level.min)) * 100)
  const remaining = Math.max(0, level.max - summary.wordsLearned)

  const achievementCtx = useMemo(
    () => ({
      totalGamesPlayed: summary.totalGamesPlayed,
      bestScores,
      streakDays: summary.streakDays,
    }),
    [summary, bestScores],
  )

  const name = displayName ?? 'לומד'

  return (
    <div className="space-y-6 pb-6">
      {/* Profile Hero */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(99,230,198,0.15),transparent_30%)] p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 font-display text-2xl font-semibold text-text sm:h-20 sm:w-20 sm:text-3xl"
              style={prefs.avatarColor ? { background: prefs.avatarColor, color: '#07101d' } : undefined}
            >
              {initial ?? name.slice(0, 1)}
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl" data-nikud-skip>
                {name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="text-lg">{level.icon}</span>
                <span data-testid="profile-level">{level.name}</span>
              </div>
            </div>
          </div>

          {/* Level progress bar */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {summary.wordsLearned} / {level.max} מילים
              </span>
              <span className="text-muted">
                {remaining > 0 ? `עוד ${remaining} לשלב הבא` : 'הגעת לשלב הגבוה ביותר!'}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-learn transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div
            className={cn(
              'mt-5 grid grid-cols-2 gap-3',
              expressionsMastered > 0 ? 'sm:grid-cols-6' : 'sm:grid-cols-5',
            )}
          >
            <MiniStat testid="profile-stat-streak" icon={<Flame size={16} className="text-learn" />} label="רצף" value={`${summary.streakDays}`} unit="ימים" />
            <MiniStat testid="profile-stat-words" icon={<Star size={16} className="text-practice" />} label="נלמדו" value={`${summary.wordsLearned}`} unit="מילים" />
            <MiniStat icon={<Sparkles size={16} className="text-challenge" />} label="שליטה" value={`${wordsMastered}`} unit="מילים" />
            {expressionsMastered > 0 && (
              <MiniStat testid="profile-stat-expressions" icon={<MessageCircle size={16} className="text-challenge" />} label="ביטויים" value={`${expressionsMastered}`} />
            )}
            <MiniStat icon={<Medal size={16} className="text-test" />} label="מטבעות" value={`${summary.coins}`} />
            <MiniStat testid="profile-stat-certs" icon={<Award size={16} className="text-learn" />} label="תעודות" value={`${certificates.length}`} />
          </div>
        </div>
      </section>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-surface/80 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`profile-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white/10 text-text'
                : 'text-muted hover:bg-white/5 hover:text-text',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          activityDates={activityDates}
          unlocks={unlocks}
          summary={summary}
        />
      )}
      {activeTab === 'certificates' && <CertificatesTab certificates={certificates} />}
      {activeTab === 'words' && <WordsTab learnedWords={learnedWords} vocabBank={vocabBank} />}
      {activeTab === 'achievements' && <AchievementsTab ctx={achievementCtx} />}
    </div>
  )
}

// ─── Mini stat pill ─────────────────────────────────────────────────────────

function MiniStat({
  icon,
  label,
  value,
  unit,
  testid,
}: {
  icon: ReactNode
  label: string
  value: string
  unit?: string
  testid?: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-semibold text-text" data-testid={testid}>
        {value}
        {unit && <span className="ms-1 text-xs font-normal text-muted">{unit}</span>}
      </p>
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({
  activityDates,
  unlocks,
  summary,
}: {
  activityDates: string[]
  unlocks: Record<string, { unlocked: boolean; requirement?: string }>
  summary: { totalGamesPlayed: number; totalScore: number }
}) {
  return (
    <div className="space-y-4">
      <ActivityCalendar activityDates={activityDates} />
      <QuickStats totalGamesPlayed={summary.totalGamesPlayed} totalScore={summary.totalScore} />
      <UnlockedGamesGrid unlocks={unlocks} />
    </div>
  )
}

// ─── Activity Calendar ──────────────────────────────────────────────────────

function ActivityCalendar({ activityDates }: { activityDates: string[] }) {
  const activitySet = useMemo(() => new Set(activityDates), [activityDates])

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
  const today = new Date()
  const todayDay = today.getDay()

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - todayDay)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    return {
      name: dayNames[i],
      isActive: activitySet.has(dateStr),
      isToday: i === todayDay,
    }
  })

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <Calendar size={16} />
        <span>פעילות השבוע</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.name} className="flex flex-col items-center gap-1.5">
            <span className="text-xs text-muted">{day.name}</span>
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                day.isActive && day.isToday && 'bg-learn text-slate-950',
                day.isActive && !day.isToday && 'bg-learn/30 text-learn',
                !day.isActive && day.isToday && 'border-2 border-white/20 text-text',
                !day.isActive && !day.isToday && 'bg-white/5 text-muted',
              )}
            >
              {day.isActive ? '✓' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Quick Stats ────────────────────────────────────────────────────────────

function QuickStats({ totalGamesPlayed, totalScore }: { totalGamesPlayed: number; totalScore: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Gamepad2 size={16} />
          <span>משחקים שהושלמו</span>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold text-text">{totalGamesPlayed}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Trophy size={16} />
          <span>ניקוד כולל</span>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold text-text">{totalScore}</p>
      </div>
    </div>
  )
}

// ─── Unlocked Games Grid ────────────────────────────────────────────────────

function UnlockedGamesGrid({
  unlocks,
}: {
  unlocks: Record<string, { unlocked: boolean; requirement?: string }>
}) {
  const badges = useMemo(() => {
    const byId = new Map(getGameCatalog().map((g) => [g.type, g]))
    return GAME_BADGES.map((badge) => ({
      ...badge,
      name: byId.get(badge.type)?.displayNameHebrew ?? badge.fallbackName,
    }))
  }, [])
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <Gamepad2 size={16} />
        <span>משחקים</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map((game) => {
          const isOpen = ALWAYS_OPEN.has(game.type) || unlocks[game.type]?.unlocked
          return (
            <div
              key={game.type}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm',
                isOpen
                  ? 'border border-white/12 bg-white/8 text-text'
                  : 'border border-white/6 bg-white/3 text-muted/60',
              )}
            >
              <span>{game.icon}</span>
              <span>{game.name}</span>
              {!isOpen && <Lock size={12} className="text-muted/40" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Certificates Tab ───────────────────────────────────────────────────────

interface CertificateData {
  id: string
  topicId: string
  topicName?: string
  earnedDate: string
  score: number
}

function CertificatesTab({ certificates }: { certificates: CertificateData[] }) {
  if (certificates.length === 0) {
    return (
      <EmptyState
        icon="🎓"
        title="עוד אין תעודות"
        description="סיים נושא כדי לקבל תעודה!"
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {certificates.map((cert) => (
        <div
          key={cert.id}
          className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-challenge/15 text-xl">
              🏅
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text">{cert.topicName ?? cert.topicId}</p>
              {cert.earnedDate && (
                <p className="mt-0.5 text-xs text-muted">{cert.earnedDate}</p>
              )}
              <p className="mt-1 text-sm text-muted">ציון: {cert.score}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Words Tab (Sticker Book) ───────────────────────────────────────────────

function WordsTab({
  learnedWords,
  vocabBank,
}: {
  learnedWords: Record<string, { graduatedDate?: string }>
  vocabBank: Array<{ word: string; translation: string; category: string; image: string }>
}) {
  const entries = useMemo(() => {
    const keys = Object.keys(learnedWords)
    if (keys.length === 0) return []

    const bankMap = new Map<string, (typeof vocabBank)[number]>()
    for (const w of vocabBank) {
      bankMap.set(`${w.word.toLowerCase()}_${w.category}`, w)
    }

    return keys
      .sort((a, b) => {
        const da = learnedWords[a].graduatedDate ?? ''
        const db = learnedWords[b].graduatedDate ?? ''
        return db.localeCompare(da)
      })
      .map((key) => {
        const wordData = bankMap.get(key)
        return {
          key,
          emoji: wordData?.image ?? '📝',
          word: wordData?.word ?? key.split('_')[0],
          translation: wordData?.translation ?? '',
        }
      })
  }, [learnedWords, vocabBank])

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="🗺️"
        title="עוד לא למדת מילים"
        description="התחל מסע מילים כדי לאסוף!"
      />
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-surface/90 p-3 text-center shadow-panel"
          title={`${entry.word} — ${entry.translation}`}
        >
          <span className="text-2xl">{entry.emoji}</span>
          <span className="text-sm font-medium text-text">{entry.word}</span>
          <span className="text-xs text-muted">{entry.translation}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Achievements Tab ───────────────────────────────────────────────────────

function AchievementsTab({
  ctx,
}: {
  ctx: { totalGamesPlayed: number; bestScores: Record<string, number>; streakDays: number }
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ACHIEVEMENTS.map((ach) => {
        const unlocked = ach.check(ctx)
        return (
          <div
            key={ach.id}
            className={cn(
              'rounded-2xl border p-4 shadow-panel transition-colors',
              unlocked
                ? 'border-white/12 bg-surface/90'
                : 'border-white/6 bg-surface/50',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl',
                  unlocked ? 'bg-learn/15' : 'bg-white/5 grayscale',
                )}
              >
                {ach.icon}
              </div>
              <div className="min-w-0">
                <p className={cn('font-medium', unlocked ? 'text-text' : 'text-muted')}>
                  {ach.name}
                </p>
                <p className="mt-0.5 text-sm text-muted">{ach.description}</p>
                {unlocked && (
                  <span className="mt-1.5 inline-block rounded-full bg-learn/15 px-2 py-0.5 text-xs font-medium text-learn">
                    הושג!
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-surface/90 px-6 py-12 text-center shadow-panel">
      <span className="text-4xl">{icon}</span>
      <p className="font-display text-lg font-semibold text-text">{title}</p>
      <p className="text-sm text-muted">{description}</p>
    </div>
  )
}
