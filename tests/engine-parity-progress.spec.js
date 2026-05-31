// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the ProgressManager rewrite (the brain).
 *
 * Replays mastery-lifecycle scenarios through legacy `managers/ProgressManager.js`
 * and new `src/engine/progress.ts` and asserts the resulting state + derived
 * outputs are deep-equal. recordWordAttempt is deterministic (no randomness), so
 * only wall-clock fields are normalized: wordMastery.lastSeen and certificate
 * earnedDate (full ISO, differ by ms between the two runs). Date-only fields
 * (slice(0,10)) match because both runs happen on the same day. Backdated
 * scenarios pin time explicitly so due/spacing is fully deterministic.
 */

const LEGACY = '/managers/ProgressManager.js';
const NEXT = '/src/engine/progress.ts';

/** Run a string-serialized scenario(pm) against a fresh instance of BOTH modules. */
async function parity(page, scenario) {
  return page.evaluate(
    async ({ legacyPath, nextPath, fnStr }) => {
      const legacyMod = await import(legacyPath);
      const nextMod = await import(nextPath);

      // Normalize volatile wall-clock fields so only LOGIC is compared.
      const norm = (pm) => {
        const wm = {};
        for (const [k, v] of Object.entries(pm.wordMastery)) {
          wm[k] = { ...v, lastSeen: v.lastSeen ? 'TS' : v.lastSeen };
        }
        const certs = pm.certificates.map((c) => ({ ...c, earnedDate: c.earnedDate ? 'TS' : c.earnedDate }));
        return { wm, certs };
      };

      const scenario = new Function('pm', 'helpers', `return (${fnStr})(pm, helpers);`);
      const apply = (Mod) => {
        const pm = new Mod.ProgressManager();
        const helpers = {
          correct: (w, c, n = 1, g = 'word-journey') => { for (let i = 0; i < n; i++) pm.recordWordAttempt(w, c, true, g); },
          wrong: (w, c, n = 1, g = 'word-journey') => { for (let i = 0; i < n; i++) pm.recordWordAttempt(w, c, false, g); },
          backdate: (w, c, days) => { const k = `${w.toLowerCase()}_${c}`; pm.wordMastery[k].lastSeen = new Date(Date.now() - days * 86400000).toISOString(); },
          seedUnlocks: (ids) => ids.forEach((g) => { pm.gameUnlocks[g] = { unlocked: false }; }),
        };
        const ret = scenario(pm, helpers);
        return { ret, state: { ...norm(pm), learnedWords: pm.learnedWords, gameUnlocks: pm.gameUnlocks, journey: pm.wordJourneyProgress } };
      };

      return { legacy: apply(legacyMod), next: apply(nextMod) };
    },
    { legacyPath: LEGACY, nextPath: NEXT, fnStr: scenario.toString() },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('parity: per-word graduation, lifecycle counts, status, key sets', async ({ page }) => {
  const { legacy, next } = await parity(page, (pm, h) => {
    h.correct('dog', 'animals', 3);   // learned
    h.wrong('owl', 'animals', 3);     // learning
    h.correct('cat', 'animals', 1);   // learning
    h.correct('A', 'abc', 3);         // ABC — excluded from vocab counts
    return {
      counts: pm.getLifecycleCounts(),
      dog: pm.getWordStatus('dog', 'animals'),
      owl: pm.getWordStatus('owl', 'animals'),
      cat: pm.getWordStatus('cat', 'animals'),
      introduced: [...pm.getIntroducedWordKeys()].sort(),
      learnedKeys: [...pm.getLearnedWordKeys()].sort(),
      derivedLearned: pm.getDerivedLearnedCount(),
      masteryDog: pm.getWordStats('dog', 'animals').masteryLevel,
    };
  });
  expect(next.ret).toEqual(legacy.ret);
  expect(next.state).toEqual(legacy.state);
});

test('parity: tiered unlock gates fire identically', async ({ page }) => {
  const { legacy, next } = await parity(page, (pm, h) => {
    h.seedUnlocks(['listening', 'picture-match', 'true-or-not', 'vocabulary', 'pronunciation', 'reading', 'story-time', 'fill-blanks', 'scramble', 'grammar']);
    // 12 words introduced, 6 of them genuinely learned.
    for (let i = 0; i < 6; i++) h.correct(`g${i}`, 'animals', 3); // learned
    for (let i = 0; i < 6; i++) h.correct(`l${i}`, 'animals', 1); // learning
    const a = pm.checkAndUnlockGames(0, 0, 0);
    const b = pm.checkAndUnlockGames(0, 0, 70); // abcMastery bump (reading still needs 10 introduced)
    return { introduced: pm.getIntroducedCount(), learned: pm.getDerivedLearnedCount(), firstCall: a, secondCall: b };
  });
  expect(next.ret).toEqual(legacy.ret);
  expect(next.state).toEqual(legacy.state);
});

test('parity: hysteresis (2-miss demotion) + spacing/due progression', async ({ page }) => {
  const { legacy, next } = await parity(page, (pm, h) => {
    h.correct('bird', 'animals', 3);           // learned
    h.wrong('bird', 'animals', 1);             // 1st slip — protected
    const afterOne = pm.getWordStatus('bird', 'animals');
    h.wrong('bird', 'animals', 1);             // 2nd — demote
    const afterTwo = pm.getWordStatus('bird', 'animals');

    h.correct('lion', 'animals', 3);           // learned, stage 0 (3d)
    h.backdate('lion', 'animals', 1);
    const due1 = pm.isWordDue('lion', 'animals');
    h.backdate('lion', 'animals', 5);
    const due5 = pm.isWordDue('lion', 'animals');
    h.correct('lion', 'animals', 1);           // correct-while-due → stage 1 (7d)
    const stage = pm.wordMastery['lion_animals'].reviewStage;
    return { afterOne, afterTwo, due1, due5, stage };
  });
  expect(next.ret).toEqual(legacy.ret);
  expect(next.state).toEqual(legacy.state);
});

test('parity: grandfathered legacy stamp + migrateToLifecycleModel', async ({ page }) => {
  const { legacy, next } = await parity(page, (pm) => {
    pm.learnedWords['fish_animals'] = { graduatedDate: '2020-01-01', journeyScore: 60, journeyCompletions: 1, reinforcedIn: [], lastPracticed: '2020-01-01' };
    pm.migrateToLifecycleModel();
    pm.graduateWord('shark', 'animals', 90);
    return {
      fishStatus: pm.getWordStatus('fish', 'animals'),
      fishGrandfathered: pm.learnedWords['fish_animals'].grandfathered,
      learnedCount: pm.getDerivedLearnedCount(),
      sharkLearned: pm.isWordLearned('shark', 'animals'),
      progressDataKeys: Object.keys(pm.getProgressData()).sort(),
    };
  });
  expect(next.ret).toEqual(legacy.ret);
  expect(next.state).toEqual(legacy.state);
});
