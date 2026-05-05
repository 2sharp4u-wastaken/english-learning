import { useCallback, useEffect, useState } from 'react'
import {
  UserPlus,
  KeyRound,
  RotateCcw,
  BarChart3,
  Trash2,
  Shield,
  ShieldCheck,
} from 'lucide-react'
import type { User } from '@/bridge/types'
import {
  getAllUsers,
  getCurrentUserId,
  addUser as bridgeAddUser,
  resetUserPassword,
  deleteUser as bridgeDeleteUser,
  setUserRole,
  verifyAdminPassword,
} from '@/bridge/auth'
import { resetUserPractice, resetUserStats } from '@/bridge/progress'
import { SectionCard } from '../components/SectionCard'
import { ParentPasswordModal } from '../components/ParentPasswordModal'
import { AddUserModal } from '../components/AddUserModal'
import { cn } from '@/lib/cn'

const MAX_USERS = 4

type PendingAction =
  | { kind: 'reset-password'; user: User }
  | { kind: 'reset-stats'; user: User }
  | { kind: 'reset-practice'; user: User }
  | { kind: 'delete'; user: User }
  | { kind: 'toggle-role'; user: User }

const PROMPTS: Record<PendingAction['kind'], { title: string; description: string; submitLabel: string }> = {
  'reset-password': {
    title: 'איפוס סיסמה',
    description: 'ההורה יגדיר סיסמה חדשה בהתחברות הבאה. הזן את סיסמת ההורה לאישור.',
    submitLabel: 'אפס סיסמה',
  },
  'reset-stats': {
    title: 'איפוס כל הסטטיסטיקות',
    description: 'כל ציוני המשחקים, ההיסטוריה, המטבעות, התעודות והמילים הנלמדות יימחקו. אין ביטול. הזן את סיסמת ההורה לאישור.',
    submitLabel: 'אפס סטטיסטיקות',
  },
  'reset-practice': {
    title: 'איפוס נתוני תרגול',
    description: 'מונה מילים הנאבקות יאופס. הציונים יישמרו. הזן את סיסמת ההורה לאישור.',
    submitLabel: 'אפס תרגול',
  },
  delete: {
    title: 'מחיקת משתמש',
    description: 'המשתמש ונתוניו יימחקו לצמיתות. אין ביטול. הזן את סיסמת ההורה לאישור.',
    submitLabel: 'מחק משתמש',
  },
  'toggle-role': {
    title: 'שינוי תפקיד',
    description: 'החלפת סטטוס הורה. הזן את סיסמת ההורה לאישור.',
    submitLabel: 'החלף תפקיד',
  },
}

