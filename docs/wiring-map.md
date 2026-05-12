# Wiring Map — Cause & Effect Chains

> **Purpose:** Before changing any function, find it here and check what depends on it. If you change X, verify every downstream Y still works.

## Word Journey Completion Chain

```
endGame('word-journey') with percentage ≥ 60%
  ├─ progressManager.graduateWord(word, category, %) ──→ learnedWords{} updated
  ├─ Calculate ABC mastery from wordMastery[A_abc..Z_abc]
  ├─ progressManager.checkAndUnlockGames(learned, topics, abcMastery)
  │   └─ gameUnlocks{} updated → home card lock states refresh
  ├─ app.checkMilestoneCertificates(learnedCount)
  │   └─ certificates[] updated → profile gallery, modal shown
  ├─ saveGameScoreToHistory() ──→ stats games panel
  ├─ totalPoints += delta ──→ stats overview
  ├─ coinManager.awardActivityComplete() ──→ coins, header display
  │   └─ If replay mode: half coins
  ├─ coinManager.awardPerfectGame() if 100% ──→ coins
  ├─ app.updateProgress() ──→ totalGamesPlayed++, course tracking
  └─ saveUserProgress() ──→ localStorage persisted
```

**UI surfaces that must update:** home hero card, home card locks, home words-learned count, profile stats grid, profile word collection, profile certificates, profile unlocked games, profile progress bar, stats overview, stats words panel, stats categories, stats hall of fame

## ABC Game Completion Chain

```
endGame('abc')
  ├─ saveGameScoreToHistory() ──→ stats
  ├─ totalPoints += delta
  ├─ coinManager.awardActivityComplete()
  ├─ Calculate ABC mastery from wordMastery[A_abc..Z_abc]
  ├─ progressManager.checkAndUnlockGames(learned, topics, abcMastery)
  │   └─ May unlock Reading game (requires ABC ≥ 60%)
  ├─ app.checkGameMilestoneCertificates('abc', score)
  │   └─ May award "ABC Hero" certificate (100%)
  └─ app.updateProgress()
```

## Any Other Game Completion Chain

```
endGame(gameType)  [not word-journey, not abc]
  ├─ saveGameScoreToHistory()
  ├─ totalPoints += delta
  ├─ coinManager.awardActivityComplete()
  ├─ coinManager.awardPerfectGame() if 100%
  ├─ app.checkGameMilestoneCertificates(gameType, score)
  │   └─ May award: Sentence Builder (scramble/fill-blanks 100%), Perfect Listener (listening 100%)
  └─ app.updateProgress() ──→ totalGamesPlayed++, course tracking
```

**Does NOT trigger:** word graduation, game unlocks, learning progress bar

## Word Attempt During Gameplay

```
gameManager.recordWordAttempt(word, category, correct)
  ├─ progressManager.recordWordAttempt() ──→ wordMastery[key] updated
  ├─ saveUserProgress()
  └─ If mastery crosses 0.8 ──→ in-game level-up celebration
```

## Daily Login

```
CoinManager.initialize()
  └─ checkDailyBonus()
      ├─ awardCoins(10, 'daily login')
      └─ updateStreak()
          ├─ streakDays updated
          └─ Every 7 days: awardStreakBonus(50)
```

## Settings Change

```
settings.js saveSettings()
  ├─ localStorage['englishLearningSettings'] written
  ├─ localStorage['v2_englishLearningSettings'] written (bridge)
  └─ On next game start: gameManager.applySettings() reads all values
```

**Settings that affect gameplay:**
| Setting | Where it's read | Effect |
|---------|----------------|--------|
| `learningPace` | `getWordJourneyWords()` gameLogic.js:3406 | 3/5/8 words per journey |
| `hebrewVocalization` | Word Journey Discover stage | Hebrew TTS after English |
| `questionsPerGame` | `startGame()` for non-WJ games | Question count |
| `gameUnlockOverride` | Gate checks in `performGameSwitch` | Bypasses all gates |

