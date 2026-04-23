// Shared TypeScript types for the bridge layer.
// These mirror the shapes stored in localStorage and exposed by legacy globals.

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string          // Hebrew display name
  displayName: string   // English display name
  initial: string       // Single-letter avatar
  password: string | null
  created: string       // ISO date
  lastLogin: string | null
}

export interface Session {
  userId: string
  userName: string
  displayName: string
  initial: string
  loginTime: number
  lastActivity: number
  authenticated: boolean
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface WordStats {
  word: string
  category: string
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  consecutiveCorrect: number
  lastSeen: string | null
  lastResult: 'correct' | 'incorrect' | null
  masteryLevel: number
  gameTypeStats: Record<string, { correct: number; total: number }>
  responseTimes: number[]
  averageResponseTime: number | null
}

export interface LearnedWordEntry {
  graduatedDate: string
  journeyScore: number
  journeyCompletions: number
  reinforcedIn: string[]
  lastPracticed: string
}

export interface GameUnlockEntry {
  unlocked: boolean
  unlockedDate?: string | null
  requirement?: string
  requiredCount?: number
  requiredTopics?: number
  requiredAbcMastery?: number
}

export interface Certificate {
  id: string
  topicId: string
  topicName?: string
  earnedDate: string
  score: number
}

export interface CoinHistoryEntry {
  amount: number
  reason: string
  gameType?: string | null
  timestamp: number
  date: string
  balance: number
}

export interface CourseProgressEntry {
  unlocked: boolean
  startedDate?: string
  currentUnit?: string | null
  currentTopic?: string | null
}

export interface TopicProgressEntry {
  unlocked: boolean
  started: boolean
  mastery: number
  completedActivities: string[]
  certificateEarned: boolean
  completed: boolean
}

export interface UserProgress {
  version: number
  hasPlayedBefore: boolean
  totalGamesPlayed: number
  bestScores: Record<string, number>
  streakDays: number
  lastPlayDate: string | null
  totalCorrectAnswers: number
  wordMastery: Record<string, WordStats>
  lastSessionWordKeys: Record<string, string[]>
  courses: Record<string, CourseProgressEntry>
  topicProgress: Record<string, TopicProgressEntry>
  certificates: Certificate[]
  totalPoints: number
  totalLearningTimeMs: number
  coins: number
  totalCoinsEarned: number
  coinHistory: CoinHistoryEntry[]
  lastLoginDate: string | null
  studentName: string | null
  learnedWords: Record<string, LearnedWordEntry>
  wordJourneyProgress: Record<string, unknown>
  gameUnlocks: Record<string, GameUnlockEntry>
  activityDates?: string[]
}

export interface UserSummary {
  streakDays: number
  wordsLearned: number
  coins: number
  totalScore: number
  totalGamesPlayed: number
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  soundEnabled: boolean
  speechRate: number
  autoPlayAudio: boolean
  showPhonetics: boolean
  language: string
  [key: string]: unknown   // legacy may add extra fields
}

// ─── Games ───────────────────────────────────────────────────────────────────

export interface GameDefinition {
  type: string
  displayName: string
  displayNameHebrew: string
  icon: string
  config: {
    questionsPerGame: number
    pointsPerCorrect: number
    categories?: string[]
    skillLevel?: string
    timeLimit?: number | null
  }
}

export interface ContinueTarget {
  gameId: string
  label: string
  icon: string
}
