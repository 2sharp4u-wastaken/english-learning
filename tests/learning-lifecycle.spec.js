// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Unit-level tests for the V3 mastery-driven word lifecycle
 * (docs/learning-flow-redesign.md, step 2 — ProgressManager refactor).
 *
 * Drives the REAL `src/engine/progress.ts` ProgressManager inside the browser via
 * a fresh dynamic import, so we exercise shipping logic — not a re-implementation.
 * (Slice 4.4.b1 retired the legacy `managers/ProgressManager.js`; this engine port
 * is byte-faithful and was the parity oracle's twin.) No app state is touched; each
 * test builds its own ProgressManager instance.
 */

const MOD = '/src/engine/progress.ts';
const DAY = 86400000;

/** Run a scenario fn (string-serialized) against a fresh ProgressManager. */
async function run(page, fn) {
  return page.evaluate(async ({ mod, fnStr }) => {
    const { ProgressManager } = await import(mod);
    const pm = new ProgressManager();
    // Helpers exposed to the scenario.
    const correct = (w, c, n = 1, game = 'word-journey') => {
      for (let i = 0; i < n; i++) pm.recordWordAttempt(w, c, true, game);
    };
    const wrong = (w, c, n = 1, game = 'word-journey') => {
      for (let i = 0; i < n; i++) pm.recordWordAttempt(w, c, false, game);
    };
    const backdate = (w, c, days) => {
      const key = `${w.toLowerCase()}_${c}`;
      pm.wordMastery[key].lastSeen = new Date(Date.now() - days * 86400000).toISOString();
    };
    // eslint-disable-next-line no-new-func
    const scenario = new Function('pm', 'correct', 'wrong', 'backdate', 'DAY', `return (${fnStr})(pm, correct, wrong, backdate, DAY);`);
    return scenario(pm, correct, wrong, backdate, 86400000);
  }, { mod: MOD, fnStr: fn.toString() });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('a never-seen word is New and not introduced', async ({ page }) => {
  const r = await run(page, (pm) => ({
    status: pm.getWordStatus('cat', 'animals'),
    introduced: pm.isWordIntroduced('cat', 'animals'),
    introducedCount: pm.getIntroducedCount(),
    learnedCount: pm.getDerivedLearnedCount(),
  }));
  expect(r.status).toBe('new');
  expect(r.introduced).toBe(false);
  expect(r.introducedCount).toBe(0);
  expect(r.learnedCount).toBe(0);
});

test('an introduced low-mastery word is Learning, not Learned', async ({ page }) => {
  const r = await run(page, (pm, correct) => {
    correct('cat', 'animals', 2); // 2 attempts < minAttempts(3) → not yet stable
    return {
      status: pm.getWordStatus('cat', 'animals'),
      introduced: pm.isWordIntroduced('cat', 'animals'),
      counts: pm.getLifecycleCounts(),
    };
  });
  expect(r.status).toBe('learning');
  expect(r.introduced).toBe(true);
  expect(r.counts.introduced).toBe(1);
  expect(r.counts.learning).toBe(1);
  expect(r.counts.learned).toBe(0);
});

test('graduation is PER-WORD, not batch — the nailed word learns, the failed one does not', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong) => {
    correct('dog', 'animals', 3); // 3/3 → mastery 1.0, stable → Learned
    wrong('owl', 'animals', 3);   // 0/3 → mastery 0 → still Learning
    return {
      dog: pm.getWordStatus('dog', 'animals'),
      owl: pm.getWordStatus('owl', 'animals'),
      counts: pm.getLifecycleCounts(),
    };
  });
  expect(r.dog).toBe('learned');
  expect(r.owl).toBe('learning');
  expect(r.counts.learned).toBe(1);   // only the demonstrated word
  expect(r.counts.introduced).toBe(2); // both were met
});

