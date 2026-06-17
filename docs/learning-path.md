# Learning Path — How the App Guides a Child Through English

> **Consolidated 2026-05-27.** This is the single living doc for the learning flow.
> It absorbed `word-journey-flow.md` (Word Journey structure) and
> `learning-flow-redesign.md` (the mastery-driven model + open loose ends), which were
> deleted. The model is **V3 mastery-driven**: per-word graduation, two-step promotion
> via review, light spacing, tiered unlocks — defined in **"Word Lifecycle Model"** below.

## Overview

The app is built as a guided learning journey for Hebrew-speaking kids (ages 5–8). Instead of a flat list of games, it uses a tiered progression system where learning new words unlocks more games. The core loop is:

**Learn words → Unlock games → Practice & play → Master vocabulary → Earn rewards**

The child always has something to do, always sees what's coming next, and is motivated by coins, certificates, and a growing word collection.

---

## The Learning Loop

### Step 1: Word Journey (Entry Point)

Every child starts here. Word Journey is a 5-stage structured lesson for a batch of words:

| Stage | What Happens | Scored? |
|-------|-------------|---------|
| 1. Discover | See the word, image, and hear it spoken (English + optional Hebrew) | No |
| 2. Listen & Match | Hear the word, pick the matching image | Yes |
| 3. Spell Tiles | Arrange letter tiles to spell the word | Yes |
| 4. Say Word | Pronounce the word (speech recognition) | Yes |
| 5. Recall | See the image, pick the correct English word | Yes |

- **Batch size** is controlled by the Learning Pace setting (3 / 5 / 8 words)
- **(V3 — mastery-driven)** Word Journey no longer graduates a whole batch at ≥60%.
  Each stage records that word's real performance, so a word the child nails reaches
  **Learned** while a fumbled one stays **Learning**. Word Journey is the *first
  encounter*; the review games promote Learning → Learned. (See "Word Lifecycle Model".)

### Step 2: Games Unlock Progressively

Games unlock on two tiers (numbers unchanged from the table below; only the *counter*
differs). **Review-tier** games gate on words **introduced** (Learning ∪ Learned) so the
child always has somewhere to promote new words. **Consolidation-tier** games gate on
words genuinely **Learned**.

| Tier | Game | Unlock Requirement (V3) |
|------|------|--------------------|
| **Learn** | Word Journey | Always open |
| **Learn** | ABC Letters | Always open |
| **Practice** | Memory Game | Always open (word mode when ≥12 *introduced*) |
| **Practice** | Grammar Beginner | Always open |
| **Practice** | Listening / Picture Match / True or Not? | 5 *introduced* |
| **Challenge** | Reading | 10 *introduced* + ABC 60% mastery |
| **Challenge** | Pronunciation / Vocabulary | 10 *introduced* |
| **Challenge** | Story Time | 15 *Learned* |
| **Challenge** | Fill the Blank / Sentence Scramble | 30 *Learned* + 2 topics |
| **Challenge** | Grammar | 50 *Learned* + 3 topics |
| **Test** | Word Test | 10 *Learned* |

(Word Builder was retired into Fill the Blank — Slice 3.7.1.) Locked games are visible
on the home screen with a semi-transparent overlay showing the unlock requirement.

### Step 3: Practice & Reinforcement

Review games draw from the **Learning ∪ Due** pool (Due = a Learned word past its
spacing interval — 3/7/14/30 days), prioritizing Due words. This means:
- Review games are the **promotion path**: practicing a Learning word raises its mastery
  until it becomes Learned; old Learned words resurface as Due before they're forgotten.
- Consolidation games draw from genuinely **Learned** words.
- No game throws unfamiliar words at the child (except Memory with <12 learned words, and grammar-beginner)
- The more words they learn, the richer and more varied each game becomes

### Step 4: Mastery & Rewards

The child earns rewards throughout:
- **Coins** — earned for completing games, perfect scores, streaks, and daily logins
- **Certificates** — awarded at milestones (1st word, 10, 25, 50, 100 words learned + special ones like ABC Hero, Perfect Listener)
- **Word Collection** — a sticker-book view of all graduated words
- **Learning Level** — progresses through 6 levels: מתחיל → חוקר → לומד מיומן → מומחה → אלוף → אגדה

---

## Word Lifecycle Model (mastery-driven)

