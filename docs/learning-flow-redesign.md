# Learning Flow Redesign — Mastery-Driven Word Lifecycle

> **Status:** Design approved (core decisions). Not yet implemented.
> **Date:** 2026-05-24
> **Supersedes:** the graduation/gating model described in `docs/learning-path.md`
> (that doc describes the *current* behavior; this doc describes the *target* and
> will be folded back into it once built).
> **Trigger:** surfaced while planning the Slice 3.13 Word Journey React port —
> the port exposed two design leaks worth fixing before freezing a React baseline.

---

## 1. Why we're changing the learning model

The app keeps **two independent scorecards per word**, and only the weaker one
drives the experience:

- **Scorecard A — `wordMastery[key]` (accurate).** Updated on *every* answer in
  *every* game via `ProgressManager.recordWordAttempt` (`managers/ProgressManager.js:67`).
  Tracks attempts, correct/incorrect, consecutive-correct streak, and a
  `masteryLevel` (0–1) with an explicit `mastered: 0.8` threshold
  (`ProgressManager.js:15`). This is an honest, per-word, always-current signal.

- **Scorecard B — `learnedWords[key]` (gatekeeper).** A binary "graduated" stamp.
  It is the **only** thing that decides which words and games the child can
  access. It is written in exactly one place: `graduateWord` (`ProgressManager.js:501`),
  called only from Word Journey's `endGame` (`gameLogic.js:3005`) **if the batch
  averages ≥60%**, which graduates *every* word in the batch at once.

### The three cracks

1. **The accurate scorecard is ignored; the crude one runs everything.** The app
   may *know* a child has 20% mastery on a word (Scorecard A) yet treat it as fully
   "learned" because it rode a lucky batch (Scorecard B).
2. **"Learned" is a batch lie.** All-or-nothing at 60% *batch average* means a word
   the child failed at every stage still graduates on the strength of its
   batchmates. "Learned" does not mean "this child knows this word."
3. **Nothing is ever forgotten or re-reviewed.** `lastPracticed` / `lastSeen` are
   recorded but never read. No spacing, no decay, no "due for review." Once stamped,
   a word is learned forever — the exact opposite of how vocabulary retention works.

A consequence of cracks 1–2: the review games (listening, picture-match,
pronunciation, …) faithfully update Scorecard A, but **that signal feeds nothing
structural** — those games are effectively consequence-free busywork.

---

## 2. The target model — a derived word lifecycle

Replace the binary stamp with a **lifecycle status that is *derived* from the
accurate scorecard**. Status is never stored as a separate source of truth; it is
computed from `wordMastery[key]`:

```
New        → no wordMastery entry (or 0 attempts)
Learning   → introduced, masteryLevel < 0.8 (or not yet stable)
Learned    → masteryLevel ≥ 0.8 AND totalAttempts ≥ 3 AND consecutiveCorrect ≥ 2
Due        → Learned AND (today − lastSeen) ≥ the word's current review interval
```

