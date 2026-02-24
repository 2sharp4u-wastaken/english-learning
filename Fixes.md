# Fixes Backlog

Each item is self-contained and can be tackled independently.

---

## 1) Grammar game: remove topic selector; use settings categories; add Hebrew translation

**Status:** ❌ Not started

**Entry points:**
- `index.html` — `#grammar-topic-selector` div and `#grammar-sentence`
- `gameLogic.js` — `initGrammarTopicSelector()`, `selectGrammarCategory()`, `getFilteredGrammarQuestions()`, `setupEventListeners()`
- `games/grammar-game.js` — `loadGrammarQuestion()` (add Hebrew line)
- `data/grammarData.js` — verify grammar question objects have a `hebrewSentence` or `translation` field

**Action plan:**
1. In `index.html`, remove the entire `#grammar-topic-selector` div (lines ~292–298). Keep reset button and progress bar.
2. In `gameLogic.js`, remove `initGrammarTopicSelector()` and `selectGrammarCategory()` calls. Update `getFilteredGrammarQuestions()` to filter by `this.settings.selectedCategories` (same pattern as vocabulary), falling back to all if no category match exists.
3. Add a `<div class="hebrew-translation" id="grammar-hebrew"></div>` element below `#grammar-sentence` in `index.html`.
4. In `games/grammar-game.js` `loadGrammarQuestion()`, populate `#grammar-hebrew` with `question.hebrewSentence || question.translation || ''` after setting the sentence HTML.
5. Check `data/grammarData.js` to verify the Hebrew field name; add it to a sample of questions if missing.

**Acceptance:**
- Grammar game no longer shows topic tabs.
- Grammar questions are filtered by the same categories selected in Settings.
- Hebrew sentence translation appears below the English question.

---

## 2) Game initialization failure: memory/scramble/fill-blanks + memory card flip lockup

**Status:** ❌ Not started

**Root cause analysis:**
- `app.js` creates `window.memoryGame`, `window.scrambleGame`, `window.fillBlanksGame` inside `initializeManagers()`, which is gated by `authService.getCurrentUserId()` returning a non-null value.
- If the auth service hasn't resolved by the time a game is opened, the game instances are `undefined` and `gameLogic.startGame()` logs an error and does nothing.
- On return to `index.html`, the practice badge refreshes correctly because `refreshPracticeDataContext()` re-reads localStorage directly — confirming data was always there; the problem is purely the game instance references not being set in time.
- Memory card flip lockup: `isProcessing` is set to `true` after two cards are selected, but if `checkForMatch()` enters the `handleMatch()` path and speech synthesis hangs (known Chrome issue), `isProcessing` can remain stuck even though the code releases it before awaiting speech.

**Entry points:**
- `app.js` — `initializeApp()`, `setupWithAuth()`, `initializeManagers()`
- `gameLogic.js` — `startGame()` blocks for `memory`/`scramble`/`fill-blanks` (lines ~1755–1820)
- `games/memory-game.js` — `handleMatch()` (processing lock release)

**Action plan:**
1. In `app.js`, move the three game instance creations (`MemoryGame`, `SentenceScrambleGame`, `FillBlanksGame`) out of `initializeManagers()` and into a new `initializeGameInstances()` method that is called unconditionally from `initializeApp()`, using `null` or stub managers initially.
2. After managers are initialized in `initializeManagers()`, update the already-created game instances with real managers: `this.memoryGame.scoreManager = this.scoreManager`, etc.
3. Add a fallback retry in `gameLogic.startGame()` for these three game types: if the window instance is null, retry via `setTimeout` once (500ms) before giving up and showing an error message.
4. In `memory-game.js` `handleMatch()`, add a safety timeout to force-release `isProcessing` after 2 seconds if it's still `true` and `flippedCards` is empty (prevents permanent lockup from speech synthesis hang).

**Acceptance:**
- Opening memory/scramble/fill-blanks directly (without visiting home first) initializes and shows the game.
- Memory cards can be flipped continuously without ever getting permanently stuck.

---

## 3) Home page card stats (🌟 / 📚 / ⚠️) always show zero