Status is **derived** from each word's `wordMastery` entry — never stored as a separate
flag. Computed in `managers/ProgressManager.js` (`getWordStatus` / `getLifecycleCounts`
/ `getWordsByStatus` / `getDueWords`):

```
New      → no wordMastery entry (or 0 attempts)
Learning → introduced, masteryLevel < 0.8 (or not yet stable)
Learned  → masteryLevel ≥ 0.8 AND totalAttempts ≥ 3 AND consecutiveCorrect ≥ 2
Due      → Learned AND (today − lastSeen) ≥ the word's review interval
```

(`0.8 / 3 / 2` reuse the existing `mastered / minAttempts / consecutiveForMastery`
thresholds.) Gate counters: **introducedCount** = words with ≥1 attempt; **learnedCount**
= words whose derived status is Learned (both exclude `category:'abc'` letter entries).

- **Two-step promotion.** Word Journey usually lands a word in **Learning**; the review
  games (listening, picture-match, true-or-not, vocabulary, pronunciation, reading) draw
  from **Learning ∪ Due** and are the path that promotes Learning → Learned.
  Consolidation games (story-time, fill-blanks, scramble, grammar) draw from **Learned**.
- **Light spacing.** A Learned word gets a growing review interval **3 → 7 → 14 → 30 days**
  (per-word `reviewStage`); past the interval it's **Due** and prioritized in review + the
  Practice game.
- **Gentle decay (2-miss hysteresis).** Missed reviews lower mastery, but a Learned word
  demotes to Learning only after **two consecutive misses** (a correct answer forgives). A
  word never falls back to **New** — introduced is forever. Grandfathered words (pre-V3
  `learnedWords`) are sticky-Learned and never demote.
- **UI mapping.** Profile "words learned" = introduced count; "words mastered" = Learned
  count. Continue-recommendation order: **Due review → promote Learning → Word Journey →
  newly unlocked game** (review target rotates among unlocked review games).

## Word Journey mechanics (binding)

Fixed product rules the React port honors:

- **5 fixed stages** — `discover`, `listen-match`, `spell-tiles`, `say-word`, `recall`.
  `discover` is instructional (unscored); the other four are scored and each calls
  `recordWordAttempt` per word.
- **`learningPace` is the only batch-size knob** — slow 3 / normal 5 / fast 8 words. The
  global `questionsPerGame` does **not** affect Word Journey.
- Header shows stage progress (`שלב X מתוך 5`) + batch size (`N מילים במסע`); header chrome
  stays visually secondary to the learning card.
- **Selection** — free-play picks a mastery-aware batch from active categories (weak/
  unlearned preferred; words learned today deprioritized). Topic-scoped uses the topic word
  list with the same pace.
- **Banking** — points bank only on completion (per-word mastery is saved per stage played).
- **Resume** — leaving mid-journey persists the built session + current stage to
  `savedWJ_<userId>` (24h TTL); returning continues the *same* journey at that stage
  (stage-level granularity — the current stage restarts, earlier stages stay done).
  Cleared on completion or the Reset button; replay/practice runs are not persisted.
  (Originally resume-less by design; re-added because reshuffling a brand-new journey on
  every re-entry read as data loss to kids/parents — beta feedback 2026-06-17.)
- **Completion guidance** — free-play biases toward more learning / a newly unlocked game;
  topic-scoped biases back to the next topic activity (don't show two buttons that both
  restart Word Journey).

---

## Home Screen Layout

The home screen is organized into 4 tiers, top to bottom:

1. **Continue Learning Hero Card** — a personalized recommendation at the top ("Start Word Journey", "Try your new game: Listening", etc.)
2. **Learn** tier — Word Journey + ABC (always open)
3. **Practice** tier — reinforcement games (some gated)
4. **Challenge** tier — advanced games (all gated)
5. **Test** tier — Word Test for cold recall

Below the games is the **User Hub** with two tabs:
- **Profile** — avatar, stats, learning level, certificates, word collection, unlocked games, weekly activity
- **Courses** — structured topic-based learning paths

---

## Profile Page (User Hub → Profile Tab)

The profile shows the child's progress at a glance:

- **Stats Grid**: streak days, words learned, words mastered, certificates earned
- **Learning Progress Bar**: current level with progress toward the next one (6 levels, tied to learned word count)
- **Next Recommended Action**: smart suggestion — start Word Journey, try a newly unlocked game, continue a course, etc.
- **Certificates**: earned milestone badges displayed in a grid
- **Word Collection (Sticker Book)**: gallery of all graduated words with emoji, English word, and Hebrew translation
- **Unlocked Games**: visual display of which games are open vs. locked
- **Weekly Activity Calendar**: 7-day dot row showing which days the child was active
- **Chime Selector**: fun entry sounds the child can choose

