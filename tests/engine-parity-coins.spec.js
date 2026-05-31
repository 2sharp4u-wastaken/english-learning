// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the CoinManager rewrite.
 *
 * Runs identical economy scenarios through legacy `managers/CoinManager.js` and
 * new `src/engine/coins.ts`, asserting the resulting userProgress mutations are
 * deep-equal. coinHistory `timestamp` is normalized out (wall-clock, differs
 * microseconds apart between the two runs); every other field — amount, reason,
 * gameType, date, balance, plus coins/totalCoinsEarned/streakDays — must match.
 */

const LEGACY = '/managers/CoinManager.js';
const NEXT = '/src/engine/coins.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('CoinManager parity: legacy vs src/engine mutate userProgress identically', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ legacyPath, nextPath }) => {
    const legacyMod = await import(legacyPath);
    const nextMod = await import(nextPath);

    const freshUP = () => ({ coins: 0, totalCoinsEarned: 0, coinHistory: [], lastLoginDate: null, streakDays: 0 });
    const stripTs = (up) => ({
      ...up,
      coinHistory: up.coinHistory.map(({ timestamp, ...rest }) => rest),
    });

    // The same scripted scenario applied to a manager instance.
    const scenario = (m, up) => {
      m.awardCorrectAnswer(true, false);
      m.awardCorrectAnswer(true, true);
      m.awardCorrectAnswer(false);
      m.awardPerfectAnswer();
      m.awardActivityComplete();
      m.awardTopicComplete();
      m.awardPerfectGame();
      m.awardStreakBonus(14);
      m.awardCoins(0, 'noop-should-not-record'); // amount<=0 → ignored
      m.spendCoins(25, 'shop');
      m.spendCoins(999999, 'too-expensive'); // insufficient → ignored
      m.updateStreak('2026-01-01', '2026-01-02'); // consecutive
      m.updateStreak('2026-01-02', '2026-01-09'); // gap → reset to 1
      m.updateStreak(null, '2026-01-10'); // no-last → 1
      // Drive a 7-day-boundary bonus: streak 6 → 7 awards the streak bonus.
      up.streakDays = 6;
      m.updateStreak('2026-02-01', '2026-02-02');
      return stripTs(up);
    };

    const lUP = freshUP();
    const L = new legacyMod.CoinManager(lUP);
    const lo = scenario(L, lUP);

    // Legacy stamps history with window.gameManager?.currentGame; feed the new
    // engine the same source so we compare LOGIC, not the injected gameType
    // (in production the new GameManager supplies it).
    const nUP = freshUP();
    const N = new nextMod.CoinManager(nUP, { currentGameType: () => window.gameManager?.currentGame ?? null });
    const no = scenario(N, nUP);

    return { legacy: lo, next: no };
  }, { legacyPath: LEGACY, nextPath: NEXT });

  expect(next).toEqual(legacy);
});

test('CoinManager.checkDailyBonus parity (first-of-day award + streak)', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ legacyPath, nextPath }) => {
    const legacyMod = await import(legacyPath);
    const nextMod = await import(nextPath);
    const run = (Mod) => {
      const up = { coins: 0, totalCoinsEarned: 0, coinHistory: [], lastLoginDate: null, streakDays: 0 };
      const m = new Mod.CoinManager(up);
      m.checkDailyBonus(); // first today → +10
      m.checkDailyBonus(); // same day → no-op
      return { coins: up.coins, streak: up.streakDays, historyLen: up.coinHistory.length, last: up.lastLoginDate };
    };
    return { legacy: run(legacyMod), next: run(nextMod) };
  }, { legacyPath: LEGACY, nextPath: NEXT });

  expect(next).toEqual(legacy);
});
