import { createHashRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { CoursesPage } from '@/features/courses/CoursesPage'
import { StatsPage } from '@/features/stats/StatsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GameHostPage } from '@/features/games/GameHostPage'

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'courses', element: <CoursesPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'game/:gameId', element: <GameHostPage /> },
      // Catch-all: redirect any unknown hash path (e.g. /settings.html
      // bookmarked from the legacy app) to home so the React shell still
      // renders and the legacy DOM stays suppressed.
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
])