export function UsersTab() {
  const [users, setUsers] = useState<User[]>(() => getAllUsers())
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const currentUserId = getCurrentUserId()

  const refresh = useCallback(() => setUsers(getAllUsers()), [])

  // Poll so UI reflects changes made by other tabs/pages
  useEffect(() => {
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  }, [refresh])

  const atCapacity = users.length >= MAX_USERS

  const handleAction = useCallback(
    async (password: string): Promise<string | null> => {
      if (!pending) return null
      if (!verifyAdminPassword(password)) return 'סיסמה שגויה'

      try {
        switch (pending.kind) {
          case 'reset-password': {
            const r = resetUserPassword(pending.user.id, password)
            if (!r.success) return r.error ?? r.message ?? 'שגיאה'
            break
          }
          case 'delete': {
            const r = bridgeDeleteUser(pending.user.id, password)
            if (!r.success) return r.error ?? r.message ?? 'שגיאה'
            break
          }
          case 'reset-practice': {
            resetUserPractice(pending.user.id)
            break
          }
          case 'reset-stats': {
            resetUserStats(pending.user.id)
            break
          }
          case 'toggle-role': {
            const nextRole = pending.user.role === 'parent' ? null : 'parent'
            const r = setUserRole(pending.user.id, nextRole)
            if (!r.success) return r.error ?? 'שגיאה'
            break
          }
        }
      } catch (err) {
        return err instanceof Error ? err.message : 'שגיאה בלתי צפויה'
      }

      setPending(null)
      refresh()
      return null
    },
    [pending, refresh],
  )

  const handleAdd = useCallback(
    async ({
      id,
      name,
      displayName,
      initial,
      password,
    }: {
      id: string
      name: string
      displayName: string
      initial: string
      password: string
    }): Promise<string | null> => {
      if (users.length >= MAX_USERS) {
        return `הגעת למקסימום (${MAX_USERS}) משתמשים. מחק משתמש קיים לפני הוספת חדש.`
      }
      if (!verifyAdminPassword(password)) return 'סיסמה שגויה'
      const r = bridgeAddUser(id, name, displayName, initial, password)
      if (!r.success) return r.error ?? r.message ?? 'שגיאה ביצירת המשתמש'
      setAddOpen(false)
      refresh()
      return null
    },
    [users.length, refresh],
  )

  const prompt = pending ? PROMPTS[pending.kind] : null

  return (
    <div className="space-y-4">
      <SectionCard
        title="ניהול משתמשים"
        description={`${users.length}/${MAX_USERS} משתמשים רשומים.`}
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={atCapacity}
            className="flex items-center gap-1.5 rounded-lg bg-learn/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-learn disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={14} />
            <span>הוסף משתמש</span>
          </button>
        }
      >
        <ul className="space-y-2">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isCurrent={user.id === currentUserId}
              onResetPassword={() => setPending({ kind: 'reset-password', user })}
              onResetStats={() => setPending({ kind: 'reset-stats', user })}
              onResetPractice={() => setPending({ kind: 'reset-practice', user })}
              onToggleRole={() => setPending({ kind: 'toggle-role', user })}
              onDelete={() => setPending({ kind: 'delete', user })}
            />
          ))}
          {users.length === 0 && (
            <li className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">
              אין משתמשים רשומים עדיין.
            </li>
          )}
        </ul>
      </SectionCard>

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />

      <ParentPasswordModal
        open={pending !== null}
        title={prompt?.title}
        description={prompt?.description}
        submitLabel={prompt?.submitLabel}
        onClose={() => setPending(null)}
        onSubmit={handleAction}
      />
    </div>
  )
}

interface RowProps {
  user: User
  isCurrent: boolean
  onResetPassword: () => void
  onResetStats: () => void
  onResetPractice: () => void
  onToggleRole: () => void
  onDelete: () => void
}

function UserRow({
  user,
  isCurrent,
  onResetPassword,
  onResetStats,
  onResetPractice,
  onToggleRole,
  onDelete,
}: RowProps) {
  const isManager = user.role === 'manager' || user.id === 'manager'
  const isParent = user.role === 'parent'

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-3 sm:flex-nowrap">
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-sm font-semibold text-text">
          {user.initial ?? user.displayName?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium text-text">
            <span className="truncate">{user.name ?? user.displayName}</span>
            {isCurrent && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">אני</span>
            )}
            {isManager && (
              <span className="rounded-full bg-practice/15 px-1.5 py-0.5 text-[10px] text-practice">מנהל</span>
            )}
            {isParent && !isManager && (
              <span className="rounded-full bg-learn/15 px-1.5 py-0.5 text-[10px] text-learn">הורה</span>
            )}
          </div>
          <div className="truncate text-xs text-muted" dir="ltr">{user.id}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1">
        <ActionBtn icon={<KeyRound size={14} />} label="איפוס סיסמה" onClick={onResetPassword} />
        <ActionBtn icon={<RotateCcw size={14} />} label="איפוס תרגול" onClick={onResetPractice} />
        <ActionBtn icon={<BarChart3 size={14} />} label="איפוס סטטיסטיקה" onClick={onResetStats} />
        {!isManager && (
          <ActionBtn
            icon={isParent ? <ShieldCheck size={14} /> : <Shield size={14} />}
            label={isParent ? 'הסר הורה' : 'הפוך להורה'}
            onClick={onToggleRole}
            tone={isParent ? 'active' : 'neutral'}
          />
        )}
        {!isManager && (
          <ActionBtn icon={<Trash2 size={14} />} label="מחק" onClick={onDelete} tone="danger" />
        )}
      </div>
    </li>
  )
}

interface BtnProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'neutral' | 'active' | 'danger'
}

function ActionBtn({ icon, label, onClick, tone = 'neutral' }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
        tone === 'danger' &&
          'border-coral-400/25 bg-coral-400/10 text-coral-400 hover:bg-coral-400/15',
        tone === 'active' &&
          'border-learn/40 bg-learn/15 text-learn hover:bg-learn/20',
        tone === 'neutral' &&
          'border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-text',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
