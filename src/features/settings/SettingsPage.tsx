import { useCallback, useState } from 'react'
import { Library, Gamepad2, SlidersHorizontal, Users, Wrench, MessagesSquare } from 'lucide-react'
import { useParentPassword } from '@/hooks/useParentPassword'
import { SettingsTabRail, type TabDef } from './components/SettingsTabRail'
import { ParentPasswordModal } from './components/ParentPasswordModal'
import { CategoriesTab } from './tabs/CategoriesTab'
import { GameTab } from './tabs/GameTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { UsersTab } from './tabs/UsersTab'
import { AdvancedToolsTab } from './tabs/AdvancedToolsTab'
import { ExpressionsTab } from './tabs/ExpressionsTab'

type TabId = 'categories' | 'game' | 'advanced' | 'users' | 'advanced-tools' | 'expressions'

const TABS: TabDef[] = [
  { id: 'categories',     label: 'קטגוריות',    icon: <Library size={16} />,          protected: false },
  { id: 'game',           label: 'משחק',        icon: <Gamepad2 size={16} />,         protected: true  },
  { id: 'advanced',       label: 'מתקדם',       icon: <SlidersHorizontal size={16} />, protected: true  },
  { id: 'expressions',    label: 'ביטויים',     icon: <MessagesSquare size={16} />,   protected: true  },
  { id: 'users',          label: 'משתמשים',     icon: <Users size={16} />,            protected: true  },
  { id: 'advanced-tools', label: 'כלי הורה',    icon: <Wrench size={16} />,           protected: true  },
]

export function SettingsPage() {
  const [activeId, setActiveId] = useState<TabId>('categories')
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  const { unlocked, unlock } = useParentPassword()

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
          <p className="text-sm text-muted">התאמת המשחקים, ניהול משתמשים והעדפות תצוגה.</p>
        </div>
      </header>

      {/* Body: tab rail + active tab */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <SettingsTabRail
          tabs={TABS}
          activeId={activeId}
          unlocked={unlocked}
          onSelect={handleSelect}
        />
        <div className="min-w-0 flex-1 space-y-4">
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
