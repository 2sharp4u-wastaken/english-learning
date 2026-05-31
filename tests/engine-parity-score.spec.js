// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the ScoreManager rewrite.
 *
 * Runs the identical operations through the legacy `managers/ScoreManager.js`
 * and the new `src/engine/score.ts` (both imported in-browser via Vite) and
 * asserts deep-equal outputs. The legacy module stays in-tree purely as this
 * oracle until every engine module's parity is green; only then is it deleted.
 */

const LEGACY = '/managers/ScoreManager.js';
const NEXT = '/src/engine/score.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('ScoreManager parity: legacy vs src/engine produce identical outputs', async ({ page }) => {
  const diff = await page.evaluate(async ({ legacyPath, nextPath }) => {
    const legacy = await import(legacyPath);
    const next = await import(nextPath);
    const L = new legacy.ScoreManager();
    const N = new next.ScoreManager();

    const out = (s) => {
      // Exercise every pure surface across a representative input grid.
      const coinActions = ['correctFirstTry', 'correctRetry', 'completeActivity', 'dailyLogin', 'completeTopic', 'unknownAction'];
      const coinCtx = [{}, { isPerfect: true }, { streakDays: 6 }, { streakDays: 7 }, { streakDays: 14 }, { streakDays: 30 }];
      const coins = [];
      for (const a of coinActions) for (const c of coinCtx) coins.push([a, JSON.stringify(c), s.calculateCoins(a, c)]);

      const pct = [[3, 4], [0, 0], [1, 3], [2, 3], [10, 10], [7, 9]].map(([c, t]) => s.calculatePercentage(c, t));
      const ratings = [100, 95, 90, 89, 80, 79, 70, 69, 60, 59, 0].map((p) => s.getPerformanceRating(p));
      const games = ['vocabulary', 'grammar', 'pronunciation', 'scramble', 'abc', 'fill-blanks', 'mystery', 'word-journey'];
      const xp = [];
      for (const g of games) for (const [c, t] of [[3, 4], [4, 4], [3, 5], [5, 5], [0, 4]]) xp.push([g, c, t, s.calculateXP(c, t, g), s.getGameXPMultiplier(g)]);

      // Stateful score map.
      s.initialize();
      s.addPoints('vocabulary', 10);
      s.addPoints('vocabulary', 5);
      s.addPoints('memory', 30);
      s.resetScore('memory');
      const scores = s.getAllScores();

      return { coins, pct, ratings, xp, scores, coinRewards: s.coinRewards };
    };

    const lo = out(L);
    const no = out(N);
    return { equal: JSON.stringify(lo) === JSON.stringify(no), legacy: lo, next: no };
  }, { legacyPath: LEGACY, nextPath: NEXT });

  // Pinpoint the first divergence if any, for a readable failure.
  expect(diff.next).toEqual(diff.legacy);
  expect(diff.equal).toBe(true);
});
