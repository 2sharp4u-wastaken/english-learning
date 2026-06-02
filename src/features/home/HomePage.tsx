import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Play } from 'lucide-react'
import { getContinueTarget, getGameCatalog, takePendingUnlocks } from '@/bridge/games'
import { playEffect, type SoundEffect } from '@/bridge/feedback'
import { speakHebrew } from '@/bridge/audio'
import { NewlyUnlockedModal } from './components/NewlyUnlockedModal'
import { HomeMascot } from './components/HomeMascot'
import { HeroSparkles } from './components/HeroSparkles'
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
  { id: 'phonics', tier: 'learn', fallbackIcon: '🔡', fallbackName: 'משחק צלילים', description: 'צלילים של כמה אותיות יחד: sh, ch, th וגם ee, oo.' },
  { id: 'listening', tier: 'practice', fallbackIcon: '👂', fallbackName: 'משחק הקשבה', description: 'שומעים מילה ובוחרים את התשובה הנכונה.' },
  { id: 'picture-match', tier: 'practice', fallbackIcon: '🖼️', fallbackName: 'מילה לתמונה', description: 'מתאימים בין מילה לתמונה במהירות.' },
  { id: 'true-or-not', tier: 'practice', fallbackIcon: '✅', fallbackName: 'נכון או לא?', description: 'בודקים אם התמונה והמילה באמת תואמות.' },
  { id: 'memory', tier: 'practice', fallbackIcon: '🧠', fallbackName: 'משחק זיכרון', description: 'מחזקים אוצר מילים דרך זוגות וזיכרון חזותי.' },
  { id: 'grammar-beginner', tier: 'practice', fallbackIcon: '📐', fallbackName: 'דקדוק למתחילים', description: 'תרגול דקדוק בסיסי עם משוב מיידי.' },
  { id: 'articles', tier: 'practice', fallbackIcon: '📝', fallbackName: 'a / an / the', description: 'מתי אומרים a, מתי an ומתי the — עם תמונות.' },
  { id: 'progressive', tier: 'practice', fallbackIcon: '🏃', fallbackName: 'זמן מתמשך', description: 'פעולות שקורות עכשיו ובעבר (is/was + ing).' },
  { id: 'practice', tier: 'practice', fallbackIcon: '🎯', fallbackName: 'מצב תרגול', description: 'חוזרים על מילים שכבר למדת כדי לחזק אותן.' },
  { id: 'reading', tier: 'challenge', fallbackIcon: '📖', fallbackName: 'משחק קריאה', description: 'עוברים מזיהוי מילים לקריאה עצמאית.' },
  { id: 'pronunciation', tier: 'challenge', fallbackIcon: '🎤', fallbackName: 'משחק הגייה', description: 'משפרים הגייה וביטחון בדיבור.' },
  { id: 'story-time', tier: 'challenge', fallbackIcon: '📚', fallbackName: 'זמן סיפור', description: 'קוראים סיפורים קצרים ומבינים הקשר.' },
  { id: 'fill-blanks', tier: 'challenge', fallbackIcon: '✍️', fallbackName: 'השלם את המשפט', description: 'משלימים משפטים עם המילה המתאימה.' },
  { id: 'scramble', tier: 'challenge', fallbackIcon: '🔀', fallbackName: 'סידור משפטים', description: 'מסדרים מילים לסדר נכון ומשמעותי.' },
  { id: 'grammar', tier: 'challenge', fallbackIcon: '✏️', fallbackName: 'תרגול דקדוק', description: 'מעמיקים בדקדוק אחרי בסיס רחב יותר.' },
  { id: 'vocabulary', tier: 'test', fallbackIcon: '📝', fallbackName: 'מבחן מילים', description: 'בודקים כמה מהמילים כבר יושבות חזק.' },
]

const TIER_META: Record<TierId, { title: string; emoji: string; badge: string; accent: string }> = {
  learn: { title: 'מתחילים ללמוד', emoji: '🌱', badge: 'תמיד פתוח', accent: 'text-learn' },
  practice: { title: 'מתרגלים יחד', emoji: '🎯', badge: 'נפתח תוך כדי משחק', accent: 'text-practice' },
  challenge: { title: 'אתגרים מגניבים', emoji: '🚀', badge: 'למי שכבר התקדם', accent: 'text-challenge' },
  test: { title: 'בודקים מה ידעתי', emoji: '🏆', badge: 'מבחן ידע', accent: 'text-test' },
}

