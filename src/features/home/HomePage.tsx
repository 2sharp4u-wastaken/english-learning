import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Flame, Lock, Medal, Play, Settings, Star, Trophy, User } from 'lucide-react'
import { getContinueTarget, getGameCatalog, takePendingUnlocks } from '@/bridge/games'
import { NewlyUnlockedModal } from './components/NewlyUnlockedModal'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useGameUnlocks } from '@/hooks/useGameUnlocks'
import { useUserProgress } from '@/hooks/useUserProgress'
import { cn } from '@/lib/cn'

type TierId = 'learn' | 'practice' | 'challenge' | 'test'

interface GameCardMeta {
  id: string
  tier: TierId
  fallbackIcon: string
  fallbackName: string
  description: string
}

const GAME_ORDER: GameCardMeta[] = [
  { id: 'word-journey', tier: 'learn', fallbackIcon: '🗺️', fallbackName: 'מסע המילים', description: 'לומדים מילים חדשות בהתקדמות רציפה.' },
  { id: 'abc', tier: 'learn', fallbackIcon: '🔤', fallbackName: 'ABC אותיות', description: 'מתרגלים אותיות, צלילים וזיהוי בסיסי.' },
  { id: 'listening', tier: 'practice', fallbackIcon: '👂', fallbackName: 'משחק הקשבה', description: 'שומעים מילה ובוחרים את התשובה הנכונה.' },
  { id: 'picture-match', tier: 'practice', fallbackIcon: '🖼️', fallbackName: 'מילה לתמונה', description: 'מתאימים בין מילה לתמונה במהירות.' },
  { id: 'true-or-not', tier: 'practice', fallbackIcon: '✅', fallbackName: 'נכון או לא?', description: 'בודקים אם התמונה והמילה באמת תואמות.' },
  { id: 'memory', tier: 'practice', fallbackIcon: '🧠', fallbackName: 'משחק זיכרון', description: 'מחזקים אוצר מילים דרך זוגות וזיכרון חזותי.' },
  { id: 'grammar-beginner', tier: 'practice', fallbackIcon: '📐', fallbackName: 'דקדוק למתחילים', description: 'תרגול דקדוק בסיסי עם משוב מיידי.' },
  { id: 'reading', tier: 'challenge', fallbackIcon: '📖', fallbackName: 'משחק קריאה', description: 'עוברים מזיהוי מילים לקריאה עצמאית.' },
  { id: 'pronunciation', tier: 'challenge', fallbackIcon: '🎤', fallbackName: 'משחק הגייה', description: 'משפרים הגייה וביטחון בדיבור.' },
  { id: 'story-time', tier: 'challenge', fallbackIcon: '📚', fallbackName: 'זמן סיפור', description: 'קוראים סיפורים קצרים ומבינים הקשר.' },
  { id: 'fill-blanks', tier: 'challenge', fallbackIcon: '✍️', fallbackName: 'השלם את המשפט', description: 'משלימים משפטים עם המילה המתאימה.' },
  { id: 'scramble', tier: 'challenge', fallbackIcon: '🔀', fallbackName: 'סידור משפטים', description: 'מסדרים מילים לסדר נכון ומשמעותי.' },
  { id: 'grammar', tier: 'challenge', fallbackIcon: '✏️', fallbackName: 'תרגול דקדוק', description: 'מעמיקים בדקדוק אחרי בסיס רחב יותר.' },
  { id: 'vocabulary', tier: 'test', fallbackIcon: '📝', fallbackName: 'מבחן מילים', description: 'בודקים כמה מהמילים כבר יושבות חזק.' },
]

const TIER_META: Record<TierId, { title: string; badge: string; accent: string }> = {
  learn: { title: 'למידה', badge: 'תמיד פתוח', accent: 'text-learn' },
  practice: { title: 'תרגול', badge: 'נפתח בהתקדמות', accent: 'text-practice' },
  challenge: { title: 'אתגר', badge: 'למתקדמים', accent: 'text-challenge' },
  test: { title: 'מבחן', badge: 'בדיקת ידע', accent: 'text-test' },
}

