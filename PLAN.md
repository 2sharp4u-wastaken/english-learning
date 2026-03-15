# V2 Redesign Plan — Learning System Overhaul

> **Session reminder:** Say **"save progress"** before ending a session so the plan gets updated and committed.

## Project Goal
Transform the app from a collection of independent games into a guided learning system where Word Journey is the entry point for all new words, and other games are unlocked progressively as the child builds vocabulary.

## Current Status
- **Phase:** Not started
- **Last session:** 2026-03-16 — planning complete, worktree created
- **Next up:** Phase 1 — Foundation (data structures + ProgressManager methods)

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

### Phase 1 — Foundation (data structures, no UI changes)
- [ ] Add `v2_` storage prefix constant and update all localStorage access
- [ ] Add `learnedWords` structure to userProgress schema
- [ ] Add `gameUnlocks` structure to userProgress schema
- [ ] Add ProgressManager methods: `graduateWord()`, `getLearnedWords()`, `getLearnedWordCount()`, `isWordLearned()`
- [ ] Add ProgressManager methods: `getGameUnlockStatus()`, `checkAndUnlockGames()`
- [ ] Add `getFilteredWordsForGame(gameType)` — returns learned words only for gated games
- [ ] Wire Word Journey completion → `graduateWord()` for qualifying words
- [ ] Add Hebrew TTS chaining to speechManager

### Phase 2 — Word Journey Fix
- [ ] Add completion celebration screen after stage 5 (Recall)
- [ ] Show per-word stars, coins earned, "words learned" count
- [ ] "Learn More Words" button → fresh word selection (re-call getWordJourneyWords)
- [ ] "Back to Hub" button → return to welcome screen
- [ ] Fix reset button to select new words instead of replaying same
- [ ] Make progress bar dynamic (not fixed 10-question)

### Phase 3 — Game Gating
- [ ] Wire each game's word selection through `getFilteredWordsForGame()`
- [ ] Handle edge case: not enough learned words → "Learn more words first!" prompt
- [ ] Vocabulary game → reposition as "Word Test" with cold-recall mechanic (no audio hints)
- [ ] Practice game → remove from hub, accessible from profile/completion only

### Phase 4 — Home Page Redesign
- [ ] Replace flat grid with tiered layout (Learn / Practice / Challenge / Test)
- [ ] Add "Continue Learning" hero card with recommendation logic
- [ ] Add lock overlay + unlock-condition text to gated cards
- [ ] Dynamic card states from `gameUnlocks`
- [ ] Update streak widget

### Phase 5 — Top Bar Simplification
- [ ] Remove 12 game buttons from header
- [ ] Add back button + game name during active games
- [ ] Move case/nikud toggles to Settings → Advanced
- [ ] Add persistent coin display to header
- [ ] Hide score display on hub screens, show during games only

### Phase 6 — Settings Cleanup
- [ ] Add Hebrew vocalization toggle (Game Settings tab)
- [ ] Add learning pace setting (slow 3 / normal 5 / fast 8 words per journey)
- [ ] Add game unlock override toggle (Advanced, protected)
- [ ] Simplify exit behavior to 2 options
- [ ] Remove exit threshold slider, auto-save toggle (always on)
- [ ] Remove practice/competitive mode distinction from categories tab
- [ ] Clean up stale settings (showPictures, theme, autoPlay, animationSpeed)

### Phase 7 — Profile Expansion
- [ ] Activate "Next recommended action" card with logic
- [ ] Add word collection (sticker book) view — gallery of learned words
- [ ] Add learning progress bar ("12 / 50 words to next level")
- [ ] Replace "Topics Done" with "Words Learned" in stats grid
- [ ] Add milestone certificates to CertificateManager
- [ ] Add unlocked games display
- [ ] Add weekly activity calendar (dot per day played)

### Phase 8 — Stats Overhaul
- [ ] Add "Words Learned" to Overview hero tile
- [ ] Add per-word journey status to Words panel (which stages done)
- [ ] Add category completion view ("Animals: 12/20 mastered")
- [ ] Add learning velocity ("X words per week")
- [ ] Add "Words Learned" leaderboard to Hall of Fame
- [ ] Add time spent learning metric

### Phase 9 — Completion Screen Overhaul (all games)
- [ ] Expand `.game-complete` to show word mastery progress per word
- [ ] Add "Next recommended game" button
- [ ] Add coins earned animation
- [ ] Variable progress bar based on actual question count
- [ ] Adjust audio play limits per tier (Learn: unlimited, Practice: 8, Challenge: 5)

### Phase 10 — Course & Certificate Rewiring
- [ ] Wire `completeActivity()` from ALL games (not just course-launched)
- [ ] Add `getNextRecommendedActivity()` to CourseManager
- [ ] Add milestone certificates: First Word, Word Explorer (10), Word Master (25), Word Champion (50), ABC Hero, Sentence Builder, Perfect Listener
- [ ] Ensure topic completion works across free-play and course-launched games
- [ ] Course-level unlock requirements enforced in UI

### Phase 11 — New Games (optional, post-core)
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