export function HomePage() {
  const navigate = useNavigate()
  const { displayName } = useAuthSession()
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

  const greetingName = displayName ?? 'חבר'
  const continueGameId = continueTarget?.gameId ?? 'word-journey'
  const continueLabel = continueTarget?.label ?? 'מסע המילים'
  const continueIcon = continueTarget?.icon ?? '🗺️'

  return (
    <div className="space-y-6 pb-8">
      {/* ── Welcome hero: mascot + one big "let's go" action ────────────────── */}
      {/* No `overflow-hidden` here on purpose: the mascot's tap bubble opens below
          the short band and must escape it. The sparkle background self-clips (its
          own rounded overflow-hidden wrapper) and the inner gradient div is rounded,
          so the band corners stay clean without clipping the bubble. `relative z-10`
          lifts the hero (and its overflowing bubble) above the sections below it. */}
      <section
        data-testid="home-hero"
        className="relative z-10 rounded-3xl border border-white/10 bg-surface shadow-panel"
      >
        {/* Compact single-band hero (2026-06 compaction): mascot + greeting on
            one side, stat chips + the primary "continue" CTA on the other, all on
            one centered row that wraps on mobile. The old subtitle + full-width
            giant button were removed; the CTA stays prominent via bg-learn. */}
        <div className="relative rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(99,230,198,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.18),transparent_40%)] p-3 sm:p-4">
          <HeroSparkles />
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 sm:justify-between">
            {/* Greeting + mascot */}
            <div className="flex items-center gap-2.5">
              <HomeMascot streakDays={summary.streakDays} wordsLearned={summary.wordsLearned} size="sm" />
              <h1 className="font-display text-xl font-bold text-text sm:text-2xl">
                <button
                  type="button"
                  onClick={() => void speakHebrew(`שלום ${greetingName}`).catch(() => {})}
                  data-testid="home-greeting"
                  aria-label={`השמע שלום ${greetingName}`}
                  className="rounded-lg transition-transform hover:scale-[1.03] active:scale-95"
                >
                  שלום {greetingName}!{' '}
                  <span className="inline-block transition-transform hover:rotate-12" aria-hidden>
                    👋
                  </span>
                </button>
              </h1>
            </div>

            {/* Stat chips + primary continue action */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <StatChip emoji="🔥" value={summary.streakDays} label="ימים ברצף" effect="streak" />
              <StatChip emoji="⭐" value={summary.wordsLearned} label="מילים שלמדתי" effect="sparkle" />
              <StatChip emoji="🪙" value={summary.coins} label="מטבעות" effect="coin" />

              <button
                type="button"
                onClick={() => navigate(`/game/${continueGameId}`)}
                data-testid="home-continue"
                className="group flex items-center gap-2 rounded-full bg-learn px-4 py-2 text-sm font-bold text-slate-950 shadow-glow transition-transform hover:scale-105 active:scale-95 sm:text-base"
              >
                <span className="text-lg" aria-hidden>{continueIcon}</span>
                <span>בוא נשחק — {continueLabel}</span>
                <Play size={16} className="fill-current transition-transform group-hover:translate-x-[-2px]" />
              </button>
            </div>
          </div>

          {nextUnlock ? (
            <p className="relative z-10 mt-3 text-center text-sm text-muted">
              🎁 עוד קצת ותפתח את <span className="font-semibold text-text">{nextUnlock.icon} {nextUnlock.name}</span>
              {unlocks[nextUnlock.id]?.requirement ? ` · ${unlocks[nextUnlock.id]?.requirement}` : ''}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Game tiers: kept as the guidance structure, lighter presentation ── */}
      {gamesByTier.map(({ tier, meta, games }) => {
        const openCount = games.filter((game) => unlocks[game.id]?.unlocked !== false).length
        return (
          <section key={tier} data-testid={`home-tier-${tier}`} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className={cn('flex items-center gap-2 font-display text-xl font-bold sm:text-2xl', meta.accent)}>
                <span aria-hidden>{meta.emoji}</span>
                {meta.title}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
                {openCount}/{games.length} פתוחים
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {games.map((game) => {
                const isLocked = unlocks[game.id]?.unlocked === false
                return (
                  <button
                    key={game.id}
                    type="button"
                    data-testid="home-game-card"
                    data-game={game.id}
                    data-locked={isLocked ? 'true' : 'false'}
                    disabled={isLocked}
                    onClick={() => navigate(`/game/${game.id}`)}
                    title={isLocked ? unlocks[game.id]?.requirement ?? undefined : game.description}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center shadow-panel transition-transform',
                      isLocked
                        ? 'cursor-not-allowed border-white/8 bg-surface-2/60'
                        : 'border-white/12 bg-surface hover:-translate-y-0.5 hover:border-white/25 hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'text-4xl transition-transform sm:text-5xl',
                        isLocked ? 'opacity-40 grayscale' : 'group-hover:scale-110',
                      )}
                      aria-hidden
                    >
                      {game.icon}
                    </span>
                    <span className={cn('text-sm font-semibold sm:text-base', isLocked ? 'text-muted' : 'text-text')}>
                      {game.name}
                    </span>
                    {isLocked ? (
                      <span
                        data-testid="home-game-lock"
                        className="flex items-center gap-1 text-[0.7rem] leading-tight text-muted"
                      >
                        <Lock size={11} />
                        {unlocks[game.id]?.requirement ?? 'נפתח בקרוב'}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {unlockedMeta.length > 0 ? (
        <NewlyUnlockedModal games={unlockedMeta} onClose={() => setUnlockedIds([])} />
      ) : null}
    </div>
  )
}

interface StatChipProps {
  emoji: string
  value: number | string
  label: string
  /** Sound effect played when the chip is tapped. */
  effect: SoundEffect
}

function StatChip({ emoji, value, label, effect }: StatChipProps) {
  return (
    <button
      type="button"
      onClick={() => playEffect(effect)}
      aria-label={`${label}: ${value}`}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 transition-transform hover:scale-105 active:scale-95"
    >
      <span className="text-lg" aria-hidden>{emoji}</span>
      <span className="font-display text-lg font-bold text-text">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  )
}