export function HomePage() {
  const navigate = useNavigate()
  const { displayName, initial } = useAuthSession()
  const summary = useUserProgress()
  const unlocks = useGameUnlocks()

  const catalog = useMemo(() => {
    const byId = new Map(getGameCatalog().map((game) => [game.type, game]))
    return GAME_ORDER.map((item) => {
      const game = byId.get(item.id)
      return {
        ...item,
        icon: game?.icon ?? item.fallbackIcon,
        name: game?.displayNameHebrew ?? item.fallbackName,
      }
    })
  }, [])

  const continueTarget = useMemo(() => getContinueTarget(), [])

  const nextUnlock = useMemo(
    () => catalog.find((game) => unlocks[game.id]?.unlocked === false) ?? null,
    [catalog, unlocks],
  )

  const availableGames = useMemo(
    () => catalog.filter((game) => unlocks[game.id]?.unlocked !== false).length,
    [catalog, unlocks],
  )

  const gamesByTier = useMemo(
    () =>
      (Object.keys(TIER_META) as TierId[]).map((tier) => ({
        tier,
        meta: TIER_META[tier],
        games: catalog.filter((game) => game.tier === tier),
      })),
    [catalog],
  )

  // Show the "newly unlocked games" celebration once, for games queued by the
  // session that just finished (see queuePendingUnlocks / gameLogic completion).
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])
  useEffect(() => {
    const ids = takePendingUnlocks()
    if (ids.length > 0) setUnlockedIds(ids)
  }, [])

  const unlockedMeta = useMemo(
    () =>
      unlockedIds.map((id) => {
        const game = catalog.find((c) => c.id === id)
        return { id, icon: game?.icon ?? '🎮', name: game?.name ?? id }
      }),
    [unlockedIds, catalog],
  )

  const greetingName = displayName ?? 'לומד'
  const continueGameId = continueTarget?.gameId ?? 'word-journey'
  const continueLabel = continueTarget?.label ?? 'מסע המילים'
  const continueIcon = continueTarget?.icon ?? '🗺️'

  return (
    <div className="space-y-6 pb-6">
      <section data-testid="home-hero" className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-panel">
        <div className="grid gap-5 bg-[radial-gradient(circle_at_top_right,rgba(99,230,198,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 sm:grid-cols-[1.5fr_1fr] sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 font-display text-lg font-semibold text-text">
                  {initial ?? greetingName.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm text-muted">שלום {greetingName}</p>
                  <h1 className="font-display text-3xl font-semibold text-text sm:text-4xl">
                    ממשיכים ללמוד בלי לאבד את ההתקדמות
                  </h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                כל הנתונים כאן נמשכים מהמערכת הקיימת: רצף, מטבעות, מילים שנלמדו ונעילות משחקים.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/game/${continueGameId}`)}
                className="inline-flex items-center gap-2 rounded-xl bg-learn px-4 py-3 font-medium text-slate-950 transition-transform hover:scale-[1.01]"
              >
                <span className="text-lg">{continueIcon}</span>
                המשך עם {continueLabel}
                <Play size={16} className="fill-current" />
              </button>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-text transition-colors hover:bg-white/10"
              >
                <BookOpen size={16} />
                הקורסים שלי
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:content-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-muted">המשחק הבא שנפתח</p>
              {nextUnlock ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-lg font-semibold text-text">
                    <span>{nextUnlock.icon}</span>
                    <span>{nextUnlock.name}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {unlocks[nextUnlock.id]?.requirement ?? 'המשך לשחק כדי לפתוח'}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">כל המשחקים הפתוחים כבר זמינים עבורך.</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-muted">זמינות כללית</p>
              <p className="mt-2 font-display text-3xl font-semibold text-text">
                {availableGames}/{catalog.length}
              </p>
              <p className="text-sm text-muted">משחקים זמינים כרגע מתוך כל הקטלוג.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Flame size={18} className="text-learn" />} label="רצף נוכחי" value={`${summary.streakDays}`} detail="ימים ברצף" />
        <StatCard icon={<Star size={18} className="text-practice" />} label="מילים שנלמדו" value={`${summary.wordsLearned}`} detail="מילים שהושלמו" />
        <StatCard icon={<Trophy size={18} className="text-challenge" />} label="מטבעות" value={`${summary.coins}`} detail="זמינים בחשבון" />
        <StatCard icon={<Medal size={18} className="text-test" />} label="ניקוד כולל" value={`${summary.totalScore}`} detail={`${summary.totalGamesPlayed} משחקים`} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <QuickLink to="/profile" icon={<User size={18} />} title="פרופיל" description="תעודות, הישגים ופעילות אישית" />
        <QuickLink to="/courses" icon={<BookOpen size={18} />} title="קורסים" description="מעקב אחר נושאים ויחידות" />
        <QuickLink to="/settings" icon={<Settings size={18} />} title="הגדרות" description="צליל, פוניטיקה והעדפות מערכת" />
      </section>

      {gamesByTier.map(({ tier, meta, games }) => (
        <section key={tier} data-testid={`home-tier-${tier}`} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className={cn('font-display text-2xl font-semibold', meta.accent)}>{meta.title}</h2>
              <p className="text-sm text-muted">{meta.badge}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
              {games.filter((game) => unlocks[game.id]?.unlocked !== false).length}/{games.length} פתוחים
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {games.map((game) => {
              const unlock = unlocks[game.id]
              const isLocked = unlock?.unlocked === false

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => {
                    if (!isLocked) navigate(`/game/${game.id}`)
                  }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border p-4 text-right shadow-panel transition-transform',
                    isLocked
                      ? 'cursor-not-allowed border-white/10 bg-surface-2/80'
                      : 'border-white/12 bg-surface hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface-2',
                  )}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-40" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-lg font-semibold text-text">
                        <span className="text-2xl">{game.icon}</span>
                        <span>{game.name}</span>
                      </div>
                      <p className="text-sm leading-6 text-muted">{game.description}</p>
                    </div>
                    <div
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium',
                        isLocked
                          ? 'border-white/10 bg-white/5 text-muted'
                          : 'border-white/10 bg-white/10 text-text',
                      )}
                    >
                      {isLocked ? 'נעול' : 'פתוח'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    {isLocked ? (
                      <div className="flex items-center gap-2 text-muted">
                        <Lock size={14} />
                        <span>{unlock?.requirement ?? 'נדרש עוד תרגול'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-text">
                        <span>לפתיחה במשחק הקיים</span>
                        <ArrowLeft size={14} />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {unlockedMeta.length > 0 ? (
        <NewlyUnlockedModal games={unlockedMeta} onClose={() => setUnlockedIds([])} />
      ) : null}
    </div>
  )
}

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  detail: string
}

function StatCard({ icon, label, value, detail }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  )
}

interface QuickLinkProps {
  to: string
  icon: ReactNode
  title: string
  description: string
}

function QuickLink({ to, icon, title, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel transition-colors hover:bg-surface-2"
    >
      <div className="flex items-center gap-2 text-text">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </Link>
  )
}
