// @ts-check
import { test, expect } from '@playwright/test';

const TEST_USER_ID = 'smoketest';
const V2_PREFIX = 'v2_';

/** Strip Hebrew nikud (vowel marks) U+0591..U+05C7 */
function stripNikud(s) {
  return (s || '').replace(/[֑-ׇ]/g, '');
}

test('stats records tab renders cross-game personal records', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'Smoke Test', displayName: 'Smoke Test', initial: 'S', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: 'Smoke Test', displayName: 'Smoke Test', initial: 'S', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4, totalGamesPlayed: 6, totalPoints: 1200, streakDays: 4 }));
    // Per-game score history (percentages).
    localStorage.setItem(`${userId}_vocabulary_history`, JSON.stringify([60, 100, 100, 80]));
    localStorage.setItem(`${userId}_listening_history`, JSON.stringify([70, 80]));
    localStorage.setItem(`${userId}_reading_history`, JSON.stringify([100, 90]));
    // Memory best records.
    localStorage.setItem(`memoryBest_${userId}`, JSON.stringify({
      1: { score: 120, stars: 3, timeSeconds: 40, moves: 10, date: '2026-07-01' },
      2: { score: 300, stars: 4, timeSeconds: 55, moves: 14, date: '2026-07-05' },
    }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();

  await page.goto('/#/stats');
  await page.locator('button', { hasText: /שיאים/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/stats-records.png', fullPage: true });

  // The nikud DOM processor injects vowel marks into Hebrew chrome, so match on
  // nikud-stripped page text.
  const text = stripNikud(await page.locator('#react-root').innerText());
  expect(text).toContain('שיא אישי לכל משחק');
  expect(text).toContain('משחקים מושלמים');
  expect(text).toContain('שיאים אישיים — משחק'); // memory records folded in
  // vocabulary + reading each have 100% sessions → 3 perfect games total.
  expect(text).toContain('3');
});
