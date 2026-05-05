import { useState, useMemo } from 'react'
import {
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  Coins,
  Flame,
  Gamepad2,
  Layers,
  Route,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { useStats } from '@/hooks/useStats'
import {
  buildUserStatsModel,
  formatDuration,
  formatDate,
  getJourneyStatus,
  WORD_JOURNEY_STAGES,
  GAME_NAMES,
  COIN_REASON_LABELS,
  type UserStatsModel,
  type WordMasteryInfo,
  type JourneyRow,
  type CategoryRow,
  type MemoryRecord,
} from '@/bridge/stats'
import { getAllUsers } from '@/bridge/auth'
import { cn } from '@/lib/cn'

// ─── Tab definitions ────────────────────────────────────────────────────────

type ContentTab = 'overview' | 'games' | 'words' | 'categories' | 'memory' | 'coins'

const CONTENT_TABS: { id: ContentTab; label: string; icon: typeof Star; disabledCheck?: (m: UserStatsModel) => boolean }[] = [
  { id: 'overview', label: 'סקירה', icon: BarChart3 },
  { id: 'games', label: 'משחקים', icon: Gamepad2 },
  { id: 'words', label: 'מילים', icon: BookOpen },
  { id: 'categories', label: 'קטגוריות', icon: Layers },
  { id: 'memory', label: 'זיכרון', icon: Brain, disabledCheck: (m) => !m.hasMemory },
  { id: 'coins', label: 'מטבעות', icon: Coins },
]

// ─── StatsPage ──────────────────────────────────────────────────────────────

export function StatsPage() {
  const { users, selectedUserId, selectUser, model } = useStats()
  const [showHallOfFame, setShowHallOfFame] = useState(false)
  const [activeTab, setActiveTab] = useState<ContentTab>('overview')

  const handleSelectUser = (userId: string) => {
    setShowHallOfFame(false)
    selectUser(userId)
    setActiveTab('overview')
  }

  const handleShowHof = () => {
    setShowHallOfFame(true)
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-text">
          סטטיסטיקות שחקנים
        </h1>
        <p className="mt-1 text-sm text-muted">עקוב אחר ההתקדמות וההישגים שלך</p>
      </div>

      {/* User tabs */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => handleSelectUser(user.id)}
            className={cn(
              'rounded-full px-6 py-3 text-sm font-bold transition-all',
              selectedUserId === user.id && !showHallOfFame
                ? 'bg-practice/15 text-text ring-1 ring-practice/40 shadow-md scale-105'
                : 'bg-white/10 text-text/70 hover:bg-white/15 hover:scale-[1.03]',
            )}
          >
            {user.displayName || user.name}
          </button>
        ))}
        <button
          onClick={handleShowHof}
          className={cn(
            'rounded-full px-6 py-3 text-sm font-bold transition-all',
            showHallOfFame
              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 scale-105'
              : 'bg-amber-500/10 text-amber-400/80 hover:bg-amber-500/15 hover:scale-[1.03]',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-4 w-4" />
            היכל התהילה
          </span>
        </button>
      </div>

      {/* Content */}
      {showHallOfFame ? (
        <HallOfFame />
      ) : model ? (
        <UserStatsContent model={model} activeTab={activeTab} onTabChange={setActiveTab} />
      ) : (
        <EmptyState icon={<BarChart3 className="h-12 w-12 opacity-40" />} text="בחר שחקן להצגת סטטיסטיקות" />
      )}
    </div>
  )
}

// ─── User stats content with tabs ───────────────────────────────────────────

function UserStatsContent({
  model,
  activeTab,
  onTabChange,
}: {
  model: UserStatsModel
  activeTab: ContentTab
  onTabChange: (tab: ContentTab) => void
}) {
  return (
    <div className="space-y-4">
      {/* Content tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-surface/80 p-2">
        {CONTENT_TABS.map((tab) => {
          const Icon = tab.icon
          const disabled = tab.disabledCheck?.(model) ?? false
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onTabChange(tab.id)}
              disabled={disabled}
              className={cn(
                'flex flex-1 min-w-[80px] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all',
                activeTab === tab.id
                  ? 'bg-practice/15 text-text ring-1 ring-practice/30'
                  : disabled
                    ? 'text-muted/30 cursor-not-allowed'
                    : 'text-muted hover:bg-white/8 hover:text-text',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active panel */}
      {activeTab === 'overview' && <OverviewPanel model={model} />}
      {activeTab === 'games' && <GamesPanel model={model} />}
      {activeTab === 'words' && <WordsPanel model={model} />}
      {activeTab === 'categories' && <CategoriesPanel model={model} />}
      {activeTab === 'memory' && <MemoryPanel records={model.memoryRecords} />}
      {activeTab === 'coins' && <CoinsPanel model={model} />}
    </div>
  )
}