---

## Stats Page

The stats page is accessible from the top navigation bar and has per-user tabs plus a Hall of Fame:

### Overview Tab
- Hero card with user name, avatar, streak
- 5 metric tiles: total score, words learned, games played, best score, time spent learning
- Insight cards: learning velocity (words/week), time spent

### Games Tab
- Score banner (total score)
- Per-game stats table: game name, times played, best score, average score

### Words Tab
- Mastery overview tiles: struggling / learning / mastered / total
- Per-word table with mastery bar, translation, and Word Journey stage progress (which of the 5 stages completed)

### Categories Tab
- Per-category completion cards showing "X / Y mastered" with progress bar

### Memory Tab
- Memory game specific stats (levels, stars)

### Coins Tab
- Coin balance and transaction history

### Hall of Fame
- Cross-user leaderboard ranked by words learned (not just score)

---

## Settings Page (Parent-Controlled)

Settings are organized into tabs. The Categories tab is open; all others are password-protected for parents.

### Categories Tab (Open)
- Select which vocabulary categories are active (Animals, Colors, Food, etc.)
- Controls which words appear in Word Journey and other games

### Game Settings Tab (Protected)
- **Questions per game** — slider (5–20), controls non-WJ games only
- **Click count** — how many times to tap a word before answers appear
- **Audio play limit** — max listens per word (3–15)
- **Hebrew vocalization** — toggle Hebrew TTS after English words in Word Journey's Discover stage
- **Learning pace** — slow (3 words) / normal (5) / fast (8) per Word Journey — this is the main knob for adjusting the learning intensity

### Custom Words Tab (Protected)
- Parents can add custom English words (e.g., "dragon, wizard, castle")
- Uses Claude API for auto-translation and categorization
- Custom words appear across all games and all users

### Word Images Tab (Protected)
- Manage images and translations for vocabulary words

### Users Tab (Protected)
- Add/remove user accounts
- Each user has independent progress

### Advanced Tab (Protected)
- **Hebrew nikud** — show vowel marks on Hebrew translations
- **Lowercase English** — show abc instead of ABC
- **Confetti** — toggle celebration animations
- **Exit behavior** — auto-save (default) or always-confirm
- **Game unlock override** — bypass all gating requirements (opens every game regardless of learned word count)

---

## Courses System

In addition to free-play, the app has a course system:

- Courses are topic-based (e.g., "Animals", "At Home")
- Each course contains activities that launch specific games scoped to topic words
- Completing course activities counts toward topic completion
- Free-play sessions that happen to match a topic's words also contribute to course progress
- Course-level unlocks are shown in the Courses tab of the User Hub

---

## Word Journey Replay

After completing a Word Journey, the celebration screen offers:

1. **"Start another Word Journey"** (primary) — selects fresh/weak words
2. **"Practice Learned Words"** (secondary) — replays graduated words with half coin rewards, marked with a "Practice Mode" badge
3. **Next recommended game** — if a new game just unlocked or a course activity is suggested
4. **"Back to Home"** — return to the hub

This ensures the child is always nudged toward learning new words first, but can revisit old words for fun and confidence-building.

---

## Key Design Principles

1. **Never block the child** — there's always at least Word Journey + ABC + Memory + Grammar Beginner available
2. **Show what's locked** — locked game cards are visible (semi-transparent overlay) so the child sees what they're working toward
3. **Reinforce, don't test cold** — games only use words the child has already *met*: review games draw from Learning∪Due words (introduced via Word Journey), consolidation games from genuinely Learned words
4. **Reward everything** — coins, certificates, levels, word stickers, streaks, confetti
5. **Parent control without friction** — settings are password-protected but the child's experience is self-guided
6. **Adjustable intensity** — parents can tune learning pace, difficulty, categories, and even bypass gates entirely

---

## Open loose ends (not yet built)

➡️ **Tracked in [`docs/backlog.md`](backlog.md)** (§2 learning-flow loose ends + §3 test
gaps) — the single source of truth for open work. This is intentionally a pointer so the
backlog can't drift across docs. The design rationale for the learning flow stays above.
