import { test, expect } from '@playwright/test';

/**
 * Cloud Phase B — the per-profile backup UI renders when signed into a cloud
 * account, and the link/push flow calls the Worker endpoints. The backend isn't
 * provisioned in CI, so we STUB /api/* to assert the client wiring (endpoints,
 * link map) without a live D1.
 */
test('cloud backup: signed-in panel lists profiles and links → PUT progress', async ({ page }) => {
  // Stub the Worker cloud API so we can assert the exact calls the client makes.
  const calls = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    calls.push(`${req.method()} ${new URL(req.url()).pathname}`);
    const path = new URL(req.url()).pathname;
    if (path === '/api/players' && req.method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ player: { id: 'cloud-1', name: 'Dana', initial: 'D' } }) });
    }
    if (path.startsWith('/api/progress/') || path.startsWith('/api/prefs/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, updated: 'now' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.addInitScript(() => {
    // A kid profile + an authenticated session (parent-elevated for the tab).
    localStorage.setItem('users', JSON.stringify({
      dana: { id: 'dana', name: 'Dana', displayName: 'Dana', initial: 'D', password: null, created: new Date().toISOString(), lastLogin: null },
      mom: { id: 'mom', name: 'Mom', displayName: 'Mom', initial: 'M', password: null, created: new Date().toISOString(), lastLogin: null, role: 'parent' },
    }));
    localStorage.setItem('currentUser', 'mom');
    localStorage.setItem('currentSession', JSON.stringify({ userId: 'mom', userName: 'Mom', displayName: 'Mom', initial: 'M', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem('v2_userProgress_dana', JSON.stringify({ version: 4, coins: 7, wordMastery: {}, learnedWords: {} }));
    // A cloud session (Phase A) so the panel shows its signed-in view.
    localStorage.setItem('cloudToken', 'jwt-test');
    localStorage.setItem('cloudEmail', 'mom@test.com');
  });

  await page.goto('/#/settings');
  await page.setViewportSize({ width: 1280, height: 800 });
  // Open the parent area tab (the parent session auto-elevates by role).
  await page.locator('[data-tab-id="parents"]:visible').first().click();
  const list = page.locator('[data-testid="cloud-backup-list"]');
  await expect(list).toBeVisible({ timeout: 8000 });

  // Dana (kid) is listed and not yet linked → "הפעלת גיבוי".
  const linkBtn = page.locator('[data-testid="cloud-link-dana"]');
  await expect(linkBtn).toBeVisible();
  await linkBtn.click();

  // After linking, the push/pull controls appear + the link persisted.
  await expect(page.locator('[data-testid="cloud-push-dana"]')).toBeVisible({ timeout: 8000 });
  const links = await page.evaluate(() => localStorage.getItem('cloudPlayerLinks'));
  expect(JSON.parse(links).dana).toBe('cloud-1');

  // The client created a cloud player then PUT the progress blob.
  expect(calls).toContain('POST /api/players');
  expect(calls.some((c) => c.startsWith('PUT /api/progress/cloud-1'))).toBe(true);
});