// ─── Overview Panel ─────────────────────────────────────────────────────────

function OverviewPanel({ model }: { model: UserStatsModel }) {
  const p = model.progress
  const streakDays = p.streakDays ?? 0

  return (
    <div className="space-y-5">
      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricTile
          icon={<Star className="h-6 w-6" />}
          value={(p.totalPoints ?? 0).toLocaleString()}
          label="ניקוד כולל"
          variant="primary"
          className="col-span-2 sm:col-span-1"
        />
        <MetricTile
          icon={<Gamepad2 className="h-6 w-6" />}
          value={String(model.totalGamesPlayed)}
          label="משחקים שוחקו"
        />
        <MetricTile
          icon={<Sparkles className="h-6 w-6" />}
          value={String(model.learnedCount)}
          label="מילים נלמדו"
          variant="green"
        />
        <MetricTile
          icon={<Clock className="h-6 w-6" />}
          value={formatDuration(model.totalLearningTimeMs)}
          label="זמן למידה"
        />
        <MetricTile
          icon={<Flame className="h-6 w-6" />}
          value={String(streakDays)}
          label="רצף ימים"
          variant={streakDays >= 7 ? 'orange' : 'default'}
        />
      </div>

      {/* Insight cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard icon={<Zap className="h-4 w-4" />} title="קצב למידה" value={String(model.learningVelocity)} subtitle="מילים ב-7 הימים האחרונים" />
        <InsightCard icon={<Layers className="h-4 w-4" />} title="נושאים בתהליך" value={`${model.categoriesStartedCount}/${model.categoryRows.length}`} subtitle="קטגוריות שכבר תורגלו" />
        <InsightCard icon={<Route className="h-4 w-4" />} title="מסע מילים" value={String(model.inProgressCount)} subtitle="מילים עם מסע פעיל או חלקי" />
        <InsightCard icon={<BarChart3 className="h-4 w-4" />} title="ממוצע כללי" value={`${model.overallAverage}%`} subtitle="ממוצע כל המשחקים" />
      </div>
    </div>
  )
}

// ─── Games Panel ────────────────────────────────────────────────────────────

function GamesPanel({ model }: { model: UserStatsModel }) {
  if (model.gameRows.length === 0) {
    return <EmptyState icon={<Gamepad2 className="h-12 w-12 opacity-40" />} text="עדיין לא שיחקת אף משחק" sub="התחל לשחק כדי לראות סטטיסטיקות!" />
  }

  return (
    <div className="space-y-4">
      {/* Score banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-practice/40 bg-practice/10 px-5 py-4 text-text shadow-panel">
        <Star className="h-5 w-5 flex-shrink-0 text-practice" />
        <span className="font-bold">
          ניקוד כולל נצבר: <strong>{(model.progress.totalPoints ?? 0).toLocaleString()} נקודות</strong>
        </span>
      </div>

      {/* Games table */}
      <StatsCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-3 pe-2 text-start text-xs font-semibold text-muted" />
                <th className="pb-3 pe-4 text-start text-xs font-semibold text-muted">משחק</th>
                <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">שוחק</th>
                <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">ממוצע</th>
                <th className="pb-3 ps-2 text-center text-xs font-semibold text-muted">שיא</th>
              </tr>
            </thead>
            <tbody>
              {model.gameRows.map((row) => (
                <tr key={row.gameType} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pe-2 text-lg">{row.icon}</td>
                  <td className="py-3 pe-4 font-bold text-text">{row.name}</td>
                  <td className="py-3 px-2 text-center text-muted">{row.gamesPlayed}</td>
                  <td className="py-3 px-2 text-center font-semibold text-accent-blue">{row.averageScore}%</td>
                  <td className="py-3 ps-2 text-center font-extrabold text-amber-400">{row.bestScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StatsCard>
    </div>
  )
}

// ─── Words Panel ────────────────────────────────────────────────────────────

function WordsPanel({ model }: { model: UserStatsModel }) {
  if (model.masteryStats.total === 0 && model.journeyRows.length === 0) {
    return <EmptyState icon={<BookOpen className="h-12 w-12 opacity-40" />} text="עדיין לא נלמדו מילים" sub="שחק כדי לבנות שליטה במילים!" />
  }

  return (
    <div className="space-y-5">
      {/* Overview tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MasteryTile value={model.learnedCount} label="מילים נלמדו" color="text-emerald-400" />
        <MasteryTile value={model.inProgressCount} label="מסעות בתהליך" color="text-blue-400" />
        <MasteryTile value={model.masteryStats.total} label="מילים שתורגלו" color="text-accent-blue" />
        <MasteryTile value={model.learningVelocity} label="מילים השבוע" color="text-amber-400" />
      </div>

      {/* Journey table */}
      {model.journeyRows.length > 0 && (
        <StatsCard title="סטטוס מסע המילים לפי מילה" titleIcon={<Route className="h-4 w-4 text-accent-blue" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-3 pe-4 text-start text-xs font-semibold text-muted">מילה</th>
                  <th className="pb-3 px-2 text-start text-xs font-semibold text-muted">קטגוריה</th>
                  <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">שלבי מסע</th>
                  <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">סטטוס</th>
                  <th className="pb-3 ps-2 text-center text-xs font-semibold text-muted">עודכן</th>
                </tr>
              </thead>
              <tbody>
                {model.journeyRows.map((row) => {
                  const status = getJourneyStatus(row)
                  const updatedDate = row.graduatedDate || row.lastUpdated || row.startedDate
                  return (
                    <tr key={row.key} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pe-4">
                        <div className="font-bold text-text">{row.word}</div>
                        {row.translation && <div className="mt-0.5 text-xs text-muted">{row.translation}</div>}
                      </td>
                      <td className="py-3 px-2 text-muted">{row.categoryIcon} {row.categoryLabel}</td>
                      <td className="py-3 px-2">
                        <JourneyStagePills row={row} />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <JourneyBadge variant={status.variant}>{status.text}</JourneyBadge>
                      </td>
                      <td className="py-3 ps-2 text-center text-xs text-muted">{formatDate(updatedDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </StatsCard>
      )}

      {/* Mastery breakdown */}
      {model.masteryStats.total > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MasteryTile value={model.masteryStats.struggling.length} label="דורשות חיזוק" color="text-amber-400" />
          <MasteryTile value={model.masteryStats.learning.length} label="בלמידה" color="text-blue-400" />
          <MasteryTile value={model.masteryStats.mastered.length} label="בשליטה מלאה" color="text-emerald-400" />
          <MasteryTile value={model.masteryStats.total} label='סה"כ מילים' color="text-accent-blue" />
        </div>
      )}

      {/* Struggling words */}
      {model.masteryStats.struggling.length > 0 && (
        <StatsCard
          title={`דורשות תשומת לב (${model.masteryStats.struggling.length})`}
          titleIcon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
        >
          <WordMasteryTable words={model.masteryStats.struggling.slice(0, 10)} color="amber" />
        </StatsCard>
      )}

      {/* Mastered words */}
      {model.masteryStats.mastered.length > 0 && (
        <StatsCard
          title={`שליטה מלאה (${model.masteryStats.mastered.length})`}
          titleIcon={<Trophy className="h-4 w-4 text-emerald-400" />}
        >
          <WordMasteryTable words={model.masteryStats.mastered.slice(0, 10)} color="emerald" />
        </StatsCard>
      )}
    </div>
  )
}

// ─── Categories Panel ───────────────────────────────────────────────────────

function CategoriesPanel({ model }: { model: UserStatsModel }) {
  if (model.categoryRows.length === 0) {
    return <EmptyState icon={<Layers className="h-12 w-12 opacity-40" />} text="אין עדיין נתוני קטגוריות" />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MasteryTile value={model.categoriesStartedCount} label="קטגוריות שהתחילו" color="text-accent-blue" />
        <MasteryTile value={model.categoriesCompletedCount} label="קטגוריות שהושלמו" color="text-emerald-400" />
        <MasteryTile value={model.learnedCount} label="מילים נלמדו" color="text-blue-400" />
        <MasteryTile value={model.learningVelocity} label="מילים השבוע" color="text-amber-400" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {model.categoryRows.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  )
}

// ─── Memory Panel ───────────────────────────────────────────────────────────

function MemoryPanel({ records }: { records: MemoryRecord[] }) {
  if (records.length === 0) {
    return <EmptyState icon={<Brain className="h-12 w-12 opacity-40" />} text="עדיין לא שיחקת משחק זיכרון" />
  }

  return (
    <StatsCard title="שיאים אישיים — משחק הזיכרון" titleIcon={<Brain className="h-4 w-4 text-accent-blue" />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="pb-3 pe-4 text-start text-xs font-semibold text-muted">רמה</th>
              <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">ניקוד</th>
              <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">זמן</th>
              <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">מהלכים</th>
              <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">כוכבים</th>
              <th className="pb-3 ps-2 text-center text-xs font-semibold text-muted">תאריך</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.level} className="border-b border-white/5 last:border-0">
                <td className="py-3 pe-4 font-bold text-text">רמה {r.level}</td>
                <td className="py-3 px-2 text-center font-extrabold text-amber-400">{r.score}</td>
                <td className="py-3 px-2 text-center text-muted">{r.timeSeconds != null ? `${r.timeSeconds} שנ'` : '—'}</td>
                <td className="py-3 px-2 text-center text-muted">{r.moves ?? '—'}</td>
                <td className="py-3 px-2 text-center text-amber-400 tracking-widest">
                  {r.stars > 0 ? '★'.repeat(r.stars) + '☆'.repeat(4 - r.stars) : '—'}
                </td>
                <td className="py-3 ps-2 text-center text-xs text-muted">{r.date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StatsCard>
  )
}

// ─── Coins Panel ────────────────────────────────────────────────────────────

function CoinsPanel({ model }: { model: UserStatsModel }) {
  const p = model.progress
  const coins = p.coins ?? 0
  const totalEarned = p.totalCoinsEarned ?? 0
  const today = new Date().toISOString().split('T')[0]
  const rawHistory = Array.isArray(p.coinHistory) ? p.coinHistory : []
  const history = rawHistory.slice(-10).reverse()
  const earnedToday = rawHistory
    .filter((e) => e?.date === today && (e.amount ?? 0) > 0)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={<Coins className="h-6 w-6" />} value={coins.toLocaleString()} label="יתרת מטבעות" variant="primary" />
        <MetricTile icon={<Trophy className="h-6 w-6" />} value={totalEarned.toLocaleString()} label='סה"כ הרוויח' variant="green" />
        <MetricTile icon={<Sun className="h-6 w-6" />} value={String(earnedToday)} label="הרוויח היום" variant="orange" />
      </div>

      {history.length > 0 ? (
        <StatsCard title="היסטוריית מטבעות" titleIcon={<Clock className="h-4 w-4 text-accent-blue" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-3 pe-4 text-start text-xs font-semibold text-muted">תאריך</th>
                  <th className="pb-3 px-2 text-start text-xs font-semibold text-muted">סיבה</th>
                  <th className="pb-3 px-2 text-start text-xs font-semibold text-muted">משחק</th>
                  <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">סכום</th>
                  <th className="pb-3 ps-2 text-center text-xs font-semibold text-muted">יתרה</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => {
                  const label = COIN_REASON_LABELS[entry.reason] || entry.reason
                  const gameMeta = entry.gameType ? GAME_NAMES[entry.gameType] : null
                  return (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pe-4 text-xs text-muted">{entry.date || '—'}</td>
                      <td className="py-3 px-2 text-text">{label}</td>
                      <td className="py-3 px-2 text-muted">{gameMeta ? `${gameMeta.icon} ${gameMeta.name}` : '—'}</td>
                      <td className={cn('py-3 px-2 text-center font-bold', entry.amount >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {entry.amount >= 0 ? '+' : ''}{entry.amount}
                      </td>
                      <td className="py-3 ps-2 text-center text-muted">{entry.balance}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </StatsCard>
      ) : (
        <EmptyState icon={<Coins className="h-12 w-12 opacity-40" />} text="עדיין לא נצברו מטבעות" sub="שחק כדי לצבור מטבעות!" />
      )}
    </div>
  )
}

// ─── Hall of Fame ───────────────────────────────────────────────────────────

function HallOfFame() {
  const users = getAllUsers()

  const userData = useMemo(() => {
    return users.map((user) => {
      const displayName = user.displayName || user.name || user.id
      const m = buildUserStatsModel(user.id, displayName)
      return {
        id: user.id,
        name: displayName,
        totalPoints: m.progress.totalPoints ?? 0,
        totalGamesPlayed: m.totalGamesPlayed,
        wordsLearned: m.learnedCount,
        learningVelocity: m.learningVelocity,
        streakDays: m.progress.streakDays ?? 0,
        coins: m.progress.coins ?? 0,
      }
    })
  }, [users])

  const totalPoints = userData.reduce((s, u) => s + u.totalPoints, 0)
  const totalGames = userData.reduce((s, u) => s + u.totalGamesPlayed, 0)
  const totalLearned = userData.reduce((s, u) => s + u.wordsLearned, 0)

  const MEDALS = ['🥇', '🥈', '🥉']

  function Leaderboard({
    title,
    icon,
    dataKey,
    color,
    formatter = (v: number) => v.toLocaleString(),
  }: {
    title: string
    icon: React.ReactNode
    dataKey: keyof (typeof userData)[0]
    color: string
    formatter?: (v: number) => string
  }) {
    const sorted = [...userData].sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number))
    return (
      <StatsCard>
        <div className={cn('mb-3 flex items-center gap-2 border-b border-white/10 pb-3 font-bold', color)}>
          {icon}
          <span>{title}</span>
        </div>
        <div className="space-y-2">
          {sorted.map((user, i) => (
            <div
              key={user.id}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5',
                i === 0 && 'bg-amber-500/8',
              )}
            >
              <span className="text-xl w-8 text-center">{MEDALS[i] || `${i + 1}.`}</span>
              <span className="flex-1 font-bold text-text">{user.name}</span>
              <span className={cn('text-lg font-extrabold', color)}>{formatter(user[dataKey] as number)}</span>
            </div>
          ))}
        </div>
      </StatsCard>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 px-5 py-5 text-white shadow-lg shadow-amber-500/25">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/25 text-3xl border-2 border-white/40">
          🏆
        </div>
        <div>
          <div className="text-xl font-extrabold">היכל התהילה</div>
          <div className="text-sm font-semibold text-white/80">
            {users.length} שחקנים · {totalGames} משחקים · {totalLearned} מילים נלמדו
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={<Star className="h-6 w-6" />} value={totalPoints.toLocaleString()} label="ניקוד משותף" variant="primary" />
        <MetricTile icon={<Gamepad2 className="h-6 w-6" />} value={String(totalGames)} label='משחקים בסה"כ' variant="green" />
        <MetricTile icon={<Sparkles className="h-6 w-6" />} value={String(totalLearned)} label='מילים נלמדו בסה"כ' variant="orange" />
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="ניקוד כולל" icon={<Star className="h-4 w-4" />} dataKey="totalPoints" color="text-accent-blue" />
        <Leaderboard title="משחקים שוחקו" icon={<Gamepad2 className="h-4 w-4" />} dataKey="totalGamesPlayed" color="text-emerald-400" />
        <Leaderboard title="מילים נלמדו" icon={<Sparkles className="h-4 w-4" />} dataKey="wordsLearned" color="text-blue-400" />
        <Leaderboard title="קצב למידה שבועי" icon={<Zap className="h-4 w-4" />} dataKey="learningVelocity" color="text-purple-400" formatter={(v) => `${v} מילים`} />
        <Leaderboard title="רצף ימים" icon={<Flame className="h-4 w-4" />} dataKey="streakDays" color="text-orange-400" formatter={(v) => `${v} ימים`} />
        <Leaderboard title="מטבעות" icon={<Coins className="h-4 w-4" />} dataKey="coins" color="text-amber-400" />
      </div>
    </div>
  )
}

// ─── Shared UI components ───────────────────────────────────────────────────

function MetricTile({
  icon,
  value,
  label,
  variant = 'default',
  className: extraClass,
}: {
  icon: React.ReactNode
  value: string
  label: string
  variant?: 'default' | 'primary' | 'green' | 'orange'
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 text-center transition-transform hover:-translate-y-1',
        variant === 'primary'
          ? 'border border-practice/40 bg-practice/10 shadow-panel'
          : 'border border-white/8 bg-surface/90',
        extraClass,
      )}
    >
      <div className={cn(
        'mx-auto mb-2',
        variant === 'primary' ? 'text-practice' :
        variant === 'green' ? 'text-emerald-400' :
        variant === 'orange' ? 'text-orange-400' :
        'text-accent-blue',
      )}>
        {icon}
      </div>
      <div className={cn(
        'text-2xl font-extrabold leading-tight',
        variant === 'green' ? 'text-emerald-400' :
        variant === 'orange' ? 'text-orange-400' :
        'text-text',
      )}>
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold text-muted">
        {label}
      </div>
    </div>
  )
}

function InsightCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/90 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-accent-blue">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-2xl font-extrabold text-text">{value}</div>
      <div className="mt-1 text-xs text-muted leading-relaxed">{subtitle}</div>
    </div>
  )
}

function MasteryTile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/90 p-4 text-center">
      <div className={cn('text-3xl font-extrabold leading-tight', color)}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-muted">{label}</div>
    </div>
  )
}

function StatsCard({
  title,
  titleIcon,
  children,
}: {
  title?: string
  titleIcon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/90 p-5">
      {title && (
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
          {titleIcon}
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-surface/90 py-16 text-center">
      {icon}
      <p className="mt-4 text-lg text-muted">{text}</p>
      {sub && <p className="mt-1 text-sm text-muted/60">{sub}</p>}
    </div>
  )
}

function WordMasteryTable({ words, color }: { words: WordMasteryInfo[]; color: 'amber' | 'emerald' }) {
  const barColor = color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'
  const pctColor = color === 'amber' ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="pb-3 pe-4 text-start text-xs font-semibold text-muted">מילה</th>
            <th className="pb-3 px-2 text-start text-xs font-semibold text-muted">קטגוריה</th>
            <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">ניסיונות</th>
            <th className="pb-3 px-2 text-center text-xs font-semibold text-muted">דיוק</th>
            <th className="pb-3 ps-2 text-start text-xs font-semibold text-muted min-w-[120px]">שליטה</th>
          </tr>
        </thead>
        <tbody>
          {words.map((w) => (
            <tr key={w.word + w.category} className="border-b border-white/5 last:border-0">
              <td className="py-3 pe-4 font-bold text-text">{w.word}</td>
              <td className="py-3 px-2 text-muted">{w.categoryLabel}</td>
              <td className="py-3 px-2 text-center text-muted">{w.attempts}</td>
              <td className="py-3 px-2 text-center text-muted">{w.accuracy}%</td>
              <td className="py-3 ps-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${w.mastery * 100}%` }} />
                  </div>
                  <span className={cn('text-xs font-semibold min-w-[36px] text-end', pctColor)}>
                    {Math.round(w.mastery * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JourneyStagePills({ row }: { row: JourneyRow }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {WORD_JOURNEY_STAGES.map((stage) => {
        const isDone = row.completedStages.includes(stage.id)
        const isCurrent = !isDone && row.currentStageId === stage.id
        return (
          <span
            key={stage.id}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap',
              isDone
                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                : isCurrent
                  ? 'bg-accent-blue/15 text-accent-blue ring-1 ring-accent-blue/25'
                  : 'bg-white/5 text-muted/50',
            )}
          >
            {stage.icon} {stage.label}
          </span>
        )
      })}
    </div>
  )
}

function JourneyBadge({
  variant,
  children,
}: {
  variant: 'learned' | 'active' | 'partial' | 'none'
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap',
        variant === 'learned' && 'bg-emerald-500/12 text-emerald-400',
        variant === 'active' && 'bg-accent-blue/12 text-accent-blue',
        variant === 'partial' && 'bg-amber-500/12 text-amber-400',
        variant === 'none' && 'bg-white/5 text-muted/60',
      )}
    >
      {children}
    </span>
  )
}

function CategoryCard({ category }: { category: CategoryRow }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/90 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-bold text-text">{category.icon} {category.name}</span>
        <span className="font-bold text-text">{category.learned}/{category.total || '—'}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-accent-blue"
          style={{ width: `${category.pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{category.pct}% הושלמו</span>
        <span>{category.practiced} תורגלו</span>
      </div>
    </div>
  )
}
