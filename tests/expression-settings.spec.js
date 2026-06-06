// Slice 5.2 — parent-locked expression controls + meaning editor.
// Seeds a manager user (auto-unlocks the protected ביטויים tab), then exercises
// the master/register toggles and the per-expression meaning override editor,
// asserting both persist to localStorage.
const { test, expect } = require('@playwright/test');

const USER_ID = 'expr_parent';
const SETTINGS_KEY = 'v2_englishLearningSettings';
const OVERRIDES_KEY = 'expressionMeaningOverrides';

async function seedParent(page) {
  await page.goto('/');
  await page.evaluate((userId) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: {
        id: userId, name: 'Parent', displayName: 'Parent', initial: 'P',
        role: 'manager', password: null,
        created: new Date().toISOString(), lastLogin: null,
      },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({
      userId, userName: 'Parent', displayName: 'Parent', initial: 'P',
      authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
    }));
  }, USER_ID);
  await page.goto('/#/settings');
  await page.waitForTimeout(1500);
}

async function openExpressionsTab(page) {
  await page.getByRole('button', { name: 'ביטויים' }).click();
  await expect(page.getByTestId('expressions-list')).toBeVisible();
}

test('register + master toggles persist to settings', async ({ page }) => {
  await seedParent(page);
  await openExpressionsTab(page);

  // Enable the "edgy" register (off by default).
  await page.getByRole('switch', { name: /נועז/ }).click();
  await page.waitForTimeout(400);
  let settings = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), SETTINGS_KEY);
  expect(settings.expressionRegisters?.edgy).toBe(true);

  // Master off — disables the whole feature.
  await page.getByRole('switch', { name: 'הפעלת ביטויים' }).click();
  await page.waitForTimeout(400);
  settings = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), SETTINGS_KEY);
  expect(settings.expressionsEnabled).toBe(false);
});

test('editing a meaning saves an override and reset clears it', async ({ page }) => {
  await seedParent(page);
  await openExpressionsTab(page);

  // First card: type a custom meaning.
  const firstCard = page.getByTestId('expressions-list').locator('li').first();
  const phrase = (await firstCard.locator('[dir="ltr"]').first().textContent())?.trim();
  expect(phrase).toBeTruthy();

  await firstCard.getByTestId('expr-custom-toggle').click();
  await firstCard.getByTestId('expr-custom-input').fill('בדיקה אוטומטית');
  await firstCard.getByTestId('expr-custom-save').click();
  await page.waitForTimeout(400);

  let overrides = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), OVERRIDES_KEY);
  expect(overrides[phrase]).toBe('בדיקה אוטומטית');

  // Reset to source clears the override.
  await firstCard.getByTestId('expr-reset').click();
  await page.waitForTimeout(400);
  overrides = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), OVERRIDES_KEY);
  expect(overrides[phrase]).toBeUndefined();
});
