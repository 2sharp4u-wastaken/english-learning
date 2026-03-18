# V2 Redesign Plan — Learning System Overhaul

> **Session reminder:** Say **"save progress"** before ending a session so the plan gets updated and committed.

## Project Goal
Transform the app from a collection of independent games into a guided learning system where Word Journey is the entry point for all new words, and other games are unlocked progressively as the child builds vocabulary.

## Current Status
- **Phase:** Phase 9 complete, Phase 10 next
- **Last session:** 2026-03-18 — Phase 8 Stats Overhaul and Phase 9 Completion Screen Overhaul implemented
- **Next up:** Phase 10 — Course & Certificate Rewiring

---

## Key Decisions (Settled)

### Game Tiers
| Tier | Games | Gate |
|------|-------|------|
| Learn | Word Journey, ABC | Always open |
| Practice | Listening, Picture-Match, Memory, Grammar-Beginner | Memory + Grammar-Beginner always open; Listening + Picture-Match require ≥5 learned words |
| Challenge | Reading, Pronunciation, Fill-Blanks, Scramble, Grammar | Reading: ≥10 words + ABC 60%; Pronunciation: ≥10 words; Fill-Blanks/Scramble: ≥30 words + 2 topics; Grammar: ≥50 words + 3 topics |
| Test | Vocabulary (repurposed as "Word Test") | ≥10 learned words |

### Word Graduation
- A word is "learned" after completing all 5 Word Journey stages with ≥60% accuracy across scored stages
- Learned words stored in `userProgress.learnedWords`
- Gated games only draw from learned words pool

### Vocabulary Game
- Repurposed as "Word Test" (מבחן מילים) — cold-recall mastery check
- Not removed; repositioned as final tier

### Grammar Game
- Grayed out, unlocked at ≥50 learned words + 3 topics done
- Shows lock + unlock condition text

### Practice Game
- Card removed from hub; accessible via "Practice weak words" in profile/completion screens

### Hebrew Vocalization
- Add Hebrew TTS after English word in: Listening, Reading, Pronunciation, Word Journey (Discover)
- On by default, toggleable in settings

### Home Page
- 3-tier layout (Learn / Practice / Challenge) + Test section
- "Continue Learning" hero card with recommendation logic at top
- Locked cards show 🔒 + unlock condition text

### Top Bar
- Remove 12 game buttons
- During game: back button + game name + score + coins
- On hub: home + stats + settings + coins + user

### Settings Changes
- Add: Hebrew vocalization toggle, learning pace, game unlock override, age group
- Simplify exit behavior to 2 options (auto-save default, always confirm)
- Remove: practice/competitive mode distinction, exit threshold slider
- Remove stale: showPictures, theme, autoPlay, animationSpeed

### Stats Changes
- Replace "average score" with "Words Learned" in overview
- Add per-word journey status to Words panel
- Add "Words Learned" leaderboard to Hall of Fame

### Profile Changes
- Activate "Next recommended action" card
- Replace "Topics Done" stat with "Words Learned"
- Add word collection (sticker book)
- Add milestone certificates

### Word Journey Fix
- Completion celebration screen after stage 5
- Per-word stars, coins, "words learned" count
- "Learn More Words" → fresh word selection
- Reset button → new words (not replay same)

### localStorage Isolation
- V2 uses `v2_` prefix on all storage keys to avoid collision with v1

---

## Phase Breakdown

> **Model guide:** `🟢 Sonnet` = straightforward implementation, Sonnet is fine.
> `🟡 Opus recommended` = mixed complexity, Opus preferred but Sonnet workable.
> `🔴 Opus` = design judgment, cross-cutting logic, or complex UI — use Opus.
> Claude will advise switching at each phase boundary.

### Phase 1 — Foundation (data structures, no UI changes) `🟢 Sonnet` ✅
- [x] Add `v2_` storage prefix constant and update all localStorage access (`V2_STORAGE_PREFIX` in app.js)
- [x] Add `learnedWords` structure to userProgress schema (v4 default + migration)
- [x] Add `gameUnlocks` structure to userProgress schema (v4 default + migration)
- [x] Add ProgressManager methods: `graduateWord()`, `getLearnedWords()`, `getLearnedWordCount()`, `isWordLearned()`
- [x] Add ProgressManager methods: `getGameUnlockStatus()`, `checkAndUnlockGames()`, `getCompletedTopicCount()`
- [x] Add `getFilteredWordsForGame(gameType)` in app.js — returns learned words only for gated games
- [x] Wire Word Journey completion → `graduateWord()` for qualifying words (gameLogic.js endGame)
- [x] Add Hebrew TTS chaining to speechManager (`speakWordWithTranslation()`)