**Status:** ❌ Not started

**Root cause analysis:**
- `gamification.js:updateGameCardProgress()` calls `getGameMasteryStats(gameType)`.
- `getGameMasteryStats()` reads from `window.app.userProgress.wordMastery` and filters by `selectedCategories` from localStorage settings.
- Two causes for zeroes: (a) `window.app.userProgress` is null when `updateAllGameCards()` runs (auth not yet resolved, same timing issue as task 2), and (b) `wordMastery` keys are only created after a word is practiced at least once — brand new users always see 0.
- The stats represent: 🌟 mastered words (masteryLevel ≥ 0.8), 📚 words in progress (0.5–0.8), ⚠️ struggling words (masteryLevel < 0.5 after at least one attempt).

**Entry points:**
- `gamification.js` — `updateAllGameCards()`, `updateGameCardProgress()`, `getGameMasteryStats()`
- `app.js` — where `updateAllGameCards()` is triggered after auth resolves
- `index.html` — `.game-card-stats` span elements

**Action plan:**
1. Confirm these stats are meaningful and desired (they are — they reflect per-game learning progress).
2. Ensure `updateAllGameCards()` is called after auth resolves and `userProgress` is populated. In `app.js` `initializeManagers()`, add `window.gamificationManager?.updateAllGameCards()` at the end.
3. Guard `getGameMasteryStats()` against null `userProgress`: return `{ masteredWords: 0, learningWords: 0, strugglingWords: 0 }` if `window.app?.userProgress` is falsy.
4. Verify the `selectedCategories` check doesn't filter out all words for new users — if `selectedCategories` is empty, fall back to showing stats for all categories.

**Acceptance:**
- After logging in and playing any vocabulary round, the home card stat badges update with non-zero values.
- No console errors when userProgress is not yet loaded.

---

## 4) Progress bar visually incomplete at last question (question 10/10)

**Status:** ❌ Not started

**Root cause:**
- `gameLogic.js updateProgress()`: `progress = (this.currentQuestionIndex / this.totalQuestions) * 100`
- At question 10 of 10, `currentQuestionIndex = 9` (0-based), so `progress = 90%` — the bar never reaches 100%.
- The same off-by-one applies to all games using `updateProgress()`.
- Games with their own `updateProgress()` (scramble, fill-blanks) compute: `(this.currentIndex / this.sentences.length) * 100` — same bug.

**Entry points:**
- `gameLogic.js` — `updateProgress()` line ~2669
- `games/sentence-scramble-game.js` — `updateProgress()` line ~419
- `games/fill-blanks-game.js` — `updateProgress()` line ~333
- `games/memory-game.js` — `updateStats()` (already correct: `matchedPairs / totalPairs`)

**Action plan:**
1. In `gameLogic.js updateProgress()`, change: `const progress = ((this.currentQuestionIndex + 1) / this.totalQuestions) * 100;`
2. In `sentence-scramble-game.js updateProgress()`, change: `const pct = ((this.currentIndex + 1) / this.sentences.length) * 100;`
3. In `fill-blanks-game.js updateProgress()`, change: `const pct = ((this.currentIndex + 1) / this.sentences.length) * 100;`
4. Verify the bar shows 100% on the last question across vocabulary, grammar, pronunciation, scramble, and fill-blanks games.

**Acceptance:**
- Progress bar reaches full width on the final question in all games.

---

## 5) Memory game: show emoji/image on cards

**Status:** ❌ Not started

**Root cause:**
- `memory-game.js createCardElement()` renders only text (`cardFront.textContent = safeContent`).
- `normalizeWordObject()` extracts `image/picture/icon/emoji` into `normalizedVisual` but only uses it as a fallback for `translation`, not as a display element.
- Other games (vocabulary, pronunciation) show an emoji via `#vocab-picture` / `#pronunciation-picture`.

**Entry points:**
- `games/memory-game.js` — `normalizeWordObject()`, `createCardElement()`
- `data/categories/*.js` — word objects with `emoji`, `image`, or `icon` fields

