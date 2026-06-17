import { useCallback, useState } from 'react'
import { useParentPassword } from '@/hooks/useParentPassword'
import { SettingsTabRail, type TabDef } from './components/SettingsTabRail'
import { Palette, Library, Gamepad2, SlidersHorizontal, Users, Wrench, MessagesSquare } from 'lucide-react'
import { DisplayTab } from './tabs/DisplayTab'
import { CategoriesTab } from './tabs/CategoriesTab'
import { GameTab } from './tabs/GameTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { UsersTab } from './tabs/UsersTab'
import { AdvancedToolsTab } from './tabs/AdvancedToolsTab'
import { ExpressionsTab } from './tabs/ExpressionsTab'

type TabId = 'display' | 'categories' | 'game' | 'advanced' | 'users' | 'advanced-tools' | 'expressions'

// Only "תצוגה" (display) is kid-facing; everything that changes content,
// mechanics, or accounts is parent-gated — incl. קטגוריות (content selection),
// which moved behind the gate in M12 Slice B.
const TABS: TabDef[] = [
  { id: 'display',        label: 'המשחק שלי',   icon: <Palette size={16} />,          protected: false },
  { id: 'categories',     label: 'קטגוריות',    icon: <Library size={16} />,          protected: true  },
  { id: 'game',           label: 'משחק',        icon: <Gamepad2 size={16} />,         protected: true  },
  { id: 'advanced',       label: 'מתקדם',       icon: <SlidersHorizontal size={16} />, protected: true  },
  { id: 'expressions',    label: 'ביטויים',     icon: <MessagesSquare size={16} />,   protected: true  },
  { id: 'users',          label: 'משתמשים',     icon: <Users size={16} />,            protected: true  },
  { id: 'advanced-tools', label: 'כלי הורה',    icon: <Wrench size={16} />,           protected: true  },
]

export function SettingsPage() {
  const [activeId, setActiveId] = useState<TabId>('display')
  const { unlocked } = useParentPassword()

  // Kids (not elevated) see ONLY the unprotected tab(s). The parent tabs appear
  // only when the parent is in control — which now means the parent is logged in
  // with their own (password-protected) parent profile (role auto-elevation).
  // There is NO inline "unlock from a kid session" gate anymore: managing
  // protected settings = sign in as the parent. If a kid had a protected tab
  // active when the session changed, snap back to display.
  const visibleTabs = unlocked ? TABS : TABS.filter((t) => !t.protected)
  if (!unlocked && TABS.find((t) => t.id === activeId)?.protected) {
    setActiveId('display')
  }

  // Only visible (=accessible) tabs reach this; protected tabs are shown solely
  // when already elevated, so selecting one never needs a password prompt.
  const handleSelect = useCallback((id: string) => {
    if (TABS.some((t) => t.id === id)) setActiveId(id as TabId)
  }, [])

  return (
    <div className="space-y-5 pb-6">
      {/* Header — maintenance actions (logs download, settings reset) live in
          the parent-gated כלי הורה tab (M6), not here. Parent settings are
          reached by signing in with the parent profile, not an inline button. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">הגדרות</h1>
          <p className="text-sm text-muted">
            {unlocked
              ? 'התאמת המשחקים, ניהול משתמשים והעדפות תצוגה.'
              : 'העדפות תצוגה. הגדרות נוספות נמצאות בכניסה עם פרופיל ההורה.'}
          </p>
        </div>
      </header>

      {/* Body: tab rail + active tab. For kids only one tab is visible
          ("המשחק שלי") — a single-pill rail is just a redundant label, so we drop
          it and show the customization content directly. The rail appears only
          when the parent is elevated and there's more than one tab to switch. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        {visibleTabs.length > 1 && (
          <SettingsTabRail
            tabs={visibleTabs}
            activeId={activeId}
            unlocked={unlocked}
            onSelect={handleSelect}
          />
        )}
        <div className="min-w-0 flex-1 space-y-4">
          {activeId === 'display' && <DisplayTab />}
          {activeId === 'categories' && <CategoriesTab />}
          {activeId === 'game' && <GameTab />}
          {activeId === 'advanced' && <AdvancedTab />}
          {activeId === 'expressions' && <ExpressionsTab />}
          {activeId === 'users' && <UsersTab />}
          {activeId === 'advanced-tools' && <AdvancedToolsTab />}
        </div>
      </div>
    </div>
  )
}
