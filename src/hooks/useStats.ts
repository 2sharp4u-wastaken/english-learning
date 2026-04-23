import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/bridge/types'
import { getAllUsers } from '@/bridge/auth'
import { buildUserStatsModel, type UserStatsModel } from '@/bridge/stats'

const POLL_INTERVAL = 1000 // stats page is read-heavy, 1s is fine

/**
 * React hook that provides the full stats model for a selected user.
 * Returns the list of all users, the selected user ID, a setter, and the model.
 */
export function useStats() {
  const [users, setUsers] = useState<User[]>(() => getAllUsers())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    const current = localStorage.getItem('currentUser')
    const allUsers = getAllUsers()
    if (current && allUsers.find((u) => u.id === current)) return current
    return allUsers[0]?.id ?? null
  })
  const [model, setModel] = useState<UserStatsModel | null>(null)

  // Refresh users list on mount
  useEffect(() => {
    setUsers(getAllUsers())
  }, [])

  // Build model when selection changes, poll for updates
  useEffect(() => {
    if (!selectedUserId) {
      setModel(null)
      return
    }

    const build = () => {
      const user = users.find((u) => u.id === selectedUserId)
      const displayName = user?.displayName || user?.name || selectedUserId
      const next = buildUserStatsModel(selectedUserId, displayName)
      setModel(next)
    }

    build()
    const id = setInterval(build, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [selectedUserId, users])

  const selectUser = useCallback((userId: string) => {
    setSelectedUserId(userId)
  }, [])

  return { users, selectedUserId, selectUser, model }
}
