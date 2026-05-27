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
    !e.text.includes('chunk-') &&
    // Transient `fetch` failures hitting the dev server under parallel test
    // load (phonetic index in particular) — not a product bug.
    !e.text.includes('[PHONETICS] Failed to load') &&
    !(e.text.includes('TypeError: Failed to fetch') && e.text.includes('phonetic'))
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
    // Assert a real course card renders — guards against the manager-getter regression
    // that left the page on its empty state (the 'קורסים' text alone is in that copy too).
    await expect(page.locator('[data-testid="course-card-header"]').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/courses.png', fullPage: true });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});

// ─── Slice C1: Launchable Courses ─────────────────────────────────────────────

test.describe('Slice C1: Launchable Courses', () => {
  /** Unlock the first course (auto-unlocks its first topic) and return its info. */
  async function unlockFirstTopic(page) {
    return await page.evaluate(() => {
      const cm = window.appManager?.courseManager || window.courseManager;
      const course = cm.getAllCourses()[0];
      cm.unlockCourse(course.id);
      const topic = course.units[0].topics[0];
      return {
        courseId: course.id,
        topicId: topic.id,
        activities: topic.activities || [],
        words: topic.words || [],
      };
    });
  }

  const LAUNCHABLE = ['vocabulary', 'listening', 'picture-match'];

  async function launchFirstTopicActivity(page, info, activity) {
    await gotoHash(page, '/courses');
    await page.locator(`[data-testid="course-card-header"][data-course="${info.courseId}"]`).click();
    await page
      .locator(`[data-testid="topic-activity-launch"][data-topic="${info.topicId}"][data-activity="${activity}"]`)
      .first()
      .click();
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 4000 })
      .toContain(`/game/${activity}`);
    await page.waitForTimeout(800);
  }

  test('launching a topic activity scopes the game to topic words and skips the learn-first gate', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page); // deliberately ZERO learned words
    const info = await unlockFirstTopic(page);
    const activity = LAUNCHABLE.find((a) => info.activities.includes(a));
    expect(activity, `first topic should expose a launchable activity; got ${JSON.stringify(info.activities)}`).toBeTruthy();

    await launchFirstTopicActivity(page, info, activity);

    // Course context is set on the legacy gameManager.
    const ctx = await page.evaluate(() => ({
      id: window.gameManager?.currentTopicId,
      act: window.gameManager?.currentTopicActivity,
    }));
    expect(ctx.id).toBe(info.topicId);
    expect(ctx.act).toBe(activity);

    // The game is live (shell rendered) even though no words are learned — the
    // learn-first gate is skipped in course mode.
    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();

    // Scoping: every question word is one of the topic's words, and there is at
    // least one (an empty pool would have returned the learn-first gate).
    const scopedOk = await page.evaluate((topicWords) => {
      const set = new Set(topicWords.map((w) => String(w).toLowerCase()));
      const qs = window.gameManager?.shuffledQuestions || [];
      return qs.length > 0 && qs.every((q) => set.has(String(q.word).toLowerCase()));
    }, info.words);
    expect(scopedOk).toBe(true);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('exiting a course game clears the course context and returns to /courses', async ({ page }) => {
    await seedUser(page);
    const info = await unlockFirstTopic(page);
    const activity = LAUNCHABLE.find((a) => info.activities.includes(a));
    expect(activity).toBeTruthy();

    await launchFirstTopicActivity(page, info, activity);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();
    await page.locator('[data-testid="exit-dialog-confirm"]').click();

    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 4000 })
      .toContain('/courses');

    // Context cleared so a later free-play session is not wrongly scoped.
    const cleared = await page.evaluate(() => window.gameManager?.currentTopicId);
    expect(cleared).toBeFalsy();
  });

  // true-or-not (fast-follow) scopes via getActiveTopicWords, not getScopedQuestionPool,
  // so it gets its own check. No course topic lists it as an activity yet, so we set the
  // legacy course context directly — exactly what startTopicActivity() does — then load.
  test('true-or-not in course mode scopes to topic words and skips the learn-first gate', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page); // deliberately ZERO learned words → free play would gate
    const info = await unlockFirstTopic(page);

    await page.evaluate(({ topicId, words }) => {
      window.gameManager.deleteGameState('true-or-not');
      window.gameManager.isResuming = false;
      window.gameManager.setCourseActivityContext({
        topicId,
        activityType: 'true-or-not',
        topicWords: words,
      });
    }, { topicId: info.topicId, words: info.words });

    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(800);

    // Live despite zero learned words — the ≥5-learned gate is skipped in course mode.
    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();

    // Every question's word is one of the topic's words (mismatch rounds keep the topic
    // word and only swap the displayed image, so this holds for both match and mismatch).
    const scopedOk = await page.evaluate((topicWords) => {
      const set = new Set(topicWords.map((w) => String(w).toLowerCase()));
      const qs = window.gameManager?.shuffledQuestions || [];
      return qs.length > 0 && qs.every((q) => set.has(String(q.word).toLowerCase()));
    }, info.words);
    expect(scopedOk).toBe(true);

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

// ─── Slice 3.2: Listening Game (React) ──────────────────────────────────────

