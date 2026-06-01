// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the CourseManager rewrite.
 *
 * Drives the same course-progression scenario (register → auto-unlock → activity
 * completion across thresholds → topic/course unlock cascade → free-play topic
 * inference) through legacy `managers/CourseManager.js` and new
 * `src/engine/courses.ts`, asserting the resulting userProgress + return values
 * are deep-equal.
 *
 * Two legacy ambient deps are isolated so course LOGIC is what's compared:
 *  - progressManager.calculateTopicMastery → a deterministic stub (its real parity
 *    is covered by engine-parity-progress.spec.js).
 *  - the vocabulary bank for inferTopicForActivity → legacy reads
 *    window.vocabularyBank; the new engine takes the same source via the
 *    `vocabularyBank` provider option.
 * `courses[*].startedDate` is date-only (same day → identical) so no normalization
 * is needed.
 */

const LEGACY = '/managers/CourseManager.js';
const NEXT = '/src/engine/courses.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('CourseManager parity: unlock cascade + activity completion + inference', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ legacyPath, nextPath }) => {
    const legacyMod = await import(legacyPath);
    const nextMod = await import(nextPath);

    // Fresh, identical course graph per manager (getTopic returns refs into this).
    const buildCourses = () => ([
      {
        id: 'a',
        name: 'Course A',
        nameHebrew: 'קורס א',
        units: [{
          id: 'u1',
          topics: [
            { id: 't1', activities: ['vocabulary', 'listening'], words: ['dog', 'cat', 'bird'], milestone: { scoreThreshold: 70 } },
            { id: 't2', activities: ['vocabulary'], words: ['lion'], milestone: { scoreThreshold: 70 } },
            { id: 't3', activities: ['vocabulary'], words: ['apple', 'banana', 'cherry', 'date', 'egg'], milestone: { scoreThreshold: 70 } },
          ],
        }],
      },
      {
        id: 'b',
        name: 'Course B',
        nameHebrew: 'קורס ב',
        unlockRequirement: { course: 'a', completionPercentage: 100 },
        units: [{ id: 'bu1', topics: [{ id: 'bt1', activities: ['vocabulary'], words: ['sun'] }] }],
      },
    ]);

    // Deterministic mastery stub (isolates course logic from ProgressManager).
    const pmStub = () => ({ calculateTopicMastery: (words) => (words && words.length ? 0.5 : 0) });

    const bank = [
      { word: 'apple' }, { word: 'banana' }, { word: 'cherry' }, { word: 'date' }, { word: 'egg' },
    ];
    window.vocabularyBank = bank;

    const run = (Mod, isNext) => {
      const up = { courses: {}, topicProgress: {}, certificates: [] };
      const opts = isNext ? { vocabularyBank: () => window.vocabularyBank } : undefined;
      const m = isNext
        ? new Mod.CourseManager(up, pmStub(), opts)
        : new Mod.CourseManager(up, pmStub());
      m.initialize();

      const courses = buildCourses();
      m.registerCourse(courses[0]); // first course → auto-unlocks course a + topic t1
      m.registerCourse(courses[1]); // gated on a@100% → stays locked

      const ret = {};
      ret.afterRegister = {
        aUnlocked: m.isCourseUnlocked('a'),
        bUnlocked: m.isCourseUnlocked('b'),
        t1Unlocked: m.isTopicUnlocked('t1'),
        t2Unlocked: m.isTopicUnlocked('t2'),
        stats: m.getStats(),
        reqText: m.getCourseUnlockRequirementText('b'),
        nextActivity: (() => { const n = m.getNextRecommendedActivity(); return n ? { topicId: n.topic.id, activityType: n.activityType } : null; })(),
      };

      ret.belowThreshold = m.completeActivity('t1', 'vocabulary', 50);          // < 70 → not counted
      ret.vocabAbove = m.completeActivity('t1', 'vocabulary', 80);              // counted; topic still incomplete (listening pending)
      ret.listeningAbove = m.completeActivity('t1', 'listening', 90);          // topic t1 complete → unlock t2
      ret.t1MasteryPct = m.getTopicMastery('t1');
      ret.t2UnlockedAfter = m.isTopicUnlocked('t2');

      ret.t2Complete = m.completeActivity('t2', 'vocabulary', 75);             // t2 complete → unlock t3 + course a 100% → unlock b
      ret.courseAProgress = m.getCourseProgress('a');
      ret.bUnlockedAfter = m.isCourseUnlocked('b');
      ret.t3UnlockedAfter = m.isTopicUnlocked('t3');

      // Free-play inference: 3 of t3's 5 words → coverage 0.6, matched 3 → resolves to t3.
      const inferred = m.completeGameActivity({ activityType: 'vocabulary', score: 90, sessionWords: [{ word: 'apple' }, { word: 'banana' }, { word: 'cherry' }] });
      ret.inferred = inferred ? { topicId: inferred.topicId, thresholdMet: inferred.thresholdMet, topicCompletedNow: inferred.topicCompletedNow, newlyUnlockedCourses: inferred.newlyUnlockedCourses } : null;

      // Inference miss: too few matches.
      ret.inferMiss = m.completeGameActivity({ activityType: 'vocabulary', score: 90, sessionWords: [{ word: 'apple' }] });

      ret.finalStats = m.getStats();

      return { ret, up };
    };

    return { legacy: run(legacyMod, false), next: run(nextMod, true) };
  }, { legacyPath: LEGACY, nextPath: NEXT });

  expect(next.ret).toEqual(legacy.ret);
  expect(next.up).toEqual(legacy.up);
});
