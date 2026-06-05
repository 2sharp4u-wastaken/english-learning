// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b — unit specs for the engine's PURE logic.
 *
 * These pin the exact, deterministic outputs of the rules the React bridges
 * depend on (scoring, coin economy, mastery, course unlocking). Originally b0
 * characterization specs against the legacy `managers/*`; Slice 4.4.b1 repointed
 * them at the byte-faithful `src/engine/*` ports (the legacy modules were deleted)
 * — they now serve as the engine's standing unit tests.
 *
 * Each spec dynamic-imports the engine module in-browser and exercises it
 * directly — no app state touched.
 */

const DAY = 86400000;

/** Import a module and run a string-serialized scenario against its exports. */
async function run(page, modulePath, fn, arg = null) {
  return page.evaluate(
    async ({ mod, fnStr, arg }) => {
      const ns = await import(mod);
      // eslint-disable-next-line no-new-func
      const scenario = new Function('ns', 'arg', `return (${fnStr})(ns, arg);`);
      return scenario(ns, arg);
    },
    { mod: modulePath, fnStr: fn.toString(), arg },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// ─── ScoreManager ────────────────────────────────────────────────────────────

const SCORE = '/src/engine/score.ts';

test('ScoreManager.calculateCoins — base rewards + perfect + streak bonuses', async ({ page }) => {
  const r = await run(page, SCORE, (ns) => {
    const s = new ns.ScoreManager();
    return {
      firstTry: s.calculateCoins('correctFirstTry'),
      retry: s.calculateCoins('correctRetry'),
      activity: s.calculateCoins('completeActivity'),
      activityPerfect: s.calculateCoins('completeActivity', { isPerfect: true }),
      perfectButNotActivity: s.calculateCoins('correctFirstTry', { isPerfect: true }),
      daily: s.calculateCoins('dailyLogin'),
      daily6: s.calculateCoins('dailyLogin', { streakDays: 6 }),
      daily7: s.calculateCoins('dailyLogin', { streakDays: 7 }),
      daily14: s.calculateCoins('dailyLogin', { streakDays: 14 }),
      daily30: s.calculateCoins('dailyLogin', { streakDays: 30 }),
      unknown: s.calculateCoins('nope'),
    };
  });
  expect(r).toEqual({
    firstTry: 10,
    retry: 5,
    activity: 20,
    activityPerfect: 50, // 20 + perfectGame(30)
    perfectButNotActivity: 10, // perfect bonus only applies to completeActivity
    daily: 10,
    daily6: 10, // below 7-day threshold
    daily7: 60, // 10 + streakBonus7(50)
    daily14: 110, // 10 + streakBonus14(100)
    daily30: 210, // 10 + streakBonus30(200)
    unknown: 0,
  });
});

test('ScoreManager.calculatePercentage — rounding + divide-by-zero', async ({ page }) => {
  const r = await run(page, SCORE, (ns) => {
    const s = new ns.ScoreManager();
    return [s.calculatePercentage(3, 4), s.calculatePercentage(0, 0), s.calculatePercentage(1, 3), s.calculatePercentage(2, 3), s.calculatePercentage(10, 10)];
  });
  expect(r).toEqual([75, 0, 33, 67, 100]);
});

test('ScoreManager.getPerformanceRating — tier boundaries', async ({ page }) => {
  const r = await run(page, SCORE, (ns) => {
    const s = new ns.ScoreManager();
    return [100, 90, 89, 80, 79, 70, 69, 60, 59, 0].map((p) => s.getPerformanceRating(p).level);
  });
  expect(r).toEqual([
    'perfect', // 100
    'excellent', // 90
    'very-good', // 89
    'very-good', // 80
    'good', // 79
    'good', // 70
    'okay', // 69
    'okay', // 60
    'needs-practice', // 59
    'needs-practice', // 0
  ]);
});

test('ScoreManager.calculateXP — base*multiplier + perfect bonus', async ({ page }) => {
  const r = await run(page, SCORE, (ns) => {
    const s = new ns.ScoreManager();
    return {
      vocab_3of4: s.calculateXP(3, 4, 'vocabulary'), // 30*1.0 + 0
      vocab_perfect: s.calculateXP(4, 4, 'vocabulary'), // 40*1.0 + 20
      scramble_perfect: s.calculateXP(4, 4, 'scramble'), // 40*1.5 + 20
      pronunciation_3of5: s.calculateXP(3, 5, 'pronunciation'), // round(30*1.3) + 0
      abc_perfect: s.calculateXP(5, 5, 'abc'), // 50*0.8 + 20
      mult_grammar: s.getGameXPMultiplier('grammar'),
      mult_unknown: s.getGameXPMultiplier('mystery'),
    };
  });
  expect(r).toEqual({
    vocab_3of4: 30,
    vocab_perfect: 60,
    scramble_perfect: 80,
    pronunciation_3of5: 39,
    abc_perfect: 60,
    mult_grammar: 1.2,
    mult_unknown: 1.0,
  });
});

// ─── CoinManager ─────────────────────────────────────────────────────────────

const COIN = '/src/engine/coins.ts';

test('CoinManager award helpers return the documented amounts and update balance', async ({ page }) => {
  const r = await run(page, COIN, (ns) => {
    const up = { coins: 0, totalCoinsEarned: 0, coinHistory: [] };
    const c = new ns.CoinManager(up);
    return {
      firstTry: c.awardCorrectAnswer(true, false),
      retry: c.awardCorrectAnswer(false),
      fastFirstTry: c.awardCorrectAnswer(true, true),
      perfectAnswer: c.awardPerfectAnswer(),
      activity: c.awardActivityComplete(),
      topic: c.awardTopicComplete(),
      perfectGame: c.awardPerfectGame(),
      balance: up.coins,
    };
  });
  expect(r).toEqual({
    firstTry: 10,
    retry: 5,
    fastFirstTry: 20, // correctAnswer(10) + speedBonus(10)
    perfectAnswer: 15,
    activity: 20,
    topic: 50,
    perfectGame: 30,
    balance: 10 + 5 + 20 + 15 + 20 + 50 + 30,
  });
});

test('CoinManager.awardStreakBonus — floor(days/7)*50, zero below a week', async ({ page }) => {
  const r = await run(page, COIN, (ns) => {
    const mk = () => new ns.CoinManager({ coins: 0, totalCoinsEarned: 0, coinHistory: [] });
    return { d6: mk().awardStreakBonus(6), d7: mk().awardStreakBonus(7), d13: mk().awardStreakBonus(13), d14: mk().awardStreakBonus(14) };
  });
  expect(r).toEqual({ d6: 0, d7: 50, d13: 50, d14: 100 });
});

test('CoinManager.updateStreak — increment, reset, no-op, and 7-day bonus', async ({ page }) => {
  const r = await run(page, COIN, (ns) => {
    const mk = (streakDays) => {
      const up = { coins: 0, totalCoinsEarned: 0, coinHistory: [], streakDays };
      return { up, c: new ns.CoinManager(up) };
    };
    // First-ever login (no lastLogin) → streak 1
    const a = mk(0);
    a.c.updateStreak(null, '2026-01-02');
    // Consecutive day → +1
    const b = mk(3);
    b.c.updateStreak('2026-01-01', '2026-01-02');
    // Gap > 1 day → reset to 1
    const cc = mk(5);
    cc.c.updateStreak('2026-01-01', '2026-01-05');
    // Same day → unchanged
    const d = mk(4);
    d.c.updateStreak('2026-01-01', '2026-01-01');
    // Crossing a 7-day multiple awards a streak bonus
    const e = mk(6);
    e.c.updateStreak('2026-01-01', '2026-01-02'); // → 7
    return { first: a.up.streakDays, consec: b.up.streakDays, broken: cc.up.streakDays, same: d.up.streakDays, weekHit: e.up.streakDays, weekCoins: e.up.coins };
  });
  expect(r).toEqual({ first: 1, consec: 4, broken: 1, same: 4, weekHit: 7, weekCoins: 50 });
});

test('CoinManager.checkDailyBonus — awards once per day and advances lastLoginDate', async ({ page }) => {
  const r = await run(page, COIN, (ns) => {
    const today = new Date().toISOString().split('T')[0];
    const up = { coins: 0, totalCoinsEarned: 0, coinHistory: [], lastLoginDate: null, streakDays: 0 };
    const c = new ns.CoinManager(up);
    c.checkDailyBonus(); // first call this "day" → +10, sets lastLoginDate
    const afterFirst = { coins: up.coins, last: up.lastLoginDate };
    c.checkDailyBonus(); // same day → no-op
    return { afterFirst, coinsAfterSecond: up.coins, isToday: up.lastLoginDate === today };
  });
  expect(r.afterFirst.coins).toBe(10);
  expect(r.coinsAfterSecond).toBe(10); // not awarded twice
  expect(r.isToday).toBe(true);
});

// ─── ProgressManager.calculateMastery (exact numbers, not just status) ─────────

const PROGRESS = '/src/engine/progress.ts';

test('ProgressManager.calculateMastery — exact masteryLevel values', async ({ page }) => {
  const r = await run(page, PROGRESS, (ns) => {
    const pm = new ns.ProgressManager();
    const m = (totalAttempts, correctAttempts, consecutiveCorrect) => pm.calculateMastery({ totalAttempts, correctAttempts, consecutiveCorrect });
    return {
      noAttempts: m(0, 0, 0),
      threeOfThree: m(3, 3, 3), // accuracy 1.0 (bonus capped, already 1)
      twoOfTwo: m(2, 2, 2), // accuracy 1.0, no minAttempts → still base 1.0
      nineOfTen_consec2: m(10, 9, 2), // 0.9 + 0.1 bonus = 1.0
      nineOfTen_consec1: m(10, 9, 1), // 0.9, no consecutive bonus
      threeOfFour: m(4, 3, 1), // 0.75, accuracy<0.9 → no bonus
      twoOfThree: m(3, 2, 0), // round(0.6667*100)/100 = 0.67
    };
  });
  expect(r).toEqual({
    noAttempts: 0,
    threeOfThree: 1,
    twoOfTwo: 1,
    nineOfTen_consec2: 1,
    nineOfTen_consec1: 0.9,
    threeOfFour: 0.75,
    twoOfThree: 0.67,
  });
});

// ─── GameManager course scoping (baseline fix #1) ────────────────────────────

const GM = '/src/engine/gameManager.ts';

test('getScopedQuestionPool — course topic stays playable when its category is unchecked', async ({ page }) => {
  const r = await run(page, GM, (ns) => {
    // Full converted bank (what window.gameData exposes): one animal, one color.
    const fullVocab = [
      { word: 'cat', translation: 'חתול', category: 'animals', options: [] },
      { word: 'red', translation: 'אדום', category: 'colors', options: [] },
    ];
    const gm = new ns.GameManager({
      gameDataProvider: () => ({ vocabulary: fullVocab }),
      vocabularyBank: () => fullVocab,
    });

    // Settings uncheck "colors" → loadGameData filters it out of this.gameData.
    gm.applySettings({ ...gm.getDefaultSettings(), selectedCategories: ['animals'] });
    gm.loadGameData();
    const filteredKeys = gm.gameData.vocabulary.map((w) => w.word);

    // Launch the "colors" topic's vocabulary activity (color word is the curriculum).
    gm.currentTopicId = 't1';
    gm.currentTopicActivity = 'vocabulary';
    gm.currentTopicWords = [{ word: 'red', category: 'colors' }];
    const scoped = gm.getScopedQuestionPool('vocabulary').map((w) => w.word);

    // Outside course mode the category filter still applies (no regression).
    gm.currentTopicActivity = null;
    const unscoped = gm.getScopedQuestionPool('vocabulary').map((w) => w.word);

    return { filteredKeys, scoped, unscoped };
  });
  // Settings filtered "red" out of the plain pool…
  expect(r.filteredKeys).toEqual(['cat']);
  // …but the launched topic still serves its color word (was empty → bug).
  expect(r.scoped).toEqual(['red']);
  // Non-course play is unchanged: filtered pool only.
  expect(r.unscoped).toEqual(['cat']);
});

// ─── CourseManager unlock requirements ───────────────────────────────────────

const COURSE = '/src/engine/courses.ts';

test('CourseManager — unlock requirement gating on prerequisite completion %', async ({ page }) => {
  const r = await run(page, COURSE, (ns) => {
    const up = { courses: {}, topicProgress: {}, certificates: [], coins: 0 };
    const cm = new ns.CourseManager(up, null);
    cm.initialize();
    const courseA = {
      id: 'a',
      name: 'A',
      nameHebrew: 'קורס א',
      units: [{ topics: [{ id: 'a1', activities: ['vocabulary'] }, { id: 'a2', activities: ['vocabulary'] }] }],
    };
    const courseB = { id: 'b', name: 'B', unlockRequirement: { course: 'a', completionPercentage: 50 } };
    cm.registerCourse(courseA);
    cm.registerCourse(courseB);

    const before = { progress: cm.getCourseProgress('a'), meets: cm.meetsCourseUnlockRequirement(courseB) };
    // Complete topic a1 (1 of 2 topics) → 50%
    up.topicProgress['a1'] = { completed: true, completedActivities: ['vocabulary'] };
    const after = { progress: cm.getCourseProgress('a'), meets: cm.meetsCourseUnlockRequirement(courseB) };
    const text = cm.getCourseUnlockRequirementText(courseB);
    return { before, after, text };
  });
  expect(r.before).toEqual({ progress: 0, meets: false });
  expect(r.after).toEqual({ progress: 50, meets: true });
  expect(r.text).toBe('נפתח אחרי 50% ב-קורס א');
});
