# English Learning Game - Major Overhaul Plan

## Overview
Comprehensive overhaul based on "English Adventures" app screenshots (35 screenshots reviewed) to add:
- Structured course progression (Unit → Topic → Activity)
- New game types (Memory, Sentence Scramble, Fill-in-Blanks)
- User profiles with dashboard
- Certificate system
- Real image support
- Points/coins economy
- Video integration

---

## Phase 1: Foundation & Architecture (Priority: Critical)

### 1.1 Refactor GameManager (Prerequisite for all features)

**Current Problem:** 2400-line monolithic `GameManager` class handles everything

**Files to modify:**
- `gameLogic.js` → Extract into smaller managers

**Create new files:**
```
/managers/
  ScoreManager.js      - Scoring logic, points calculation
  ProgressManager.js   - Word mastery, completion tracking
  GameRegistry.js      - Game registration factory pattern
  CourseManager.js     - Course/unit/topic progression
  CertificateManager.js - Certificate tracking & generation
```

**GameRegistry Pattern:**
```javascript
// Instead of hardcoded method binding in constructor:
GameRegistry.register('memory', {
    module: MemoryGame,
    loadQuestion: 'loadMemoryQuestion',
    checkAnswer: 'checkMemoryAnswer',
    config: { questionsPerGame: 10, pointsPerCorrect: 10 }
});
```

### 1.2 Course/Unit/Topic Data Structure

**Create:** `/data/courses/`
```
courses/
  index.js           - Course registry
  beginner-vocab.js  - Unit 1: Basic Vocabulary
  colors-shapes.js   - Unit 2: Colors & Shapes
  animals.js         - Unit 3: Animals
  ...
```

**Course Structure:**
```javascript
export const beginnerVocabCourse = {
    id: 'beginner-vocab',
    name: 'Beginner Vocabulary',
    nameHebrew: 'אוצר מילים למתחילים',
    icon: '📚',
    units: [
        {
            id: 'unit-1-colors',
            name: 'Colors',
            topics: [
                {
                    id: 'basic-colors',
                    name: 'Basic Colors',
                    words: ['red', 'blue', 'green', 'yellow'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: null,  // First topic always unlocked
                    certificateId: 'cert-basic-colors'
                },
                {
                    id: 'more-colors',
                    name: 'More Colors',
                    words: ['orange', 'purple', 'pink', 'brown'],
                    activities: ['vocabulary', 'listening', 'scramble'],
                    unlockRequirement: { topic: 'basic-colors', mastery: 0.7 }
                }
            ]
        }
    ]
};
```

### 1.3 User Progress Extension

**Modify:** `app.js` - Extend `userProgress` structure

```javascript
userProgress = {
    // Existing fields...
    wordMastery: {...},
    streakDays: 0,

    // NEW: Course progression
    courses: {
        'beginner-vocab': {
            unlocked: true,
            startedDate: '2026-02-13',
            currentUnit: 'unit-1-colors',
            currentTopic: 'basic-colors'
        }
    },

    // NEW: Topic completion
    topicProgress: {
        'basic-colors': {
            unlocked: true,
            started: true,
            mastery: 0.85,
            completedActivities: ['vocabulary', 'listening'],
            certificateEarned: true
        }
    },

    // NEW: Certificates earned
    certificates: [
        {
            id: 'cert-basic-colors',
            topicId: 'basic-colors',
            earnedDate: '2026-02-13',
            score: 92
        }
    ],

    // NEW: Coins/points economy
    coins: 150,
    totalCoinsEarned: 500
};
```

---

## Phase 2: New Game Types

### 2.1 Memory/Matching Game

**Create:** `/games/memory-game.js`

**Gameplay:**
- Grid of face-down cards (6-8 pairs)
- Click to flip, match English word ↔ Hebrew translation
- Points based on attempts (fewer flips = more points)
- Audio plays word on flip

**Data format:**
```javascript
{
    type: 'memory',
    pairs: [
        { english: 'cat', hebrew: 'חתול', image: '🐱' },
        { english: 'dog', hebrew: 'כלב', image: '🐕' }
    ],
    pairCount: 6
}
```

**HTML container (add to index.html):**
```html
<div id="memory-game" class="game-content">
    <div class="progress-container">...</div>
    <div class="game-board">
        <div id="memory-grid" class="memory-grid"></div>
    </div>
    <div class="feedback" id="memory-feedback"></div>
</div>
```

### 2.2 Sentence Scramble Game

**Create:** `/games/sentence-scramble-game.js`

**Gameplay:**
- Display Hebrew sentence as hint
- Show scrambled English words
- Drag/tap to arrange in correct order
- Audio plays correct sentence on success

**Data format:**
```javascript
{
    type: 'scramble',
    sentence: 'The cat is sleeping',
    words: ['The', 'cat', 'is', 'sleeping'],
    hebrew: 'החתול ישן',
    audio: 'the-cat-is-sleeping'
}
```

