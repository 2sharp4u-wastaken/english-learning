# Learning Path — How the App Guides a Child Through English

> **Note (2026-05-24):** This document describes the *current* graduation/gating
> model. A mastery-driven redesign of the word lifecycle (per-word graduation,
> two-step promotion, light spacing, tiered unlocks) is approved and pending
> implementation — see `docs/learning-flow-redesign.md`. Sections below will be
> updated as that ships.

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
- If the child scores **≥60% across scored stages**, the words are **graduated** into the learned-words bank
- Graduated words are the currency that unlocks other games

### Step 2: Games Unlock Progressively

As the child accumulates learned words, new games unlock automatically:

| Tier | Game | Unlock Requirement |
|------|------|--------------------|
| **Learn** | Word Journey | Always open |
| **Learn** | ABC Letters | Always open |
| **Practice** | Memory Game | Always open (uses learned words when ≥12 available) |
| **Practice** | Grammar Beginner | Always open |
| **Practice** | Listening | 5 learned words |
| **Practice** | Picture Match | 5 learned words |
| **Practice** | True or Not? | 5 learned words |
| **Challenge** | Reading | 10 learned words + ABC 60% mastery |
| **Challenge** | Pronunciation | 10 learned words |
| **Challenge** | Story Time | 15 learned words |
| **Challenge** | Word Builder | 20 learned words + 1 topic complete |
| **Challenge** | Fill the Blank | 30 learned words + 2 topics complete |
| **Challenge** | Sentence Scramble | 30 learned words + 2 topics complete |
| **Challenge** | Grammar | 50 learned words + 3 topics complete |
| **Test** | Word Test | 10 learned words |

Locked games are visible on the home screen with a semi-transparent overlay showing the unlock requirement, so the child can see what's coming.

### Step 3: Practice & Reinforcement

Once games are unlocked, they draw from the child's learned-words pool. This means:
- Every game reinforces words the child already studied in Word Journey
- No game throws unfamiliar words at the child (except Memory with <12 learned words, and grammar-beginner)
- The more words they learn, the richer and more varied each game becomes

### Step 4: Mastery & Rewards

The child earns rewards throughout:
- **Coins** — earned for completing games, perfect scores, streaks, and daily logins
- **Certificates** — awarded at milestones (1st word, 10, 25, 50, 100 words learned + special ones like ABC Hero, Perfect Listener)
- **Word Collection** — a sticker-book view of all graduated words
- **Learning Level** — progresses through 6 levels: מתחיל → חוקר → לומד מיומן → מומחה → אלוף → אגדה

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
3. **Reinforce, don't test cold** — gated games only use words the child has already learned through Word Journey
4. **Reward everything** — coins, certificates, levels, word stickers, streaks, confetti
5. **Parent control without friction** — settings are password-protected but the child's experience is self-guided
6. **Adjustable intensity** — parents can tune learning pace, difficulty, categories, and even bypass gates entirely
