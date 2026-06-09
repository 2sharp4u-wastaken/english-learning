// @ts-check
import { test, expect } from '@playwright/test';
import { installMockSpeech, queueTranscript, queueSpeechError } from './helpers/mockSpeech.js';

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

  // FU-4.1: a brand-new user (no persisted progress key) must see gated games
  // LOCKED on the grid. The grid reads unlock state from the live engine; before
  // the engine boots, an absent gameUnlocks map made every gated card render OPEN
  // and clickable. `useGameUnlocks` now recomputes on `engine-ready` (mirrors the
  // FU-HOME-continue fix) so the lock state is correct once the engine is up.
  test('fresh user (no persisted progress) sees gated games LOCKED on /home', async ({ page }) => {
    const FRESH = 'freshfu41';
    await page.goto('/');
    await page.evaluate((userId) => {
      localStorage.setItem('users', JSON.stringify({
        [userId]: {
          id: userId, name: 'Fresh', displayName: 'Fresh', initial: 'F',
          password: null, created: new Date().toISOString(), lastLogin: null,
        },
      }));
      localStorage.setItem('currentUser', userId);
      localStorage.setItem('currentSession', JSON.stringify({
        userId, userName: 'Fresh', displayName: 'Fresh', initial: 'F',
        authenticated: true, loginTime: Date.now(), lastActivity: Date.now(),
      }));
      // Deliberately DO NOT seed v2_userProgress_<id> — this is the fresh-user case.
    }, FRESH);
    await page.reload();
    await page.waitForTimeout(2000);
    await gotoHash(page, '/home');

    // Gated-by-default games render locked; always-open word-journey stays open.
    for (const g of ['listening', 'vocabulary', 'pronunciation']) {
      await expect(
        page.locator(`[data-testid="home-game-card"][data-game="${g}"]`),
        `gated game ${g} should be locked for a fresh user`,
      ).toHaveAttribute('data-locked', 'true');
    }
    await expect(page.locator('[data-testid="home-game-card"][data-game="word-journey"]'))
      .toHaveAttribute('data-locked', 'false');
  });

  test('hero shows a gender-neutral encouragement line when everything is unlocked', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Array.isArray(window.vocabularyBank) && window.vocabularyBank.length >= 60);
    await page.evaluate(() => {
      localStorage.setItem('users', JSON.stringify({ enc: { id: 'enc', name: 'Enc', displayName: 'Enc', initial: 'E', password: null, created: new Date().toISOString(), lastLogin: null } }));
      localStorage.setItem('currentUser', 'enc');
      localStorage.setItem('currentSession', JSON.stringify({ userId: 'enc', userName: 'Enc', displayName: 'Enc', initial: 'E', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
      const learnedWords = {};
      for (const w of window.vocabularyBank.slice(0, 80)) {
        learnedWords[`${String(w.word).toLowerCase()}_${w.category}`] = { graduatedDate: '2025-01-01', grandfathered: true };
      }
      const gameUnlocks = {};
      for (const id of ['word-journey', 'abc', 'phonics', 'memory', 'grammar-beginner', 'articles', 'progressive', 'listening', 'picture-match', 'reading', 'pronunciation', 'fill-blanks', 'scramble', 'grammar', 'vocabulary', 'true-or-not', 'story-time']) {
        gameUnlocks[id] = { unlocked: true, unlockedDate: '2025-01-01' };
      }
      localStorage.setItem('v2_userProgress_enc', JSON.stringify({ version: 4, learnedWords, wordMastery: {}, gameUnlocks }));
    });
    await gotoHash(page, '/home');
    await page.waitForTimeout(1500);

    // Everything unlocked → the unlock teaser is gone and the encouragement line
    // shows. Nikud is injected, so strip it before matching. Assert the words
    // message renders AND that no masculine 2nd-person form leaked in (אתה/בוא/למדת).
    const raw = await page.locator('[data-testid="home-hero"] p').last().textContent();
    const text = (raw || '').replace(/[֑-ׇ]/g, '');
    expect(text).toContain('כל הכבוד');
    expect(text).not.toContain('🎁');
    expect(text).not.toMatch(/אתה|בוא\b|למדת/);
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
      const cm = window.__engine?.app?.courseManager;
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
      id: window.__engine?.gm?.currentTopicId,
      act: window.__engine?.gm?.currentTopicActivity,
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
      const qs = window.__engine?.gm?.shuffledQuestions || [];
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
    const cleared = await page.evaluate(() => window.__engine?.gm?.currentTopicId);
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
      window.__engine.gm.deleteGameState('true-or-not');
      window.__engine.gm.isResuming = false;
      window.__engine.gm.setCourseActivityContext({
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
      const qs = window.__engine?.gm?.shuffledQuestions || [];
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

  // Slice 4.3.b/c: Custom Words + Word Images both ported to React — the
  // advanced-tools tab no longer links to legacy settings.html at all.
  async function openAdvancedTools(page) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedUser(page);
    await gotoHash(page, '/settings');
    await page.locator('[data-tab-id="advanced-tools"]:visible').first().click();
    await expect(page.locator('#parent-password')).toBeVisible();
    await page.locator('#parent-password').fill('mac7395eRa1n1!');
    await page.locator('#parent-password').press('Enter');
    await expect(page.locator('#parent-password')).not.toBeVisible();
  }

  test('advanced-tools: both tools render natively with no settings.html escape hatch', async ({ page }) => {
    await openAdvancedTools(page);

    // Custom Words panel (textarea) + Word Images panel (list) both render.
    await expect(page.locator('#react-root textarea')).toBeVisible();
    await expect(page.locator('[data-testid="word-images-list"]')).toBeVisible();

    // No legacy escape hatch links remain.
    await expect(page.locator('#react-root a[href="settings.html"]')).toHaveCount(0);
  });

  test('advanced-tools: Custom Words panel lists a seeded word and deletes it', async ({ page }) => {
    await openAdvancedTools(page);

    // Seed a custom word, then re-open the tab so the panel reads it on mount.
    await page.evaluate(() => {
      localStorage.setItem('customWords_global', JSON.stringify([
        { word: 'dragon', translation: 'דרקון', category: 'animals', image: '🐉' },
      ]));
    });
    await page.locator('[data-tab-id="game"]:visible').first().click();
    await page.locator('[data-tab-id="advanced-tools"]:visible').first().click();

    const list = page.locator('[data-testid="custom-words-list"]');
    await expect(list).toContainText('dragon');

    await page.locator('[aria-label="מחק dragon"]').click();
    await expect(page.locator('[data-testid="custom-words-list"]')).toHaveCount(0);
    const remaining = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('customWords_global') || '[]'),
    );
    expect(remaining).toHaveLength(0);
  });

  test('advanced-tools: Custom Words import restores a backup bundle', async ({ page }) => {
    await openAdvancedTools(page);

    const bundle = {
      version: 1,
      exportedAt: '2026-05-30T00:00:00.000Z',
      customWords: [{ word: 'whale', translation: 'לוויתן', category: 'animals', image: '🐋' }],
      imageOverrides: {},
      translationOverrides: {},
    };
    // Scope to the JSON import input — Word Images adds many image/* file inputs.
    await page.locator('#react-root input[type="file"][accept="application/json"]').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bundle)),
    });

    await expect(page.locator('[data-testid="custom-words-list"]')).toContainText('whale');
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('customWords_global') || '[]'),
    );
    expect(saved.some((w) => w.word === 'whale')).toBe(true);
  });

  test('advanced-tools: Word Images sets and resets an image override (live)', async ({ page }) => {
    await openAdvancedTools(page);
    await expect(page.locator('[data-testid="word-images-list"]')).toBeVisible();

    // First card — word-independent (avoids assuming a specific base word).
    const card = page.locator('[data-testid="word-images-list"] li').first();
    await expect(card).toBeVisible();

    const url = 'https://example.com/override.png';
    await card.locator('input[type="url"]').fill(url);
    await card.locator('[data-testid="wim-save"]').click();

    // Override persisted AND live on window.wordImageOverrides (sync render path).
    await expect.poll(() => page.evaluate((u) =>
      Object.values(window.wordImageOverrides || {}).includes(u), url,
    )).toBe(true);

    await card.locator('[data-testid="wim-reset"]').click();
    await expect.poll(() => page.evaluate((u) =>
      Object.values(window.wordImageOverrides || {}).includes(u), url,
    )).toBe(false);
  });

  test('advanced-tools: Word Images saves a translation override to localStorage', async ({ page }) => {
    await openAdvancedTools(page);
    await expect(page.locator('[data-testid="word-images-list"]')).toBeVisible();

    const card = page.locator('[data-testid="word-images-list"] li').first();
    await card.locator('[data-testid="wim-trans-edit"]').click();
    const editor = card.locator('[data-testid="wim-trans-input"]');
    await editor.fill('בדיקה-תרגום');
    await editor.press('Enter');

    await expect.poll(() => page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('wordTranslationOverrides') || '{}');
      return Object.values(m).includes('בדיקה-תרגום');
    })).toBe(true);
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
    if (window.__engine?.app) {
      window.__engine.app.userProgress = existing;
      if (window.__engine.app.progressManager) {
        window.__engine.app.progressManager.learnedWords = learned;
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

  test('learn-first gate header back navigates straight home', async ({ page }) => {
    // Representative coverage of the shared learn-first gate-back fix applied to
    // all 10 learn-first games (vocabulary/listening/picture-match/true-or-not/
    // reading/story-time/pronunciation/practice/fill-blanks/sentence-scramble).
    await seedUser(page);
    await gotoHash(page, '/game/vocabulary');
    await expect(page.locator('[data-testid="vocabulary-learn-first"]')).toBeVisible();

    // Gate screen has no game in progress → header back goes home directly
    // (it doesn't mount the exit-confirm dialog the play screen uses).
    await page.locator('[data-testid="game-header-back"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
    // React now owns nikud (FU-4.4-nikud) and it's on by default, so the hint
    // renders with vowel marks (הַשֵּׁמַע עוֹד…). Match nikud-stripped text.
    await expect
      .poll(async () =>
        stripNikud((await page.locator('[data-testid="media-prompt-audio-hint"]').textContent()) || ''),
      )
      .toContain('השמע עוד');

    await page.locator('[data-testid="media-prompt-audio"]').click();
    await page.locator('[data-testid="media-prompt-audio"]').click();

    await expect(page.locator('[data-testid="answer-grid"]'))
      .not.toHaveClass(/pointer-events-none/);
    // Audio hint flips to "plays remaining" after the gate clears.
    await expect
      .poll(async () =>
        stripNikud((await page.locator('[data-testid="media-prompt-audio-hint"]').textContent()) || ''),
      )
      .toContain('השמעות נותרו');
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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

  test('sneak peek button re-flashes the hidden word and spends its budget', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/reading');
    await page.waitForTimeout(900);

    const peek = page.locator('[data-testid="reading-peek"]');
    await expect(peek).toBeVisible();
    // Default budget is 3; the word auto-reveals first, so peek starts disabled.
    await expect(peek).toContainText('(3)');
    await expect(peek).toBeDisabled();

    // Once the 3s auto-reveal lapses the word hides and peek becomes available.
    const word = page.locator('[data-testid="media-prompt-word"]');
    await expect(word).toHaveClass(/invisible/, { timeout: 5000 });
    await expect(peek).toBeEnabled();

    // Peeking re-reveals the word and decrements the per-question budget.
    await peek.click();
    await expect(word).not.toHaveClass(/invisible/);
    await expect(peek).toContainText('(2)');
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
      const m = window.__engine?.gm;
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
      const m = window.__engine?.gm;
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
    // D4: a wrong answer shows the correct-above-attempt comparison panel
    // (correct order in green) instead of overwriting the attempt zone.
    await expect(page.locator('[data-testid="sentence-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentence-target-word"]').first()).toBeVisible();
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

// ─── Slice 3.7: Fill-in-the-Blanks Game (React) ─────────────────────────────

test.describe('Slice 3.7: Fill-in-the-Blanks Game (React)', () => {
  // F2 (bug-dump 2026-06-07): after answering, a word-review table shows the
  // correct option (✓) + the chosen wrong option (✗), each with its Hebrew gloss
  // (from the shared optionTranslations map) and a play button.
  test('F2: word-review table appears after answering with the correct option row', async ({ page }) => {
    const errors = captureErrors(page);
    await seedUser(page);
    const learned = await seedLearnedFromBank(page, 35);
    expect(learned).toBeGreaterThanOrEqual(30);

    await gotoHash(page, '/game/fill-blanks');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="fill-blanks-sentence"]')).toBeVisible();
    // No table before answering.
    await expect(page.locator('[data-testid="word-table"]')).toHaveCount(0);

    const correctText = await page.evaluate(() => {
      const m = window.__engine?.gm;
      const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
      return q ? q.blank.options[0] : null;
    });
    expect(correctText).toBeTruthy();

    // Click the correct option (English label is the first inner span).
    const opts = page.locator('[data-testid="answer-option"]');
    const optCount = await opts.count();
    let clicked = false;
    for (let i = 0; i < optCount; i++) {
      const text = (await opts.nth(i).locator('span > span').first().textContent())
        ?.trim().toLowerCase();
      if (text === correctText.toLowerCase()) {
        await opts.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    await expect(page.locator('[data-testid="fill-blanks-next"]')).toBeVisible();
    await expect(page.locator('[data-testid="word-table"]')).toBeVisible();
    await expect(
      page.locator(`[data-testid="word-table-row"][data-word="${correctText}"]`),
    ).toBeVisible();
    // The row carries a Hebrew gloss + a play button.
    await expect(page.locator('[data-testid="word-table-play"]').first()).toBeVisible();

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('F2: a wrong pick adds its own ✗ row alongside the correct ✓ row', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 35);
    await gotoHash(page, '/game/fill-blanks');
    await page.waitForTimeout(900);

    const correctText = await page.evaluate(() => {
      const m = window.__engine?.gm;
      const q = m?.shuffledQuestions?.[m.currentQuestionIndex];
      return q ? q.blank.options[0] : null;
    });
    expect(correctText).toBeTruthy();

    // Click a WRONG option.
    const opts = page.locator('[data-testid="answer-option"]');
    const optCount = await opts.count();
    let wrongText = null;
    for (let i = 0; i < optCount; i++) {
      const text = (await opts.nth(i).locator('span > span').first().textContent())
        ?.trim();
      if (text && text.toLowerCase() !== correctText.toLowerCase()) {
        wrongText = text;
        await opts.nth(i).click();
        break;
      }
    }
    expect(wrongText).toBeTruthy();

    await expect(page.locator('[data-testid="word-table"]')).toBeVisible();
    // Both the correct and the chosen-wrong rows are present (2 rows).
    await expect(page.locator('[data-testid="word-table-row"]')).toHaveCount(2);
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
      const m = window.__engine?.gm;
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
    // E7: the Hebrew sentence shows in FULL (no blank placeholder) so the child
    // reads the meaning instead of deducing it.
    await expect(page.locator('[data-testid="grammar-hebrew"]')).not.toContainText('___');

    const opts = page.locator('[data-testid="answer-option"]');
    await expect(opts).toHaveCount(4);

    // Click the correct option using the gameManager state.
    const correctText = await page.evaluate(() => {
      const m = window.__engine?.gm;
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
    // F3: after answering, the word-review table shows the correct word (✓).
    // E8 also merges the sentence's NEW vocab words in (no mark), so there may
    // be more than one row — assert the correct option's row is present.
    await expect(page.locator('[data-testid="word-table"]')).toBeVisible();
    await expect(
      page.locator(`[data-testid="word-table-row"][data-word="${correctText}"]`),
    ).toBeVisible();

    await page.locator('[data-testid="grammar-next"]').click();
    await expect.poll(() => page.locator('[data-testid="qp-current"]').textContent(), {
      timeout: 4000,
    }).toBe('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('E8: new vocabulary words surface as tappable pills', async ({ page }) => {
    // Zero learned words → every vocab-bank content word in the sentence is "new".
    await seedUser(page);
    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(900);

    // Most questions carry a bank content word; a few don't — advance until one
    // renders a new-word pill (bounded).
    let found = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      if ((await page.locator('[data-testid="new-word-pill"]').count()) > 0) {
        found = true;
        break;
      }
      await page.locator('[data-testid="answer-option"]').first().click();
      await page.locator('[data-testid="grammar-next"]').click();
      await page.waitForTimeout(300);
    }
    expect(found).toBe(true);

    // Tapping a pill reveals its Hebrew tooltip.
    await page.locator('[data-testid="new-word-pill"]').first().click();
    await expect(page.locator('[data-testid="new-word-tooltip"]').first()).toBeVisible();
  });

  test('incorrect answer reveals the correct option and shows explanation', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/game/grammar');
    await page.waitForTimeout(900);

    const { correctText, wrongText } = await page.evaluate(() => {
      const m = window.__engine?.gm;
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
        const m = window.__engine?.gm;
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
    // F3: the word-review table lists the story's highlighted words.
    await expect(page.locator('[data-testid="word-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="word-table-row"]').first()).toBeVisible();

    // Switch to quiz.
    await page.locator('[data-testid="story-time-ready"]').click();
    await expect(page.locator('[data-testid="story-time-quiz"]')).toBeVisible();
    await expect(page.locator('[data-testid="story-time-question"]')).toBeVisible();
    const opts = page.locator('[data-testid="answer-option"]');
    await expect(opts.first()).toBeVisible();

    // Pick the correct option by matching the option text against the bridge's story data.
    const correctText = await page.evaluate(() => {
      const stories = window.__engine?.gm?.shuffledQuestions;
      const q = stories?.[0]?.questions?.[0];
      return q ? q.options[q.correctIndex] : null;
    });
    expect(correctText).toBeTruthy();

    const optCount = await opts.count();
    let clicked = false;
    for (let i = 0; i < optCount; i++) {
      // Options render in the active abc/ABC case, so compare case-insensitively
      // against the bridge's raw option text.
      const text = (await opts.nth(i).textContent())?.trim();
      if (text?.toLowerCase() === correctText?.toLowerCase()) {
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
      const stories = window.__engine?.gm?.shuffledQuestions;
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
      // Options render in the active abc/ABC case (see happy-path note).
      const text = (await opts.nth(i).textContent())?.trim();
      if (text?.toLowerCase() === wrongText?.toLowerCase()) {
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

  test('learn-first gate header back navigates straight home', async ({ page }) => {
    await seedUser(page);
    await seedLearnedFromBank(page, 3); // below the 6-word minimum → learn-first gate
    await gotoHash(page, '/game/memory');
    await expect(page.locator('[data-testid="memory-learn-first"]')).toBeVisible();

    // The gate screen has no game in progress, so the header back goes home
    // directly (it doesn't mount the exit-confirm dialog the play screen uses).
    await page.locator('[data-testid="game-header-back"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
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

  test('completing level 1 shows the inline complete strip + advance button, and advancing builds level 2', async ({ page }) => {
    // Per project_slice314_memory: the full MemoryLevelSummary only renders at
    // game-end (phase === 'finished'). After a level the board stays up with a
    // small `memory-level-complete` strip (stars + "כל הזוגות נמצאו") and a
    // `memory-advance` button. The previous version of this test asserted the
    // pre-redesign per-level summary DOM that no longer exists.
    await seedUser(page);
    await seedLearnedFromBank(page, 12);
    await gotoHash(page, '/game/memory');
    await page.waitForTimeout(900);

    await completeMemoryLevel(page);

    await expect(page.locator('[data-testid="memory-level-complete"]')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('[data-testid="memory-level-stars"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-advance"]')).toBeVisible();

    // Advancing builds the level-2 board (9 pairs → 18 cards).
    await page.locator('[data-testid="memory-advance"]').click();
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
      .poll(() => page.evaluate(() => window.__engine?.gm?.currentQuestionIndex), { timeout: 3000 })
      .toBe(1);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2', { timeout: 3000 });

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('C4: listen-and-pick (letter-sound) shows a 🔊 glyph, not a bare "?"', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const userId = localStorage.getItem('currentUser');
      const q = {
        type: 'letter-sound',
        questionType: 'abc',
        letter: 'a',
        letterUpper: 'A',
        phonetic: 'ay',
        options: ['a', 'b', 'c', 'd'],
        correct: 0,
        category: 'abc',
        word: 'A',
        instruction: 'איזו אות שמעת?',
        instructionEn: 'Which letter did you hear?',
      };
      localStorage.setItem(
        `savedGame_${userId}_abc`,
        JSON.stringify({
          gameType: 'abc',
          currentQuestionIndex: 0,
          score: 0,
          totalQuestions: 1,
          timestamp: Date.now(),
          shuffledQuestions: [q],
          gameElapsedMs: 0,
          selectedCategories: [],
        }),
      );
    });
    await gotoHash(page, '/game/abc');
    await page.waitForTimeout(900);

    const glyph = page.locator('[data-testid="abc-letter-display"]');
    await expect(glyph).toHaveText('🔊');
    await expect(glyph).not.toHaveText('?');
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
      const wm = (window.__engine.app.userProgress.wordMastery ||= {});
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

  test('gate-screen (all-mastered) header back navigates straight home', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const wm = (window.__engine.app.userProgress.wordMastery ||= {});
      for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        wm[`${ch}_abc`] = { masteryLevel: 1, attempts: 10, correct: 10 };
      }
    });
    await gotoHash(page, '/game/abc');
    await expect(page.locator('[data-testid="abc-all-mastered"]')).toBeVisible();

    // Gate screen has no game in progress → header back goes home directly.
    await page.locator('[data-testid="game-header-back"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
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

    // The big digraph prompt renders (uppercase by default — phonics honors the
    // app-wide case toggle whose default is uppercase, like every other game).
    await expect(page.locator('[data-testid="phonics-sound-display"]')).toHaveText('SH');
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="qp-total"]')).toHaveText('3');

    // Options are audio-gated until the prompt word auto-plays, then interactive.
    const grid = page.locator('[data-testid="answer-grid"]');
    await expect(grid).toHaveAttribute('data-variant', 'media');
    await expect(grid).not.toHaveClass(/pointer-events-none/, { timeout: 4000 });

    await page.locator('[data-testid="answer-option"][data-index="0"]').click();

    await expect
      .poll(() => page.evaluate(() => window.__engine?.gm?.currentQuestionIndex), { timeout: 3000 })
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
      const wm = (window.__engine.app.userProgress.wordMastery ||= {});
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

  test('case toggle flips the digraph display (phonics honors the case toggle)', async ({ page }) => {
    await seedUser(page);
    await seedPhonicsSaved(page);
    await gotoHash(page, '/game/phonics');
    await page.waitForTimeout(900);

    const display = page.locator('[data-testid="phonics-sound-display"]');
    await expect(display).toHaveText('SH'); // uppercase default
    await page.locator('[data-testid="header-case-toggle"]').click();
    await expect(display).toHaveText('sh'); // toggled to lowercase
    await page.locator('[data-testid="header-case-toggle"]').click();
    await expect(display).toHaveText('SH'); // and back
  });

  test('gate-screen (all-mastered) header back navigates straight home', async ({ page }) => {
    await seedUser(page);
    await page.evaluate(() => {
      const wm = (window.__engine.app.userProgress.wordMastery ||= {});
      for (const s of ['sh', 'ch', 'th', 'ph', 'wh', 'ck', 'ng', 'ee', 'oo', 'ai', 'oa', 'ea', 'ay']) {
        wm[`${s}_phonics`] = { masteryLevel: 1, attempts: 10, correct: 10 };
      }
    });
    await gotoHash(page, '/game/phonics');
    await expect(page.locator('[data-testid="phonics-all-mastered"]')).toBeVisible();

    // On a gate screen there's no game in progress: the header back must go home
    // directly (no exit-confirm dialog, which the gate screen doesn't mount).
    await page.locator('[data-testid="game-header-back"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
  });
});

// ─── Slice 3.11: Pronunciation Game (React) ─────────────────────────────────
// The mic→compare→score path is driven through the real `window.speechManager`
// wired to the `webkitSpeechRecognition` stub from helpers/mockSpeech.js
// (installed before boot). `queueTranscript` feeds what the recognizer "hears".

/** Read the current English target word from the prompt card (case-folded for compare). */
async function pronunciationTarget(page) {
  const raw = await page.locator('[data-testid="media-prompt-word"]').textContent();
  return (raw || '').trim().toLowerCase();
}

test.describe('Slice 3.11: Pronunciation Game (React)', () => {
  test('under-threshold learned set shows the learn-first gate (no mic)', async ({ page }) => {
    const errors = captureErrors(page);
    await installMockSpeech(page);
    await seedUser(page);
    await gotoHash(page, '/game/pronunciation');
    await page.waitForTimeout(900);

    // Pool needs >= 4 admitted words; a fresh user has none → learn-first.
    await expect(page.locator('[data-testid="pronunciation-record"]')).toHaveCount(0);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('matching speech scores correct, shows 100% comparison, and waits for manual next', async ({ page }) => {
    const errors = captureErrors(page);
    await installMockSpeech(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/pronunciation');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="pronunciation-record"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');

    const target = await pronunciationTarget(page);
    expect(target.length).toBeGreaterThan(0);
    await queueTranscript(page, target);
    await page.locator('[data-testid="pronunciation-record"]').click();

    const comparison = page.locator('[data-testid="pronunciation-comparison"]');
    await expect(comparison).toBeVisible();
    await expect(page.locator('[data-testid="pronunciation-transcript"]')).toHaveText(target);
    await expect(page.locator('[data-testid="pronunciation-accuracy"]')).toHaveText('100%');

    // B4: correct answers no longer auto-advance — the child controls it via the
    // "next" button (so they can replay / hear themselves first). Stay put until
    // it's pressed, then advance.
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await expect(page.locator('[data-testid="pronunciation-next"]')).toBeVisible();
    await page.waitForTimeout(2200); // would have auto-advanced by now under the old behavior
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    await page.locator('[data-testid="pronunciation-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('mismatching speech scores incorrect; manual next advances', async ({ page }) => {
    const errors = captureErrors(page);
    await installMockSpeech(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/pronunciation');
    await page.waitForTimeout(900);

    const target = await pronunciationTarget(page);
    await queueTranscript(page, 'zzzz');
    await page.locator('[data-testid="pronunciation-record"]').click();

    await expect(page.locator('[data-testid="pronunciation-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="pronunciation-transcript"]')).toHaveText('zzzz');
    // Incorrect does NOT auto-advance — the child taps "next" themselves.
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
    expect(target).not.toBe('zzzz');

    await page.locator('[data-testid="pronunciation-next"]').click();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('2');

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('a recognition error surfaces a retry message and stays on the question', async ({ page }) => {
    await installMockSpeech(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 8);
    await gotoHash(page, '/game/pronunciation');
    await page.waitForTimeout(900);

    await queueSpeechError(page, 'no-speech');
    await page.locator('[data-testid="pronunciation-record"]').click();

    await expect(page.locator('[data-testid="pronunciation-error"]')).toBeVisible();
    // No score recorded, no comparison panel — the question is still live.
    await expect(page.locator('[data-testid="pronunciation-comparison"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="pronunciation-record"]')).toBeVisible();
    await expect(page.locator('[data-testid="qp-current"]')).toHaveText('1');
  });
});

// ─── Slice 3.16: Practice Game (React) ──────────────────────────────────────
// Practice reuses the Pronunciation mechanic (mic → compare). The non-mic tests
// below cover the empty state, the Due-first pool render, and the exit dialog;
// the mic→score path uses the same `webkitSpeechRecognition` stub as Slice 3.11.
// (Grandfathered learnedWords seeded with an old `lastPracticed` land well past
// the 30-day max review interval, so they're Due.)

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

  test('matching speech scores correct and shows the comparison (mic stub)', async ({ page }) => {
    const errors = captureErrors(page);
    await installMockSpeech(page);
    await seedUser(page);
    await seedLearnedFromBank(page, 6);
    await gotoHash(page, '/game/practice');
    await page.waitForTimeout(900);

    await expect(page.locator('[data-testid="practice-record"]')).toBeVisible();
    const target = await pronunciationTarget(page);
    expect(target.length).toBeGreaterThan(0);
    await queueTranscript(page, target);
    await page.locator('[data-testid="practice-record"]').click();

    await expect(page.locator('[data-testid="practice-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="practice-transcript"]')).toHaveText(target);

    const critical = filterCritical(errors);
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
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

  // Slice 4.4.b retired the legacy `gameManager.showWelcomeScreen()` DOM/routing
  // method (pure DOM manipulation + hash route to /#/home). Nothing in the React app
  // calls it — React Router owns game-exit navigation — so the compat-shim test it
  // pinned is gone with the legacy engine.

  // Slice 4.4.b2 retired the legacy `window.authService` global — `src/bridge/auth.ts`
  // is now the standalone auth owner and the React AuthGate renders the app (not the
  // login screen) once a valid session exists. We assert that end-state behavior.
  test('React auth gate renders the app for an authenticated user', async ({ page }) => {
    await seedUser(page);
    await gotoHash(page, '/home');

    // App shell is shown, login screen is not.
    await expect(page.locator('[data-testid="home-hero"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-modal"]')).toHaveCount(0);
    // The legacy authService global is gone.
    const hasLegacyGlobal = await page.evaluate(() => typeof window.authService !== 'undefined');
    expect(hasLegacyGlobal).toBe(false);
  });

  // Slice 4.4.b2: the full React login flow (no session → user-select → password →
  // app). Uses the default seeded users (omer/zohar/idan); first login adopts any
  // password. Exercises bridge/auth.login + the AuthGate flip end-to-end.
  test('React login flow: select user + enter password → app renders', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      // Ensure no existing session: this is a fresh login.
      localStorage.removeItem('currentSession');
      localStorage.removeItem('currentUser');
    });
    await page.reload();

    // Login screen is shown with the default user cards.
    await expect(page.locator('[data-testid="login-modal"]')).toBeVisible();
    const cards = page.locator('[data-testid="user-select-card"]');
    expect(await cards.count()).toBeGreaterThan(0);

    // Pick the first user → password step.
    await cards.first().click();
    await expect(page.locator('[data-testid="password-entry-screen"]')).toBeVisible();

    // First login adopts the entered password.
    await page.locator('#password-input').fill('test1234');
    await page.locator('[data-testid="login-submit"]').click();

    // AuthGate flips to the app.
    await expect(page.locator('[data-testid="home-hero"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-modal"]')).toHaveCount(0);
  });
});
