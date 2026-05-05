// @ts-check
import { test, expect } from '@playwright/test';

/**
 * React migration sweep — Phase 0 + Phase 1 (Home, Nav, Profile, Courses, Stats).
 * Runs against Vite dev server at http://localhost:3002.
 */

const TEST_USER_ID = 'smoketest';
const V2_PREFIX = 'v2_';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip Hebrew nikud (vowel marks) Unicode U+0591..U+05C7 */
function stripNikud(s) {
  return (s || '').replace(/[֑-ׇ]/g, '');
}

async function seedUser(page, { progressPatch = {} } = {}) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix, patch }) => {
    // auth.js stores users at the unprefixed 'users' key.
    localStorage.setItem('users', JSON.stringify({
      [userId]: {
        id: userId,
        name: 'Smoke Test',
        displayName: 'Smoke Test',
        initial: 'S',
        password: null,
        created: new Date().toISOString(),
        lastLogin: null,
      },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({
      userId,
      userName: 'Smoke Test',
      displayName: 'Smoke Test',
      initial: 'S',
      authenticated: true,
      loginTime: Date.now(),
      lastActivity: Date.now(),
    }));
    const key = `${prefix}userProgress_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ version: 4, ...existing, ...patch }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX, patch: progressPatch });
  await page.reload();
  await page.waitForTimeout(2500);
}

function captureErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
  });
  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: err.message });
  });
  return errors;
}

function filterCritical(errors) {
  return errors.filter((e) =>
    !e.text.includes('favicon') &&
    !e.text.includes('net::ERR') &&
    !e.text.match(/Failed to load resource.*404/) &&
    !e.text.includes('chunk-')
  );
}

async function gotoHash(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(600);
}

/** Query react-root for a rendered element whose nikud-stripped text contains `needle`. */
async function hasText(page, needle) {
  return await page.evaluate((n) => {
    const root = document.getElementById('react-root');
    if (!root) return false;
    const strip = (s) => (s || '').replace(/[֑-ׇ]/g, '');
    return strip(root.textContent || '').includes(n);
  }, needle);
}

// ─── Phase 0.3: App Shell ───────────────────────────────────────────────────

test.describe('Phase 0.3: App Shell', () => {
  test('React root mounts, takes over as fixed overlay on hub routes', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/home');

    const state = await page.evaluate(() => {
      const r = document.getElementById('react-root');
      const cs = r ? getComputedStyle(r) : null;
      return {
        exists: !!r,
        hasChildren: (r?.children.length ?? 0) > 0,
        position: cs?.position,
        zIndex: cs?.zIndex,
      };
    });
    expect(state.exists).toBe(true);
    expect(state.hasChildren).toBe(true);
    expect(state.position).toBe('fixed');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice 1.1: Home ────────────────────────────────────────────────────────

test.describe('Slice 1.1: Home', () => {
  test('home renders hero + all 4 tier sections', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page, { progressPatch: { coins: 250, totalScore: 1500, streakDays: 3 } });
    await gotoHash(page, '/home');

    // Plan 1.1: "React-owned home hero and progress summary" + "React game-tier grid"
    await expect(page.locator('[data-testid="home-hero"]')).toBeVisible();
    for (const tier of ['learn', 'practice', 'challenge', 'test']) {
      await expect(
        page.locator(`[data-testid="home-tier-${tier}"]`),
        `Missing tier section: ${tier}`,
      ).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/home.png', fullPage: true });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice 1.2: Nav ─────────────────────────────────────────────────────────

test.describe('Slice 1.2: Nav', () => {
  test('top nav shows logo + all 5 links', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/home');
    await page.setViewportSize({ width: 1280, height: 800 });

    expect(await hasText(page, 'לומדים אנגלית')).toBe(true);
    for (const label of ['בית', 'קורסים', 'סטטיסטיקות', 'פרופיל', 'הגדרות']) {
      expect(await hasText(page, label), `Missing nav item: ${label}`).toBe(true);
    }
  });

  test('user menu shows with authenticated user', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/home');
    await page.setViewportSize({ width: 1280, height: 800 });

    // Plan 1.2: "User menu dropdown provides quick access to profile, settings, and logout"
    // Menu only renders when isAuthenticated is true in the React bridge.
    const menuVisible = await page.evaluate(() => {
      const root = document.getElementById('react-root');
      if (!root) return false;
      const strip = (s) => (s || '').replace(/[֑-ׇ]/g, '');
      return Array.from(root.querySelectorAll('button')).some(
        (b) => strip(b.textContent || '').includes('Smoke Test'),
      );
    });
    expect(menuVisible, 'user menu button with display name should be visible').toBe(true);
  });
});

// ─── Slice 1.3: Profile ─────────────────────────────────────────────────────

test.describe('Slice 1.3: Profile', () => {
  test('profile renders all 4 tabs', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page, {
      progressPatch: {
        coins: 250, totalScore: 1500, streakDays: 3,
        certificates: [{ topicName: 'test', earnedDate: '2026-04-01', score: 100, id: 'x' }],
      },
    });
    await gotoHash(page, '/profile');

    // Plan 1.3: "4 tabs: Overview, Certificates, Word Collection, Achievements"
    for (const tab of ['overview', 'certificates', 'words', 'achievements']) {
      await expect(
        page.locator(`[data-testid="profile-tab-${tab}"]`),
        `Missing profile tab: ${tab}`,
      ).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/profile.png', fullPage: true });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice 1.4: Courses ─────────────────────────────────────────────────────

test.describe('Slice 1.4: Courses', () => {
  test('courses page renders content', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/courses');

    expect(await hasText(page, 'קורסים')).toBe(true);
    await page.screenshot({ path: 'test-results/courses.png', fullPage: true });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice 1.5: Stats ───────────────────────────────────────────────────────

test.describe('Slice 1.5: Stats', () => {
  test('stats page renders content', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/stats');

    expect(await hasText(page, 'סטטיסטיקות')).toBe(true);
    await page.screenshot({ path: 'test-results/stats.png', fullPage: true });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice 1.6: Settings ────────────────────────────────────────────────────

test.describe('Slice 1.6: Settings', () => {
  test('settings renders tab rail with all 5 tabs', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/settings');

    // Wait for the tab rail to mount
    await expect(page.locator('[data-tab-id="categories"]').first()).toBeAttached({ timeout: 5000 });

    for (const id of ['categories', 'game', 'advanced', 'users', 'advanced-tools']) {
      const tabs = await page.locator(`[data-tab-id="${id}"]`).count();
      expect(tabs, `Missing settings tab: ${id}`).toBeGreaterThan(0);
    }

    // Categories is the default active tab — its content should render.
    // Use nikud-stripping helper because legacy injects vowel marks into headings.
    // Categories is the default active tab — its content should render.
    // Substring chosen to survive legacy nikud-script spelling normalization
    // (the script replaces some matres lectionis with vowel marks).
    await expect.poll(() => hasText(page, 'קטגוריות אוצר'), { timeout: 5000 }).toBe(true);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('protected tab opens password modal and unlocks on correct password', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedUser(page);
    await gotoHash(page, '/settings');

    // Click the visible "game" tab (mobile pill is hidden at desktop viewport)
    await page.locator('[data-tab-id="game"]:visible').first().click();

    // Password modal should appear
    await expect(page.locator('#parent-password')).toBeVisible();

    // Submit the correct admin password (hardcoded in auth.js)
    await page.locator('#parent-password').fill('mac7395eRa1n1!');
    await page.locator('#parent-password').press('Enter');

    // Modal should close and Game tab content should render
    await expect(page.locator('#parent-password')).not.toBeVisible();
    await expect.poll(() => hasText(page, 'מכניקת'), { timeout: 5000 }).toBe(true);
  });

  test('changing a setting persists to both legacy localStorage keys', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/settings');

    // Wait for the weather category button (nikud-stripped match) and click it.
    // 'weather' is NOT in DEFAULT_SETTINGS — first click adds it.
    await expect.poll(() => page.evaluate(() => {
      const strip = (s) => (s || '').replace(/[֑-ׇ]/g, '');
      return Array.from(document.querySelectorAll('#react-root button'))
        .some((b) => strip(b.textContent || '').includes('מזג'));
    }), { timeout: 5000 }).toBe(true);

    await page.evaluate(() => {
      const strip = (s) => (s || '').replace(/[֑-ׇ]/g, '');
      const btn = Array.from(document.querySelectorAll('#react-root button'))
        .find((b) => strip(b.textContent || '').includes('מזג'));
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect.poll(() => page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('v2_englishLearningSettings') || 'null');
      return v?.selectedCategories?.includes('weather') ?? false;
    }), { timeout: 3000 }).toBe(true);

    const [v2, legacy] = await page.evaluate(() => [
      JSON.parse(localStorage.getItem('v2_englishLearningSettings') || 'null'),
      JSON.parse(localStorage.getItem('englishLearningSettings') || 'null'),
    ]);
    expect(v2?.selectedCategories).toContain('weather');
    expect(legacy?.selectedCategories).toContain('weather');
  });
});

// ─── Cross-route navigation ─────────────────────────────────────────────────

test.describe('Navigation sanity', () => {
  test('all 5 hub routes render React shell without unexpected errors', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);

    for (const hash of ['/home', '/profile', '/courses', '/stats', '/settings']) {
      await gotoHash(page, hash);
      const rendered = await page.evaluate(() => {
        const r = document.getElementById('react-root');
        return (r?.innerHTML.length ?? 0) > 100;
      });
      expect(rendered, `Route #${hash} did not render`).toBe(true);
    }

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Integration bug regression tests ───────────────────────────────────────

test.describe('Integration (known issues)', () => {
  test('legacy hashchange handler ignores React Router paths', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await seedUser(page);
    await gotoHash(page, '/home');
    await gotoHash(page, '/profile');
    await gotoHash(page, '/courses');

    const hashErrors = errors.filter((e) => e.match(/Invalid game type "\//));
    expect(hashErrors, 'legacy switchGame() must not run for React Router paths').toHaveLength(0);
  });

  test('React auth bridge resolves the authenticated user', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/home');

    const state = await page.evaluate(() => {
      const svc = window.authService;
      return {
        authServiceOnWindow: typeof svc !== 'undefined',
        svcReportsAuthenticated: !!svc?.isAuthenticated?.(),
        svcReturnsUser: !!svc?.getCurrentUser?.(),
      };
    });
    expect(state.authServiceOnWindow).toBe(true);
    expect(state.svcReportsAuthenticated).toBe(true);
    expect(state.svcReturnsUser).toBe(true);
  });
});
