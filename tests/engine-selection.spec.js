// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b0 — characterization specs for the legacy GameManager's spaced-
 * repetition question selection (smartQuestionSelection + improvedShuffle).
 *
 * GameManager isn't cleanly importable (it attaches to window and side-effects in
 * its constructor), so — like tests/difficulty-gate.spec.js — these drive the REAL
 * booted `window.gameManager`. To isolate selection from ProgressManager's due/
 * mastery rules (separately pinned in learning-lifecycle.spec.js), we swap in a
 * deterministic `progressManager` stub: selection's BUCKETING is the unit here.
 *
 * Selection is randomized (weighted pick + 5-pass shuffle), so we pin the RNG-
 * INDEPENDENT structural invariants that hold for every outcome — these are the
 * real cross-implementation contract the Slice 4.4.b rewrite must honor. Exact
 * shuffled order is deliberately NOT pinned (it wouldn't survive a reimplementation
 * that consumes randomness differently); b1's parity spec compares invariants +
 * statistical distribution instead.
 */

const TEST_USER_ID = 'selsmoke';
const V2_PREFIX = 'v2_';

async function boot(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'S', displayName: 'S', initial: 'S', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: 'S', displayName: 'S', initial: 'S', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4 }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForFunction(() => !!window.gameManager, null, { timeout: 5000 });
}

/**
 * Run smartQuestionSelection against a deterministic mastery/due stub.
 * @param opts.poolSize, opts.dueKeys, opts.recentKeys, opts.masteryMap, opts.iterations
 */
async function selectInvariants(page, opts) {
  return page.evaluate((o) => {
    const gm = window.gameManager;
    gm.currentGame = 'vocabulary';

    // Synthetic pool: w0..w{n-1} in 'animals'.
    const pool = [];
    for (let i = 0; i < o.poolSize; i++) pool.push({ word: `w${i}`, category: 'animals', translation: `t${i}` });
    const keyOf = (q) => `${q.word}_${q.category}`;

    // Deterministic stub — isolates bucketing from ProgressManager internals.
    const dueSet = new Set(o.dueKeys || []);
    const masteryMap = o.masteryMap || {};
    gm.progressManager = {
      getWordStats: (w, c) => ({ masteryLevel: masteryMap[`${w}_${c}`] ?? 0 }),
      isWordDue: (w, c) => dueSet.has(`${w}_${c}`),
    };

    // Session rotation input.
    window.app = window.app || {};
    window.app.userProgress = window.app.userProgress || {};
    window.app.userProgress.lastSessionWordKeys = { vocabulary: o.recentKeys || [] };

    const poolKeys = new Set(pool.map(keyOf));
    const results = [];
    for (let iter = 0; iter < (o.iterations || 20); iter++) {
      const selected = gm.smartQuestionSelection(pool.map((q) => ({ ...q })));
      const keys = selected.map(keyOf);
      results.push({
        length: selected.length,
        unique: new Set(keys).size === keys.length,
        subsetOfPool: keys.every((k) => poolKeys.has(k)),
        allDueSelected: (o.dueKeys || []).every((k) => keys.includes(k)),
        recentIntersection: keys.filter((k) => (o.recentKeys || []).includes(k)).length,
        allHaveMastery: selected.every((q) => typeof q.masteryLevel === 'number'),
      });
    }
    return results;
  }, opts);
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('selection: dedup, caps at 50, stays within the pool (80 new words)', async ({ page }) => {
  const results = await selectInvariants(page, { poolSize: 80, iterations: 25 });
  for (const r of results) {
    expect(r.length).toBe(50); // target = min(pool, 50)
    expect(r.unique).toBe(true);
    expect(r.subsetOfPool).toBe(true);
    expect(r.allHaveMastery).toBe(true);
  }
});

test('selection: Due words (Learned-but-stale) always make the cut', async ({ page }) => {
  const dueKeys = ['w0_animals', 'w1_animals', 'w2_animals', 'w3_animals', 'w4_animals'];
  const results = await selectInvariants(page, { poolSize: 60, dueKeys, iterations: 25 });
  for (const r of results) {
    expect(r.allDueSelected).toBe(true); // due bucket gets top priority
    expect(r.unique).toBe(true);
    expect(r.length).toBe(50);
  }
});

test('selection: session rotation excludes last-session words when fresh fill the target', async ({ page }) => {
  const recentKeys = Array.from({ length: 10 }, (_, i) => `w${i}_animals`);
  const results = await selectInvariants(page, { poolSize: 60, recentKeys, iterations: 25 });
  for (const r of results) {
    expect(r.recentIntersection).toBe(0); // 50 fresh words fill the slate; recent ones sit out
    expect(r.length).toBe(50);
    expect(r.unique).toBe(true);
  }
});

test('improvedShuffle is a pure permutation (same multiset, same length)', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const gm = window.gameManager;
    const input = Array.from({ length: 40 }, (_, i) => i);
    for (let iter = 0; iter < 25; iter++) {
      const out = gm.improvedShuffle(input);
      if (out.length !== input.length) return false;
      const a = [...out].sort((x, y) => x - y);
      const b = [...input].sort((x, y) => x - y);
      if (JSON.stringify(a) !== JSON.stringify(b)) return false;
    }
    return true;
  });
  expect(ok).toBe(true);
});
