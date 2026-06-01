// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the GameManager DATA-half rewrite
 * (`src/engine/gameManager.ts` vs the booted legacy `window.gameManager`).
 *
 * The legacy GameManager isn't cleanly importable (it attaches to window +
 * side-effects in its ctor + setTimeout), so — like engine-selection.spec.js —
 * these drive the REAL booted `window.gameManager` and compare against a fresh
 * `GameManager` instance. Both runs use IDENTICAL injected state (stub managers,
 * a fixed gameData/bank, a deterministic clock), so the deterministic surface is
 * deep-equal. Randomized methods (smartQuestionSelection / improvedShuffle /
 * getWordJourneyWords) are pinned by their RNG-INDEPENDENT invariants — exact
 * order wouldn't survive a reimplementation that consumes randomness differently
 * (the structural invariants are the real cross-implementation contract).
 */

const TEST_USER_ID = 'gmparity';
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
  await page.waitForFunction(() => !!window.gameManager, null, { timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('GameManager parity: data half identical to legacy GameManager', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ nextPath }) => {
    const nextMod = await import(nextPath);

    // ── Fixtures shared by both runs ──
    const BANK = [
      { word: 'Dog', translation: 'כלב', hebrew: 'כלב', category: 'animals' },
      { word: 'Cat', translation: 'חתול', hebrew: 'חתול', category: 'animals' },
      { word: 'Elephant', translation: 'פיל', hebrew: 'פיל', category: 'animals' },
      { word: 'Red', translation: 'אדום', hebrew: 'אדום', category: 'colors' },
      { word: 'Apple', translation: 'תפוח', hebrew: 'תפוח', category: 'food' },
    ];
    const VOCAB_POOL = [
      { word: 'Dog', category: 'animals', options: [{ word: 'a' }, { word: 'b' }] },
      { word: 'Cat', category: 'animals', options: [] },
      { word: 'Elephant', category: 'animals', options: [] }, // length 8 > maxLen 7
      { word: 'Red', category: 'colors', options: [] },
      { word: 'Apple', category: 'food', options: [] },
    ];

    const makeStubManagers = () => {
      const masteryMap = { dog_animals: 0.3, cat_animals: 0.9, red_colors: 0 };
      const progressManager = {
        learnedWords: { dog_animals: { graduatedDate: '2020-01-01', journeyScore: 80 }, red_colors: {} },
        getWordStats: (w, c) => {
          const key = `${String(w).toLowerCase()}_${c}`;
          return key in masteryMap ? { masteryLevel: masteryMap[key], totalAttempts: 4, correctAttempts: 3 } : null;
        },
        isWordDue: () => false,
        isWordLearned: (w, c) => `${String(w).toLowerCase()}_${c}` in { dog_animals: 1, red_colors: 1 },
        getIntroducedWordKeys: () => new Set(['dog_animals', 'red_colors']),
      };
      const scoreManager = { getScore: () => 70 };
      return { progressManager, scoreManager };
    };

    const FIXED_NOW = 1_700_000_000_000;

    const scenario = (gm, readUserId) => {
      const { progressManager, scoreManager } = makeStubManagers();
      gm.progressManager = progressManager;
      gm.scoreManager = scoreManager;
      gm.coinManager = null;
      gm.courseManager = null;
      gm.settings = { difficultyAutoGate: true, questionsPerGame: 10 };
      gm.selectedCategories = [];
      gm.totalQuestions = 10;
      gm.currentGame = 'vocabulary';
      gm.gameData = { vocabulary: VOCAB_POOL.map((w) => ({ ...w })) };

      // ── Tier + audio gate (deterministic) ──
      const tiers = ['word-journey', 'abc', 'listening', 'vocabulary', 'unknown'].map((g) => gm.getGameTier(g));
      const limits = ['word-journey', 'vocabulary', 'listening'].map((g) => {
        const l = gm.getAudioPlayLimit(g);
        return Number.isFinite(l) ? l : 'Infinity';
      });
      gm.resetAudioPlayCounter('vocabulary'); // limit 5
      const audioSeq = [gm.consumeAudioPlay('vocabulary'), gm.audioPlaysLeft];
      gm.audioPlaysLeft = 0;
      const audioBlocked = gm.consumeAudioPlay('vocabulary');

      // ── Difficulty gate (learnedCount=2 < 15 → maxLen 7, options check on listening) ──
      const gatedVocab = gm.applyDifficultyGate(VOCAB_POOL.map((w) => ({ ...w })), 'vocabulary').map((w) => w.word);
      const gatedListening = gm
        .applyDifficultyGate([{ word: 'Cat', category: 'animals', options: [{ word: 'aaaaaa' }, { word: 'bbbbbb' }] }], 'listening')
        .map((w) => w.word); // long opts → filtered out, but empty falls back to original
      const gateOff = gm.applyDifficultyGate(VOCAB_POOL.map((w) => ({ ...w })), 'word-journey').map((w) => w.word);

      // ── Pool scoping ──
      gm.currentTopicId = null;
      gm.currentTopicActivity = null;
      gm.currentTopicWords = [];
      const unscopedPool = gm.getScopedQuestionPool('vocabulary').map((w) => w.word);

      gm.currentTopicId = 't1';
      gm.currentTopicActivity = 'vocabulary';
      gm.currentTopicWords = [{ word: 'Dog', category: 'animals' }, 'red'];
      const scopedPool = gm.getScopedQuestionPool('vocabulary').map((w) => w.word);
      const activeTopicWords = gm.getActiveTopicWords().map((w) => w.word);
      gm.currentTopicId = null;
      gm.currentTopicActivity = null;
      gm.currentTopicWords = [];

      // ── Completion helpers ──
      gm.currentQuestionIndex = 7;
      const answered = gm.getCompletionAnsweredCount('vocabulary', 10);
      const progressPct = gm.getCompletionProgressPercent(7, 10);
      const effTotalVocab = gm.getEffectiveTotalQuestions('vocabulary');
      gm.shuffledQuestions = VOCAB_POOL.map((w) => ({ ...w }));
      const effTotalWj = gm.getEffectiveTotalQuestions('word-journey');

      // ── _getLearnedWordSet (via stub getIntroducedWordKeys) ──
      const learnedSet = [...gm._getLearnedWordSet()].sort();

      // ── Score history (localStorage append + 50-cap) ──
      // Each run writes under its own resolved user id; read back via the known id
      // so we compare the resulting array (the per-run key itself differs).
      const histKey = `${readUserId}_histgame_history`;
      try { localStorage.removeItem(histKey); } catch (e) {}
      gm.saveGameScoreToHistory('histgame', 55);
      gm.saveGameScoreToHistory('histgame', 80);
      let history = [];
      try { history = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch (e) {}

      // ── Persistence round-trip (fixed clock so timestamp matches) ──
      const origNow = Date.now;
      Date.now = () => FIXED_NOW;
      gm.isGameActive = true;
      gm.currentGame = 'vocabulary';
      gm.currentQuestionIndex = 3;
      gm.gameElapsedMs = 5000;
      gm.gameSessionStartAt = null; // sessionElapsed=0 → elapsed stays 5000
      gm.selectedCategories = ['animals'];
      gm.shuffledQuestions = VOCAB_POOL.map((w) => ({ ...w }));
      const saveOk = gm.saveGameState();
      const loaded = gm.loadGameState('vocabulary');
      const loadedNorm = loaded ? { ...loaded, timestamp: 'X' } : null;
      gm.deleteGameState('vocabulary');
      const afterDelete = gm.loadGameState('vocabulary');
      Date.now = origNow;

      // ── Randomized methods → RNG-independent invariants only ──
      const shuf = gm.improvedShuffle(VOCAB_POOL.map((w) => ({ ...w })));
      const shufIsPermutation =
        shuf.length === VOCAB_POOL.length &&
        VOCAB_POOL.every((w) => shuf.some((s) => s.word === w.word));

      gm.currentGame = 'vocabulary';
      const sel = gm.smartQuestionSelection(VOCAB_POOL.map((w) => ({ ...w })));
      const selKeys = sel.map((q) => `${q.word}_${q.category}`);
      const poolKeys = new Set(VOCAB_POOL.map((q) => `${q.word}_${q.category}`));
      const selInvariants = {
        dedup: new Set(selKeys).size === selKeys.length,
        subset: selKeys.every((k) => poolKeys.has(k)),
        underTarget: sel.length <= Math.min(VOCAB_POOL.length, 50),
      };

      gm._wjReplayMode = false;
      gm.selectedCategories = [];
      const wj = gm.getWordJourneyWords();
      const wjInvariants = {
        count: wj.length, // pace 'normal' → 5, bank has 5
        subset: wj.every((w) => BANK.some((b) => b.word === w.word)),
      };

      return {
        tiers,
        limits,
        audioSeq,
        audioBlocked,
        gatedVocab,
        gatedListening,
        gateOff,
        unscopedPool,
        scopedPool,
        activeTopicWords,
        answered,
        progressPct,
        effTotalVocab,
        effTotalWj,
        learnedSet,
        history,
        loadedNorm,
        saveOk,
        afterDelete,
        shufIsPermutation,
        selInvariants,
        wjInvariants,
      };
    };

    // ── Legacy run (booted window.gameManager) ──
    const gm = window.gameManager;
    const legacyOrigBank = window.vocabularyBank;
    const legacyOrigApp = window.app;
    // gm reads window.vocabularyBank + window.app; stub them with our fixtures.
    window.vocabularyBank = BANK;
    window.app = { userProgress: { coinHistory: [], lastSessionWordKeys: {} }, saveUserProgress: () => {} };
    const legacy = scenario(gm, 'gmparity'); // legacy resolves authService.getCurrentUserId()
    window.vocabularyBank = legacyOrigBank;
    window.app = legacyOrigApp;

    // ── New run (src/engine/gameManager.ts) ──
    const inst = new nextMod.GameManager({
      vocabularyBank: () => BANK,
      getApp: () => ({ userProgress: { coinHistory: [], lastSessionWordKeys: {} }, saveUserProgress: () => {} }),
      getUserId: () => 'gmparity-next',
    });
    const next = scenario(inst, 'gmparity-next'); // matches opts.getUserId

    return { legacy, next };
  }, { nextPath: '/src/engine/gameManager.ts' });

  expect(next).toEqual(legacy);
});