**Action plan:**
1. In `normalizeWordObject()`, preserve the visual field separately: add `visual: normalizedVisual` to the returned object (do not use it as translation fallback anymore — keep the existing `safeTranslation` logic).
2. In `createCardElement()`, for cards of type `'word'` (English), check if `card.wordObj.visual` is non-empty. If yes, render both an emoji span and the word text stacked vertically: `<span class="card-emoji">${visual}</span><span class="card-word">${content}</span>`.
3. Add `.card-emoji` CSS rule: `font-size: 1.6em; display: block; line-height: 1.2;` and `.card-word` `font-size: 0.85em`.
4. Translation (Hebrew) cards do not need the emoji — text-only is correct there.

**Acceptance:**
- English word cards in the memory game show the emoji/icon above the word text when available.
- Cards without an emoji show word text only (no layout breakage).

---

## 6) Reset game button: grammar-beginner not wired; scramble/fill-blanks missing

**Status:** ❌ Not started

**Root cause:**
- `gameLogic.js setupEventListeners()` wires reset buttons for: `['vocab', 'grammar', 'pronunciation', 'listening', 'reading', 'abc']` — **`grammar-beginner` is absent**, so `#grammar-beginner-reset-btn` (which exists in HTML) never gets a click handler.
- `#scramble-reset-btn` and `#fill-blanks-reset-btn` do not exist in `index.html` — no reset button is rendered for these games.

**Entry points:**
- `gameLogic.js` — `setupEventListeners()` reset button loop (~line 1301), `resetCurrentGame()`
- `index.html` — `#scramble-game` and `#fill-blanks-game` progress containers
- `games/sentence-scramble-game.js` — `playAgain()` (acts as reset)
- `games/fill-blanks-game.js` — `playAgain()` (acts as reset)

**Action plan:**
1. In `gameLogic.js setupEventListeners()`, add `'grammar-beginner'` to the reset button array so `#grammar-beginner-reset-btn` gets wired.
2. Verify `resetCurrentGame()` handles `'grammar-beginner'` correctly (same as other games — it resets and calls `startGame()`).
3. In `index.html`, add `<button class="reset-game-btn" id="scramble-reset-btn" title="אפס משחק">אפס משחק</button>` inside `#scramble-game`'s `.progress-container`.
4. Add same button for fill-blanks: `<button class="reset-game-btn" id="fill-blanks-reset-btn" ...>`.
5. Wire these two new buttons in `app.js initializeManagers()` (since scramble/fill-blanks are managed there): on click, call `window.scrambleGame.startGame(...)` and `window.fillBlanksGame.startGame(...)` respectively (same difficulty/params as initial start).

**Acceptance:**
- Clicking reset in grammar-beginner restarts the game with fresh questions.
- Reset buttons are visible and functional in sentence-scramble and fill-blanks games.

---

## 7) Home page card layout: move action buttons into card; show icons with tooltips

**Status:** ❌ Not started

**Current state:**
- Each `.game-card` has a `.game-card-main` section (icon + title + stats) and a `.game-card-footer` (hidden with `display:none`) containing "new game" and "continue" text buttons.
- The footer is currently unused/hidden.

**Desired behavior:**
- Remove the footer entirely.
- Shorten each card to fit its content.
- Place two icon-only action buttons flanking the card's large icon:
  - Left side: **New Game** button (e.g. `▶` / `fas fa-play`)
  - Right side: **Continue** button (e.g. `⏩` / `fas fa-forward`) — hidden if no saved game exists
- Buttons have `title` tooltip text in Hebrew.

**Entry points:**
- `index.html` — all `.game-card` blocks (approx. 10+ cards)
- `styles.css` — `.game-card`, `.game-card-main`, `.game-card-footer`, `.game-card-icon`, `.game-card-stats`
- `gameLogic.js` — `populateResumeGames()` or wherever continue/new-game actions are wired