(`0.8`, `3`, `2` are the existing `this.thresholds.mastered`, `minAttempts`,
`consecutiveForMastery` — we reuse them, we don't invent new numbers.)

Because Word Journey already calls `recordWordAttempt` per word in every scored
stage, and the review games do too, **all four approved decisions fall out of this
one mechanism for free:**

- **Per-word graduation** — a word's status reflects *that word's* performance,
  never the batch average.
- **Two-step promotion** — Word Journey rarely pushes a word all the way to 0.8 on
  first encounter, so it lands words in **Learning**; the review games are what
  promote **Learning → Learned**.
- **Mastery as source of truth** — the binary `learnedWords` stamp is retired;
  status is a pure function of `wordMastery`.
- **Light spacing + gentle decay** — see §6. Status is derived from `masteryLevel`,
  so missing words lose mastery; a small **2-miss hysteresis** keeps a freshly
  Learned word from flickering back to Learning on a single slip (demote only after
  two consecutive misses; a correct answer in between forgives).

### Approved decisions (this redesign)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Per-word graduation | **Yes** |
| 2 | Two-step promotion (WJ → Learning, review → Learned) | **Yes** |
| 3 | Light spacing / forgetting | **Yes** (gentle; intervals in §6) |
| 4 | Derive status from mastery; retire the binary stamp | **Yes** |
| 5 | Tiered unlocks (review games gate on *introduced*, consolidation on *Learned*) | **Yes** |
| 6 | Grandfather existing `learnedWords` as Learned (no access regression) | **Yes** |

---

## 3. The trap the redesign must design around

If "Learned" is now *earned through the review games*, but the review games are
gated to only show already-Learned words (today's `VOCAB_GATED_GAMES` filter,
`gameLogic.js:2212`), then a **Learning** word can never appear anywhere to be
promoted. Chicken-and-egg.

**Resolution:** the review games must practice the **Learning** pool (plus any
**Due** Learned words), not the Learned-only pool. Review *is* the promotion path.
This is the structural change that finally gives the other games a purpose.

This splits the roster into two tiers by the kind of knowledge each game needs:

| Game | Today unlocks at | New unlocks at | Practices which pool |
|------|------------------|----------------|----------------------|
| **Word Journey, ABC** | always | always | introduces **New** words |
| Listening, Picture Match, True or Not | 5 learned | **5 introduced** | **Learning** (+ Due) |
| Vocabulary, Pronunciation, Reading¹ | 10 learned | **10 introduced** | **Learning** (+ Due) |
| Memory | always (≥12 learned for word mode) | always (**≥12 introduced** for word mode) | **Learning** + **Learned** |
| Grammar Beginner | always | always | n/a (not vocab-gated) |
| Story Time | 15 learned | **15 Learned** | **Learned** |
| Fill Blanks, Sentence Scramble | 30 learned + 2 topics | **30 Learned** + 2 topics | **Learned** |
| Grammar | 50 learned + 3 topics | **50 Learned** + 3 topics | **Learned** |
| Word Test | 10 learned | **10 Learned** | **Learned** (cold recall) |

¹ Reading keeps its additional `abcMastery ≥ 60` gate.

**Numbers are deliberately unchanged.** Early pacing feels identical to today; the
only change is *which counter* a gate reads. The effect:

- **Easy review games open on "words introduced"** — the child always has a way to
  *promote* their Learning words. No dead end.
- **Hard consolidation games open on "words genuinely Learned"** — you can no longer
  luck your way into Grammar; you earn it by actually mastering words through review.

Definitions for the gate counters (excluding `category === 'abc'` letter entries):

- **introducedCount** = words with a `wordMastery` entry and `totalAttempts > 0`.
- **learnedCount** (new meaning) = words whose derived status is **Learned**.

---

## 4. Word Journey's new role

Word Journey stops being the *verdict* and becomes the **first encounter**:

- Its five stages still run and still call `recordWordAttempt` per word per stage,
  so each word leaves Word Journey with a real, per-word mastery score reflecting
  how the child actually did across discover → listen → spell → say → recall.
- A word the child nails across stages may reach **Learned** within Word Journey
  alone; a word they fumble stays **Learning** and will surface in the review games.
- **`graduateWord` and the batch-≥60% rule are removed.** No batch graduation.
- The celebration screen changes its language from "X words learned!" to something
  honest about the batch (e.g. "you practiced N words — keep playing to master
  them!"), and can show each word's status (Learning vs Learned). Exact copy is an
  open item (§9).
- The Practice/replay mode ("practice learned words") still exists; it now pulls
  from **Learned + Due** words.

`recordJourneyStageCompletion` / `wordJourneyProgress` (the per-word per-stage
record that is currently *written but never read*, `ProgressManager.js:565`) can
either be (a) retired, or (b) kept and surfaced in the Stats → Words tab (which
already claims to show "Word Journey stage progress"). Recommendation: keep writing
it, surface it read-only in stats; do not use it for gating (mastery already does
that). Decided as part of build, low-risk either way.

---

## 5. What changes for each game's word selection

Two gating concerns per game, kept separate:

- **Availability gate** — *is the game unlocked?* (the table in §3).
- **Pool filter** — *which words does it draw from once open?*

Pool filter changes (`gameLogic.js` `getScopedQuestionPool` + `VOCAB_GATED_GAMES`
filter at ~`gameLogic.js:2212`, and the mirrored filters in `src/bridge/*.ts`):

- **Review tier** (listening, picture-match, true-or-not, vocabulary, pronunciation,
  reading): filter pool to **Learning ∪ Due** words. `smartQuestionSelection` is
  extended to **prioritize Due words first**, then Learning words with the lowest
  mastery (most in need of practice).
- **Consolidation tier** (story-time, fill-blanks, scramble, grammar): filter pool
  to **Learned** words (Due ones included — practicing them is good).
- **Memory**: Learning ∪ Learned (word mode when ≥12 introduced; otherwise its
  current standalone behavior).
- **`gameUnlockOverride`** (parent bypass) still short-circuits both gates exactly
  as today.

---

## 6. Light spacing & automatic decay

Goal: words resurface for review *before* they're forgotten — gently, not a full SRS.

- Each Learned word gets a **review interval** that grows as it survives reviews.
  Proposed curve (tunable, §9): **3 days → 7 → 14 → 30**, indexed by a per-word
  `reviewStage` counter incremented each time the word is answered correctly while
  Due.
- A Learned word becomes **Due** when `today − lastSeen ≥ interval`.
- **Due words are prioritized** in review-tier selection and are the primary fuel
  for the **Practice game** (Slice 3.16), which becomes the dedicated "review what's
  slipping" surface.
- **Decay with 2-miss hysteresis.** Status is derived from `masteryLevel`, so missed
  reviews lower accuracy. To avoid a discouraging flicker, a word that has reached
  Learned stays Learned through a single slip and is **demoted to Learning only after
  two consecutive misses** (a correct answer in between resets the lapse counter).
  Implemented via `reachedLearned` + `lapses` on the mastery entry
  (`recordWordAttempt`). A word never falls all the way back to **New** (kindness:
  introduced is forever). Grandfathered words are sticky-Learned and never demote.

Implication: `lastSeen` (already recorded) finally gets *read*. We add a small
`reviewStage` field per word (or derive interval from a review-count we already
have). No heavy scheduler.

---

## 7. Migration & backward compatibility (must not regress access)

Existing children already have words stamped under the old lucky-batch rule, and
existing `gameUnlocks`. We must **not** yank away games a child already had.

- **Grandfather:** on first load under the new model, every word currently in
  `learnedWords` is treated as **Learned** going forward (seed/keep its status),
  regardless of its `masteryLevel`. Existing `gameUnlocks` entries stay unlocked.
- New rules (per-word promotion, spacing, tiered gates) apply **prospectively** to
  new words and to ongoing review.
- Existing `wordMastery` is already populated, so derived status works immediately
  for everything the child has touched.
- This is a one-time, idempotent migration in `ProgressManager.initialize` /
  `getProgressData`. No data is destroyed; `learnedWords` may be retained as a
  "grandfathered + currently-derived-Learned" union for counting, or fully replaced
  by the derived set — decided at build time, but the *grandfather guarantee* is
  fixed.

---

## 8. Impact on the rest of the progress mechanics

Retiring/redefining "learned" ripples beyond the games. Each is addressed so the
child's sense of progress does **not** stall, even though "Learned" is now harder:

- **Give visible credit for "Learning."** Because reaching Learned now takes review,
  raw "words learned" would climb slower than before. To keep momentum visible:
  - **Word Collection (sticker book):** show **Learning** words as in-progress
    (faded / partial sticker) and **Learned** as full stickers. The child sees every
    word they've met, with a clear "fill it in by playing" affordance.
  - **Learning Levels (6 levels, מתחיל→אגדה):** count **introduced** words (optionally
    weighting Learned higher) so leveling reflects effort, not just final mastery.
    Prevents a progress freeze. Exact weighting is an open item (§9).
  - **Certificates (1/10/25/50/100):** split or relabel — milestones for *words met*
    vs *words mastered*. Grandfathered users keep already-earned certificates.
- **Profile stats** already shows both "words learned" and "words mastered"
  (`docs/learning-path.md` §Profile). These now map cleanly:
  **"words learned" → introduced count**, **"words mastered" → Learned count.**
- **Stats → Words tab** already buckets struggling/learning/mastered from
  `masteryLevel` — this becomes the canonical view and needs little change beyond
  adding a **Due** indicator.
- **Continue recommendation engine** (`getContinueTarget`, `src/bridge/games.ts` +
  legacy `getCompletionRecommendation`): new priority order becomes
  **(1) review Due words → (2) promote Learning words in an unlocked review game →
  (3) introduce new words via Word Journey → (4) try a newly unlocked game.**
- **Memory game:** its "≥12 learned words" word-mode threshold reads **introduced**
  instead of learned.
- **Word Test:** stays gated on **Learned** (cold recall should test real mastery).
- **Courses / topic progress:** unaffected structurally; topic completion still
  feeds the `topicsDone` gate on the consolidation tier.
- **Coins:** unchanged. Review games already award coins; they now also matter
  pedagogically, which is a pure win.

---

## 9. Decisions & remaining open questions

**Decided (2026-05-24):**

- **Spacing curve = 3 → 7 → 14 → 30 days** (growing intervals; last bucket repeats).
  Implemented in step 2.
- **Demotion = 2-miss hysteresis** (a single slip is forgiven; demote only after two
  consecutive misses). Implemented in step 2.
- **`learnedWords` storage = grandfather-union** (read-time; not destructively migrated).
  Implemented in step 2.
- **Review-tier pacing = unlock at 5 introduced** (first review tier opens after one
  Word Journey; higher tiers stay staggered at 10/15/30/50). Kept as-is.
- **Word Journey celebration = animated per-journey learned-words summary** — recap the
  ~3–8 words just practiced, each animating in with its **picture + audio**, tagged with
  its new status (✓ נלמד / ⏳ לומד). Not the whole collection; just this journey's batch.
- **Newly-unlocked-games modal = app-wide** — a modern animated modal that shows the
  game card(s) that just opened, then lands on Home highlighting them. Fires after **any**
  game whose completion newly unlocks something (review games promote words too, so this
  is not Word-Journey-only). Driven by `checkAndUnlockGames`'s returned `newlyUnlocked`.

**Still open (lower priority, step 6 — do not block step 4):**

- **Level/certificate recalibration** — weighting of introduced vs Learned so progression
  feels good and grandfathered users aren't surprised.
- **`wordJourneyProgress`** — retire vs surface read-only in Stats → Words.

---

## 10. Build sequencing

This is a **progression-model phase** that lands *before* the Word Journey React
port; the port then rides on the new model.

1. **This design doc** ✅ (review & approve).
2. **Progress-model refactor** ✅ (`managers/ProgressManager.js`): derived lifecycle
   helpers (`getWordStatus`, `isWordIntroduced`/`getIntroducedCount`,
   `getDerivedLearnedCount`, `getLifecycleCounts`, `getWordsByStatus`, `getDueWords`),
   spacing intervals + `reviewStage`, 2-miss demotion hysteresis (`reachedLearned`/
   `lapses`), read-time grandfather + idempotent `migrateToLifecycleModel`. Covered by
   `tests/learning-lifecycle.spec.js` (drives the real module in-browser).
3. **Re-tier gates & repoint review pool** ✅ — `checkAndUnlockGames` now gates the
   review tier on `getIntroducedCount` and the consolidation tier on
   `getDerivedLearnedCount`; `GameManager._getLearnedWordSet()` now returns the
   *introduced* set (`getIntroducedWordKeys`), repointing all five VOCAB-gated review
   bridges + legacy true-or-not in one change; `true-or-not.ts` count gate switched to
   introduced. Grandfather no-regression test included. **⚠️ LIVE GAP (do in step 5):**
   consolidation games (`story-time`, `fill-blanks`, `sentence-scramble`, `grammar`)
   still read the raw `learnedWords` stamp for their in-bridge learn-first gate +
   content, and "words learned" displays (`progress.ts`, certificates, Word Collection,
   `games.ts` Continue) read it too. **Step 4 stopped writing that stamp (React WJ does
   not call `graduateWord`), so for NEW users the stamp is frozen → those gates/displays
   break.** Existing/grandfathered users are unaffected. Repoint all of them to
   `getDerivedLearnedCount`/`getLearnedWordKeys`. **Do not merge to main before this.**
4. ✅ **Word Journey React port** (the original Slice 3.13) against the new model — shipped 2026-05-24:
   5 stages, custom celebration, practice mode, **no batch graduation, no
   mid-journey resume** (justified: graduation is now per-word/continuous, so an
   abandoned journey still banks per-word mastery for the stages played). The
   **spell stage** must reuse the shared `SpellingComparison` (correct word + the
   child's attempt, per-letter green/red) on a wrong answer and **voice the
   correct word on a correct answer** — same treatment already shipped for the
   Reading game (`SpellingComparison` + word TTS on correct). The **celebration**
   becomes an **animated per-journey learned-words summary**: each of this journey's
   ~3–8 words animates in with its picture + audio, tagged with its new status
   (✓ נלמד / ⏳ לומד) — not the whole collection.
5. ✅ **Repoint pools + prioritize Due** — consolidation bridges (story-time, fill-blanks,
   sentence-scramble) + learned-count displays now read derived counts (closed the
   stamp regression); `smartQuestionSelection` has a top-priority `due` bucket. Practice
   (Slice 3.16) gets its Due wiring when migrated; review games are covered now.
6. ✅ **App-wide "newly unlocked games" modal** — `queuePendingUnlocks`/`takePendingUnlocks`
   (sessionStorage) fed by `finishWordJourney` + a generalized post-completion unlock
   re-check in `gameLogic.endGame`; `NewlyUnlockedModal` pops on the next Home mount.
7. ◑ **Mechanics polish** — DONE: profile "words learned" → introduced & "mastery" →
   Learned (§8 mapping) + level tracks introduced; Word Collection repointed to the
   derived set (no longer empties under V3); Continue engine reordered (Due → Word
   Journey); Stats "🔁 לחזרה" Due badge. **DEFERRED:** certificate track recalibration
   (split "words met" vs "mastered" milestones) + milestone certs firing on React WJ —
   genuine product decision, not yet made; `back.png` runtime emoji (needs manual check).

---

## 11. Acceptance criteria

- A word's status is computed from `wordMastery`; no code reads a standalone binary
  "learned" flag for gating (except the grandfather seed).
- Failing a word in Word Journey does **not** mark it Learned; nailing a word across
  stages can.
- A Learning word appears in review games and, after enough correct review answers,
  becomes Learned and starts counting toward the consolidation-tier gates.
- A Learned word left untouched past its interval becomes Due, is prioritized in
  review/Practice, and reverts to Learning only after two consecutive misses.
- Existing users keep every game they had unlocked and every word they had learned
  (grandfather), verified by a migration test on real saved-progress shapes.
- Unlock numbers (5/10/15/30/50 + topic gates) are unchanged; only the counter
  meaning (introduced vs Learned) differs per tier.
- RTL, audio, scoring, and coin parity preserved in the Word Journey React port.

## 12. Handoff — remaining work & loose ends (updated 2026-05-24)

All code committed on `v3-react-migration` (not merged). **Steps 1–7 implemented.**
The critical stamp regression is **closed** (step 5). What's left:

**🟡 Genuine product decision (not yet made) — certificates & level recalibration
(part of step 7).** The level now tracks *introduced*, and "words learned"/"mastery"
map to introduced/Learned (§8). NOT done: splitting the milestone-certificate tracks
("words met" vs "words mastered"), and **milestone certs do not fire on React Word
Journey completion** (`finishWordJourney` doesn't call `checkMilestoneCertificates`).
Needs a decision on cert thresholds/tracks before wiring. `wordJourneyProgress`
retire-vs-surface also still open (harmless either way).

**🟡 Verification gaps (built, not human-tested):** Word Journey recall 3D flip, slot
interaction, say-word recording, celebration animation/audio; per-word graduation
surfacing (✓נלמד/⏳לומד); the new unlock modal, Word Collection (now derived), Stats
Due badge, and Continue reorder. No E2E for say-word/recall/celebration (needs a
`webkitSpeechRecognition` stub — same gap as Slice 3.11). Automated coverage:
`learning-lifecycle`, `wj-step1`, `unlock-modal`, `react-routes` Slice 3.5, gate tests.

**⚪ Unconfirmed:** `back.png` shows the emoji fallback in-app; `body.js` corruption was
cleaned and the file+data verified correct, but the runtime cause (likely a stale
`wordImageOverrides` entry from a prior in-app upload, or a cache) was NOT confirmed.

**✅ Done this effort:** lifecycle model + spacing + hysteresis + grandfather; tiered
gates; Word Journey React port + polish (double-audio, 3D flip, shared slot mechanic +
SpellingComparison, voice-on-correct); consolidation repoint (regression closed); Due
prioritization; unlock modal; profile/stat mapping; Word Collection repoint; Continue
reorder; Stats Due badge; docs reconciled (`learning-path.md`, this doc, `master-plan`,
`wiring-map`, `CLAUDE.md`).
