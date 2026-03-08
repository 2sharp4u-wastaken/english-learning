# Tech Debt Remediation Plan
Generated: 2026-03-09 | Status: IN PROGRESS

## How to resume
Tell Claude: "continue tech debt plan" or "start Phase X of tech debt plan"
Reference file: `tech-debt-plan.md` in project root

---

## Phase A — Safety (~90 min) [x]
> Zero-risk. Do first.

- [x] A1 — Commit 7 untracked files: `games/picture-match-game.js`, `games/word-journey-game.js`, `utils/wordImageManager.js`, `data/categories/music.js`, `data/categories/signs.js`, `data/categories/tools.js`, `data/categories/transportation.js`
- [x] A2 — Add `memory`, `scramble`, `fill-blanks`, `word-journey`, `picture-match` to `ScoreManager.initialize()` array (`managers/ScoreManager.js:26`)
- [x] A3 — Add 4 missing category toggles (music, signs, tools, transportation) to `settings.html`

## Phase B — Dead Code & Quick Cleanup (~3 hours) [x]
> Low risk. Can be done in any order within this phase.

- [x] B1 — Delete dead `generatePracticeWords()` wrapper at `gameLogic.js:1837`
- [x] B2 — Remove unreachable `_recordWordAttemptLegacy` at `gameLogic.js:680` (and fallback check at lines 638–642)
- [x] B3 — Consolidate both `getGameName()` maps (`gameLogic.js:1235`, `gamification.js:323`) to read from `GameRegistry`
- [x] B4 — Replace `getGameIcon()` at `gameLogic.js:795` with `GameRegistry` lookup
- [x] B5 — Fix double `getWordStats()` iteration in `getPracticeWords()` — single-pass with annotated array
- [x] B6 — Add `const DEBUG = false` flag at top of `gameLogic.js`, wrap 83 `console.log` calls via `debugLog` helper
- [x] B7 — Convert `utils/wordImageManager.js` from IIFE to ES module

## Phase C — Duplicate Settings & Score Unification (~3 hours) [x]
> Medium risk. Test after each item.

- [x] C1 — Remove `GameManager.loadSettings()` (`gameLogic.js:424`); replaced with `applySettings(settings)` method; AppManager.saveSettings() now pushes settings to gameManager via `applySettings()`
- [x] C2 — Elect `ScoreManager` as sole source of truth: removed `GameManager.scores{}` parallel copy, updated all `games/*.js` to use `scoreManager` directly, removed redundant sync lines

## Phase D — Event Listener & Audio Refactor (~2 hours) [ ]

- [ ] D1 — Extract game-specific logic from `playCurrentQuestionAudio()` into respective game modules (listening reveal → `listening-game.js`, vocabulary reveal → `vocabulary-game.js`)
- [ ] D2 — Fix `setupEventListeners()`: add teardown before re-wiring, split into per-game registration functions

## Phase E — Module Pattern Consistency (~2 hours) [ ]

- [ ] E1 — Convert `games/picture-match-game.js` from function-export pattern to class pattern (match `memory-game.js` style)
- [ ] E2 — Audit remaining old-pattern game files; decide migrate-all vs document the two-pattern split

## Phase F — `startGame()` Decomposition (~4 hours) [ ]
> Higher risk. Do not mix with other changes. Test every game after.

- [ ] F1 — Extract each game's init block from `startGame()` into a `prepareQuestions()` method per game class/module
- [ ] F2 — Make `startGame()` a thin orchestrator: `prepareQuestions()` → `loadQuestion()`
- [ ] F3 — Replace `loadQuestion()`'s 14-case switch with `GameRegistry` dispatch

## Phase G — Startup Sequencing & Coupling (~3 hours) [ ]

- [ ] G1 — Replace `setTimeout` polling chain (`gameLogic.js:133`) with a `managers-ready` CustomEvent dispatched from `app.js` after `setupWithAuth()`
- [ ] G2 — Define narrow interface between `AppManager` and `GameManager`; remove direct `window.app.*` / `window.gameManager.*` cross-access

## Phase H — Documentation (add as phases complete) [ ]

- [ ] H1 — Document startup/init sequence (add to `CLAUDE.md` or inline comments in `app.js`)
- [ ] H2 — Document `startGame()` preconditions per game type (after Phase F)
- [ ] H3 — Document score persistence contract — `lastPersistedScores`, delta logic, `endGame()` reconciliation (or remove via C2)

## Phase I — Testing Infrastructure (ongoing) [ ]

- [ ] I1 — Add QUnit via CDN, create `test.html` served by existing `python3 server.py`
- [ ] I2 — Write unit tests: `smartQuestionSelection`, `shouldShowExitConfirmation`, mastery calculations, score delta logic, `clearLegacySavedState` migration

---

## Completed items
- **Phase A** — A1 (files committed in prior session), A2 (ScoreManager game types), A3 (categories already in settings.js)
- **Phase B** — B1–B7 all done: dead code removed, getGameName/getGameIcon use GameRegistry, getPracticeWords single-pass, debugLog wrapper, wordImageManager converted to ES module
- **Phase C** — C1 (loadSettings→applySettings, AppManager.saveSettings pushes to gameManager), C2 (GameManager.scores removed, all games write directly to scoreManager)
