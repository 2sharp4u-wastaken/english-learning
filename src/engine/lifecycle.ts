/**
 * src/engine/lifecycle.ts — the SINGLE source of truth for the V3 word lifecycle
 * (New / Learning / Learned) and its aggregate counts, computed from a PLAIN
 * progress snapshot (no class instance, no `getApp()`).
 *
 * WHY this is a standalone pure module (PROG1, 2026-06-14):
 *   - `ProgressManager` derives status from its own instance state — i.e. the
 *     CURRENT logged-in user. That's correct for Home/Profile (which only ever show
 *     the current user) and for the game-unlock gates.
 *   - The **Stats** page renders ANY selected user from a plain
 *     `loadUserProgress(userId)` object, so it CANNOT use the current-user PM. It
 *     must compute the same counts from the snapshot directly.
 * Both paths now funnel through the rule defined here, so "introduced" and "learned"
 * can never drift apart again (the bug that showed Home=31 / Stats=0).
 *
 * Definitions are byte-faithful to the legacy `ProgressManager.getWordStatus` /
 * `_eachVocabWord`; see docs/learning-path.md → "Word Lifecycle Model".
 */

export interface LifecycleThresholds {
  /** masteryLevel bar for "learned" (legacy `thresholds.mastered`, 0.8). */
  mastered: number
  /** minimum attempts before a word can be "learned" (legacy `minAttempts`, 3). */
  minAttempts: number
  /** consecutive-correct bar for "learned" (legacy `consecutiveForMastery`, 2). */
  consecutiveForMastery: number
}

export const DEFAULT_LIFECYCLE_THRESHOLDS: LifecycleThresholds = {
  mastered: 0.8,
  minAttempts: 3,
  consecutiveForMastery: 2,
}

export type WordStatus = 'new' | 'learning' | 'learned'

/**
 * The subset of a `wordMastery` entry the lifecycle rule reads. Intentionally has
 * NO index signature so both the engine `WordStats` and the bridge `WordStats`
 * (neither of which is required to declare one) are structurally assignable to it.
 */
export interface LifecycleWordStats {
  word?: string
  category?: string
  totalAttempts?: number
  masteryLevel?: number
  consecutiveCorrect?: number
  reachedLearned?: boolean
}

export interface LifecycleInput {
  wordMastery?: Record<string, LifecycleWordStats> | null
  /** Grandfathered (pre-V3) graduations — keys are `word_category`. */
  learnedWords?: Record<string, unknown> | null
}

export interface LifecycleResult {
  /** Words with status !== 'new' (Learning ∪ Learned) — "words learned" in the UI. */
  introducedCount: number
  /** Words with status === 'learned' — "words mastered" / שליטה in the UI. */
  learnedCount: number
  introducedKeys: Set<string>
  learnedKeys: Set<string>
  byStatus: { new: number; learning: number; learned: number }
}

const ABC_CATEGORY = 'abc'

/** Canonical de-dupe key, matching legacy `ProgressManager._key`. */
function makeKey(word: string, category: string): string {
  return `${word.toLowerCase()}_${category}`
}

/** Split a `word_category` key into its category (suffix after the last `_`). */
function categoryFromKey(key: string): string {
  const idx = key.lastIndexOf('_')
  return idx > 0 ? key.slice(idx + 1) : ''
}

/**
 * Whether a word is "learned" purely from its mastery stats (the derived path —
 * before grandfathering or the sticky flag). Mirrors `ProgressManager._isDerivedLearned`.
 */
export function isDerivedLearned(
  stats: LifecycleWordStats | null | undefined,
  t: LifecycleThresholds = DEFAULT_LIFECYCLE_THRESHOLDS,
): boolean {
  if (!stats) return false
  return (
    (stats.totalAttempts || 0) >= t.minAttempts &&
    (stats.masteryLevel || 0) >= t.mastered &&
    (stats.consecutiveCorrect || 0) >= t.consecutiveForMastery
  )
}

/**
 * Status for one word from its mastery stats + whether it's grandfathered (present
 * in the legacy `learnedWords` stamp). Mirrors `ProgressManager.getWordStatus`:
 *   - never introduced  → 'new'
 *   - grandfathered OR derived-learned OR sticky `reachedLearned` → 'learned'
 *   - otherwise → 'learning'  (introduced is forever — a word never returns to 'new')
 */
export function deriveWordStatus(
  stats: LifecycleWordStats | null | undefined,
  grandfathered: boolean,
  t: LifecycleThresholds = DEFAULT_LIFECYCLE_THRESHOLDS,
): WordStatus {
  const introduced = grandfathered || (!!stats && (stats.totalAttempts || 0) > 0)
  if (!introduced) return 'new'
  const sticky = !!stats && stats.reachedLearned === true
  if (grandfathered || isDerivedLearned(stats, t) || sticky) return 'learned'
  return 'learning'
}

/**
 * Compute introduced/learned counts + key sets from a plain progress snapshot.
 * Unions `wordMastery` entries with grandfathered `learnedWords` keys and excludes
 * ABC letter entries — exactly mirroring `ProgressManager._eachVocabWord` +
 * `getLifecycleCounts`, so the Stats page agrees with Home/Profile to the word.
 */
export function deriveLifecycle(
  input: LifecycleInput,
  t: LifecycleThresholds = DEFAULT_LIFECYCLE_THRESHOLDS,
): LifecycleResult {
  const wordMastery = input.wordMastery || {}
  const learnedWords = input.learnedWords || {}

  // The word universe, keyed canonically so a mastery entry and its grandfathered
  // stamp collapse to one word (legacy `_eachVocabWord` de-dupes via `_key`).
  const statsByKey = new Map<string, LifecycleWordStats>()
  const grandfathered = new Set<string>()

  for (const [rawKey, stats] of Object.entries(wordMastery)) {
    if (!stats || typeof stats !== 'object') continue
    const word = (stats.word as string) || rawKey.slice(0, rawKey.lastIndexOf('_'))
    if (!word) continue
    const category = (stats.category as string) || categoryFromKey(rawKey)
    if (category === ABC_CATEGORY) continue
    statsByKey.set(makeKey(word, category), stats)
  }

  for (const rawKey of Object.keys(learnedWords)) {
    const idx = rawKey.lastIndexOf('_')
    if (idx <= 0) continue
    const word = rawKey.slice(0, idx)
    const category = rawKey.slice(idx + 1)
    if (!word || category === ABC_CATEGORY) continue
    grandfathered.add(makeKey(word, category))
  }

  const result: LifecycleResult = {
    introducedCount: 0,
    learnedCount: 0,
    introducedKeys: new Set(),
    learnedKeys: new Set(),
    byStatus: { new: 0, learning: 0, learned: 0 },
  }

  const allKeys = new Set<string>([...statsByKey.keys(), ...grandfathered])
  for (const key of allKeys) {
    const status = deriveWordStatus(statsByKey.get(key) ?? null, grandfathered.has(key), t)
    result.byStatus[status]++
    if (status !== 'new') {
      result.introducedCount++
      result.introducedKeys.add(key)
    }
    if (status === 'learned') {
      result.learnedCount++
      result.learnedKeys.add(key)
    }
  }
  return result
}
