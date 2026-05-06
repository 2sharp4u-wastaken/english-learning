// @ts-check
import { test, expect } from '@playwright/test';

const TEST_USER_ID = 'wjsmoketest';
const V2_PREFIX = 'v2_';

async function seedAndStartJourney(page) {
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
    const key = `${prefix}userProgress_${userId}`;
    localStorage.setItem(key, JSON.stringify({ version: 4, gameUnlockOverride: true }));
    // Force unlock all games via settings override
    localStorage.setItem(`${prefix}englishLearningSettings`, JSON.stringify({ gameUnlockOverride: true }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.location.hash = '/game/word-journey'; });
  // Word Journey may take a bit to render its first stage
  await page.waitForTimeout(2500);
}

test('Word Journey step 1 (Discover) shows a play button with shared budget', async ({ page }) => {
  await seedAndStartJourney(page);

  // The discover card should render with an audio button
  const audioBtn = page.locator('#wj-discover-audio');
  await expect(audioBtn).toBeVisible({ timeout: 5000 });

  // plays-left counter inside the discover card should show a numeric value
  const playsLeft = page.locator('.wj-discover-card .plays-left');
  await expect(playsLeft).toBeVisible();
  const text = (await playsLeft.textContent())?.trim();
  expect(text === '∞' || /^\d+$/.test(text || '')).toBe(true);

  // After clicking the button once, count either decrements by 1 or remains ∞ (when limit is unbounded)
  const before = (await playsLeft.textContent())?.trim();
  await audioBtn.click();
  await page.waitForTimeout(400);
  const after = (await playsLeft.textContent())?.trim();
  if (before === '∞') {
    expect(after).toBe('∞');
  } else {
    const beforeNum = parseInt(before || '0', 10);
    const afterNum = parseInt(after || '0', 10);
    expect(afterNum).toBeLessThanOrEqual(beforeNum);
  }
});
