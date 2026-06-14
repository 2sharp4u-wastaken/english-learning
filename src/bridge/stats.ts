import type { UserProgress } from './types'
import { getApp } from '../engine/instances'
import { v2Key } from './storage'
import { getAllExpressions, type ExpressionType } from './expressions'
import { deriveLifecycle } from '../engine/lifecycle'

// ─── Constants ──────────────────────────────────────────────────────────────

const MEMORY_MAX_STARS = 4

const WORD_JOURNEY_STAGES = [
  { id: 'discover', label: 'גילוי', icon: '👀' },
  { id: 'listen-match', label: 'הקשבה', icon: '👂' },
  { id: 'spell-tiles', label: 'כתיבה', icon: '✏️' },
  { id: 'say-word', label: 'דיבור', icon: '🎤' },
  { id: 'recall', label: 'זיכרון', icon: '🧠' },
] as const

export { WORD_JOURNEY_STAGES }

const CATEGORY_META: Record<string, { name: string; icon: string }> = {
  animals: { name: 'חיות', icon: '🐾' },
  colors: { name: 'צבעים', icon: '🎨' },
  numbers: { name: 'מספרים', icon: '🔢' },
  food: { name: 'אוכל ושתייה', icon: '🍎' },
  body: { name: 'חלקי גוף', icon: '👁️' },
  family: { name: 'משפחה', icon: '👨‍👩‍👧' },
  clothes: { name: 'בגדים', icon: '👕' },
  home: { name: 'בית וחפצים', icon: '🏠' },
  actions: { name: 'פעולות', icon: '🏃' },
  nature: { name: 'טבע', icon: '🌿' },
  school: { name: 'בית ספר', icon: '📚' },
  minecraft: { name: 'Minecraft', icon: '⛏️' },
  gaming: { name: 'משחקים', icon: '🎮' },
  roblox: { name: 'Roblox', icon: '🟥' },
  feelings: { name: 'רגשות', icon: '😊' },
  adjectives: { name: 'תארים', icon: '✨' },
  places: { name: 'מקומות', icon: '📍' },
  time: { name: 'זמן', icon: '⏰' },
  weather: { name: 'מזג אוויר', icon: '☀️' },
  sports: { name: 'ספורט', icon: '⚽' },
  transportation: { name: 'תחבורה', icon: '🚌' },
  tools: { name: 'כלים וציוד', icon: '🧰' },
  signs: { name: 'שלטים וסמלים', icon: '🚸' },
  music: { name: 'מוזיקה', icon: '🎵' },
  custom: { name: 'מותאם אישית', icon: '⭐' },
}

