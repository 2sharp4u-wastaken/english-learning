import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, User, BookOpen, BarChart3, Settings, LogOut, Coins, Trophy } from 'lucide-react'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useUserProgress } from '@/hooks/useUserProgress'
import { cn } from '@/lib/cn'

const navItems = [
  { to: '/home', label: 'בית', icon: Home },
  { to: '/courses', label: 'קורסים', icon: BookOpen },
  { to: '/stats', label: 'סטטיסטיקות', icon: BarChart3 },
  { to: '/profile', label: 'פרופיל', icon: User },
  { to: '/settings', label: 'הגדרות', icon: Settings },
] as const

export function TopNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { displayName, initial, isAuthenticated, logout } = useAuthSession()
  const { coins, totalScore } = useUserProgress()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
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

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  return (
    <header data-testid="react-topnav" className="sticky top-0 z-30 hidden border-b border-white/8 bg-surface/95 backdrop-blur-md sm:block">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link to="/home" className="font-display text-lg font-semibold text-text">
          לומדים אנגלית
        </Link>

        {/* Center: nav links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-text'
                    : 'text-muted hover:bg-white/5 hover:text-text',
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right side: score, coins, user menu */}
        <div className="flex items-center gap-3">
          {/* Score pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted">
            <Trophy size={14} className="text-challenge" />
            <span>{totalScore.toLocaleString()}</span>
          </div>

          {/* Coins pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted">
            <Coins size={14} className="text-amber-400" />
            <span>{coins.toLocaleString()}</span>
          </div>

          {/* User menu */}
          {isAuthenticated && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-text">
                  {initial ?? displayName?.charAt(0) ?? '?'}
                </div>
                <span className="text-sm font-medium text-text">{displayName}</span>
              </button>

              {menuOpen && (
                <div className="absolute start-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/10 bg-surface p-1 shadow-panel">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/profile')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-white/5"
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-white/5"
                  >
                    <Settings size={16} />
                    <span>הגדרות</span>
                  </button>
                  <div className="my-1 border-t border-white/8" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-coral-400 transition-colors hover:bg-white/5"
                  >
                    <LogOut size={16} />
                    <span>התנתק</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