## Home Screen Refresh

```
showWelcomeScreen()
  ├─ updateHomeCardStates() ──→ reads gameUnlocks, applies .locked class
  ├─ updateHeroCard() ──→ reads recommendation logic
  ├─ updateWordsLearnedCount() ──→ reads learnedWords
  └─ renderProfileScreen() ──→ refreshes all profile sections
```

## Word Selection per Game

```
getFilteredWordsForGame(gameType)
  ├─ UNGATED (full bank): word-journey, abc, grammar-beginner, practice
  ├─ HYBRID (memory): learned words if ≥12, else full bank
  └─ GATED (all others): learned words only, empty → showLearnFirstPrompt()
```

---

## Vocabulary Game (React — Slice 3.1)

```
React route /#/game/vocabulary
  └─ GameHostPage.tsx → REACT_GAMES['vocabulary'] → VocabularyGamePage.tsx
      ├─ beginVocabularySession()  (src/bridge/vocabulary.ts)
      │   ├─ speechManager.setGameContext('vocabulary')
      │   ├─ V2 gating mirrors gameLogic.js:2244–2257
      │   │   └─ pool < 4 → render <VocabularyLearnFirst />
      │   └─ gameManager.smartQuestionSelection(pool) → shuffledQuestions
      ├─ Loop: <MediaPromptCard> + <AnswerGrid> + <FeedbackBanner>
      │   └─ recordVocabularyAnswer() → recordWordAttempt + scoreManager.addPoints + saveGameState
      └─ Final question → finishVocabularySession() → gameManager.endGame()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Legacy `games/vocabulary-game.js`, `#vocabulary-game` DOM, and `_setupVocabularyListeners` are no longer reached for this route. They remain in the tree until Slice 4.4.

## Listening Game (React — Slice 3.2)

```
React route /#/game/listening
  └─ GameHostPage.tsx → REACT_GAMES['listening'] → ListeningGamePage.tsx
      ├─ beginListeningSession()  (src/bridge/listening.ts)
      │   ├─ speechManager.setGameContext('listening')
      │   ├─ V2 gating mirrors gameLogic.js
      │   │   └─ pool < 4 → render <ListeningLearnFirst />
      │   └─ gameManager.smartQuestionSelection(pool) → shuffledQuestions
      ├─ Loop: <MediaPromptCard> (audio-only — no English word) + <AnswerGrid> + <FeedbackBanner>
      │   ├─ Auto-play on each question → 1-play gate clears, options reveal
      │   └─ recordListeningAnswer() → recordWordAttempt + scoreManager.addPoints + saveGameState
      └─ Final question → finishListeningSession() → gameManager.endGame()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Legacy `games/listening-game.js` and `#listening-game` DOM are no longer reached for this route. They remain in the tree until Slice 4.4.

## Critical File Locations

| Function | File | Line |
|----------|------|------|
| `graduateWord()` | managers/ProgressManager.js | ~580 |
| `checkAndUnlockGames()` | managers/ProgressManager.js | 644 |
| `getFilteredWordsForGame()` | app.js | 1553 |
| `getWordJourneyWords()` | gameLogic.js | 3403 |
| `endGame()` | gameLogic.js | ~2920 |
| `showLearnFirstPrompt()` | gameLogic.js | ~2321 |
| `updateHomeCardStates()` | index.html | ~1154 |
| `checkMilestoneCertificates()` | app.js | ~924 |
| `checkGameMilestoneCertificates()` | app.js | ~964 |
| `getRecommendation()` | app.js | ~662 |
| `showCelebration()` | games/word-journey-game.js | 1130 |
| `awardCoins()` | managers/CoinManager.js | 64 |
| `renderProfileScreen()` | app.js | ~527 |

> **Note:** Line numbers shift as the codebase evolves. Use function names for search, not line numbers.