test('grandfathered words count as Learned regardless of mastery (no access regression)', async ({ page }) => {
  const r = await run(page, (pm) => {
    // Simulate a pre-redesign saved profile: a binary stamp, no mastery data.
    pm.learnedWords['fish_animals'] = {
      graduatedDate: '2020-01-01', journeyScore: 60, journeyCompletions: 1,
      reinforcedIn: [], lastPracticed: '2020-01-01',
    };
    pm.migrateToLifecycleModel();
    return {
      status: pm.getWordStatus('fish', 'animals'),
      introduced: pm.isWordIntroduced('fish', 'animals'),
      learnedCount: pm.getDerivedLearnedCount(),
      grandfathered: pm.learnedWords['fish_animals'].grandfathered,
    };
  });
  expect(r.status).toBe('learned');
  expect(r.introduced).toBe(true);
  expect(r.learnedCount).toBe(1);
  expect(r.grandfathered).toBe(true);
});

test('demotion needs 2 misses — a single slip stays Learned (hysteresis)', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong) => {
    correct('bird', 'animals', 3);                 // Learned (1.0)
    const learned = pm.getWordStatus('bird', 'animals');
    wrong('bird', 'animals', 1);                    // 1st miss → protected, still Learned
    const afterOneMiss = pm.getWordStatus('bird', 'animals');
    wrong('bird', 'animals', 1);                    // 2nd consecutive miss → demote
    const afterTwoMisses = pm.getWordStatus('bird', 'animals');
    return { learned, afterOneMiss, afterTwoMisses };
  });
  expect(r.learned).toBe('learned');
  expect(r.afterOneMiss).toBe('learned');   // one slip is forgiven
  expect(r.afterTwoMisses).toBe('learning'); // demoted only after the 2nd miss
});

test('a correct answer between misses forgives the lapse (no demotion)', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong) => {
    correct('frog', 'animals', 3);   // Learned
    wrong('frog', 'animals', 1);     // 1st miss → protected
    correct('frog', 'animals', 1);   // forgiven → lapse counter reset
    wrong('frog', 'animals', 1);     // counts as a fresh 1st miss → still protected
    return { status: pm.getWordStatus('frog', 'animals') };
  });
  expect(r.status).toBe('learned'); // never hit 2 consecutive misses
});

test('a Learned word becomes Due past its interval and not before', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong, backdate) => {
    correct('lion', 'animals', 3); // Learned, reviewStage 0 → 3-day interval
    backdate('lion', 'animals', 1);
    const dueAt1 = pm.isWordDue('lion', 'animals');
    backdate('lion', 'animals', 5);
    const dueAt5 = pm.isWordDue('lion', 'animals');
    return { dueAt1, dueAt5 };
  });
  expect(r.dueAt1).toBe(false); // 1 day < 3-day interval
  expect(r.dueAt5).toBe(true);  // 5 days ≥ 3-day interval
});

test('reviewStage advances on a correct review and resets on a missed one', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong, backdate) => {
    correct('bear', 'animals', 3);          // Learned, reviewStage 0
    const key = 'bear_animals';
    backdate('bear', 'animals', 5);          // Due (≥3d)
    correct('bear', 'animals', 1);          // correct-while-due → reviewStage 1 (interval 7d)
    const stageAfterReview = pm.wordMastery[key].reviewStage;
    const dueAt6 = (() => { backdate('bear', 'animals', 6); return pm.isWordDue('bear', 'animals'); })(); // 6<7
    const dueAt8 = (() => { backdate('bear', 'animals', 8); return pm.isWordDue('bear', 'animals'); })(); // 8≥7
    wrong('bear', 'animals', 1);            // miss-while-due → reviewStage reset to 0
    const stageAfterMiss = pm.wordMastery[key].reviewStage;
    return { stageAfterReview, dueAt6, dueAt8, stageAfterMiss };
  });
  expect(r.stageAfterReview).toBe(1);
  expect(r.dueAt6).toBe(false); // interval grew to 7 days
  expect(r.dueAt8).toBe(true);
  expect(r.stageAfterMiss).toBe(0);
});