**Create:** `/data/sentences.js` - Sentence bank for scramble game

### 2.3 Fill-in-the-Blanks Game

**Create:** `/games/fill-blanks-game.js`

**Gameplay:**
- Sentence with one or more blanks
- Multiple choice options below
- Context-based vocabulary learning

**Data format:**
```javascript
{
    type: 'blanks',
    sentence: 'The ___ is red',
    answer: 'apple',
    options: ['apple', 'banana', 'orange', 'grape'],
    hebrew: 'התפוח אדום',
    image: '🍎'
}
```

---

## Phase 3: UI Overhaul

### 3.1 Course Selection Screen

**Modify:** `index.html` - Add new screen

```html
<div id="courses-screen" class="screen">
    <div class="courses-header">
        <h1>בחר קורס</h1>
        <div class="user-coins">💰 <span id="user-coins">0</span></div>
    </div>
    <div class="courses-grid">
        <div class="course-card" data-course="beginner-vocab">
            <div class="course-icon">📚</div>
            <h3>Beginner Vocabulary</h3>
            <div class="course-progress">
                <div class="progress-bar">...</div>
                <span>3/10 topics</span>
            </div>
        </div>
        <div class="course-card locked" data-course="intermediate">
            <div class="lock-overlay">🔒</div>
            <div class="unlock-requirement">Complete Beginner to unlock</div>
        </div>
    </div>
</div>
```

### 3.2 Topic Selection Screen

```html
<div id="topics-screen" class="screen">
    <div class="topics-header">
        <button class="back-btn">← Back</button>
        <h2 id="current-unit-name">Unit 1: Colors</h2>
    </div>
    <div class="topics-list">
        <div class="topic-card completed" data-topic="basic-colors">
            <div class="topic-status">✅</div>
            <h3>Basic Colors</h3>
            <div class="topic-activities">
                <span class="activity-badge done">📖</span>
                <span class="activity-badge done">👂</span>
                <span class="activity-badge">🎮</span>
            </div>
        </div>
        <div class="topic-card locked" data-topic="more-colors">
            <div class="topic-status">🔒</div>
            <h3>More Colors</h3>
            <div class="unlock-hint">Master Basic Colors to unlock</div>
        </div>
    </div>
</div>
```

### 3.3 Dashboard/Profile Screen

**Create:** Profile section showing:
- User avatar & name
- Total coins earned
- Learning streak
- Certificates earned (scrollable gallery)
- Statistics: topics completed, words mastered, hours learned

```html
<div id="profile-screen" class="screen">
    <div class="profile-header">
        <div class="avatar">👤</div>
        <h2 id="profile-name">Player Name</h2>
        <div class="coins-display">💰 <span>150</span> coins</div>
    </div>
    <div class="stats-grid">
        <div class="stat-card">
            <span class="stat-value">12</span>
            <span class="stat-label">Topics Completed</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">85</span>
            <span class="stat-label">Words Mastered</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">7</span>
            <span class="stat-label">Day Streak</span>
        </div>
    </div>
    <div class="certificates-section">
        <h3>My Certificates</h3>
        <div class="certificates-scroll">
            <!-- Certificate cards -->
        </div>
    </div>
</div>
```

### 3.4 Certificate Modal

```html
<div class="certificate-modal" id="certificate-modal">
    <div class="certificate-content">
        <div class="certificate-badge">🏆</div>
        <h2>Certificate of Completion</h2>
        <p>This certifies that</p>
        <h3 id="cert-student-name">Student Name</h3>
        <p>has successfully completed</p>
        <h3 id="cert-topic-name">Basic Colors</h3>
        <p class="cert-date" id="cert-date"></p>
        <button class="cert-download-btn">Download Certificate</button>
        <button class="cert-continue-btn">Continue Learning →</button>
    </div>
</div>
```

---

## Phase 4: Real Images Support

### 4.1 Image Asset Structure

**Directory:** `/img/vocabulary/`
```
img/vocabulary/
  animals/
    cat.png, dog.png, bird.png...
  colors/
    red.png, blue.png...
  food/
    apple.png, banana.png...
```

### 4.2 Data Model Update

**Modify:** `/data/categories/*.js`

```javascript
// Before
{ word: 'cat', hebrew: 'חתול', image: '🐱' }

// After (backwards compatible)
{
    word: 'cat',
    hebrew: 'חתול',
    emoji: '🐱',                    // Keep emoji as fallback
    image: '/img/vocabulary/animals/cat.png'  // Add real image
}
```

### 4.3 Image Display Component

**Modify:** Game display logic to prefer real images with emoji fallback

```javascript
function renderWordImage(word) {
    if (word.image) {
        return `<img src="${word.image}" alt="${word.word}"
                     onerror="this.parentElement.innerHTML='${word.emoji}'">`;
    }
    return word.emoji;
}
```

