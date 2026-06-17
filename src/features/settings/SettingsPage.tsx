import { useCallback, useState } from 'react'
import { Palette, Library, Gamepad2, SlidersHorizontal, Users, Wrench, MessagesSquare, Lock } from 'lucide-react'
import { useParentPassword } from '@/hooks/useParentPassword'
import { SettingsTabRail, type TabDef } from './components/SettingsTabRail'
import { ParentPasswordModal } from './components/ParentPasswordModal'
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
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  const { unlocked, unlock } = useParentPassword()

  // Kids (not elevated) see ONLY the unprotected tab(s) — a short, clean page,
  // not a rail of padlocked tabs they can't open (M12 Slice B). The parent tabs
  // appear only when the parent is in control (role auto-elevation or after one
  // password unlock). If a kid had a protected tab active when the session
  // re-locked, snap back to display.
  const visibleTabs = unlocked ? TABS : TABS.filter((t) => !t.protected)
  if (!unlocked && TABS.find((t) => t.id === activeId)?.protected) {
    setActiveId('display')
  }

  const openParentSettings = useCallback(() => {
    // Land on the first parent tab after unlocking (no-op if already elevated).
    setPendingTab('categories')
    if (unlocked) {
      setActiveId('categories')
    } else {
      setPwModalOpen(true)
    }
  }, [unlocked])

  const handleSelect = useCallback((id: string) => {
    const tab = TABS.find((t) => t.id === id)
    if (!tab) return
    if (tab.protected && !unlocked) {
      setPendingTab(id as TabId)
      setPwModalOpen(true)
      return
    }
    setActiveId(id as TabId)
  }, [unlocked])

  const handleUnlock = useCallback((password: string): string | null => {
    if (!unlock(password)) return 'סיסמה שגויה'
    setPwModalOpen(false)
    if (pendingTab) {
      setActiveId(pendingTab)
      setPendingTab(null)
    }
    return null
  }, [unlock, pendingTab])

  return (
    <div className="space-y-5 pb-6">
      {/* Header — maintenance actions (logs download, settings reset) live in
          the parent-gated כלי הורה tab (M6), not here. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">הגדרות</h1>
          <p className="text-sm text-muted">
            {unlocked
              ? 'התאמת המשחקים, ניהול משתמשים והעדפות תצוגה.'
              : 'העדפות תצוגה. הגדרות נוספות נמצאות באזור ההורה.'}
          </p>
        </div>
        {!unlocked && (
          <button
            type="button"
            onClick={openParentSettings}
            data-testid="open-parent-settings"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            <Lock size={14} />
            <span>הגדרות הורה</span>
          </button>
        )}
      </header>

      {/* Body: tab rail + active tab */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <SettingsTabRail
          tabs={visibleTabs}
          activeId={activeId}
          unlocked={unlocked}
          onSelect={handleSelect}
        />
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

      {/* Password modal */}
      <ParentPasswordModal
        open={pwModalOpen}
        onClose={() => {
          setPwModalOpen(false)
          setPendingTab(null)
        }}
        onSubmit={handleUnlock}
      />
    </div>
  )
}
