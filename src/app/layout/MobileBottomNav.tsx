import { Link, useLocation } from 'react-router-dom'
import { Home, User, BookOpen, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/cn'

const navItems = [
  { to: '/home', label: 'בית', icon: Home },
  { to: '/courses', label: 'קורסים', icon: BookOpen },
  { to: '/stats', label: 'סטטיסטיקות', icon: BarChart3 },
  { to: '/profile', label: 'פרופיל', icon: User },
  { to: '/settings', label: 'הגדרות', icon: Settings },
] as const

export function MobileBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-surface/95 backdrop-blur-md sm:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-learn'
                  : 'text-muted hover:text-text',
              )}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
