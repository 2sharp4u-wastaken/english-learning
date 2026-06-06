// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b0 — characterization specs for the BRIDGE → engine contract.
 *
 * Drives the REAL src/bridge/vocabulary.ts (imported via Vite) end-to-end against
 * the booted engine, and snapshots the externally-observable contract the Slice
 * 4.4.b rewrite must preserve: the begin-session result shape, the wordMastery
 * mutation on a recorded answer, the score, and the resumable gameState round-trip.
 * These are implementation-agnostic — they pin WHAT the engine produces, not how.
 *
 * Slice 4.6: the pure `getDefaultProgress` v4-schema check moved to the in-process
 * Vitest unit test `src/engine/__tests__/appState-progress.test.ts` (no browser
 * needed). What remains here is the genuinely integration-level bridge flow, which
 * stays in Playwright against the real running app + loaded content. The engine is
 * reached via the DEV-only `window.__engine` handle that Slice 4.6 introduced in
 * place of the previous production-looking engine globals.
 */

const TEST_USER_ID = 'bridgesmoke';
const V2_PREFIX = 'v2_';

async function boot(page) {
  await page.goto('/');
  await page.evaluate(({ userId, prefix }) => {
    localStorage.setItem('users', JSON.stringify({
      [userId]: { id: userId, name: 'B', displayName: 'B', initial: 'B', password: null, created: new Date().toISOString(), lastLogin: null },
    }));
    localStorage.setItem('currentUser', userId);
    localStorage.setItem('currentSession', JSON.stringify({ userId, userName: 'B', displayName: 'B', initial: 'B', authenticated: true, loginTime: Date.now(), lastActivity: Date.now() }));
    localStorage.setItem(`${prefix}userProgress_${userId}`, JSON.stringify({ version: 4 }));
  }, { userId: TEST_USER_ID, prefix: V2_PREFIX });
  await page.reload();
  await page.waitForFunction(() => !!(window.__engine?.gm && window.__engine?.gm.scoreManager && window.__engine?.gm.progressManager && window.__engine?.app), null, { timeout: 6000 });
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('vocabulary bridge: begin → recordAnswer → saveState contract', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const gm = window.__engine?.gm;
    // Bypass the learned-word gate so a fresh user has a playable pool.
    gm.settings = { ...(gm.settings || {}), gameUnlockOverride: true };
    gm.loadGameData();

    const vb = await import('/src/bridge/vocabulary.ts');

    // ── begin ──
    const begin = vb.beginVocabularySession({ fresh: true });
    if (begin.kind !== 'ready') return { beginKind: begin.kind };
    const q0 = begin.questions[0];

    // Snapshot mastery BEFORE answering.
    const keyOf = (q) => `${q.word.toLowerCase()}_${q.category}`;
    const masteryBefore = gm.progressManager.wordMastery[keyOf(q0)] ?? null;
    const scoreBefore = gm.scoreManager.getScore('vocabulary');

    // ── recordAnswer (correct) ──
    const outcome = vb.recordVocabularyAnswer(q0, q0.correct);

    const stats = gm.progressManager.wordMastery[keyOf(q0)];
    const saved = gm.loadGameState('vocabulary');

    return {
      beginKind: begin.kind,
      total: begin.total,
      questionsLen: begin.questions.length,
      resumeIndex: begin.resumeIndex,
      firstQOptionsLen: Array.isArray(q0.options) ? q0.options.length : -1,
      correctInRange: q0.correct >= 0 && q0.correct < (q0.options?.length ?? 0),
      masteryBefore,
      outcome,
      statsAfter: stats ? { totalAttempts: stats.totalAttempts, correctAttempts: stats.correctAttempts, masteryIsNumber: typeof stats.masteryLevel === 'number' } : null,
      scoreBefore,
      scoreAfter: gm.scoreManager.getScore('vocabulary'),
      savedShape: saved ? { idx: saved.currentQuestionIndex, hasQuestions: Array.isArray(saved.shuffledQuestions) && saved.shuffledQuestions.length > 0, score: saved.score } : null,
    };
  });

  expect(r.beginKind).toBe('ready');
  expect(r.questionsLen).toBe(r.total);
  expect(r.total).toBeGreaterThanOrEqual(4);
  expect(r.resumeIndex).toBe(0);
  expect(r.firstQOptionsLen).toBeGreaterThanOrEqual(2);
  expect(r.correctInRange).toBe(true);

  expect(r.masteryBefore).toBeNull(); // never seen before this session
  expect(r.outcome).toEqual({ isCorrect: true, pointsAwarded: 10 });
  expect(r.statsAfter).toEqual({ totalAttempts: 1, correctAttempts: 1, masteryIsNumber: true });
  expect(r.scoreBefore).toBe(0);
  expect(r.scoreAfter).toBe(10);

  // gameState is persisted so a refresh resumes at the next question with the score carried.
  expect(r.savedShape).toEqual({ idx: 1, hasQuestions: true, score: 10 });
});

test('vocabulary bridge: a wrong answer records an attempt but awards no points', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const gm = window.__engine?.gm;
    gm.settings = { ...(gm.settings || {}), gameUnlockOverride: true };
    gm.loadGameData();
    const vb = await import('/src/bridge/vocabulary.ts');
    const begin = vb.beginVocabularySession({ fresh: true });
    if (begin.kind !== 'ready') return { beginKind: begin.kind };
    const q0 = begin.questions[0];
    const wrongIndex = (q0.correct + 1) % q0.options.length;
    const outcome = vb.recordVocabularyAnswer(q0, wrongIndex);
    const stats = gm.progressManager.wordMastery[`${q0.word.toLowerCase()}_${q0.category}`];
    return { outcome, score: gm.scoreManager.getScore('vocabulary'), totalAttempts: stats.totalAttempts, correctAttempts: stats.correctAttempts };
  });
  expect(r.outcome).toEqual({ isCorrect: false, pointsAwarded: 0 });
  expect(r.score).toBe(0);
  expect(r.totalAttempts).toBe(1);
  expect(r.correctAttempts).toBe(0);
});