**Action plan:**
1. In `index.html`, for each `.game-card`:
   - Remove the `.game-card-footer` div entirely.
   - Wrap the `.game-card-icon` in a new `.card-icon-row` div that also contains left/right button slots.
   - Add `<button class="card-action-btn card-new-btn" title="משחק חדש"><i class="fas fa-play"></i></button>` on the left of the icon.
   - Add `<button class="card-action-btn card-continue-btn" title="המשך משחק" style="display:none"><i class="fas fa-forward"></i></button>` on the right.
2. In `styles.css`:
   - `.card-icon-row`: `display: flex; align-items: center; justify-content: center; gap: 12px;`
   - `.card-action-btn`: `width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer; font-size: 1rem;` with appropriate color variants.
   - Remove `.game-card-footer` styles or mark as unused.
   - Reduce `.game-card` min-height to fit tighter content.
3. In `gameLogic.js` (or `gamification.js`), update `populateResumeGames()` to show/hide `.card-continue-btn` per card (instead of the old footer continue button), and wire `.card-new-btn` click to `gameManager.switchGame(gameType)`.

**Acceptance:**
- Cards are visibly shorter with no footer area.
- New game and continue icon buttons appear flanking the card icon.
- Hovering over buttons shows Hebrew tooltip text.
- Continue button is hidden when no saved game exists for that type.

---

## 8) (From PLAN.md #5) Scramble game not initializing fresh

**Status:** ❌ Not started
*(Partially overlaps with Fix #2 — the auth-timing issue. This item tracks the remaining UI/init-flow work once Fix #2 is applied.)*

**Entry points:**
- `games/sentence-scramble-game.js` — `startGame()`, `showGame()`
- `gameLogic.js` — `startGame('scramble')` block
- `index.html` — `#scramble-game-container`

**Action plan:**
1. After Fix #2 ensures `window.scrambleGame` is always available, verify `startGame('scramble')` in `gameLogic.js` correctly calls `window.scrambleGame.startGame(difficulty, null, 10)`.
2. Confirm `showGame()` sets `#scramble-game-container` to `display: block` and clears any stale state.
3. Confirm the `scramble-check` button event (wired in `app.js`) is not double-bound on re-entry.

**Acceptance:**
- Navigating to the scramble game for the first time (no saved state) renders the first sentence and word bank immediately.

---

## 9) (From PLAN.md #6) Fill-blanks game not initializing fresh

**Status:** ❌ Not started
*(Partially overlaps with Fix #2.)*

**Entry points:**
- `games/fill-blanks-game.js` — `startGame()`, `showGame()`
- `gameLogic.js` — `startGame('fill-blanks')` block
- `index.html` — `#fill-blanks-container`

**Action plan:**
1. Same verification as Fix #8 but for fill-blanks.
2. Confirm `#fill-blanks-container` becomes visible and `renderSentence()` is called on init.
3. Confirm `fill-blanks-next` button listener is not double-bound.

**Acceptance:**
- Navigating to fill-blanks for the first time renders a sentence with blank and multiple-choice options immediately.

---

## 10) (From PLAN.md #7) #profile and #courses navigation

**Status:** ❌ Not started

**Current state:**
- `app.js setupScreenNavigation()` wires `nav-courses-btn` → `renderCoursesScreen()` + `showScreen('courses-screen')` and `nav-profile-btn` → `renderProfileScreen()` + `showScreen('profile-screen')`.
- Both screens exist in HTML and are rendered dynamically. The question is whether content renders correctly and navigation is intuitive.

**Entry points:**
- `app.js` — `renderCoursesScreen()`, `renderProfileScreen()`, `showScreen()`
- `index.html` — `#courses-screen`, `#profile-screen`

**Action plan:**
1. Load the app and click both buttons; verify the screens render without errors.
2. Check `renderProfileScreen()` pulls correct user data (name, coins, streak, mastery stats).
3. Check `renderCoursesScreen()` shows the courses list and unlock state correctly.
4. If either screen is blank or broken, trace the render method and fix the data source or HTML template.
5. Ensure back buttons (`courses-back-btn`, `profile-back-btn`) return to the welcome screen correctly.

**Acceptance:**
- Clicking פרופיל shows a populated profile screen.
- Clicking קורסים shows the courses grid.
- Back navigation returns to the home screen.