test.describe('Slice 3.2: Listening Game (React)', () => {
  test('learn-first empty state shows when fewer than 4 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="listening-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: prompt renders without English word, options appear, correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 8);
    expect(learned).toBeGreaterThanOrEqual(4);

    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    // Listening prompt MUST NOT show the English target word.
    await expect(page.locator('[data-testid="media-prompt-word"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    // 1-play gate: auto-play satisfies it. Wait for it, then verify revealed.
    await expect.poll(() => page.locator('[data-testid="answer-grid"]').getAttribute('class'), {
      timeout: 2500,
    }).not.toMatch(/pointer-events-none/);

    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);

    await page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');

    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(900);

    await expect.poll(() => page.locator('[data-testid="answer-grid"]').getAttribute('class'), {
      timeout: 2500,
    }).not.toMatch(/pointer-events-none/);

    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);
    const wrongIndex = correctIndex === 0 ? 1 : 0;

    await page.locator(`[data-testid="answer-option"][data-index="${wrongIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="listening-next"]')).toBeVisible();

    await page.locator('[data-testid="listening-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const bank = window.vocabularyBank || [];
      const words = bank.slice(0, 5).map((w) => ({
        word: w.word,
        category: w.category,
        translation: w.translation,
        hebrew: w.translation,
        picture: w.picture,
        options: [w.word, 'x', 'y', 'z'],
        correct: 0,
      }));
      localStorage.setItem(
        `savedGame_${userId}_listening`,
        JSON.stringify({
          gameType: 'listening',
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

    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('audio counters persist across refresh', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(900);

    // Auto-play consumes 1 play (also clears gate). Click manual twice more.
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.waitForTimeout(200);

    const beforeRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_listening_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeRefresh).toBeTruthy();
    expect(beforeRefresh.audioPlaysLeft).toBeLessThan(8);

    await page.reload();
    await page.waitForTimeout(1200);

    const afterRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_listening_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(afterRefresh.audioPlaysLeft).toBe(beforeRefresh.audioPlaysLeft);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/listening');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.3: Picture Match Game (React) ──────────────────────────────────

test.describe('Slice 3.3: Picture Match Game (React)', () => {
  test('learn-first empty state shows when fewer than 4 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/picture-match');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="picture-match-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: English prompt + 4 media options, correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 8);
    expect(learned).toBeGreaterThanOrEqual(4);

    await gotoHash(page, '/game/picture-match');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    // Picture-match prompt shows the English target word (the cue is "find this picture").
    await expect(page.locator('[data-testid="media-prompt-word"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="answer-grid"]'))
      .toHaveAttribute('data-variant', 'media');
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    // 1-play gate: auto-play satisfies it. Wait for reveal.
    await expect.poll(() => page.locator('[data-testid="answer-grid"]').getAttribute('class'), {
      timeout: 2500,
    }).not.toMatch(/pointer-events-none/);

    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);

    await page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');

    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/picture-match');
    await page.waitForTimeout(900);

    await expect.poll(() => page.locator('[data-testid="answer-grid"]').getAttribute('class'), {
      timeout: 2500,
    }).not.toMatch(/pointer-events-none/);

    const correctIndex = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correct ?? -1;
    });
    expect(correctIndex).toBeGreaterThanOrEqual(0);
    const wrongIndex = correctIndex === 0 ? 1 : 0;

    await page.locator(`[data-testid="answer-option"][data-index="${wrongIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="picture-match-next"]')).toBeVisible();

    await page.locator('[data-testid="picture-match-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const bank = window.vocabularyBank || [];
      const words = bank.slice(0, 5).map((w) => ({
        word: w.word,
        category: w.category,
        translation: w.translation,
        hebrew: w.translation,
        picture: w.picture,
        options: [
          { word: w.word, picture: w.picture },
          { word: 'x', picture: '❌' },
          { word: 'y', picture: '🚫' },
          { word: 'z', picture: '⛔' },
        ],
        correct: 0,
      }));
      localStorage.setItem(
        `savedGame_${userId}_picture-match`,
        JSON.stringify({
          gameType: 'picture-match',
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

    await gotoHash(page, '/game/picture-match');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('audio counters persist across refresh', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/picture-match');
    // Wait for the audio button to render rather than a fixed timeout — was flaky.
    await expect(page.locator('[data-testid="media-prompt-audio"]')).toBeVisible({
      timeout: 5000,
    });

    // Auto-play consumes 1 play. Two manual clicks more.
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.waitForTimeout(200);

    const beforeRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_picture_match_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeRefresh).toBeTruthy();
    expect(beforeRefresh.audioPlaysLeft).toBeLessThan(8);

    await page.reload();
    await page.waitForTimeout(1200);

    const afterRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_picture_match_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(afterRefresh.audioPlaysLeft).toBe(beforeRefresh.audioPlaysLeft);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/picture-match');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.4: True or Not Game (React) ────────────────────────────────────

test.describe('Slice 3.4: True or Not Game (React)', () => {
  test('learn-first empty state shows when fewer than 5 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="true-or-not-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: word + image prompt + 2 options (כן/לא), correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 8);
    expect(learned).toBeGreaterThanOrEqual(5);

    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-word"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-media"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    // No audio gate — options interactive immediately.
    await expect(page.locator('[data-testid="answer-grid"]'))
      .not.toHaveClass(/pointer-events-none/);

    const isMatch = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.isMatch;
    });
    expect(typeof isMatch).toBe('boolean');
    const correctIndex = isMatch ? 0 : 1;

    await page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');

    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(900);

    const isMatch = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.isMatch;
    });
    const correctIndex = isMatch ? 0 : 1;
    const wrongIndex = correctIndex === 0 ? 1 : 0;

    await page.locator(`[data-testid="answer-option"][data-index="${wrongIndex}"]`).click();
    await expect(page.locator(`[data-testid="answer-option"][data-index="${correctIndex}"]`))
      .toHaveAttribute('data-state', 'correct');
    await expect(page.locator('[data-testid="true-or-not-next"]')).toBeVisible();

    await page.locator('[data-testid="true-or-not-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const bank = window.vocabularyBank || [];
      const words = bank.slice(0, 5).map((w, i) => ({
        word: w.word,
        translation: w.translation,
        category: w.category,
        image: w.picture,
        imageUrl: w.imageUrl,
        displayImage: w.picture,
        displayImageUrl: w.imageUrl,
        isMatch: i % 2 === 0,
      }));
      localStorage.setItem(
        `savedGame_${userId}_true-or-not`,
        JSON.stringify({
          gameType: 'true-or-not',
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

    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('audio counters persist across refresh', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.waitForTimeout(200);

    const beforeRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_true_or_not_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeRefresh).toBeTruthy();
    expect(beforeRefresh.audioPlaysLeft).toBeLessThan(8);

    await page.reload();
    await page.waitForTimeout(1200);

    const afterRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_true_or_not_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(afterRefresh.audioPlaysLeft).toBe(beforeRefresh.audioPlaysLeft);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/true-or-not');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.5: Reading Game (React) ────────────────────────────────────────

test.describe('Slice 3.5: Reading Game (React)', () => {
  test('learn-first empty state shows when fewer than 4 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="reading-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="letter-slots"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: picture + letter bank + check advances on correct word', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 8);
    expect(learned).toBeGreaterThanOrEqual(4);

    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-prompt-media"]')).toBeVisible();
    await expect(page.locator('[data-testid="letter-slots"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    const target = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.word || null;
    });
    expect(target).toBeTruthy();

    // Tap the matching tiles into the slots — tiles expose a lowercase
    // data-letter; click only ones still enabled (handles duplicate letters).
    for (const ch of target.split('')) {
      const btn = page
        .locator(`[data-testid="letter-tile"][data-letter="${ch.toLowerCase()}"]:not([disabled])`)
        .first();
      await btn.click();
    }

    await expect(page.locator('[data-testid="reading-check"]')).toBeEnabled();
    await page.locator('[data-testid="reading-check"]').click();

    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('clear button empties the built word and re-enables letter buttons', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    // Pick the first available tile
    const firstLetter = page.locator('[data-testid="letter-tile"]:not([disabled])').first();
    const usedLetter = await firstLetter.getAttribute('data-letter');
    await firstLetter.click();
    await expect(page.locator('[data-testid="reading-clear"]')).toBeEnabled();

    await page.locator('[data-testid="reading-clear"]').click();
    await expect(page.locator('[data-testid="reading-clear"]')).toBeDisabled();
    // The cleared tile is available again.
    await expect(
      page.locator(`[data-testid="letter-tile"][data-letter="${usedLetter}"]:not([disabled])`).first(),
    ).toBeVisible();
  });

  test('incorrect submission surfaces feedback + Next button (no retry)', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    // Just click whatever the first available letter is — almost certainly
    // not the full target word — and submit.
    const firstLetter = page.locator('[data-testid="letter-tile"]:not([disabled])').first();
    await firstLetter.click();
    await page.locator('[data-testid="reading-check"]').click();

    // Either the answer was accidentally correct (single-letter word) or
    // we got the Next button — both leave us in a coherent state. Assert
    // that the check button is no longer enabled (retry blocked).
    await expect(page.locator('[data-testid="reading-check"]')).toHaveCount(0);
  });

  test('wrong answer shows the letter-by-letter spelling comparison', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    // One letter is almost never the full word → wrong → comparison shown.
    await page.locator('[data-testid="letter-tile"]:not([disabled])').first().click();
    await page.locator('[data-testid="reading-check"]').click();

    const next = page.locator('[data-testid="reading-next"]');
    if (await next.count()) {
      await expect(page.locator('[data-testid="spelling-comparison"]')).toBeVisible();
      // The full correct word is revealed (all target letters shown)…
      await expect(
        page.locator('[data-testid="spelling-target-letter"]').first(),
      ).toBeVisible();
      // …and the child's single attempted letter is rendered for comparison.
      await expect(
        page.locator('[data-testid="spelling-attempt-letter"]'),
      ).toHaveCount(1);
    }
  });

  test('resume picks up mid-session save and continues from the saved question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const bank = window.vocabularyBank || [];
      const words = bank.slice(0, 5).map((w) => ({
        word: (w.word || '').toUpperCase(),
        picture: w.image,
        imageUrl: w.imageUrl,
        hebrew: w.translation,
        phonics: (w.word || '').split('').join('-'),
        extraLetters: ['M', 'T', 'R', 'S', 'N', 'L'],
        difficulty: 'beginner',
        category: w.category,
      }));
      localStorage.setItem(
        `savedGame_${userId}_reading`,
        JSON.stringify({
          gameType: 'reading',
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

    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('4');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('audio counters persist across refresh', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.waitForTimeout(200);

    const beforeRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_reading_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeRefresh).toBeTruthy();
    expect(beforeRefresh.audioPlaysLeft).toBeLessThan(8);

    await page.reload();
    await page.waitForTimeout(1200);

    const afterRefresh = await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const raw = localStorage.getItem(`v2_reading_audio_${userId}`);
      return raw ? JSON.parse(raw) : null;
    });
    expect(afterRefresh.audioPlaysLeft).toBe(beforeRefresh.audioPlaysLeft);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.8: Sentence Scramble Game (React) ──────────────────────────────

test.describe('Slice 3.8: Sentence Scramble Game (React)', () => {
  test('learn-first empty state shows when fewer than 30 words are learned', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="scramble-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="scramble-word-bank"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('happy path: tap word bank → answer zone, check advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 35);
    expect(learned).toBeGreaterThanOrEqual(30);

    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="scramble-hint"]')).toBeVisible();
    await expect(page.locator('[data-testid="scramble-word-bank"]')).toBeVisible();
    await expect(page.locator('[data-testid="scramble-answer-zone"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    const target = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.words || null;
    });
    expect(target).toBeTruthy();

    // Tap each word in correct order. `:has-text()` is a substring match, so
    // we filter by exact text (case-insensitive) — sentences with shared roots
    // like "drink" vs "drinks" would otherwise pick the wrong button and the
    // iteration would run out of matches partway through.
    const wordBank = page.locator('[data-testid="scramble-word-btn"]');
    for (const raw of target) {
      const word = raw.replace(/[.,!?;:]+$/, '').toLowerCase();
      const btn = wordBank
        .filter({
          hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        })
        .first();
      await btn.click();
    }

    await expect(page.locator('[data-testid="scramble-check"]')).toBeEnabled();
    await page.locator('[data-testid="scramble-check"]').click();

    // Index advances regardless of correctness (legacy invariant).
    await expect(page.locator('[data-testid="scramble-next"]')).toBeVisible();
    await page.locator('[data-testid="scramble-next"]').click();
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('tapping a placed chip returns it to the word bank', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(900);

    const before = await page.locator('[data-testid="scramble-word-btn"]').count();
    const firstWord = page.locator('[data-testid="scramble-word-btn"]').first();
    await firstWord.click();

    await expect(page.locator('[data-testid="scramble-answer-chip"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="scramble-word-btn"]')).toHaveCount(before - 1);

    // Click the placed chip — it should return to the bank.
    await page.locator('[data-testid="scramble-answer-chip"]').first().click();
    await expect(page.locator('[data-testid="scramble-answer-chip"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="scramble-word-btn"]')).toHaveCount(before);
  });

  test('check is disabled until all words are placed', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(900);

    // No words placed → check is disabled.
    await expect(page.locator('[data-testid="scramble-check"]')).toBeDisabled();

    // Place one word → still disabled (multi-word sentences).
    await page.locator('[data-testid="scramble-word-btn"]').first().click();
    await expect(page.locator('[data-testid="scramble-check"]')).toBeDisabled();
  });

  test('incorrect submission reveals the correct order and shows Next', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(900);

    const target = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.words || null;
    });
    if (!target || target.length < 2) test.skip();

    // Place in reverse order to almost certainly be wrong. Exact-text filter
    // (not substring) — see happy-path test for the rationale.
    const reversed = [...target]
      .reverse()
      .map((w) => w.replace(/[.,!?;:]+$/, '').toLowerCase());
    const wordBankRev = page.locator('[data-testid="scramble-word-btn"]');
    for (const word of reversed) {
      const btn = wordBankRev
        .filter({
          hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        })
        .first();
      await btn.click();
    }

    await page.locator('[data-testid="scramble-check"]').click();
    // Reveal animation populates the answer zone with the correct words.
    await page.waitForTimeout(500 + target.length * 200 + 200);
    await expect(page.locator('[data-testid="scramble-next"]')).toBeVisible();
  });

  test('resume picks up mid-session save and continues from the saved question', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      // Hand-build 5 scramble questions matching the shape gameManager expects:
      // requires `words` (array) for valid-resume guard.
      const sentences = [
        { sentence: 'I am happy', translation: 'אני שמח', words: ['I', 'am', 'happy'], theme: 'daily', difficulty: 'beginner' },
        { sentence: 'The cat is here', translation: 'החתול כאן', words: ['The', 'cat', 'is', 'here'], theme: 'animals', difficulty: 'beginner' },
        { sentence: 'I like apples', translation: 'אני אוהב תפוחים', words: ['I', 'like', 'apples'], theme: 'food', difficulty: 'beginner' },
        { sentence: 'My family is big', translation: 'המשפחה שלי גדולה', words: ['My', 'family', 'is', 'big'], theme: 'family', difficulty: 'beginner' },
        { sentence: 'Hello my friend', translation: 'שלום חבר שלי', words: ['Hello', 'my', 'friend'], theme: 'greetings', difficulty: 'beginner' },
      ];
      localStorage.setItem(
        `savedGame_${userId}_scramble`,
        JSON.stringify({
          gameType: 'scramble',
          currentQuestionIndex: 2,
          score: 20,
          totalQuestions: 5,
          timestamp: Date.now(),
          shuffledQuestions: sentences,
          gameElapsedMs: 0,
          selectedCategories: [],
        }),
      );
    });

    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await gotoHash(page, '/game/scramble');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.9: Grammar Beginner Game (React) ───────────────────────────────

test.describe('Slice 3.9: Grammar Beginner Game (React)', () => {
  test('happy path: question renders, correct answer advances index', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/grammar-beginner');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="gb-options"]')).toBeVisible();

    const correct = await page.evaluate(() => {
      const m = window.gameManager;
      return m?.shuffledQuestions?.[m.currentQuestionIndex]?.correctAnswer ?? null;
    });
    expect(correct).toBeTruthy();

    await page
      .locator(`[data-testid="gb-option"][data-key="${correct}"]`)
      .first()
      .click();

    await expect(page.locator('[data-testid="gb-next"]')).toBeVisible();
    await page.locator('[data-testid="gb-next"]').click();
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('translation flash + Next button appear after any answer (correct or wrong)', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/grammar-beginner');
    await page.waitForTimeout(900);

    // Pick any option — pass or fail, the bridge advances regardless and shows Next.
    const firstOption = page.locator('[data-testid="gb-option"]').first();
    await firstOption.click();

    await expect(page.locator('[data-testid="gb-translation"]')).toBeVisible();
    await expect(page.locator('[data-testid="gb-next"]')).toBeVisible();
  });

  test('resume picks up mid-session save and continues from the saved question', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      // Hand-build 4 who-says-it questions (simplest subtype to fabricate).
      const mkQ = (subjectKey, sentence, hebrewSentence) => ({
        type: 'who-says-it',
        instruction: 'מי אמר את זה?',
        instructionAudio: 'Who said this?',
        sentence,
        sentenceAudio: sentence,
        hebrewSentence,
        correctAnswer: subjectKey,
        predicate: { word: 'happy', image: '😊', hebrew: 'שמח' },
        options: [
          { key: 'i', image: '🧒', hebrew: 'אני', isCorrect: subjectKey === 'i' },
          { key: 'she', image: '👧', hebrew: 'היא', isCorrect: subjectKey === 'she' },
          { key: 'he', image: '👦', hebrew: 'הוא', isCorrect: subjectKey === 'he' },
          { key: 'they', image: '👨‍👩‍👧', hebrew: 'הם', isCorrect: subjectKey === 'they' },
        ],
      });
      const questions = [
        mkQ('i', 'i am happy', 'אני שמח'),
        mkQ('she', 'she is happy', 'היא שמחה'),
        mkQ('he', 'he is happy', 'הוא שמח'),
        mkQ('they', 'they are happy', 'הם שמחים'),
      ];
      localStorage.setItem(
        `savedGame_${userId}_grammar-beginner`,
        JSON.stringify({
          gameType: 'grammar-beginner',
          currentQuestionIndex: 2,
          score: 20,
          totalQuestions: 4,
          timestamp: Date.now(),
          shuffledQuestions: questions,
          gameElapsedMs: 0,
        }),
      );
    });

    await gotoHash(page, '/game/grammar-beginner');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('4');
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/grammar-beginner');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.10: Grammar Game (React) ───────────────────────────────────────

test.describe('Slice 3.10: Grammar Game (React)', () => {
  test('happy path: sentence with blank + 4 options render and progress advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="grammar-sentence"]')).toBeVisible();
    await expect(page.locator('[data-testid="grammar-play"]')).toBeVisible();
    await expect(page.locator('[data-testid="grammar-blank"]')).toHaveAttribute('data-state', 'empty');
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    const opts = page.locator('[data-testid="answer-option"]');
    await expect(opts).toHaveCount(4);

    // Click the correct option using the gameManager state.
    const correctText = await page.evaluate(() => {
      const m = window.gameManager;
      const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
      return q ? q.options[q.correct] : null;
    });
    expect(correctText).toBeTruthy();

    const optCount = await opts.count();
    let clickedCorrect = false;
    for (let i = 0; i < optCount; i++) {
      // Each button has a label span + optional Hebrew sublabel; match only
      // the English label (first child span text).
      const text = (await opts.nth(i).locator('span > span').first().textContent())?.trim().toLowerCase();
      if (text === correctText.toLowerCase()) {
        await opts.nth(i).click();
        clickedCorrect = true;
        break;
      }
    }
    expect(clickedCorrect).toBe(true);

    await expect(page.locator('[data-testid="grammar-next"]')).toBeVisible();
    await expect(page.locator('[data-testid="grammar-blank"]')).toHaveAttribute('data-state', 'correct');

    await page.locator('[data-testid="grammar-next"]').click();
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals the correct option and shows explanation', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(900);

    const { correctText, wrongText } = await page.evaluate(() => {
      const m = window.gameManager;
      const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
      if (!q) return { correctText: null, wrongText: null };
      const correctText = q.options[q.correct];
      const wrongText = q.options.find((_, i) => i !== q.correct);
      return { correctText, wrongText };
    });
    if (!wrongText) test.skip();

    const opts = page.locator('[data-testid="answer-option"]');
    const optCount = await opts.count();
    let clickedWrong = false;
    for (let i = 0; i < optCount; i++) {
      const text = (await opts.nth(i).locator('span > span').first().textContent())?.trim().toLowerCase();
      if (text === wrongText.toLowerCase()) {
        await opts.nth(i).click();
        clickedWrong = true;
        break;
      }
    }
    expect(clickedWrong).toBe(true);

    await expect(page.locator('[data-testid="grammar-blank"]')).toHaveAttribute('data-state', 'incorrect');
    await expect(page.locator('[data-testid="grammar-explanation"]')).toBeVisible();
    await expect(page.locator('[data-testid="grammar-next"]')).toBeVisible();
  });

  test('resume picks up mid-session save and continues from the saved question', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const questions = [
        { sentence: 'I ___ happy', hebrewSentence: 'אני ___ שמח', options: ['am', 'is', 'are', 'be'], correct: 0, category: 'verb-to-be', explanation: "Use 'am' with 'I'", hebrewExplanation: "משתמשים ב'am' עם 'I'", difficulty: 'beginner' },
        { sentence: 'She ___ here', hebrewSentence: 'היא ___ כאן', options: ['am', 'is', 'are', 'be'], correct: 1, category: 'verb-to-be', explanation: "Use 'is' with 'she'", hebrewExplanation: "משתמשים ב'is' עם 'she'", difficulty: 'beginner' },
        { sentence: 'They ___ cool', hebrewSentence: 'הם ___ מגניבים', options: ['am', 'is', 'are', 'be'], correct: 2, category: 'verb-to-be', explanation: "Use 'are' with 'they'", hebrewExplanation: "משתמשים ב'are' עם 'they'", difficulty: 'beginner' },
        { sentence: 'He ___ tall', hebrewSentence: 'הוא ___ גבוה', options: ['am', 'is', 'are', 'be'], correct: 1, category: 'verb-to-be', explanation: "Use 'is' with 'he'", hebrewExplanation: "משתמשים ב'is' עם 'he'", difficulty: 'beginner' },
        { sentence: 'We ___ ready', hebrewSentence: 'אנחנו ___ מוכנים', options: ['am', 'is', 'are', 'be'], correct: 2, category: 'verb-to-be', explanation: "Use 'are' with 'we'", hebrewExplanation: "משתמשים ב'are' עם 'we'", difficulty: 'beginner' },
      ];
      localStorage.setItem(
        `savedGame_${userId}_grammar`,
        JSON.stringify({
          gameType: 'grammar',
          currentQuestionIndex: 2,
          score: 20,
          totalQuestions: 5,
          timestamp: Date.now(),
          shuffledQuestions: questions,
          gameElapsedMs: 0,
        }),
      );
    });

    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('5');
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Focused grammar-practice games: Articles + Progressive (React) ─────────

for (const game of [
  { id: 'articles', label: 'Articles (a/an/the)' },
  { id: 'progressive', label: 'Progressive tenses' },
]) {
  test.describe(`Grammar-practice: ${game.label}`, () => {
    test('happy path: emoji + sentence + options render and progress advances on correct answer', async ({ page }) => {
      const errors = captureErrors(page);
      await seedUser(page);
      await gotoHash(page, `/game/${game.id}`);
      await page.waitForTimeout(900);

      await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
      await expect(page.locator(`[data-testid="${game.id}-sentence"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${game.id}-play"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${game.id}-blank"]`)).toHaveAttribute('data-state', 'empty');
      await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

      const opts = page.locator('[data-testid="answer-option"]');
      await expect(opts.first()).toBeVisible();

      const correctText = await page.evaluate(() => {
        const m = window.gameManager;
        const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
        return q ? q.options[q.correct] : null;
      });
      expect(correctText).toBeTruthy();

      const optCount = await opts.count();
      let clickedCorrect = false;
      for (let i = 0; i < optCount; i++) {
        const text = (await opts.nth(i).locator('span > span').first().textContent())?.trim().toLowerCase();
        if (text === correctText.toLowerCase()) {
          await opts.nth(i).click();
          clickedCorrect = true;
          break;
        }
      }
      expect(clickedCorrect).toBe(true);

      await expect(page.locator(`[data-testid="${game.id}-next"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${game.id}-blank"]`)).toHaveAttribute('data-state', 'correct');

      await page.locator(`[data-testid="${game.id}-next"]`).click();
      await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
        timeout: 4000,
      }).toBe('2');

      const critical = filterCritical(errors);
      expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
    });
  });
}

// ─── Slice 3.12: Story Time Game (React) ────────────────────────────────────

test.describe('Slice 3.12: Story Time Game (React)', () => {
  test('learn-first empty state shows when fewer than 15 words are learned', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 4);
    await gotoHash(page, '/game/story-time');
    await page.waitForTimeout(800);

    await expect(page.locator('[data-testid="story-time-learn-first"]')).toBeVisible();
  });

  test('happy path: read phase renders, ready button switches to quiz, correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 20);
    await gotoHash(page, '/game/story-time');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="game-screen-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="story-time-read"]')).toBeVisible();
    await expect(page.locator('[data-testid="story-time-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="story-sentence"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="story-sentence-play"]').first()).toBeVisible();

    // Switch to quiz.
    await page.locator('[data-testid="story-time-ready"]').click();
    await expect(page.locator('[data-testid="story-time-quiz"]')).toBeVisible();
    await expect(page.locator('[data-testid="story-time-question"]')).toBeVisible();
    const opts = page.locator('[data-testid="answer-option"]');
    await expect(opts.first()).toBeVisible();

    // Pick the correct option by matching the option text against the bridge's story data.
    const correctText = await page.evaluate(() => {
      const stories = window.gameManager?.shuffledQuestions;
      const q = stories?.[0]?.questions?.[0];
      return q ? q.options[q.correctIndex] : null;
    });
    expect(correctText).toBeTruthy();

    const optCount = await opts.count();
    let clicked = false;
    for (let i = 0; i < optCount; i++) {
      const text = (await opts.nth(i).textContent())?.trim();
      if (text === correctText) {
        await opts.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    // The auto-advance fires after ~1.5s on correct; the progress current should bump.
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).not.toBe('1');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces next button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 20);
    await gotoHash(page, '/game/story-time');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="story-time-ready"]').click();
    await expect(page.locator('[data-testid="story-time-quiz"]')).toBeVisible();

    const wrongText = await page.evaluate(() => {
      const stories = window.gameManager?.shuffledQuestions;
      const q = stories?.[0]?.questions?.[0];
      if (!q) return null;
      const idx = q.options.findIndex((_, i) => i !== q.correctIndex);
      return idx >= 0 ? q.options[idx] : null;
    });
    if (!wrongText) test.skip();

    const opts = page.locator('[data-testid="answer-option"]');
    const optCount = await opts.count();
    let clicked = false;
    for (let i = 0; i < optCount; i++) {
      const text = (await opts.nth(i).textContent())?.trim();
      if (text === wrongText) {
        await opts.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    await expect(page.locator('[data-testid="answer-grid"]')).toHaveAttribute('data-revealed', 'true');
    await expect(page.locator('[data-testid="story-time-next"]')).toBeVisible();
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 20);
    await gotoHash(page, '/game/story-time');
    await page.waitForTimeout(800);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.14: Memory Game (React) ────────────────────────────────────────

/**
 * Read every card's pairId and return arrays of the two card indices that
 * share each pair, so a test can flip matching pairs deterministically.
 */
async function memoryPairs(page) {
  return await page.$$eval('[data-testid="memory-card"]', (els) => {
    const map = {};
    for (const el of els) {
      const pair = el.getAttribute('data-pair');
      (map[pair] ||= []).push(Number(el.getAttribute('data-index')));
    }
    return Object.values(map);
  });
}

/** Flip every matching pair of the current level, one pair at a time. */
async function completeMemoryLevel(page) {
  const pairs = await memoryPairs(page);
  for (const [a, b] of pairs) {
    await page.locator(`[data-testid="memory-card"][data-index="${a}"]`).click();
    await page.waitForTimeout(180);
    await page.locator(`[data-testid="memory-card"][data-index="${b}"]`).click();
    await page.waitForTimeout(1000); // > MATCH_CHECK_MS (700) + resolve
  }
}

test.describe('Slice 3.14: Memory Game (React)', () => {
  test('gates with a learn-first prompt when too few introduced words', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 3); // below the 6-word minimum
    await gotoHash(page, '/game/memory');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="memory-learn-first"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-board"]')).toHaveCount(0);
  });

  test('renders the level-1 board and a single match advances the pairs counter + score', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 12);
    await gotoHash(page, '/game/memory');
    await page.waitForTimeout(900);

    const board = page.locator('[data-testid="memory-board"]');
    await expect(board).toBeVisible();
    // Level 1 = 6 pairs → 12 cards.
    await expect(page.locator('[data-testid="memory-card"]')).toHaveCount(12);
    await expect(page.locator('[data-testid="memory-pairs"]')).toHaveText('0/6');

    const pairs = await memoryPairs(page);
    const [a, b] = pairs[0];
    await page.locator(`[data-testid="memory-card"][data-index="${a}"]`).click();
    await page.waitForTimeout(180);
    await page.locator(`[data-testid="memory-card"][data-index="${b}"]`).click();

    await expect
      .poll(() => page.locator('[data-testid="memory-pairs"]').textContent(), { timeout: 4000 })
      .toBe('1/6');
    // Both matched cards stay face-up in the matched state.
    await expect(
      page.locator(`[data-testid="memory-card"][data-index="${a}"]`),
    ).toHaveAttribute('data-state', 'matched');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('completing level 1 shows the level summary with stars and a next-level button', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 12);
    await gotoHash(page, '/game/memory');
    await page.waitForTimeout(900);

    await completeMemoryLevel(page);

    await expect(page.locator('[data-testid="memory-summary"]')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('[data-testid="memory-stars"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-next-level"]')).toBeVisible();

    // Advancing builds the level-2 board (9 pairs → 18 cards).
    await page.locator('[data-testid="memory-next-level"]').click();
    await expect.poll(() => page.locator('[data-testid="memory-card"]').count(), { timeout: 4000 })
      .toBe(18);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 12);
    await gotoHash(page, '/game/memory');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.15: ABC Game (React) ───────────────────────────────────────────

/**
 * Inject a deterministic ABC saved-game state so the bridge takes the resume
 * path (instead of mastery-driven random generation). All questions are
 * `match-case` — avoids the random `say-letter` type that needs a microphone.
 * Matches the `savedGame_<userId>_abc` schema written by legacy `saveGameState`.
 */
async function seedABCSaved(page, { currentQuestionIndex = 0, score = 0 } = {}) {
  await page.evaluate(({ idx, score }) => {
    const userId = localStorage.getItem('currentUser');
    const mk = (lower, upper, phonetic) => ({
      type: 'match-case',
      questionType: 'abc',
      letter: lower,
      letterUpper: upper,
      phonetic,
      isUppercase: false,
      options: [upper, 'X', 'Y', 'Z'],
      correct: 0,
      category: 'abc',
      word: upper,
      instruction: 'מצא את האות הגדולה',
      instructionEn: 'Find the uppercase letter',
    });
    const shuffledQuestions = [
      mk('a', 'A', 'ay'),
      mk('b', 'B', 'bee'),
      mk('c', 'C', 'see'),
    ];
    localStorage.setItem(
      `savedGame_${userId}_abc`,
      JSON.stringify({
        gameType: 'abc',
        currentQuestionIndex: idx,
        score,
        totalQuestions: shuffledQuestions.length,
        timestamp: Date.now(),
        shuffledQuestions,
        gameElapsedMs: 0,
        selectedCategories: [],
      }),
    );
  }, { idx: currentQuestionIndex, score });
}

test.describe('Slice 3.15: ABC Game (React)', () => {
  test('happy path: audio-gated options reveal, then a correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await seedABCSaved(page);
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    // The big letter prompt + instruction render.
    await expect(page.locator('[data-testid="abc-letter-display"]')).toHaveText('a');
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('3');

    // Options are audio-gated (pointer-events-none) until the letter sound
    // auto-plays. The reveal fires after the voice-readiness poll — once it
    // does, the grid becomes interactive. (We don't assert the pre-reveal state:
    // when voices are already loaded the auto-play fires within a few hundred ms,
    // so the gated window is too short to catch deterministically.)
    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).not.toHaveClass(/pointer-events-none/, { timeout: 4000 });

    await page.locator('[data-testid="answer-option"][data-index="0"]').click();

    // recordABCAnswer advances the legacy index immediately; the React index
    // follows on the 1.5s auto-advance.
    await expect
      .poll(() => page.evaluate(() => window.gameManager?.currentQuestionIndex), { timeout: 3000 })
      .toBe(1);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2', { timeout: 3000 });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedABCSaved(page);
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).not.toHaveClass(/pointer-events-none/, { timeout: 4000 });

    // Click a wrong option (index 1 = 'X').
    await page.locator('[data-testid="answer-option"][data-index="1"]').click();

    await expect(page.locator('[data-testid="feedback-banner"]')).toBeVisible();
    // Correct option marked, no auto-advance — a Next button appears instead.
    await expect(
      page.locator('[data-testid="answer-option"][data-index="0"]'),
    ).toHaveAttribute('data-state', 'correct');
    const next = page.locator('[data-testid="abc-next"]');
    await expect(next).toBeVisible();

    await next.click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedABCSaved(page, { currentQuestionIndex: 2, score: 20 });
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('3');
    await expect(page.locator('[data-testid="game-header-score"]')).toContainText('20');
  });

  test('all 26 letters mastered shows the congratulations screen', async ({ page }) => {
    await seedUser(page);
    // Drive the mastery-based generator to return [] by mastering every letter.
    await page.evaluate(() => {
      const wm = (window.app.userProgress.wordMastery ||= {});
      for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        wm[`${ch}_abc`] = { masteryLevel: 1, attempts: 10, correct: 10 };
      }
    });
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="abc-all-mastered"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="abc-back-home"]')).toBeVisible();
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedABCSaved(page);
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Phonics Game (React) ───────────────────────────────────────────────────

/**
 * Inject a deterministic Phonics saved-game state so the bridge takes the resume
 * path (instead of mastery-driven random generation). Uses only the two non-mic
 * subtypes (hear-pick-word, see-pick-sound) — say-sound needs a speech stub we
 * don't have yet, same as ABC's say-letter. Matches the `savedGame_<userId>_phonics`
 * schema written by legacy `saveGameState`.
 */
async function seedPhonicsSaved(page, { currentQuestionIndex = 0, score = 0 } = {}) {
  await page.evaluate(({ idx, score }) => {
    const userId = localStorage.getItem('currentUser');
    const shuffledQuestions = [
      {
        type: 'hear-pick-word', questionType: 'phonics', sound: 'sh', display: 'sh',
        hebrewSound: 'הצליל שְׁ', sayWord: 'ship', emoji: '🚢',
        options: [
          { word: 'ship', emoji: '🚢' }, { word: 'goat', emoji: '🐐' },
          { word: 'bee', emoji: '🐝' }, { word: 'duck', emoji: '🦆' },
        ],
        correct: 0, category: 'phonics', word: 'sh',
        instruction: 'הקשב — איזו תמונה מתחילה בצליל הזה?',
        instructionEn: 'Listen — which picture has this sound?',
      },
      {
        type: 'see-pick-sound', questionType: 'phonics', sound: 'ch', display: 'ch',
        hebrewSound: 'הצליל צ׳', sayWord: 'cheese', promptWord: 'cheese', emoji: '🧀',
        options: [
          { label: 'ch', sublabel: 'הצליל צ׳' }, { label: 'sh', sublabel: 'הצליל שְׁ' },
          { label: 'th', sublabel: 'הצליל ת׳' },
        ],
        correct: 0, category: 'phonics', word: 'ch',
        instruction: 'הקשב — איזה צליל יש במילה?',
        instructionEn: 'Listen — which sound is in the word?',
      },
      {
        type: 'hear-pick-word', questionType: 'phonics', sound: 'ee', display: 'ee',
        hebrewSound: 'הצליל אִי הארוך', sayWord: 'bee', emoji: '🐝',
        options: [
          { word: 'bee', emoji: '🐝' }, { word: 'ship', emoji: '🚢' },
          { word: 'goat', emoji: '🐐' }, { word: 'duck', emoji: '🦆' },
        ],
        correct: 0, category: 'phonics', word: 'ee',
        instruction: 'הקשב — איזו תמונה מתחילה בצליל הזה?',
        instructionEn: 'Listen — which picture has this sound?',
      },
    ];
    localStorage.setItem(
      `savedGame_${userId}_phonics`,
      JSON.stringify({
        gameType: 'phonics',
        currentQuestionIndex: idx,
        score,
        totalQuestions: shuffledQuestions.length,
        timestamp: Date.now(),
        shuffledQuestions,
        gameElapsedMs: 0,
        selectedCategories: [],
      }),
    );
  }, { idx: currentQuestionIndex, score });
}

test.describe('Phonics Game (React)', () => {
  test('happy path: audio-gated picture options reveal, then a correct answer advances', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await seedPhonicsSaved(page);
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    // The big digraph prompt renders.
    await expect(page.locator('[data-testid="phonics-sound-display"]')).toHaveText('sh');
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('3');

    // Options are audio-gated until the prompt word auto-plays, then interactive.
    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).toHaveAttribute('data-variant', 'media');
    await expect(grid).not.toHaveClass(/pointer-events-none/, { timeout: 4000 });

    await page.locator('[data-testid="answer-option"][data-index="0"]').click();

    await expect
      .poll(() => page.evaluate(() => window.gameManager?.currentQuestionIndex), { timeout: 3000 })
      .toBe(1);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2', { timeout: 3000 });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('incorrect answer reveals the correct option and surfaces a Next button', async ({ page }) => {
    await seedUser(page);
    await seedPhonicsSaved(page);
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).not.toHaveClass(/pointer-events-none/, { timeout: 4000 });

    // Click a wrong option (index 1).
    await page.locator('[data-testid="answer-option"][data-index="1"]').click();

    await expect(page.locator('[data-testid="feedback-banner"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="answer-option"][data-index="0"]'),
    ).toHaveAttribute('data-state', 'correct');
    const next = page.locator('[data-testid="phonics-next"]');
    await expect(next).toBeVisible();

    await next.click();
    // Q2 is a see-pick-sound: text options with the sound labels.
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveAttribute('data-variant', 'text');
  });

  test('resume picks up mid-session save and continues from the correct question', async ({ page }) => {
    await seedUser(page);
    await seedPhonicsSaved(page, { currentQuestionIndex: 2, score: 20 });
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('3');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('3');
    await expect(page.locator('[data-testid="game-header-score"]')).toContainText('20');
  });

  test('all sounds mastered shows the congratulations screen', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const wm = (window.app.userProgress.wordMastery ||= {});
      for (const s of ['sh', 'ch', 'th', 'ph', 'wh', 'ck', 'ng', 'ee', 'oo', 'ai', 'oa', 'ea', 'ay']) {
        wm[`${s}_phonics`] = { masteryLevel: 1, attempts: 10, correct: 10 };
      }
    });
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="phonics-all-mastered"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-grid"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="phonics-back-home"]')).toBeVisible();
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedPhonicsSaved(page);
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    await page.locator('[data-testid="game-header-back"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toBeVisible();

    await page.locator('[data-testid="exit-dialog-cancel"]').click();
    await expect(page.locator('[data-testid="exit-confirm-dialog"]')).toHaveCount(0);
  });
});