---

## Phase 5: Coins/Points Economy

### 5.1 Coin Rewards

| Action | Coins Earned |
|--------|-------------|
| Correct answer (first try) | 10 |
| Correct answer (retry) | 5 |
| Complete activity | 20 bonus |
| Complete topic | 50 bonus |
| Complete unit | 100 bonus |
| Daily login | 10 |
| Streak bonus (7 days) | 50 |
| Perfect game (100%) | 30 bonus |

### 5.2 Coin Manager

**Create:** `/managers/CoinManager.js`

```javascript
export class CoinManager {
    awardCoins(amount, reason) {
        this.userProgress.coins += amount;
        this.userProgress.totalCoinsEarned += amount;
        this.showCoinAnimation(amount);
        this.saveProgress();
    }

    showCoinAnimation(amount) {
        // Floating "+10 💰" animation
    }
}
```

---

## Phase 6: Video Integration

### 6.1 Video Lessons

**Create:** `/data/videos.js`

```javascript
export const videoLessons = {
    'basic-colors': {
        title: 'Learn Colors',
        youtubeId: 'abc123',
        duration: '3:45',
        thumbnailUrl: '/img/thumbnails/colors.jpg'
    }
};
```

### 6.2 Video Player Component

```html
<div class="video-lesson-container">
    <div class="video-wrapper">
        <iframe src="https://youtube.com/embed/{videoId}"
                allowfullscreen></iframe>
    </div>
    <button class="video-complete-btn">I watched the video</button>
</div>
```

---

## Implementation Order

### Sprint 1: Foundation (Week 1-2)
1. Create manager classes (ScoreManager, ProgressManager, GameRegistry)
2. Refactor GameManager to use new managers
3. Create course data structure
4. Update userProgress schema
5. Add CourseManager

### Sprint 2: New Games (Week 2-3)
1. Memory game implementation
2. Sentence scramble implementation
3. Fill-in-blanks implementation
4. Create sentence data bank

### Sprint 3: UI Screens (Week 3-4)
1. Course selection screen
2. Topic selection screen
3. Profile/dashboard screen
4. Navigation flow updates

### Sprint 4: Progression & Rewards (Week 4-5)
1. Topic unlock logic
2. Certificate system
3. Certificate modal & display
4. Coins economy implementation

### Sprint 5: Polish (Week 5-6)
1. Real image integration
2. Video lessons (optional)
3. Animations & transitions
4. Testing & bug fixes

---

## Files Summary

### New Files to Create
```
/managers/
  ScoreManager.js         (DONE - created in prior session)
  ProgressManager.js      (DONE - created in prior session)
  GameRegistry.js         (TODO)
  CourseManager.js        (TODO)
  CertificateManager.js   (TODO)
  CoinManager.js          (TODO)

/games/
  memory-game.js          (TODO)
  sentence-scramble-game.js (TODO)
  fill-blanks-game.js     (TODO)

/data/
  courses/
    index.js              (TODO)
    beginner-vocab.js     (TODO)
    intermediate.js       (TODO)
  sentences.js            (TODO)
  videos.js               (TODO)

/img/
  vocabulary/...          (image assets - TODO)
  certificates/...        (certificate templates - TODO)
```

### Files to Modify
```
gameLogic.js      - Use new managers, add new games
app.js            - Extended userProgress structure
index.html        - New screens, game containers
styles.css        - New component styles
data/_loader.js   - Import courses, sentences
feedback.js       - Add feedback for new games
```

---

## Verification Plan

### 1. Course Navigation
- [ ] Can browse courses on courses screen
- [ ] Locked courses show requirements
- [ ] Can drill into units → topics
- [ ] Back navigation works

### 2. Topic Progression
- [ ] First topic in each unit unlocked
- [ ] Completing topic unlocks next
- [ ] Certificate awarded on topic completion
- [ ] Progress persists across sessions

### 3. New Games
- [ ] Memory game: cards flip, match detection works
- [ ] Scramble game: drag/tap ordering works
- [ ] Fill-blanks: selection and validation work
- [ ] All games track mastery correctly

### 4. Coins & Rewards
- [ ] Coins awarded on correct answers
- [ ] Bonus coins for completions
- [ ] Coin balance persists
- [ ] Animation displays on earn

### 5. Certificates
- [ ] Certificate modal shows on completion
- [ ] Certificate gallery in profile
- [ ] Download functionality works

### 6. Backward Compatibility
- [ ] Existing games still work
- [ ] Existing progress migrated
- [ ] Free play mode still accessible

---

## Progress Status

**Started:** Feb 13, 2026
**Current Phase:** Phase 1 (in progress)
**Completed so far:**
- ScoreManager.js (197 lines)
- ProgressManager.js (483 lines)

**Next up:** GameRegistry.js, CourseManager.js, CertificateManager.js