// ─── Step 3: tiered gates + repointed review pool ────────────────────────────

test('review-tier games unlock on INTRODUCED count; consolidation stays locked', async ({ page }) => {
  const r = await run(page, (pm, correct) => {
    ['listening', 'picture-match', 'true-or-not', 'vocabulary', 'pronunciation', 'story-time']
      .forEach((g) => { pm.gameUnlocks[g] = { unlocked: false }; });
    // 5 words introduced, none mastered (1 correct each → Learning).
    ['a', 'b', 'c', 'd', 'e'].forEach((w) => correct(w, 'animals', 1));
    const counts = pm.getLifecycleCounts();
    pm.checkAndUnlockGames(0, 0, 0);
    return {
      introduced: counts.introduced,
      learned: counts.learned,
      listening: pm.gameUnlocks['listening'].unlocked,   // ≥5 introduced ✓
      trueOrNot: pm.gameUnlocks['true-or-not'].unlocked,  // ≥5 introduced ✓
      vocabulary: pm.gameUnlocks['vocabulary'].unlocked,  // needs ≥10 introduced ✗
      storyTime: pm.gameUnlocks['story-time'].unlocked,   // needs ≥15 LEARNED ✗
    };
  });
  expect(r.introduced).toBe(5);
  expect(r.learned).toBe(0);
  expect(r.listening).toBe(true);
  expect(r.trueOrNot).toBe(true);
  expect(r.vocabulary).toBe(false);
  expect(r.storyTime).toBe(false);
});

test('the review pool (introduced keys) includes Learning words, not just Learned', async ({ page }) => {
  const r = await run(page, (pm, correct, wrong) => {
    correct('dog', 'animals', 3); // Learned
    wrong('owl', 'animals', 2);   // Learning (introduced, 0 mastery)
    const introduced = pm.getIntroducedWordKeys();
    const learned = pm.getLearnedWordKeys();
    return {
      introHasLearning: introduced.has('owl_animals'),
      introHasLearned: introduced.has('dog_animals'),
      learnedHasLearning: learned.has('owl_animals'),
      learnedHasLearned: learned.has('dog_animals'),
    };
  });
  expect(r.introHasLearning).toBe(true);  // Learning word IS eligible for review
  expect(r.introHasLearned).toBe(true);
  expect(r.learnedHasLearning).toBe(false); // but not counted as Learned
  expect(r.learnedHasLearned).toBe(true);
});

test('grandfathered user keeps unlocks — no access regression', async ({ page }) => {
  const r = await run(page, (pm) => {
    for (let i = 0; i < 15; i++) {
      pm.learnedWords[`w${i}_animals`] = {
        graduatedDate: '2020-01-01', journeyScore: 60, journeyCompletions: 1,
        reinforcedIn: [], lastPracticed: '2020-01-01',
      };
    }
    pm.migrateToLifecycleModel();
    ['listening', 'story-time'].forEach((g) => { pm.gameUnlocks[g] = { unlocked: false }; });
    pm.checkAndUnlockGames(0, 0, 0);
    return {
      introduced: pm.getIntroducedCount(),
      learned: pm.getDerivedLearnedCount(),
      listening: pm.gameUnlocks['listening'].unlocked,
      storyTime: pm.gameUnlocks['story-time'].unlocked, // ≥15 learned via grandfather
    };
  });
  expect(r.introduced).toBe(15);
  expect(r.learned).toBe(15);
  expect(r.listening).toBe(true);
  expect(r.storyTime).toBe(true);
});

test('ABC letter entries are excluded from vocabulary lifecycle counts', async ({ page }) => {
  const r = await run(page, (pm, correct) => {
    correct('A', 'abc', 3);       // ABC letter — should NOT count as a vocab word
    correct('cat', 'animals', 3); // real vocab word
    return pm.getLifecycleCounts();
  });
  expect(r.total).toBe(1);        // only the animals word
  expect(r.learned).toBe(1);
  expect(r.introduced).toBe(1);
});
