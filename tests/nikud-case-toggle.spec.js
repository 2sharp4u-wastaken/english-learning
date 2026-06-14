// Regression coverage for the nikud + case toggles across games (bug-dump
// 2026-06-07 Theme A + E5). These toggles have regressed before, so assert the
// rendered Hebrew gains/loses vowel points and English flips case end-to-end.
import { test, expect } from '@playwright/test';

const TEST_USER_ID = 'theme-a-selftest';
const V2_PREFIX = 'v2_';
const NIKUD_RE = /[֑-ׇ]/; // Hebrew points/marks

async function seedUser(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'Self Test', displayName: 'Self Test', initial: 'S', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: 'Self Test', displayName: 'Self Test', initial: 'S', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4 }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForTimeout(2500);
}

async function seedLearnedFromBank(page, count) {
  return await page.evaluate((n) => {
    const bank = window.vocabularyBank || [];
    const learned = {};
    for (const w of bank.slice(0, n)) {
      learned[`${w.word.toLowerCase()}_${w.category}`] = { graduatedDate: '2026-03-20', journeyScore: 90, journeyCompletions: 1, reinforcedIn: [], lastPracticed: '2026-03-20' };
    }
    const userId = localStorage.getItem('currentUser');
    const key = `v2_userProgress_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing.learnedWords = learned;
    localStorage.setItem(key, JSON.stringify(existing));
    if (window.__engine?.app) {
      window.__engine.app.userProgress = existing;
      if (window.__engine.app.progressManager) window.__engine.app.progressManager.learnedWords = learned;
    }
    return Object.keys(learned).length;
  }, count);
}

async function gotoHash(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(900);
}

test('A1: Listening translation honors the nikud toggle', async ({ page }) => {
  await seedUser(page);
  await seedLearnedFromBank(page, 12);
  await gotoHash(page, '/game/listening');
  await page.waitForTimeout(900);

  const translation = page.locator('[data-testid="media-prompt-translation"]');
  await expect(translation).toBeVisible();

  // Default: nikud ON → should contain vowel points.
  const onText = (await translation.textContent()) || '';
  expect(NIKUD_RE.test(onText), `expected nikud ON, got: ${onText}`).toBe(true);

  // Toggle OFF → vowel points gone.
  await page.locator('[data-testid="header-nikud-toggle"]').click();
  await page.waitForTimeout(200);
  const offText = (await translation.textContent()) || '';
  expect(NIKUD_RE.test(offText), `expected nikud OFF, got: ${offText}`).toBe(false);

  // Toggle back ON → vowel points return.
  await page.locator('[data-testid="header-nikud-toggle"]').click();
  await page.waitForTimeout(200);
  const onAgain = (await translation.textContent()) || '';
  expect(NIKUD_RE.test(onAgain), `expected nikud ON again, got: ${onAgain}`).toBe(true);
});

test('A11-adjacent: Word Journey Hebrew card honors the nikud toggle (pre-enriched word.hebrew path)', async ({ page }) => {
  await seedUser(page);
  await seedLearnedFromBank(page, 12);
  await gotoHash(page, '/game/word-journey');
  await page.waitForTimeout(1000);

  const hebrew = page.locator('[data-testid="media-prompt-translation"]');
  await expect(hebrew).toBeVisible();

  const onText = (await hebrew.textContent()) || '';
  expect(NIKUD_RE.test(onText), `expected nikud ON, got: ${onText}`).toBe(true);

  await page.locator('[data-testid="header-nikud-toggle"]').click();
  await page.waitForTimeout(200);
  const offText = (await hebrew.textContent()) || '';
  expect(NIKUD_RE.test(offText), `expected nikud OFF, got: ${offText}`).toBe(false);

  // A11: the case toggle drives the English word card (case is English-only, so
  // it correctly leaves the Hebrew card alone — same binary path as every game).
  const english = page.locator('[data-testid="media-prompt-word"]');
  const beforeCase = (await english.textContent()) || '';
  await page.locator('[data-testid="header-case-toggle"]').click();
  await page.waitForTimeout(200);
  const afterCase = (await english.textContent()) || '';
  expect(afterCase, `case toggle changed the word: ${beforeCase} -> ${afterCase}`).not.toBe(beforeCase);
  expect(afterCase.toLowerCase()).toBe(beforeCase.toLowerCase());
});

test('E5: Story Time sentences honor the case toggle', async ({ page }) => {
  await seedUser(page);
  await seedLearnedFromBank(page, 20);
  await gotoHash(page, '/game/story-time');
  await page.waitForTimeout(900);

  const sentence = page.locator('[data-testid="story-sentence"]').first();
  await expect(sentence).toBeVisible();

  const firstText = (await sentence.textContent()) || '';
  const hasLetters = /[a-zA-Z]/.test(firstText);
  expect(hasLetters, `expected English letters in sentence, got: ${firstText}`).toBe(true);

  // Toggle case and confirm the alphabetic casing flips.
  await page.locator('[data-testid="header-case-toggle"]').click();
  await page.waitForTimeout(200);
  const afterText = (await sentence.textContent()) || '';

  const before = firstText.replace(/[^a-zA-Z]/g, '');
  const after = afterText.replace(/[^a-zA-Z]/g, '');
  expect(before.toLowerCase()).toBe(after.toLowerCase()); // same letters
  expect(after).not.toBe(before); // but casing changed
  const oneAllCaps = before === before.toUpperCase() || after === after.toUpperCase();
  const oneAllLower = before === before.toLowerCase() || after === after.toLowerCase();
  expect(oneAllCaps && oneAllLower, `expected one uppercase + one lowercase, got "${before}" / "${after}"`).toBe(true);
});

test('M2: Hebrew player name keeps exact spelling (never nikud-ized)', async ({ page }) => {
  // עידן/זוהר lose matres lectionis when the word-keyed nikud map rewrites them
  // (עידן→עדן). Names are marked data-nikud-skip so nikudDOM leaves them alone,
  // while surrounding chrome ("שלום") still gets vocalized.
  const NAME = 'עידן';
  await page.goto('/');
  await page.evaluate((name) => {
    const userId = 'm2-hebrew-name';
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name, displayName: name, initial: name[0], password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: name, displayName: name, initial: name[0], authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem('v2_userProgress_' + userId, JSON.stringify({ version: 4 }));
  }, NAME);
  await page.reload();
  await page.waitForTimeout(2500);

  // The greeting renders "שלום <name>!"; the name sits in a data-nikud-skip span.
  const nameEl = page.locator('[data-testid="home-greeting"] [data-nikud-skip]');
  await expect(nameEl).toBeVisible({ timeout: 5000 });
  const rendered = (await nameEl.textContent()) || '';
  expect(rendered).toBe(NAME);            // exact spelling — not עדן
  expect(NIKUD_RE.test(rendered)).toBe(false); // and no vowel points added

  // Sanity: the surrounding "שלום" chrome IS still vocalized (skip is scoped).
  const greeting = (await page.locator('[data-testid="home-greeting"]').textContent()) || '';
  expect(NIKUD_RE.test(greeting)).toBe(true);
});