### Phase 2 — Word Journey Fix `🟢 Sonnet` ✅
- [x] Add completion celebration screen after stage 5 (showCelebration in word-journey-game.js)
- [x] Show per-word star badges, coins earned, "words learned" count with gold highlight
- [x] "ללמוד עוד מילים" button → fresh word selection via gm.startGame('word-journey')
- [x] "חזור לבית" button → gm.showWelcomeScreen()
- [x] Fix word repetition: deprioritize today's graduated words in getWordJourneyWords()
- [x] Progress bar already dynamic (stageIndex/stageQuestions.length) — no change needed

### Phase 3 — Game Gating `🟢 Sonnet` ✅
- [x] Wire vocabulary, listening, picture-match, pronunciation, reading through learned-words filter
- [x] Wire fill-blanks, scramble with ≥30 learned words count gate
- [x] Handle edge case: `showLearnFirstPrompt()` shown when gated game has < 4 learned words
- [x] Vocabulary game → "מבחן מילים" (Word Test): options shown immediately, no audio requirement
- [x] Practice game already absent from hub — no change needed
- [x] Cleanup: `performGameSwitch` removes `.learn-first-prompt` on navigation

### Phase 4 — Home Page Redesign `🔴 Opus` ✅
- [x] Replace flat grid with tiered layout (Learn / Practice / Challenge / Test)
- [x] Add "Continue Learning" hero card with recommendation logic
- [x] Add lock overlay + unlock-condition text to gated cards
- [x] Dynamic card states from `gameUnlocks`
- [x] Update streak widget + add "words learned" counter

### Phase 5 — Top Bar Simplification `🔴 Opus` ✅
- [x] Remove 12 game buttons from header (+ practice button)
- [x] Add back button + game name during active games (showGameInHeader/setHeaderMode)
- [x] Move case/nikud toggles to Settings → Advanced (case toggle added, nikud already there)
- [x] Add persistent coin display to header (header-coins, wired to CoinManager)
- [x] Hide score display on hub screens, show during games only (header-hub-only class)

### Phase 6 — Settings Cleanup `🟢 Sonnet` ✅
- [x] Add Hebrew vocalization toggle (Game Settings tab) — wired to WJ Discover stage
- [x] Add learning pace setting (slow 3 / normal 5 / fast 8 words per journey) — wired to getWordJourneyWords()
- [x] Add game unlock override toggle (Advanced tab) — bypasses all 3 gate check sites + home card display
- [x] Simplify exit behavior to 2 options (autosave default, always confirm)
- [x] Remove exit threshold slider, auto-save toggle (always on), exit toast toggle
- [x] Remove practice/competitive mode distinction from categories tab
- [x] Fix settings bridge: SettingsManager now writes to both `englishLearningSettings` + `v2_englishLearningSettings`; GameManager merges both on init

### Phase 7 — Profile Expansion `🟡 Opus recommended` ✅
- [x] Activate "Next recommended action" card with priority-based logic (WJ → new games → course → default)
- [x] Add word collection (sticker book) view — gallery of learned words with emoji, word, translation
- [x] Add learning progress bar with 6 levels (מתחיל → חוקר → לומד מיומן → מומחה → אלוף → אגדה)
- [x] Replace "Topics Done" with "Words Learned" in stats grid
- [x] Add milestone certificates (First Word/1, Explorer/10, Master/25, Champion/50, Legend/100) — auto-awarded on graduation
- [x] Add unlocked games display (always-open vs gated, lock icons)
- [x] Add weekly activity calendar (7-day dot row, tracked via activityDates in userProgress)

### Phase 8 — Stats Overhaul `🟢 Sonnet` ✅
- [x] Add "Words Learned" to Overview hero tile
- [x] Add per-word journey status to Words panel (which stages done)
- [x] Add category completion view ("Animals: 12/20 mastered")
- [x] Add learning velocity ("X words per week")
- [x] Add "Words Learned" leaderboard to Hall of Fame
- [x] Add time spent learning metric

### Phase 9 — Completion Screen Overhaul (all games) `🔴 Opus` ✅
- [x] Expand `.game-complete` to show word mastery progress per word
- [x] Add "Next recommended game" button
- [x] Add coins earned animation
- [x] Variable progress bar based on actual question count
- [x] Adjust audio play limits per tier (Learn: unlimited, Practice: 8, Challenge: 5)

### Phase 10 — Course & Certificate Rewiring `🔴 Opus`
- [ ] Wire `completeActivity()` from ALL games (not just course-launched)
- [ ] Add `getNextRecommendedActivity()` to CourseManager
- [ ] Add milestone certificates: First Word, Word Explorer (10), Word Master (25), Word Champion (50), ABC Hero, Sentence Builder, Perfect Listener
- [ ] Ensure topic completion works across free-play and course-launched games
- [ ] Course-level unlock requirements enforced in UI