// ─── Slice 3.16: Practice Game (React) ──────────────────────────────────────
// Practice reuses the Pronunciation mechanic (mic → compare), so — like Slice
// 3.11 — the record/score path needs a `webkitSpeechRecognition` stub we don't
// have yet. These cover the non-mic surface: the empty state, the Due-first pool
// render, and the exit dialog. (Grandfathered learnedWords seeded with an old
// `lastPracticed` land well past the 30-day max review interval, so they're Due.)

test.describe('Slice 3.16: Practice Game (React)', () => {
  test('no learned words shows the "nothing to review yet" empty state', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await gotoHash(page, '/game/practice');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="practice-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="practice-empty-cta"]')).toBeVisible();
    await expect(page.locator('[data-testid="practice-record"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('Due/learned words produce a capped review session', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 6);
    await gotoHash(page, '/game/practice');
    await page.waitForTimeout(900);

    // Ready state: mic button + prompt render, no empty state.
    await expect(page.locator('[data-testid="practice-empty"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="practice-record"]')).toBeVisible();
    // Pool = 6 Due words, under the questionsPerGame cap (10) → total 6.
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('6');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('header back button opens the exit-confirm dialog', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 6);
    await gotoHash(page, '/game/practice');
    await page.waitForTimeout(900);

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