export const GAME_NAMES: Record<string, { name: string; icon: string }> = {
  'word-journey': { name: 'מסע המילים', icon: '🗺️' },
  vocabulary: { name: 'מבחן מילים', icon: '📚' },
  grammar: { name: 'תרגול דקדוק', icon: '✍️' },
  'grammar-beginner': { name: 'דקדוק מתחילים', icon: '📝' },
  pronunciation: { name: 'הגייה', icon: '🎤' },
  listening: { name: 'הקשבה', icon: '🎧' },
  reading: { name: 'איות', icon: '🔤' },
  abc: { name: 'ABC אותיות', icon: '🔠' },
  memory: { name: 'משחק זיכרון', icon: '🧠' },
  'picture-match': { name: 'מילה לתמונה', icon: '🖼️' },
  scramble: { name: 'סידור משפטים', icon: '🔀' },
  'fill-blanks': { name: 'השלם את המשפט', icon: '✏️' },
  'true-or-not': { name: 'נכון או לא?', icon: '✅' },
  'story-time': { name: 'זמן סיפור', icon: '📖' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GameStatsRow {
  gameType: string
  name: string
  icon: string
  gamesPlayed: number
  averageScore: number
  bestScore: number
}

export interface WordMasteryInfo {
  word: string
  mastery: number
  attempts: number
  accuracy: number
  category: string
  categoryLabel: string
  /** V3: a Learned word past its spacing interval — surfaced for review. */
  isDue?: boolean
}

export interface MasteryStats {
  total: number
  struggling: WordMasteryInfo[]
  learning: WordMasteryInfo[]
  mastered: WordMasteryInfo[]
}

export interface JourneyRow {
  key: string
  word: string
  translation: string
  category: string
  categoryLabel: string
  categoryIcon: string
  completedStages: string[]
  startedDate: string | null
  lastUpdated: string | null
  graduatedDate: string | null
  journeyScore: number | null
  journeyCompletions: number
  reinforcedCount: number
  isLearned: boolean
  isCurrentJourney: boolean
  currentStageId: string | null
}

export interface CategoryRow {
  id: string
  name: string
  icon: string
  total: number
  learned: number
  practiced: number
  pct: number
}

export interface MemoryRecord {
  level: string
  score: number
  timeSeconds: number | null
  moves: number | null
  stars: number
  date: string | null
}

export interface UserStatsModel {
  userId: string
  displayName: string
  avatarLetter: string
  progress: UserProgress
  totalGamesPlayed: number
  overallAverage: number
  gameRows: GameStatsRow[]
  masteryStats: MasteryStats
  memoryRecords: MemoryRecord[]
  hasMemory: boolean
  journeyRows: JourneyRow[]
  /**
   * "Words learned" = INTRODUCED count (status !== new — Learning ∪ Learned), per
   * the design (`learning-path.md` L111). Derived from `wordMastery` via the shared
   * pure lifecycle rule — NOT the legacy `learnedWords` stamp (PROG1: that stamp is
   * written only by full Word-Journey graduation, so it read ~0 while Home showed 31).
   */
  learnedCount: number
  /** "Words mastered" = derived-Learned count (the rigorous gate metric / שליטה). */
  masteredCount: number
  inProgressCount: number
  categoryRows: CategoryRow[]
  categoriesStartedCount: number
  categoriesCompletedCount: number
  learningVelocity: number
  totalLearningTimeMs: number
  expressions: ExpressionStatsSummary
}

/** Phase 5 (Slice 5.5) — expression mastery surfaced in Stats/Profile. */
export interface ExpressionStatsSummary {
  /** Phrases the child has mastered (≥3 correct). */
  mastered: number
  /** Phrases attempted at least once. */
  practiced: number
  /** Total phrases in the catalog (unfiltered). */
  total: number
  byType: Array<{
    type: ExpressionType
    label: string
    icon: string
    mastered: number
    practiced: number
    total: number
  }>
}

const EXPRESSION_TYPE_META: { type: ExpressionType; label: string; icon: string }[] = [
  { type: 'idiom', label: 'ניבים', icon: '💡' },
  { type: 'phrasal-verb', label: 'פעלים מורכבים', icon: '🔗' },
  { type: 'slang', label: 'סלנג', icon: '😎' },
]

/**
 * Join the per-phrase expressionMastery map with the (global) expression catalog
 * to produce mastered/practiced counts overall and per type. The catalog is the
 * same for every user, so reading it here is safe even when modeling another user.
 */
function buildExpressionStats(progress: UserProgress): ExpressionStatsSummary {
  const mastery = progress.expressionMastery || {}
  const catalog = getAllExpressions()
  const typeByPhrase = new Map(catalog.map((e) => [e.phrase.trim().toLowerCase(), e.type]))

  const acc: Record<string, { mastered: number; practiced: number; total: number }> = {}
  for (const t of EXPRESSION_TYPE_META) acc[t.type] = { mastered: 0, practiced: 0, total: 0 }
  for (const e of catalog) if (acc[e.type]) acc[e.type].total++

  let mastered = 0
  let practiced = 0
  for (const s of Object.values(mastery)) {
    if (!s) continue
    const wasSeen = (s.seen || 0) > 0
    if (wasSeen) practiced++
    if (s.mastered) mastered++
    const t = typeByPhrase.get((s.phrase || '').trim().toLowerCase())
    if (t && acc[t]) {
      if (wasSeen) acc[t].practiced++
      if (s.mastered) acc[t].mastered++
    }
  }

  return {
    mastered,
    practiced,
    total: catalog.length,
    byType: EXPRESSION_TYPE_META.map((t) => ({ ...t, ...acc[t.type] })),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function buildWordKey(word: string, category: string): string {
  return `${String(word || '').toLowerCase()}_${category || ''}`
}

function getCategoryMeta(category: string): { name: string; icon: string } {
  return CATEGORY_META[category] || { name: category || 'ללא קטגוריה', icon: '📘' }
}

function getDefaultProgress(): UserProgress {
  return {
    version: 4,
    hasPlayedBefore: false,
    totalGamesPlayed: 0,
    bestScores: {},
    streakDays: 0,
    lastPlayDate: null,
    totalCorrectAnswers: 0,
    wordMastery: {},
    lastSessionWordKeys: {},
    courses: {},
    topicProgress: {},
    certificates: [],
    totalPoints: 0,
    totalLearningTimeMs: 0,
    coins: 0,
    totalCoinsEarned: 0,
    coinHistory: [],
    lastLoginDate: null,
    studentName: null,
    learnedWords: {},
    wordJourneyProgress: {},
    gameUnlocks: {},
    activityDates: [],
  }
}

function loadUserProgress(userId: string): UserProgress {
  const v2 = safeParse<UserProgress | null>(
    localStorage.getItem(`${v2Key(`userProgress_${userId}`)}`),
    null,
  )
  if (v2) return { ...getDefaultProgress(), ...v2 }

  const legacy = safeParse<UserProgress | null>(
    localStorage.getItem(`userProgress_${userId}`),
    null,
  )
  if (legacy) return { ...getDefaultProgress(), ...legacy }

  return getDefaultProgress()
}

function getGameHistory(userId: string, gameType: string): number[] {
  const raw = localStorage.getItem(`${userId}_${gameType}_history`)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// ─── Vocabulary index ───────────────────────────────────────────────────────

interface VocabWord {
  word: string
  translation: string
  category: string
  image?: string
}

interface VocabIndex {
  bank: VocabWord[]
  byKey: Record<string, VocabWord>
  categoryTotals: Record<string, number>
}

function getVocabularyIndex(): VocabIndex {
  const bank: VocabWord[] = Array.isArray((window as any).vocabularyBank)
    ? (window as any).vocabularyBank
    : []
  const byKey: Record<string, VocabWord> = {}
  const categoryTotals: Record<string, number> = {}

  for (const w of bank) {
    const key = buildWordKey(w.word, w.category)
    if (!byKey[key]) byKey[key] = w
    categoryTotals[w.category] = (categoryTotals[w.category] || 0) + 1
  }

  return { bank, byKey, categoryTotals }
}

function getWordDisplayInfo(wordKey: string, vocabIndex: VocabIndex) {
  const raw = vocabIndex.byKey[wordKey]
  const parts = wordKey.split('_')
  const fallbackWord = parts[0] || ''
  const fallbackCategory = parts.slice(1).join('_') || raw?.category || 'custom'
  const meta = getCategoryMeta(raw?.category || fallbackCategory)

  return {
    word: raw?.word || fallbackWord,
    translation: raw?.translation || '',
    category: raw?.category || fallbackCategory,
    categoryLabel: meta.name,
    categoryIcon: meta.icon,
  }
}

// ─── Word mastery stats ─────────────────────────────────────────────────────

function getWordMasteryStats(progress: UserProgress, isCurrentUser = true): MasteryStats {
  const wm = progress.wordMastery || {}
  const stats: MasteryStats = { total: 0, struggling: [], learning: [], mastered: [] }
  const pm = isCurrentUser ? getApp()?.progressManager : null

  for (const [wordKey, data] of Object.entries(wm)) {
    if (!data || typeof data !== 'object') continue
    stats.total++

    const mastery = data.masteryLevel || 0
    const totalAttempts = data.totalAttempts || 0
    const correctAttempts = data.correctAttempts || 0
    const meta = getCategoryMeta(data.category)
    const word = data.word || wordKey.split('_')[0]
    const category = data.category || 'custom'
    const info: WordMasteryInfo = {
      word,
      mastery,
      attempts: totalAttempts,
      accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
      category,
      categoryLabel: meta.name,
      isDue: pm?.isWordDue ? pm.isWordDue(word, category) : false,
    }

    if (mastery < 0.5) stats.struggling.push(info)
    else if (mastery < 0.8) stats.learning.push(info)
    else stats.mastered.push(info)
  }

  stats.struggling.sort((a, b) => a.mastery - b.mastery)
  stats.learning.sort((a, b) => a.mastery - b.mastery)
  stats.mastered.sort((a, b) => b.mastery - a.mastery)
  return stats
}

// ─── Memory records ─────────────────────────────────────────────────────────

function loadMemoryRecords(userId: string): MemoryRecord[] {
  const raw = localStorage.getItem(`memoryBest_${userId}`)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

    return Object.entries(parsed)
      .filter(([, r]: [string, any]) => r && typeof r === 'object' && !Array.isArray(r))
      .map(([levelKey, r]: [string, any]) => {
        const numStars = Number(r.stars)
        const stars = Number.isFinite(numStars)
          ? Math.max(0, Math.min(MEMORY_MAX_STARS, Math.floor(numStars)))
          : 0
        return {
          level: levelKey,
          score: r.score ?? 0,
          timeSeconds: r.timeSeconds ?? null,
          moves: r.moves ?? null,
          stars,
          date: r.date ?? null,
        }
      })
      .sort((a, b) => Number(a.level) - Number(b.level))
  } catch {
    return []
  }
}

// ─── Journey status ─────────────────────────────────────────────────────────

function normalizeStageIds(stageIds: string[]): string[] {
  const stageSet = new Set(stageIds)
  return WORD_JOURNEY_STAGES.map((s) => s.id).filter((id) => stageSet.has(id))
}

interface SavedJourney {
  timestamp: number
  currentQuestionIndex?: number
  shuffledQuestions?: Array<{ stageId?: string; words?: VocabWord[] }>
}

function loadWordJourneySave(userId: string): SavedJourney | null {
  const raw = localStorage.getItem(`savedGame_${userId}_word-journey`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedJourney
    const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60)
    return ageHours <= 24 ? parsed : null
  } catch {
    return null
  }
}

function buildJourneyRows(userId: string, progress: UserProgress): JourneyRow[] {
  const vocabIndex = getVocabularyIndex()
  const learnedWords = progress.learnedWords || {}
  const journeyProgress = progress.wordJourneyProgress || {} as Record<string, any>
  const rowsMap = new Map<string, JourneyRow>()
  const allStageIds = WORD_JOURNEY_STAGES.map((s) => s.id) as string[]

  const upsert = (key: string, patch: Partial<JourneyRow> = {}) => {
    const display = getWordDisplayInfo(key, vocabIndex)
    const existing = rowsMap.get(key) || {
      key,
      ...display,
      completedStages: [] as string[],
      startedDate: null,
      lastUpdated: null,
      graduatedDate: null,
      journeyScore: null,
      journeyCompletions: 0,
      reinforcedCount: 0,
      isLearned: false,
      isCurrentJourney: false,
      currentStageId: null,
    }

    const mergedStages = normalizeStageIds([
      ...existing.completedStages,
      ...(patch.completedStages || []),
    ])

    rowsMap.set(key, { ...existing, ...patch, ...display, completedStages: mergedStages })
  }

  for (const [key, entry] of Object.entries(journeyProgress)) {
    const e = entry as any
    const learned = learnedWords[key]
    upsert(key, {
      completedStages: e.completedStages || [],
      startedDate: e.startedDate || learned?.graduatedDate || null,
      lastUpdated: e.lastUpdated || e.completedDate || learned?.lastPracticed || null,
      graduatedDate: learned?.graduatedDate || e.completedDate || null,
      journeyScore: learned?.journeyScore ?? null,
      journeyCompletions: learned?.journeyCompletions || 0,
      reinforcedCount: (learned?.reinforcedIn || []).length,
      isLearned: Boolean(learned),
    })
  }

  for (const [key, entry] of Object.entries(learnedWords)) {
    upsert(key, {
      completedStages: allStageIds,
      startedDate: entry.graduatedDate || null,
      lastUpdated: entry.lastPracticed || entry.graduatedDate || null,
      graduatedDate: entry.graduatedDate || null,
      journeyScore: entry.journeyScore ?? null,
      journeyCompletions: entry.journeyCompletions || 0,
      reinforcedCount: (entry.reinforcedIn || []).length,
      isLearned: true,
    })
  }

  // Merge saved journey state
  const saved = loadWordJourneySave(userId)
  if (saved) {
    const stages = Array.isArray(saved.shuffledQuestions) ? saved.shuffledQuestions : []
    const idx = Math.max(0, Math.min(saved.currentQuestionIndex || 0, stages.length))
    const completedFromSave = stages.slice(0, idx).map((s) => s.stageId).filter(Boolean) as string[]
    const currentStageId = stages[idx]?.stageId || null
    const currentWords = stages.find((s) => Array.isArray(s.words))?.words || []

    for (const w of currentWords) {
      const key = buildWordKey(w.word, w.category)
      upsert(key, {
        completedStages: completedFromSave,
        isCurrentJourney: true,
        currentStageId,
        startedDate: rowsMap.get(key)?.startedDate || new Date(saved.timestamp).toISOString().slice(0, 10),
        lastUpdated: rowsMap.get(key)?.lastUpdated || new Date(saved.timestamp).toISOString().slice(0, 10),
      })
    }
  }

  const rows = Array.from(rowsMap.values())
  const rank = (r: JourneyRow) => {
    if (r.isCurrentJourney && !r.isLearned) return 0
    if (!r.isLearned && r.completedStages.length > 0) return 1
    if (r.isLearned) return 2
    return 3
  }

  rows.sort((a, b) => {
    const rd = rank(a) - rank(b)
    if (rd !== 0) return rd
    const aDate = a.graduatedDate || a.lastUpdated || a.startedDate || ''
    const bDate = b.graduatedDate || b.lastUpdated || b.startedDate || ''
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return a.word.localeCompare(b.word)
  })

  return rows
}

// ─── Category completion ────────────────────────────────────────────────────

function buildCategoryCompletion(progress: UserProgress): {
  rows: CategoryRow[]
  startedCount: number
  completedCount: number
} {
  const vocabIndex = getVocabularyIndex()
  const learnedWords = progress.learnedWords || {}
  const wordMastery = progress.wordMastery || {}
  const learnedByCategory: Record<string, number> = {}
  const practicedByCategory: Record<string, number> = {}

  for (const key of Object.keys(learnedWords)) {
    const cat = getWordDisplayInfo(key, vocabIndex).category
    learnedByCategory[cat] = (learnedByCategory[cat] || 0) + 1
  }

  for (const entry of Object.values(wordMastery)) {
    const cat = entry?.category
    if (!cat) continue
    practicedByCategory[cat] = (practicedByCategory[cat] || 0) + 1
  }

  const categoryIds = new Set([
    ...Object.keys(vocabIndex.categoryTotals),
    ...Object.keys(learnedByCategory),
    ...Object.keys(practicedByCategory),
  ])

  const rows: CategoryRow[] = Array.from(categoryIds)
    .map((id) => {
      const meta = getCategoryMeta(id)
      const total = vocabIndex.categoryTotals[id] || 0
      const learned = learnedByCategory[id] || 0
      const practiced = practicedByCategory[id] || 0
      const pct = total > 0 ? Math.round((learned / total) * 100) : 0
      return { id, name: meta.name, icon: meta.icon, total, learned, practiced, pct }
    })
    .sort((a, b) => {
      if (b.learned !== a.learned) return b.learned - a.learned
      if (b.pct !== a.pct) return b.pct - a.pct
      return a.name.localeCompare(b.name)
    })

  return {
    rows,
    startedCount: rows.filter((r) => r.learned > 0 || r.practiced > 0).length,
    completedCount: rows.filter((r) => r.total > 0 && r.learned >= r.total).length,
  }
}

// ─── Learning velocity ──────────────────────────────────────────────────────

function getLearningVelocity(progress: UserProgress): number {
  // PROG1: new words MET in the last 7 days (status crosses into the lifecycle),
  // derived from each word's `firstSeen` stamp — NOT Word-Journey graduations (the
  // old `learnedWords.graduatedDate` read ~0 for kids who don't grind Word Journey).
  // Forward-only: entries predating the `firstSeen` field don't count until
  // re-practiced (intentional — we won't fabricate a met-date we don't have).
  const wm = progress.wordMastery || {}
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let count = 0
  for (const s of Object.values(wm)) {
    if (!s || s.category === 'abc') continue
    const firstSeen = (s as { firstSeen?: string | null }).firstSeen
    if (firstSeen && Date.parse(firstSeen) >= weekAgo) count++
  }
  return count
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the full stats model for a given user.
 */
export function buildUserStatsModel(userId: string, displayName: string): UserStatsModel {
  const progress = loadUserProgress(userId)

  // Game rows
  const gameTypes = Object.keys(GAME_NAMES)
  let totalGamesPlayed = 0
  const gameRows: GameStatsRow[] = []
  const playedTypes: string[] = []

  for (const gt of gameTypes) {
    const history = getGameHistory(userId, gt)
    const played = history.length
    totalGamesPlayed += played
    if (played === 0) continue

    playedTypes.push(gt)
    const avg = Math.round(history.reduce((s, v) => s + v, 0) / played)
    const best = Math.max(...history)
    gameRows.push({
      gameType: gt,
      name: GAME_NAMES[gt].name,
      icon: GAME_NAMES[gt].icon,
      gamesPlayed: played,
      averageScore: Math.min(100, avg),
      bestScore: Math.min(100, best),
    })
  }

  totalGamesPlayed = Math.max(progress.totalGamesPlayed || 0, totalGamesPlayed)

  const overallAverage =
    playedTypes.length > 0
      ? Math.round(
          playedTypes.reduce((sum, gt) => {
            const h = getGameHistory(userId, gt)
            return sum + (h.length > 0 ? Math.round(h.reduce((s, v) => s + v, 0) / h.length) : 0)
          }, 0) / playedTypes.length,
        )
      : 0

  // PROG1: derive both UI metrics from the shared pure lifecycle rule over THIS
  // user's snapshot (not the current-user PM — Stats renders any selected user).
  // "words learned" = introduced; "words mastered" = derived Learned.
  const lifecycle = deriveLifecycle(progress)
  const learnedCount = lifecycle.introducedCount
  const masteredCount = lifecycle.learnedCount

  // The mastery bar's isWordDue() reads the *current-user* PM, so only trust it when
  // the selected user IS the current user; otherwise it would show a different
  // user's due flags. (A snapshot-based due calc is a later refinement.)
  const isCurrentUser = userId === (localStorage.getItem('currentUser') || '')
  const masteryStats = getWordMasteryStats(progress, isCurrentUser)
  const memoryRecords = loadMemoryRecords(userId)
  const journeyRows = buildJourneyRows(userId, progress)
  const categoryCompletion = buildCategoryCompletion(progress)
  const learningVelocity = getLearningVelocity(progress)
  const inProgressCount = journeyRows.filter((r) => !r.isLearned).length

  return {
    userId,
    displayName,
    avatarLetter: displayName.charAt(0).toUpperCase(),
    progress,
    totalGamesPlayed,
    overallAverage,
    gameRows,
    masteryStats,
    memoryRecords,
    hasMemory: memoryRecords.length > 0,
    journeyRows,
    learnedCount,
    masteredCount,
    inProgressCount,
    categoryRows: categoryCompletion.rows,
    categoriesStartedCount: categoryCompletion.startedCount,
    categoriesCompletedCount: categoryCompletion.completedCount,
    learningVelocity,
    totalLearningTimeMs: progress.totalLearningTimeMs || 0,
    expressions: buildExpressionStats(progress),
  }
}

/**
 * Format milliseconds to compact Hebrew duration string.
 */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0 דק׳'
  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${totalMinutes} דק׳`
  if (minutes === 0) return `${hours} ש׳`
  return `${hours}ש ${minutes}ד`
}

/**
 * Format ISO date string to DD.MM.YYYY.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

/**
 * Get the journey status text and badge class for a journey row.
 */
export function getJourneyStatus(row: JourneyRow): { text: string; variant: 'learned' | 'active' | 'partial' | 'none' } {
  if (row.isLearned) {
    const scoreText = row.journeyScore != null ? ` | ${row.journeyScore}%` : ''
    return { text: `נלמדה${scoreText}`, variant: 'learned' }
  }
  if (row.isCurrentJourney) {
    return { text: `במסע עכשיו | ${row.completedStages.length}/${WORD_JOURNEY_STAGES.length}`, variant: 'active' }
  }
  if (row.completedStages.length > 0) {
    return { text: `${row.completedStages.length}/${WORD_JOURNEY_STAGES.length} שלבים`, variant: 'partial' }
  }
  return { text: 'עוד לא התחיל', variant: 'none' }
}

/**
 * Coin reason labels in Hebrew.
 */
export const COIN_REASON_LABELS: Record<string, string> = {
  'daily login': 'כניסה יומית',
  'correct answer': 'תשובה נכונה',
  'perfect answer': 'תשובה מושלמת',
  'activity complete': 'סיום פעילות',
  'topic complete': 'סיום נושא',
  'perfect game': 'משחק מושלם',
}
