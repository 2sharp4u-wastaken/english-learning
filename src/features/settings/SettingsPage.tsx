import { useCallback, useState } from 'react'
import { Library, Gamepad2, SlidersHorizontal, Users, Wrench, RotateCcw, Download } from 'lucide-react'
import { useParentPassword } from '@/hooks/useParentPassword'
import { useSettings } from '@/hooks/useSettings'
import { SettingsTabRail, type TabDef } from './components/SettingsTabRail'
import { SectionCard } from './components/SectionCard'
import { ParentPasswordModal } from './components/ParentPasswordModal'
import { CategoriesTab } from './tabs/CategoriesTab'
import { GameTab } from './tabs/GameTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { UsersTab } from './tabs/UsersTab'
import { AdvancedToolsTab } from './tabs/AdvancedToolsTab'

type TabId = 'categories' | 'game' | 'advanced' | 'users' | 'advanced-tools'

const TABS: TabDef[] = [
  { id: 'categories',     label: 'קטגוריות',    icon: <Library size={16} />,          protected: false },
  { id: 'game',           label: 'משחק',        icon: <Gamepad2 size={16} />,         protected: true  },
  { id: 'advanced',       label: 'מתקדם',       icon: <SlidersHorizontal size={16} />, protected: true  },
  { id: 'users',          label: 'משתמשים',     icon: <Users size={16} />,            protected: true  },
  { id: 'advanced-tools', label: 'כלי הורה',    icon: <Wrench size={16} />,           protected: true  },
]

export function SettingsPage() {
  const [activeId, setActiveId] = useState<TabId>('categories')
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  const [resetPromptOpen, setResetPromptOpen] = useState(false)
  const { unlocked, unlock } = useParentPassword()
  const { resetSettings } = useSettings()

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

  const handleResetRequest = useCallback(() => {
    if (unlocked) {
      setResetPromptOpen(true)
      return
    }
    setPendingTab(null)
    setPwModalOpen(true)
  }, [unlocked])

  const handleResetUnlock = useCallback((password: string): string | null => {
    if (!unlock(password)) return 'סיסמה שגויה'
    setPwModalOpen(false)
    setResetPromptOpen(true)
    return null
  }, [unlock])

  const handleResetConfirm = useCallback(() => {
    resetSettings()
    setResetPromptOpen(false)
  }, [resetSettings])

  const handleDownloadLogs = useCallback(() => {
    const logger = (window as any).consoleLogger
    if (logger?.downloadLogs) {
      logger.downloadLogs()
    }
  }, [])

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold text-text sm:text-3xl">הגדרות</h1>
          <p className="text-sm text-muted">התאמת המשחקים, ניהול משתמשים והעדפות תצוגה.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadLogs}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/8 hover:text-text"
          >
            <Download size={14} />
            <span>לוגים</span>
          </button>
          <button
            type="button"
            onClick={handleResetRequest}
            className="flex items-center gap-1.5 rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-xs font-medium text-coral-400 transition-colors hover:bg-coral-400/15"
          >
            <RotateCcw size={14} />
            <span>איפוס הגדרות</span>
          </button>
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
        onSubmit={pendingTab === null && !unlocked ? handleResetUnlock : handleUnlock}
      />

      {/* Reset confirm */}
      {resetPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setResetPromptOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm"
          >
            <SectionCard title="איפוס כל ההגדרות?" description="פעולה זו תחזיר את כל ההגדרות לברירות המחדל. לא ניתן לבטל.">
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetPromptOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleResetConfirm}
                  className="rounded-lg bg-coral-400/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-coral-400"
                >
                  איפוס
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}
