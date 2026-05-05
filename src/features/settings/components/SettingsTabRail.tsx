import { useEffect, useRef, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface TabDef {
  id: string
  label: string
  icon: ReactNode
  protected: boolean
}

interface Props {
  tabs: TabDef[]
  activeId: string
  unlocked: boolean
  onSelect: (id: string) => void
}

export function SettingsTabRail({ tabs, activeId, unlocked, onSelect }: Props) {
  const mobileRef = useRef<HTMLDivElement>(null)

  // Keep active mobile tab in view when it changes
  useEffect(() => {
    const el = mobileRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeId])

  return (
    <>
      {/* Mobile: horizontal scroll pills */}
      <div
        ref={mobileRef}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden"
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            unlocked={unlocked}
            variant="pill"
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Desktop: vertical rail */}
      <nav data-testid="settings-tabrail" className="hidden sm:flex sm:w-52 sm:flex-col sm:gap-1">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            unlocked={unlocked}
            variant="rail"
            onSelect={onSelect}
          />
        ))}
      </nav>
    </>
  )
}

interface TabButtonProps {
  tab: TabDef
  active: boolean
  unlocked: boolean
  variant: 'pill' | 'rail'
  onSelect: (id: string) => void
}

function TabButton({ tab, active, unlocked, variant, onSelect }: TabButtonProps) {
  const showLock = tab.protected && !unlocked

  return (
    <button
      type="button"
      data-tab-id={tab.id}
      onClick={() => onSelect(tab.id)}
      className={cn(
        'flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
        variant === 'pill'
          ? 'shrink-0 rounded-full border px-3 py-1.5'
          : 'w-full rounded-lg px-3 py-2 text-start',
        active
          ? variant === 'pill'
            ? 'border-white/25 bg-white/10 text-text'
            : 'bg-white/10 text-text'
          : variant === 'pill'
            ? 'border-white/10 bg-white/5 text-muted hover:bg-white/8 hover:text-text'
            : 'text-muted hover:bg-white/5 hover:text-text',
      )}
    >
      <span className="shrink-0">{tab.icon}</span>
      <span>{tab.label}</span>
      {showLock && <Lock size={12} className="ms-auto text-muted" />}
    </button>
  )
}