### Phase 11 — New Games (optional, post-core) `🟡 Opus recommended`
- [ ] "True or Not?" (נכון או לא?) — picture + word match yes/no
- [ ] "Word Builder" (בונה משפטים) — drag words from bank to complete sentences
- [ ] "Story Time" (זמן סיפור) — highlighted text read-along with learned words

---

## Data Structure Specs

### learnedWords (in userProgress)
```js
learnedWords: {
  "dog_animals": {
    graduatedDate: "2026-03-15",
    journeyScore: 85,
    journeyCompletions: 1,
    reinforcedIn: ["listening", "picture-match"],
    lastPracticed: "2026-03-15"
  }
}
```

### gameUnlocks (in userProgress)
```js
gameUnlocks: {
  "word-journey": { unlocked: true, unlockedDate: null },
  "abc": { unlocked: true, unlockedDate: null },
  "listening": { unlocked: false, requirement: "5 learned words", requiredCount: 5 },
  "grammar": { unlocked: false, requirement: "50 learned words + 3 topics", requiredCount: 50, requiredTopics: 3 },
  // ...
}
```

### Gate evaluation logic
```js
checkAndUnlockGames() {
  const learned = getLearnedWordCount();
  const topicsDone = getCompletedTopicCount();
  const abcMastery = getAbcMastery();
  // evaluate each gate, update gameUnlocks, return newly unlocked list
}
```

---

## Open Questions
- Should Memory game filter to learned words or stay as full-vocabulary daily fun? (Current decision: no filter)
- Should Word Journey allow replaying already-graduated words for extra practice? (Leaning: yes, but prioritize unlearned)
- Exact visual design for locked cards and tier sections — decide during Phase 4

---

## Session Log
| Date | Session | Work Done |
|------|---------|-----------|
| 2026-03-16 | 1 | Full audit + planning. Worktree created. PLAN.md written. |
| 2026-03-16 | 2 | Phase 1 complete: v2_ prefix, learnedWords+gameUnlocks schema (v4), ProgressManager graduation/unlock methods, getFilteredWordsForGame, WJ completion hook, speakWordWithTranslation. |
| 2026-03-16 | 3 | Phase 2 complete: showCelebration() in word-journey-game.js, endGame() delegated for WJ, today's graduated words deprioritized in getWordJourneyWords(), celebration CSS added. |
| 2026-03-16 | 4 | Phase 3 complete: game gating for vocab/listening/picture-match/pronunciation/reading (learned word filter), fill-blanks/scramble (≥30 count gate), showLearnFirstPrompt(), vocabulary renamed "מבחן מילים" with cold-recall (options shown immediately), cleanup on navigation. |
| 2026-03-16 | 5 | Phase 4 complete: tiered home layout (Learn/Practice/Challenge/Test sections), Continue Learning hero card with dynamic recommendation logic, card-lock-overlay with gate text for locked games, words-learned counter in hero row, updateHomeCardStates() refreshes on every welcome screen show. |
| 2026-03-16 | 6 | Phase 5 complete: removed 12 game buttons + practice from header, added back-button + game-name display during active games (setHeaderMode hub/game), persistent coin display (header-coins wired to CoinManager), score hidden on hub / shown in games, case toggle moved to Settings → Advanced (lowercase toggle synced with caseManager), nikud toggle removed from header (already in settings). |
| 2026-03-18 | 7 | Phase 6 complete: Hebrew vocalization toggle (wired to WJ Discover TTS), learning pace radio (3/5/8 words), game unlock override toggle (bypasses all gates + home card), simplified exit to 2 options, removed threshold/auto-save/toast controls, removed practice/competitive mode UI, fixed settings bridge (SettingsManager now writes v2_ key; GameManager merges ls+app settings). |
| 2026-03-18 | 8 | Phase 7 complete: Profile Expansion — replaced Topics Done with Words Learned stat, 6-level learning progress bar, priority-based recommendation card (WJ→new games→course→default), word collection sticker book (emoji+word+translation grid), unlocked games display (open vs locked), weekly activity calendar (7-day dots with activityDates tracking), milestone certificates (1/10/25/50/100 words, auto-awarded on graduation). |
| 2026-03-18 | 9 | Phase 8 complete: Stats Overhaul — added Words Learned overview metric, per-word Word Journey status, category completion view, learning velocity, time spent learning, and Hall of Fame leaderboard based on learned words; shared progress now persists total learning time and per-word journey progress for stats. |
| 2026-03-18 | 10 | Phase 9 complete: Completion Screen Overhaul — expanded completion screens with per-word mastery cards, animated coins earned, variable progress bar, next recommended action, Memory completion parity, and tier-based audio play limits (Learn unlimited, Practice 8, Challenge/Test 5); PLAN.md status synced. |
