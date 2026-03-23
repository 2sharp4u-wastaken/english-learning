# Score System

This document describes how score works in the app as implemented in March 2026.

## Terms

- `ScoreManager.scores[gameType]`
  - The live score for the current run of one game.
  - Used for in-game UI, save/resume, and completion calculations.
- `savedGame_<userId>_<gameType>`
  - Mid-run save state in `localStorage`.
  - Stores `score`, question index, elapsed time, and question payloads.
- `userProgress.totalPoints`
  - All-time accumulated points for the current user.
  - Only updated when a game is completed.
- `lastPersistedScores[gameType]`
  - Internal `GameManager` tracking for how much of a game's current score has already been counted into `totalPoints`.
  - Under the current contract, in-progress runs normally keep this at `0`.

## Source Of Truth

- `managers/ScoreManager.js`
  - Owns per-game live score values.
- `gameLogic.js`
  - Owns save/resume, end-of-game reconciliation, and header score display.
- `app.js`
  - Owns long-term user progress such as `totalPoints`, best scores, streaks, and completed-game stats.

## Standard Game Flow

### 1. Start a fresh game

`GameManager.startGame()` resets:

- the live per-game score in `ScoreManager`
- `lastPersistedScores[gameType]`
- question index and elapsed time

This means a fresh run starts at score `0` and has not contributed anything to `totalPoints`.

### 2. Earn points during play

Most games add points immediately on correct answers.

Examples:

- Vocabulary adds `10` on correct answers.
- Grammar adds `10` on correct answers.
- Pronunciation adds a variable amount based on accuracy.
- Memory updates a running score during each matched pair.

Important:

- During play, only the live game score changes.
- `totalPoints` does **not** change during play.

### 3. Save and resume

Mid-run saves store the current live score in the saved game state.

When a game is resumed:

- the live score is restored into `ScoreManager`
- `lastPersistedScores[gameType]` is set to `0`

This is intentional. A resumed run is still incomplete, so none of its score has been counted into `totalPoints` yet.

### 4. Complete the game

At completion:

- the final score is computed
- score history is written
- `app.updateProgress()` runs
- `userProgress.totalPoints` is increased by the completed score

For standard games this happens in `GameManager.endGame()`.

The reconciliation rule is:

```js
const alreadyCounted = lastPersistedScores[gameType] || 0;
const newlyCompletedPoints = Math.max(0, finalScore - alreadyCounted);
totalPoints += newlyCompletedPoints;
lastPersistedScores[gameType] = finalScore;
```

In normal play, `alreadyCounted` is `0`, so the full completed score is added once.

## Reset Behavior

Reset is different from leaving a game.

### Leaving a game

Switching away from an active game usually autosaves the run.

Result:

- live score is preserved in saved state
- the player can resume later
- `totalPoints` is unchanged because the run is not complete yet

### Resetting a game

The reset button:

- deletes the saved state
- resets the live per-game score to `0`
- resets `lastPersistedScores[gameType]` to `0`
- starts a fresh run

Result:

- in-run progress is lost
- no score is added to `totalPoints`
- previously accumulated `totalPoints` stays unchanged

This is the intended behavior under the current contract because only completed games contribute to all-time points.

## Header Score Behavior

- During an active non-practice game, the header shows the live score for that game.
- Outside active gameplay, the header shows all-time `totalPoints`.

This is handled in `GameManager.updateScore()` and `GameManager.updateTotalScoreDisplay()`.

## Completion-Only Stats

The following are completion-driven and do not update on mid-run reset:

- `userProgress.totalGamesPlayed`
- best scores
- streak progression
- course activity completion
- certificates
- score history

These are triggered by `app.updateProgress()` and end-of-game history writes.

## Memory Game

Memory has a custom completion flow and does not use the shared `GameManager.endGame()` path.

Current behavior:

- pair matches update a live running score during play
- the full 3-level run adds to `totalPoints` only when the final level is completed
- reset before final completion does not change `totalPoints`

This keeps memory aligned with the completion-only persistence rule, even though the flow is implemented in `games/memory-game.js` instead of the shared end-game handler.

## Practice Mode

Practice mode does not use points-based scoring and does not persist save/resume state.

## Invariants

These rules should remain true unless the score contract is intentionally redesigned:

- Live game score can change during play.
- `totalPoints` only changes on completed games.
- Resume must not double-count score.
- Reset must not write any score into `totalPoints`.
- Completion must add a game's score to `totalPoints` at most once.
