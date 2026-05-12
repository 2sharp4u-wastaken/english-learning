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

  test('reset settings flow: gate → confirm → defaults restored', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedUser(page);
    await gotoHash(page, '/settings');

    // Pre-mutate the persisted settings so we have something to reset
    await page.evaluate(() => {
      const mutated = { selectedCategories: ['animals'], questionsPerGame: 99 };
      localStorage.setItem('v2_englishLearningSettings', JSON.stringify(mutated));
      localStorage.setItem('englishLearningSettings', JSON.stringify(mutated));
    });

    // Click the reset button (lucide rotate-ccw icon inside header). Hebrew text
    // contains injected nikud so we can't reliably filter by visible text.
    const resetBtn = page.locator('#react-root header button:has(svg.lucide-rotate-ccw)');
    await expect(resetBtn).toBeVisible({ timeout: 3000 });
    await resetBtn.click();

    // Password modal opens (user is not auto-admin)
    await expect(page.locator('#parent-password')).toBeVisible({ timeout: 3000 });
    await page.locator('#parent-password').fill('mac7395eRa1n1!');
    await page.locator('#parent-password').press('Enter');
    await expect(page.locator('#parent-password')).not.toBeVisible();

    // Confirm dialog appears — click destructive "איפוס" via JS (nikud-stripped exact match)
    // Substring without yod (legacy collapses איפוס → אפוס after stripping nikud)
    await expect.poll(() => hasText(page, 'כל ההגדרות'), { timeout: 3000 }).toBe(true);
    await page.evaluate(() => {
      const strip = (s) => (s || '').replace(/[֑-ׇ]/g, '');
      // The confirm button is inside the modal at z-50 (no header tag), exact text "איפוס"
      const btn = Array.from(document.querySelectorAll('button')).find((b) => {
        const inHeader = b.closest('header');
        const t = strip(b.textContent || '').trim();
        // Legacy nikud collapses איפוס → אפוס (yod dropped after stripping)
        return !inHeader && (t === 'איפוס' || t === 'אפוס');
      });
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Defaults should be back in both keys
    await expect.poll(() => page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem('v2_englishLearningSettings') || 'null');
      return v?.questionsPerGame === 10 && v?.selectedCategories?.length === 10;
    }), { timeout: 3000 }).toBe(true);

    const legacy = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('englishLearningSettings') || 'null'),
    );
    expect(legacy?.questionsPerGame).toBe(10);
    expect(legacy?.selectedCategories?.length).toBe(10);
  });

  test('advanced-tools tab links to legacy settings.html for both flows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedUser(page);
    await gotoHash(page, '/settings');

    // Unlock with admin password by clicking advanced-tools (protected)
    await page.locator('[data-tab-id="advanced-tools"]:visible').first().click();
    await expect(page.locator('#parent-password')).toBeVisible();
    await page.locator('#parent-password').fill('mac7395eRa1n1!');
    await page.locator('#parent-password').press('Enter');
    await expect(page.locator('#parent-password')).not.toBeVisible();

    // Both escape-hatch links should be rendered and point at settings.html
    const hrefs = await page.locator('#react-root a[href="settings.html"]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('href')),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const h of hrefs) expect(h).toBe('settings.html');
  });
});

// ─── Slice 2.1: GameScreenShell ─────────────────────────────────────────────

test.describe('Slice 2.1: GameScreenShell', () => {
  test('demo route renders shell + header + progress', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-header-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="question-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('10');

    // Progress increments + score updates after picking the correct option
    await page.locator('[data-testid="answer-option"][data-index="0"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="game-header-score"]')).toContainText('50');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('back button opens exit-confirm dialog, confirm routes to /#/home', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');
    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();
    await page.locator('[data-testid="exit-dialog-confirm"]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 3000 })
      .toBe('#/home');
  });
});

// ─── Slice 2.2: Feedback + Reward + Exit dialogs ────────────────────────────

test.describe('Slice 2.2: Shared feedback and reward', () => {
  test('correct answer shows feedback banner and auto-dismisses', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await page.locator('[data-testid="answer-option"][data-index="0"]').click();
    const banner = page.locator('[data-testid="feedback-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-variant', 'correct');
    await expect(banner).toBeHidden({ timeout: 3000 });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('wrong answer shows incorrect-variant banner', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');
    // Index 1 is a wrong answer in the text-mode demo (correct is 0)
    await page.locator('[data-testid="answer-option"][data-index="1"]').click();
    const banner = page.locator('[data-testid="feedback-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-variant', 'incorrect');
  });

  test('reward modal renders score and coins; exit routes to /#/home', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await page.locator('[data-testid="demo-finish"]').click();
    const modal = page.locator('[data-testid="reward-modal"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('[data-testid="reward-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="reward-coins"]')).toBeVisible();

    await page.locator('[data-testid="reward-modal-exit"]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 3000 })
      .toBe('#/home');
  });

  test('reward modal play-again resets and closes', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');
    await page.locator('[data-testid="demo-finish"]').click();
    await page.locator('[data-testid="reward-modal-play-again"]').click();
    await expect(page.locator('[data-testid="reward-modal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="game-header-score"]')).toContainText('0');
  });

  test('exit-confirm cancel keeps user on game route', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');
    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();
    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.location.hash)).toBe('#/dev/game-shell');
  });
});

