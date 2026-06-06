// @ts-check
import { test, expect } from '@playwright/test';

const TEST_USER_ID = 'gatesmoke';
const V2_PREFIX = 'v2_';

async function seedAndStart(page, { gateOn, learnedCount = 0 }) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix, gate, learned }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'G', displayName: 'G', initial: 'G',
        password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({
      userId, userName: 'G', displayName: 'G', initial: 'G',
      authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
    }));
    // Build a learnedWords map of `learned` synthetic entries
    const learnedWords = {};
    for (let i = 0; i < learned; i++) {
      learnedWords[`fake${i}_animals`] = { graduatedDate: '2025-01-01', journeyScore: 100, journeyCompletions: 1, reinforcedIn: [], lastPracticed: '2025-01-01' };
    }
    const progress = { version: 4, learnedWords };
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify(progress));
    localStorage.setItem(`${prefix}englishLearningSettings`, JSON.stringify({ difficultyAutoGate: gate }));
    localStorage.setItem('englishLearningSettings', JSON.stringify({ difficultyAutoGate: gate }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX, gate: gateOn, learned: learnedCount });
  await page.reload();
  await page.waitForTimeout(2500);
  // Ensure gameManager has the latest settings + reload data
  await page.evaluate(() => {
    const ls = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
    const gm = window.__engine?.gm;
    if (!gm) return;
    gm.applySettings({ ...gm.getDefaultSettings(), ...ls });
    gm.progressManager?.loadProgress?.(localStorage.getItem('currentUser'));
    gm.loadGameData();
  });
}

test('fresh learner with gate on never gets words longer than 7 letters', async ({ page }) => {
  await seedAndStart(page, { gateOn: true, learnedCount: 0 });
  const lengths = await page.evaluate(() =>
    (window.__engine?.gm.gameData.vocabulary || []).map(w => w.word.length),
  );
  expect(lengths.length).toBeGreaterThan(0);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(7);
});

test('mid-tier learner (15 learned) gets words up to 9 letters', async ({ page }) => {
  await seedAndStart(page, { gateOn: true, learnedCount: 20 });
  const lengths = await page.evaluate(() =>
    (window.__engine?.gm.gameData.vocabulary || []).map(w => w.word.length),
  );
  expect(lengths.length).toBeGreaterThan(0);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(9);
  // and should include at least one word longer than 7 (proving the tier moved)
  expect(lengths.some(l => l > 7)).toBe(true);
});

test('advanced learner (50+) sees the unfiltered pool', async ({ page }) => {
  await seedAndStart(page, { gateOn: true, learnedCount: 60 });
  const longCount = await page.evaluate(() =>
    (window.__engine?.gm.gameData.vocabulary || []).filter(w => w.word.length > 9).length,
  );
  expect(longCount).toBeGreaterThan(0);
});

test('toggle off restores legacy unfiltered behavior', async ({ page }) => {
  await seedAndStart(page, { gateOn: false, learnedCount: 0 });
  const longCount = await page.evaluate(() =>
    (window.__engine?.gm.gameData.vocabulary || []).filter(w => w.word.length > 7).length,
  );
  expect(longCount).toBeGreaterThan(0);
});

test('picture-match distractor set rejects 2+ long-word options for fresh learner', async ({ page }) => {
  await seedAndStart(page, { gateOn: true, learnedCount: 0 });
  const offenders = await page.evaluate(() => {
    const items = window.__engine?.gm.gameData['picture-match'] || [];
    return items.filter(item => {
      if (!Array.isArray(item.options)) return false;
      const longCount = item.options.filter(o => (o?.word || '').length > 5).length;
      return longCount >= 2;
    }).length;
  });
  expect(offenders).toBe(0);
});

test('word-journey is unaffected by the gate', async ({ page }) => {
  await seedAndStart(page, { gateOn: true, learnedCount: 0 });
  // word-journey reads the raw vocabularyBank, not gameData.vocabulary, so the gate should be a no-op
  const longInBank = await page.evaluate(() =>
    (window.vocabularyBank || []).filter(w => (w.word || '').length > 7).length,
  );
  expect(longInBank).toBeGreaterThan(0);
});
