// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the AppManager DATA-half rewrite
 * (`src/engine/appState.ts` vs the booted legacy `window.app`).
 *
 * The legacy AppManager isn't cleanly importable (its constructor runs
 * initializeApp → auth + DOM), so — like engine-selection.spec.js — these drive
 * the REAL booted `window.app` and compare against a fresh `AppState` instance.
 * Both expose the same method names, so one scenario helper runs against either.
 *
 * Covered (the pure data surface the rewrite must reproduce byte-for-byte):
 *   getDefaultProgress, migrateUserProgress (v1/v2/v3/v4 fixtures), calculateMastery,
 *   getFilteredWordsForGame, checkMilestoneCertificates, checkGameMilestoneCertificates.
 * Certificate timestamps are normalized out (wall-clock, ms apart between runs).
 * Manager-driven side effects (updateProgress / _trackCourseActivityFromGame) are
 * not pinned here — they delegate to managers parity-tested elsewhere.
 */

const TEST_USER_ID = 'appstateparity';
const V2_PREFIX = 'v2_';

async function boot(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'S', displayName: 'S', initial: 'S', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: 'S', displayName: 'S', initial: 'S', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4 }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForFunction(() => !!window.app, null, { timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('AppState parity: data half identical to legacy AppManager', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ nextPath }) => {
    const nextMod = await import(nextPath);

    const stripTs = (certs) => certs.map(({ timestamp, ...rest }) => rest);

    // A small deterministic vocabulary bank used by getFilteredWordsForGame.
    const BANK = [
      { word: 'Dog', translation: 'כלב', category: 'animals' },
      { word: 'Cat', translation: 'חתול', category: 'animals' },
      { word: 'Red', translation: 'אדום', category: 'colors' },
      { word: 'Apple', translation: 'תפוח', category: 'food' },
    ];

    // Old-shape progress fixtures for migration (cloned per run so mutation
    // by one implementation doesn't leak into the other).
    const makeFixtures = () => ({
      v1: { version: 1, totalGamesPlayed: 3, bestScores: { vocabulary: 40 } },
      v2: { version: 2, wordMastery: { Dog_animals: { masteryLevel: 0.5 } }, bestScores: {} },
      v3: { version: 3, coins: 12, certificates: [{ id: 'c1' }], totalPoints: 50 },
      v4patch: { version: 4, bestScores: { vocabulary: 90 } }, // missing newer fields → patched
      noVersion: { totalCorrectAnswers: 7 },
    });

    const learnedFixture = {
      learnedWords: { dog_animals: { graduatedDate: '2026-01-01' }, red_colors: { graduatedDate: '2026-01-02' } },
    };

    const scenario = (mgr, setBank) => {
      // getDefaultProgress
      const def = mgr.getDefaultProgress();

      // migrateUserProgress over each fixture (mutates the fixture / mgr.userProgress)
      const fx = makeFixtures();
      const savedUP = mgr.userProgress;
      const migrated = {};
      for (const [k, v] of Object.entries(fx)) {
        mgr.userProgress = savedUP; // reset before each (v<4 path reassigns it)
        migrated[k] = mgr.migrateUserProgress(v);
      }
      mgr.userProgress = savedUP;

      // calculateMastery table
      const masteryCases = [
        null,
        { totalAttempts: 0, correctAttempts: 0, consecutiveCorrect: 0 },
        { totalAttempts: 3, correctAttempts: 3, consecutiveCorrect: 3 }, // all criteria → +0.1 cap
        { totalAttempts: 5, correctAttempts: 4, consecutiveCorrect: 1 }, // 0.8, no bonus
        { totalAttempts: 10, correctAttempts: 9, consecutiveCorrect: 2 }, // 0.9 + 0.1
        { totalAttempts: 2, correctAttempts: 2, consecutiveCorrect: 2 }, // 100% but <3 attempts
      ];
      const mastery = masteryCases.map((c) => mgr.calculateMastery(c));

      // getFilteredWordsForGame across gating buckets
      setBank(BANK);
      mgr.userProgress = { ...savedUP, learnedWords: learnedFixture.learnedWords };
      const filtered = {
        ungated: mgr.getFilteredWordsForGame('word-journey').map((w) => w.word),
        gatedWithLearned: mgr.getFilteredWordsForGame('vocabulary').map((w) => w.word),
        memoryFallsBackToBank: mgr.getFilteredWordsForGame('memory').map((w) => w.word), // <12 learned → full bank
      };
      mgr.userProgress = { ...savedUP, learnedWords: {} };
      const gatedEmpty = mgr.getFilteredWordsForGame('vocabulary');
      mgr.userProgress = savedUP;

      // Milestone certificates (deterministic increasing clock for stable order)
      const origNow = Date.now;
      let t = 1_700_000_000_000;
      Date.now = () => (t += 1000);

      mgr.userProgress = { ...savedUP, certificates: [] };
      const mWord = stripTs(mgr.checkMilestoneCertificates(25)); // first-word + explorer + master
      const mWordAgain = mgr.checkMilestoneCertificates(25); // dedup → none new

      mgr.userProgress = { ...savedUP, certificates: [] };
      const gAbc = stripTs(mgr.checkGameMilestoneCertificates('abc', 100));
      const gAbcDup = mgr.checkGameMilestoneCertificates('abc', 100); // dedup
      const gNoMatch = mgr.checkGameMilestoneCertificates('vocabulary', 100); // no game milestone

      Date.now = origNow;
      mgr.userProgress = savedUP;

      return {
        def,
        migrated,
        mastery,
        filtered,
        gatedEmptyIsArray: Array.isArray(gatedEmpty) && gatedEmpty.length === 0,
        mWord,
        mWordAgainCount: mWordAgain.length,
        gAbc,
        gAbcDupCount: gAbcDup.length,
        gNoMatchCount: gNoMatch.length,
      };
    };

    // ── Legacy run (booted window.app) ──
    const app = window.app;
    const legacyOrigBank = window.vocabularyBank;
    const legacyOrigUP = app.userProgress;
    const legacy = scenario(app, (bank) => { window.vocabularyBank = bank; });
    window.vocabularyBank = legacyOrigBank;
    app.userProgress = legacyOrigUP;

    // ── New run (src/engine/appState.ts) ──
    let nextBank = [];
    const inst = new nextMod.AppState({
      getUserId: () => 'parity-throwaway',
      vocabularyBank: () => nextBank,
    });
    inst.userProgress = { version: 4 };
    const next = scenario(inst, (bank) => { nextBank = bank; });

    return { legacy, next };
  }, { nextPath: '/src/engine/appState.ts' });

  expect(next).toEqual(legacy);
});
