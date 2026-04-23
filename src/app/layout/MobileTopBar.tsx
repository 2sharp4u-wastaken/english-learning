import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Coins, LogOut, Settings, Trophy, User } from 'lucide-react'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useUserProgress } from '@/hooks/useUserProgress'

export function MobileTopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { displayName, initial, isAuthenticated, logout } = useAuthSession()
  const { coins, totalScore } = useUserProgress()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  if (!isAuthenticated) return null

  return (
    <header className="border-b border-white/8 bg-surface/80 backdrop-blur-md sm:hidden">
      <div className="flex h-12 items-center justify-between px-3">
        {/* User avatar + name */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-text">
              {initial ?? displayName?.charAt(0) ?? '?'}
            </div>
            <span className="text-sm font-medium text-text">{displayName}</span>
          </button>

          {menuOpen && (
            <div className="absolute start-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-panel">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/profile')
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text transition-colors hover:bg-white/5"
              >
                <User size={16} />
                <span>פרופיל</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/settings')
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text transition-colors hover:bg-white/5"
              >
                <Settings size={16} />
                <span>הגדרות</span>
              </button>
              <div className="border-t border-white/8" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-coral-400 transition-colors hover:bg-white/5"
              >
                <LogOut size={16} />
                <span>התנתק</span>
              </button>
            </div>
          )}
        </div>

        {/* Score + Coins */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted">
            <Trophy size={12} className="text-challenge" />
            <span>{totalScore.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted">
            <Coins size={12} className="text-amber-400" />
            <span>{coins.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
