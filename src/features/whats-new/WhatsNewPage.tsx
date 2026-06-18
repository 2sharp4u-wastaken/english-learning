import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Rocket, ListChecks } from 'lucide-react'
import { RELEASES, BASE_FEATURES, type ChangeKind } from '@/data/whatsNew'
import { ROADMAP, type RoadmapStatus } from '@/data/roadmap'
import { cn } from '@/lib/cn'

/**
 * In-app "מה חדש" (What's New) + "בקרוב" (Roadmap) view. Parent/maintainer-facing
 * → adult Hebrew, NO nikud (whole subtree marked `data-nikud-skip` so
 * `utils/nikudDOM.js` leaves it alone), app-styled, fully offline. Content lives
 * in `src/data/whatsNew.ts` + `src/data/roadmap.ts` so adding a version is a pure
 * data edit. Pattern mirrors `ParentGuidePage`: a pure component (works as a
 * route or an overlay) + a thin route wrapper.
 */

const KIND_META: Record<ChangeKind, { label: string; icon: string; cls: string }> = {
  feature: { label: 'חדש', icon: '✨', cls: 'bg-learn/15 text-learn' },
  improve: { label: 'שיפור', icon: '⬆️', cls: 'bg-sky-400/15 text-sky-300' },
  fix: { label: 'תיקון', icon: '🛠️', cls: 'bg-amber-400/15 text-amber-300' },
}

const STATUS_META: Record<RoadmapStatus, { label: string; icon: string; cls: string }> = {
  'in-progress': { label: 'בעבודה', icon: '🔧', cls: 'bg-amber-400/15 text-amber-300' },
  planned: { label: 'מתוכנן', icon: '📅', cls: 'bg-sky-400/15 text-sky-300' },
  considering: { label: 'נשקל', icon: '💡', cls: 'bg-white/10 text-muted' },
}

function Chip({ icon, label, cls }: { icon: string; label: string; cls: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        cls,
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

function buildVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Tab = 'whats-new' | 'roadmap'

export function WhatsNewPage({
  onBack,
  initialTab = 'whats-new',
}: {
  onBack: () => void
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div
      data-nikud-skip
      data-testid="whats-new"
      dir="rtl"
      className="mx-auto max-w-2xl space-y-5 pb-10"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-learn/15 text-learn">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">מה חדש</h1>
            <p className="text-sm text-muted">
              הגרסה המותקנת: <span dir="ltr">v{buildVersion()}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/10 hover:text-text"
        >
          <ArrowRight size={16} />
          <span>חזרה</span>
        </button>
      </header>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="מה חדש ובקרוב"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-surface/60 p-1.5"
      >
        <TabButton active={tab === 'whats-new'} onClick={() => setTab('whats-new')} icon={<Rocket size={16} />}>
          מה חדש
        </TabButton>
        <TabButton active={tab === 'roadmap'} onClick={() => setTab('roadmap')} icon={<ListChecks size={16} />}>
          בקרוב
        </TabButton>
      </div>

      {tab === 'whats-new' ? <WhatsNewList /> : <RoadmapList />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-learn/15 text-learn' : 'text-muted hover:bg-white/5 hover:text-text',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function WhatsNewList() {
  return (
    <div className="space-y-4" data-testid="whats-new-list">
      {RELEASES.map((r) => (
        <section
          key={r.version}
          className="rounded-2xl border border-white/10 bg-surface/90 p-5 shadow-panel sm:p-6"
        >
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-learn/15 px-2.5 py-0.5 font-display text-sm font-bold text-learn" dir="ltr">
              v{r.version}
            </span>
            <span className="text-xs text-muted">{formatDate(r.date)}</span>
          </header>
          <h2 className="mb-3 font-display text-base font-semibold text-text sm:text-lg">{r.title}</h2>
          <ul className="space-y-2.5">
            {r.items.map((it, i) => {
              const meta = KIND_META[it.kind]
              return (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                  <Chip icon={meta.icon} label={meta.label} cls={meta.cls} />
                  <span className="pt-0.5">{it.text}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {/* The foundational "first version" — pinned oldest. */}
      <section className="rounded-2xl border border-white/10 bg-surface/60 p-5 sm:p-6">
        <h2 className="mb-3 font-display text-base font-semibold text-text sm:text-lg">
          {BASE_FEATURES.title}
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          {BASE_FEATURES.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="pt-0.5 text-learn" aria-hidden>
                •
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function RoadmapList() {
  return (
    <div className="space-y-3" data-testid="roadmap-list">
      <p className="text-sm leading-relaxed text-muted">
        מה שאנחנו עובדים עליו ומתכננים להוסיף. הרשימה מתעדכנת מדי פעם.
      </p>
      {ROADMAP.map((item, i) => {
        const meta = STATUS_META[item.status]
        return (
          <section
            key={i}
            className="rounded-2xl border border-white/10 bg-surface/90 p-4 shadow-panel sm:p-5"
          >
            <header className="mb-1.5 flex flex-wrap items-center gap-2">
              <Chip icon={meta.icon} label={meta.label} cls={meta.cls} />
              <h2 className="font-display text-base font-semibold text-text">{item.title}</h2>
            </header>
            <p className="text-sm leading-relaxed text-muted">{item.detail}</p>
          </section>
        )
      })}
    </div>
  )
}

/** Router wrapper for the `/whats-new` route (back → home). */
export function WhatsNewRoute() {
  const navigate = useNavigate()
  return <WhatsNewPage onBack={() => navigate('/home')} />
}
