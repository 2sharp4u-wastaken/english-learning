import { describe, it, expect } from 'vitest'
import { GameManager, type WordObj } from '../gameManager'

/**
 * Slice 4.6 — in-process port of the former `tests/engine-selection.spec.js`
 * Playwright characterization spec. The legacy GameManager wasn't importable
 * (it attached to `window` and side-effected in its constructor), so that spec
 * drove the booted `window.gameManager` in a browser. The Slice 4.4.b1 rewrite
 * (`src/engine/gameManager.ts`) is a clean, DI-based class whose constructor only
 * stores its options — so selection bucketing + the shuffle can be unit-tested
 * here, off the Vite dev server (deterministic, no long-run-flake exposure).
 *
 * Selection is randomized (weighted pick + 5-pass shuffle), so — exactly as the
 * Playwright spec did — we pin the RNG-INDEPENDENT structural invariants that hold
 * for every outcome, not a fixed order. `progressManager` is swapped for a
 * deterministic mastery/due stub so the unit under test is the BUCKETING.
 */

interface SelectOpts {
  poolSize: number
  dueKeys?: string[]
  recentKeys?: string[]
  masteryMap?: Record<string, number>
  iterations?: number
}

/** Build a GameManager wired to a synthetic pool + deterministic progress stub. */
function makeManager(o: SelectOpts) {
  // Fake app-state: the only field smartQuestionSelection reads is
  // userProgress.lastSessionWordKeys[gameType] (session rotation input).
  const app: any = {
    userProgress: { lastSessionWordKeys: { vocabulary: o.recentKeys || [] } },
  }

  const gm = new GameManager({
    getApp: () => app,
    vocabularyBank: () => [],
    gameDataProvider: () => ({}),
    getUserId: () => 'selsmoke',
  })
  gm.currentGame = 'vocabulary'

  const dueSet = new Set(o.dueKeys || [])
  const masteryMap = o.masteryMap || {}
  // Deterministic stub — isolates bucketing from ProgressManager internals.
  gm.progressManager = {
    getWordStats: (w: string, c: string) => ({ masteryLevel: masteryMap[`${w}_${c}`] ?? 0 }),
    isWordDue: (w: string, c: string) => dueSet.has(`${w}_${c}`),
  } as any

  return gm
}

function poolOf(n: number): WordObj[] {
  const pool: WordObj[] = []
  for (let i = 0; i < n; i++) pool.push({ word: `w${i}`, category: 'animals', translation: `t${i}` })
  return pool
}

const keyOf = (q: WordObj) => `${q.word}_${q.category}`

/** Run smartQuestionSelection `iterations` times, collecting per-run invariants. */
function selectInvariants(o: SelectOpts) {
  const gm = makeManager(o)
  const pool = poolOf(o.poolSize)
  const poolKeys = new Set(pool.map(keyOf))
  const results = []
  for (let iter = 0; iter < (o.iterations || 20); iter++) {
    // Pass fresh clones — selection mutates `masteryLevel` on the objects.
    const selected = gm.smartQuestionSelection(pool.map((q) => ({ ...q })))
    const keys = selected.map(keyOf)
    results.push({
      length: selected.length,
      unique: new Set(keys).size === keys.length,
      subsetOfPool: keys.every((k) => poolKeys.has(k)),
      allDueSelected: (o.dueKeys || []).every((k) => keys.includes(k)),
      recentIntersection: keys.filter((k) => (o.recentKeys || []).includes(k)).length,
      allHaveMastery: selected.every((q) => typeof q.masteryLevel === 'number'),
    })
  }
  return results
}

describe('GameManager.smartQuestionSelection', () => {
  it('dedups, caps at 50, stays within the pool (80 new words)', () => {
    for (const r of selectInvariants({ poolSize: 80, iterations: 25 })) {
      expect(r.length).toBe(50) // target = min(pool, 50)
      expect(r.unique).toBe(true)
      expect(r.subsetOfPool).toBe(true)
      expect(r.allHaveMastery).toBe(true)
    }
  })

  it('Due words (Learned-but-stale) always make the cut', () => {
    const dueKeys = ['w0_animals', 'w1_animals', 'w2_animals', 'w3_animals', 'w4_animals']
    for (const r of selectInvariants({ poolSize: 60, dueKeys, iterations: 25 })) {
      expect(r.allDueSelected).toBe(true) // due bucket gets top priority
      expect(r.unique).toBe(true)
      expect(r.length).toBe(50)
    }
  })

  it('session rotation excludes last-session words when fresh fill the target', () => {
    const recentKeys = Array.from({ length: 10 }, (_, i) => `w${i}_animals`)
    for (const r of selectInvariants({ poolSize: 60, recentKeys, iterations: 25 })) {
      expect(r.recentIntersection).toBe(0) // 50 fresh words fill the slate; recent ones sit out
      expect(r.length).toBe(50)
      expect(r.unique).toBe(true)
    }
  })
})

describe('GameManager.improvedShuffle', () => {
  it('is a pure permutation (same multiset, same length)', () => {
    const gm = makeManager({ poolSize: 0 })
    const input = Array.from({ length: 40 }, (_, i) => i)
    for (let iter = 0; iter < 25; iter++) {
      // Mirrors the original spec: numbers carry no .category/.difficulty, so the
      // adjacency-reorder passes are no-ops and only the Fisher–Yates runs.
      const out = gm.improvedShuffle(input as unknown as WordObj[]) as unknown as number[]
      expect(out.length).toBe(input.length)
      const a = [...out].sort((x, y) => x - y)
      const b = [...input].sort((x, y) => x - y)
      expect(a).toEqual(b)
    }
  })
})
