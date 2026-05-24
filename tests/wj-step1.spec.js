// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Word Journey — React port (Slice 3.13). Replaces the old legacy step-1 test.
 * Full happy-path E2E is limited by the say-word stage's speech recognition
 * (same webkitSpeechRecognition stub gap deferred for Pronunciation, Slice 3.11),
 * so these cover the deterministic parts: render, stage map, Discover audio
 * budget (carried-forward Slice 3.0 parity), and Discover advancement.
 *
 * NOTE: the legacy nikud injection vowelizes Hebrew text in the live DOM, so we
 * assert via testids / numeric attributes rather than plain-Hebrew text matches
 * (see testing_legacy_nikud_injection).
 */

const TEST_USER_ID = 'wjreacttest';
const V2_PREFIX = 'v2_';

async function seedAndStart(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: {
        id: userId, name: 'WJ', displayName: 'WJ', initial: 'W',
        password: null, created: new Date().toISOString(), lastLogin: null,
      },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({
      userId, userName: 'WJ', displayName: 'WJ', initial: 'W',
      authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
    }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4, gameUnlockOverride: true }));
    localStorage.setItem(`${prefix}englishLearningSettings`, JSON.stringify({ gameUnlockOverride: true }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.location.hash = '/game/word-journey'; });
  await page.waitForTimeout(1200);
}

test('renders the 5-stage map and the Discover stage', async ({ page }) => {
  await seedAndStart(page);
  await expect(page.locator('[data-testid="wj-stage-bar"]')).toBeVisible({ timeout: 6000 });
  await expect(
    page.locator('[data-testid="wj-stage-bar"] [data-stage="discover"][data-state="active"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="media-prompt-audio"]')).toBeVisible();
  await expect(page.locator('[data-testid="wj-discover-counter"]')).toBeVisible();
  await expect(page.locator('[data-testid="wj-discover-next"]')).toBeVisible();
});

test('Discover audio button consumes the per-word listen budget', async ({ page }) => {
  await seedAndStart(page);
  const card = page.locator('[data-testid="media-prompt-card"]');
  await expect(card).toBeVisible({ timeout: 6000 });
  // The only digits in the prompt card are the budget count ("…נותרו: 8").
  const readBudget = async () => parseInt((await card.innerText()).match(/\d+/)?.[0] || '0', 10);
  const before = await readBudget();
  expect(before).toBeGreaterThan(0);
  await page.locator('[data-testid="media-prompt-audio"]').click();
  await page.waitForTimeout(300);
  expect(await readBudget()).toBe(before - 1);
});

test('Discover advances to the next word once the Next button enables', async ({ page }) => {
  await seedAndStart(page);
  const counter = page.locator('[data-testid="wj-discover-counter"]');
  const next = page.locator('[data-testid="wj-discover-next"]');
  await expect(counter).toHaveAttribute('data-item', '1', { timeout: 6000 });
  await expect(next).toBeEnabled({ timeout: 6000 });
  await next.click();
  await expect(counter).toHaveAttribute('data-item', '2', { timeout: 6000 });
});