// ─── Slice 2.3: AnswerGrid + MediaPromptCard ────────────────────────────────

test.describe('Slice 2.3: Shared interaction primitives', () => {
  test('media prompt and answer grid render with default text mode', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await expect(page.locator('[data-testid="media-prompt-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-word"]')).toHaveText('apple');
    await expect(page.locator('[data-testid="media-prompt-audio"]')).toBeVisible();

    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).toHaveAttribute('data-variant', 'text');
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(4);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('selecting correct option marks it correct and locks the grid', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    const correctOption = page.locator('[data-testid="answer-option"][data-index="0"]');
    await correctOption.click();
    await expect(correctOption).toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveAttribute(
      'data-revealed',
      'true',
    );
    // Grid is locked — clicking another option must not flip the revealed state
    await page.locator('[data-testid="answer-option"][data-index="1"]').click({ force: true });
    await expect(page.locator('[data-testid="answer-option"][data-index="1"]')).not.toHaveAttribute(
      'data-state',
      'selected',
    );
  });

  test('selecting wrong option marks selection incorrect and reveals correct', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await page.locator('[data-testid="answer-option"][data-index="2"]').click();
    await expect(page.locator('[data-testid="answer-option"][data-index="2"]')).toHaveAttribute(
      'data-state',
      'incorrect',
    );
    await expect(page.locator('[data-testid="answer-option"][data-index="0"]')).toHaveAttribute(
      'data-state',
      'correct',
    );
  });

  test('arrow-key navigation moves focus across answer options', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    const first = page.locator('[data-testid="answer-option"][data-index="0"]');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="answer-option"][data-index="1"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(first).toBeFocused();
  });

  test('switching to media mode swaps the grid variant and option content', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await page.locator('[data-testid="demo-mode-media"]').click();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveAttribute(
      'data-variant',
      'media',
    );
    await expect(page.locator('[data-testid="media-prompt-audio-hint"]')).toBeVisible();
    // Word prompt is hidden in media (audio-only) mode
    await expect(page.locator('[data-testid="media-prompt-word"]')).toHaveCount(0);
  });

  test('binary mode renders 2 options with image prompt', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/dev/game-shell');

    await page.locator('[data-testid="demo-mode-binary"]').click();
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="media-prompt-media"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-word"]')).toHaveText('sun');
  });
});

// ─── Slice 3.1: Vocabulary Game (React) ─────────────────────────────────────

/**
 * Build a learnedWords object from the first N entries of the live
 * vocabularyBank, so the V2 gating filter in `bridge/vocabulary.ts` admits
 * them into the question pool.
 */
