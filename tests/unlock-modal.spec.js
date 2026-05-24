// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Step 6 — app-wide "newly unlocked games" modal. A finished session queues the
 * unlocked game IDs (sessionStorage `v3_pendingUnlocks`); Home pops the animated
 * modal on its next mount. Here we seed the queue directly and assert Home shows
 * + clears it.
 */

const TEST_USER_ID = 'unlockmodaltest';
const V2_PREFIX = 'v2_';

async function seedUser(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: {
        id: userId, name: 'U', displayName: 'U', initial: 'U',
        password: null, created: new Date().toISOString(), lastLogin: null,
      },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({
      userId, userName: 'U', displayName: 'U', initial: 'U',
      authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
    }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4 }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForTimeout(2500);
}

test('Home pops the unlock modal for queued games, then clears it', async ({ page }) => {
  await seedUser(page);
  // Queue two unlocks, then remount Home (sessionStorage survives the reload).
  await page.evaluate(() => {
    sessionStorage.setItem('v3_pendingUnlocks', JSON.stringify(['listening', 'reading']));
  });
  await page.reload();
  await page.waitForTimeout(2500);

  const modal = page.locator('[data-testid="newly-unlocked-modal"]');
  await expect(modal).toBeVisible({ timeout: 6000 });
  await expect(page.locator('[data-testid="unlocked-game-card"]')).toHaveCount(2);

  await page.locator('[data-testid="unlocked-modal-close"]').click();
  await expect(modal).toHaveCount(0);

  // Queue was consumed — a fresh Home mount shows nothing.
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-testid="newly-unlocked-modal"]')).toHaveCount(0);
});

test('no modal when nothing was unlocked', async ({ page }) => {
  await seedUser(page);
  await expect(page.locator('[data-testid="newly-unlocked-modal"]')).toHaveCount(0);
});
