// Shared TypeScript types for the bridge layer.
// These mirror the shapes stored in localStorage and exposed by legacy globals.

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'parent' | 'manager'

export interface User {
  id: string
  name: string          // Hebrew display name
  displayName: string   // English display name
  initial: string       // Single-letter avatar
  password: string | null
  created: string       // ISO date
  lastLogin: string | null
  role?: UserRole | null
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
  /** Phase 5 expression mastery, keyed by phrase (Slice 5.3). */
  expressionMastery?: Record<string, ExpressionStats>
}

/** Per-phrase expression mastery (Phase 5). Mirrors engine ExprStats. */
export interface ExpressionStats {
  phrase: string
  seen: number
  correct: number
  mastered: boolean
  lastSeen: string | null
}

export interface UserSummary {
  streakDays: number
  wordsLearned: number
  coins: number
  totalScore: number
  totalGamesPlayed: number
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type LearningPace = 'slow' | 'normal' | 'fast'
export type ExitBehavior = 'autosave' | 'confirmation'

export interface AppSettings {
  // Vocabulary category selection
  selectedCategories: string[]

  // Game mechanics
  questionsPerGame: number       // 5..20
  clickRepeatCount: number       // 1..5
  audioPlaysAllowed: number      // 3..15
  hebrewVocalization: boolean
  learningPace: LearningPace

  // Display / feel
  showNikud: boolean
  lowercaseMode: boolean
  showConfetti: boolean
  exitBehavior: ExitBehavior
  gameUnlockOverride: boolean
  difficultyAutoGate: boolean    // Slice 1.9 — gate word-length by progress

  // Reading "sneak peek" (F1) — a child-tapped button re-flashes the hidden
  // word for a short moment. Optional: pre-F1 settings blobs won't have these;
  // the Reading page + DEFAULT_SETTINGS supply the fallbacks.
  sneakPeekEnabled?: boolean     // master on/off for the peek button
  sneakPeekDuration?: number     // reveal length in seconds (0.3..2)
  sneakPeekBudget?: number       // peeks allowed per question (1..5)

  // Custom words (parent)
  claudeApiKey: string

  // Phase 5 — master on/off for all expression content (Slice 5.2). Optional:
  // absent ⇒ treated as enabled (the bridge defaults it on).
  expressionsEnabled?: boolean

  // Phase 5 — enabled expression registers (kid-friendly / casual / edgy).
  // Optional: pre-5.1 settings blobs won't have it; the expressions bridge
  // falls back to DEFAULT_REGISTERS. Keyed by Register from bridge/expressions.
  expressionRegisters?: {
    'kid-friendly': boolean
    casual: boolean
    edgy: boolean
  }

  // Legacy-extensible
  [key: string]: unknown
}

export interface VocabularyCategory {
  id: string
  name: string            // Hebrew display name
  wordCount: number
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