async function seedLearnedFromBank(page, count) {
  return await page.evaluate((n) => {
    const bank = window.vocabularyBank || [];
    const learned = {};
    for (const w of bank.slice(0, n)) {
      learned[`${w.word.toLowerCase()}_${w.category}`] = {
        graduatedDate: '2026-03-20',
        journeyScore: 90,
        journeyCompletions: 1,
        reinforcedIn: [],
        lastPracticed: '2026-03-20',
      };
    }
    const userId = localStorage.getItem('currentUser');
    const key = `v2_userProgress_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing.learnedWords = learned;
    localStorage.setItem(key, JSON.stringify(existing));
    if (window.app) {
      window.app.userProgress = existing;
      if (window.app.progressManager) {
        window.app.progressManager.learnedWords = learned;
      }
    }
    return Object.keys(learned).length;
  }, count);
}

/**
 * Drive the 3-play audio gate to the reveal point. Auto-play counts as the
 * first play; we tap the manual play button twice to complete the gate.
 */
async function unlockVocabAudioGate(page) {
  await page.waitForTimeout(400); // let the deferred auto-play fire
  await page.locator('[data-testid="media-prompt-audio"]').click();
  await page.locator('[data-testid="media-prompt-audio"]').click();
  await expect(page.locator('[data-testid="answer-grid"]'))
    .not.toHaveClass(/pointer-events-none/);
}

test.describe('Slice 3.1: Vocabulary Game (React)', () => {
  test('learn-first empty state shows when fewer than 4 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="vocabulary-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: question + 4 options render and progress advances after correct answer', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 8);
    expect(learned).toBeGreaterThanOrEqual(4);

    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-word"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    // The 3-play audio gate hides options until the player hears the word 3 times.
    await unlockVocabAudioGate(page);

    // Click the option whose label matches the current question's correct answer
    // (read from the React-driven gameManager state).
    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
      return q?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);

    await page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`).click();
    await expect(page.locator('[data-testid="answer-option"][data-index="' + correctIndex + '"]'))
      .toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="feedback-banner"]'))
      .toHaveAttribute('data-variant', 'correct');

    // After the auto-advance delay, progress moves to question 2 and grid resets.
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');
    await expect(page.locator('[data-testid="answer-grid"]'))
      .toHaveAttribute('data-revealed', 'false');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    await unlockVocabAudioGate(page);

    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);
    const wrongIndex = correctIndex === 0 ? 1 : 0;

    await page.locator(`[data-testid="answer-option"][data-index="${wrongIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${wrongIndex}"]`))
      .toHaveAttribute('data-state', 'incorrect');
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="vocabulary-next"]')).toBeVisible();

    await page.locator('[data-testid="vocabulary-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
  });

  test('audio gate hides options until the word has been heard 3 times', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    // After the deferred auto-play (counts as 1), the grid should still be
    // gated — the inline class includes pointer-events-none until the gate
    // clears at 3 plays.
    await expect(page.locator('[data-testid="answer-grid"]'))
      .toHaveClass(/pointer-events-none/);
    await expect(page.locator('[data-testid="media-prompt-audio-hint"]'))
      .toContainText(/השמע עוד/);

    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();

    await expect(page.locator('[data-testid="answer-grid"]'))
      .not.toHaveClass(/pointer-events-none/);
    // Audio hint flips to "plays remaining" after the gate clears.
    await expect(page.locator('[data-testid="media-prompt-audio-hint"]'))
      .toContainText(/השמעות נותרו/);
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    // Seed a saved vocabulary game state directly in localStorage (matches the
    // legacy `savedGame_<userId>_vocabulary` schema written by `saveGameState`).
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const bank = window.vocabularyBank || [];
      const words = bank.slice(0, 5).map((w) => ({
        word: w.word,
        category: w.category,
        translation: w.translation,
        options: [w.translation, 'X', 'Y', 'Z'],
        correct: 0,
      }));
      localStorage.setItem(
        `savedGame_${userId}_vocabulary`,
        JSON.stringify({
          gameType: 'vocabulary',
          currentQuestionIndex: 3,
          score: 30,
          totalQuestions: 5,
          timestamp: Date.now(),
          shuffledQuestions: words,
          gameElapsedMs: 0,
          selectedCategories: [],
        }),
      );
    });

    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(900);

    // Should land on question 4 of 5 (resumeIndex = 3, current = index + 1).
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('audio counters persist across refresh (no endless-plays exploit)', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    // Auto-play consumes 1 play; click manual play 3 more times to bring
    // audioPlaysLeft from 8 → 4 and playsSoFar from 1 → 4 (already past the
    // 3-play gate).
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.waitForTimeout(200);

    const beforeRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_vocab_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeRefresh).toBeTruthy();
    expect(beforeRefresh.audioPlaysLeft).toBeLessThan(8);
    expect(beforeRefresh.playsSoFar).toBeGreaterThanOrEqual(3);

    // Reload — counters must NOT reset.
    await page.reload();
    await page.waitForTimeout(1200);

    const afterRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_vocab_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(afterRefresh.audioPlaysLeft).toBe(beforeRefresh.audioPlaysLeft);
    // Options should already be revealed (no gate) because we were past 3 plays.
    await expect(page.locator('[data-testid="answer-grid"]'))
      .not.toHaveClass(/pointer-events-none/);
  });

  test('case + nikud toggles in the game header transform the prompt and options', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    const wordOriginal = await page.locator('[data-testid="media-prompt-word"]').textContent();
    expect(wordOriginal).toBeTruthy();

    await page.locator('[data-testid="header-case-toggle"]').click();
    const wordLower = await page.locator('[data-testid="media-prompt-word"]').textContent();
    expect(wordLower).toBe((wordOriginal || '').toLowerCase());
    const bodyClass = await page.evaluate(() => document.body.classList.contains('lowercase-mode'));
    expect(bodyClass).toBe(true);

    // Toggle nikud off — at least one option label loses its nikud marks.
    const optionsWithNikud = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid="answer-option"]'))
        .map((el) => el.textContent || '');
    });
    const hadNikud = optionsWithNikud.some((s) => /[֑-ׇ]/.test(s));
    if (hadNikud) {
      await page.locator('[data-testid="header-nikud-toggle"]').click();
      const optionsStripped = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-testid="answer-option"]'))
          .map((el) => el.textContent || '');
      });
      const stillHasNikud = optionsStripped.some((s) => /[֑-ׇ]/.test(s));
      expect(stillHasNikud).toBe(false);
    }
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/vocabulary');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
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

  test('gameManager.showWelcomeScreen routes through React Router to /#/home', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/practice');
    await page.waitForTimeout(800);

    // Sanity: we are on a game route
    expect(await page.evaluate(() => window.location.hash)).toContain('/game/practice');

    // Trigger the legacy exit path and verify React Router is now at /home
    await page.evaluate(() => window.gameManager?.showWelcomeScreen());
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 3000 })
      .toBe('#/home');

    // React shell should mark body active after route transition flushes
    await expect.poll(() => page.evaluate(() =>
      document.body.classList.contains('react-shell-active'),
    ), { timeout: 3000 }).toBe(true);
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
