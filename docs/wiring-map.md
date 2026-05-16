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

## Picture Match Game (React — Slice 3.3)

```
React route /#/game/picture-match
  └─ GameHostPage.tsx → REACT_GAMES['picture-match'] → PictureMatchGamePage.tsx
      ├─ beginPictureMatchSession()  (src/bridge/picture-match.ts)
      │   ├─ speechManager.setGameContext('picture-match')
      │   ├─ V2 gating mirrors gameLogic.js
      │   │   └─ pool < 4 → render <PictureMatchLearnFirst />
      │   └─ gameManager.smartQuestionSelection(pool) → shuffledQuestions
      ├─ Loop: <MediaPromptCard word=question.word audioIconOnly> + <AnswerGrid variant="media" columns=4>
      │   ├─ Auto-play on each question → 1-play gate clears, options reveal
      │   ├─ <OptionPicture> honors window.wordImageOverrides → real image OR emoji fallback
      │   └─ recordPictureMatchAnswer() → recordWordAttempt + scoreManager.addPoints + saveGameState
      └─ Final question → finishPictureMatchSession() → gameManager.endGame()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Legacy `games/picture-match-game.js` and `#picture-match-game` DOM are no longer reached for this route. They remain in the tree until Slice 4.4.

## True or Not Game (React — Slice 3.4)

```
React route /#/game/true-or-not
  └─ GameHostPage.tsx → REACT_GAMES['true-or-not'] → TrueOrNotGamePage.tsx
      ├─ beginTrueOrNotSession()  (src/bridge/true-or-not.ts)
      │   ├─ speechManager.setGameContext('true-or-not')
      │   ├─ V2 gating: learnedCount < 5 → render <TrueOrNotLearnFirst />
      │   ├─ Build pool from learned words (or full bank fallback if <4)
      │   └─ window.trueOrNotGame.buildQuestions(pool) → 5 matches + 5 mismatches, shuffled
      │       → adapt {isMatch} → {correct: 0|1} for AnswerGrid
      ├─ Loop: <MediaPromptCard word=question.word translation media=<DisplayedPicture>> + <AnswerGrid columns=2>
      │   ├─ Auto-play of the English word on each question (no reveal gate)
      │   ├─ <DisplayedPicture> renders question.displayImageUrl (may differ from word's real image on mismatch rounds)
      │   └─ recordTrueOrNotAnswer(selectedIndex) → userSaysMatch (idx 0) vs question.isMatch → recordWordAttempt + scoreManager.addPoints + saveGameState
      └─ Final question → finishTrueOrNotSession() → gameManager.endGame()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Legacy `games/true-or-not-game.js` is still mounted at boot (we call its `buildQuestions` from the bridge), but the legacy `#true-or-not-container` DOM is never displayed for this route. The legacy class can retire alongside Slice 4.4 once `buildQuestions` is reimplemented in the bridge.

## Reading Game (React — Slice 3.5)

```
React route /#/game/reading
  └─ GameHostPage.tsx → REACT_GAMES['reading'] → ReadingGamePage.tsx
      ├─ beginReadingSession()  (src/bridge/reading.ts)
      │   ├─ speechManager.setGameContext('reading')
      │   ├─ Resume from savedGame_<userId>_reading if mid-session
      │   ├─ V2 gating (reading ∈ VOCAB_GATED_GAMES): filter pool to learned words
      │   │   → if learnedPool < 4 → render <ReadingLearnFirst />
      │   └─ gameManager.smartQuestionSelection(pool) → shuffledQuestions clamped to settings.questionsPerGame
      ├─ Loop: <MediaPromptCard media=<ReadingPicture> word=question.word> + built-word box + <letter-bank>
      │   ├─ On new question: shuffle (word.split + extraLetters) into LetterToken[]; auto-play English word once
      │   ├─ 3s English-word reveal cycle: wordVisible state + wordHideTimer (Hebrew stays visible)
      │   ├─ Letter click → move LetterToken from bank.used=false → built[]; speak(letter.toLowerCase())
      │   ├─ "נקה" → empty built[], reset all bank tokens to used=false
      │   └─ "בדוק" → recordReadingAnswer(question, builtWord, attempts)
      │       → isCorrect = builtWord === question.word
      │       → pointsAwarded = isCorrect ? max(0, 10 - attempts) : 0
      │       → recordWordAttempt + scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │       → wrong: setAttempts+1, restart 3s word-reveal timer, replay audio, show "השאלה הבאה" (no retry)
      │       → correct: confetti (if enabled), auto-advance after 1500ms
      └─ Final question → finishReadingSession() → gameManager.endGame()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Reading is the first Wave 2 (text-building) React slice — the page replaces `AnswerGrid` with a letter bank + built-word box, but reuses every other shared primitive and the bridge shape from Slice 3.1.

## Word Builder Game (React — Slice 3.6)

```
React route /#/game/word-builder
  └─ GameHostPage.tsx → REACT_GAMES['word-builder'] → WordBuilderGamePage.tsx
      ├─ beginWordBuilderSession()  (src/bridge/word-builder.ts)
      │   ├─ speechManager.setGameContext('word-builder')
      │   ├─ Resume from savedGame_<userId>_word-builder if mid-session
      │   ├─ V2 gating (MIN_LEARNED=20): if learnedCount < 20 → render <WordBuilderLearnFirst />
      │   └─ getRandomSentences(20, 'beginner', themes) → shuffledQuestions clamped to settings.questionsPerGame
      ├─ Loop: theme badge + Hebrew translation + sentence-with-blank + speaker button + <AnswerGrid variant='text'>
      │   ├─ On new question: auto-speak full English sentence once (voice readiness poll); shuffle options (correct=blank.options[0])
      │   ├─ Option click → recordWordBuilderAnswer(question, selectedWord)
      │   │   → isCorrect = selectedWord.toLowerCase() === blank.options[0].toLowerCase()
      │   │   → pointsAwarded = isCorrect ? 15 : 0
      │   │   → recordWordAttempt(blankWordVocabEntry) + scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   │   → correct: re-speak full sentence; incorrect: speak target word; both reveal correctIndex in grid
      │   └─ "השאלה הבאה" (always shown after any answer — no auto-advance, kids need to read)
      └─ Final question → finishWordBuilderSession() → gameManager.endGame()
          → RewardModal opens → voices English tier ("Perfect", "Excellent", etc.) via speak()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Word Builder is the second Wave 2 slice (after Reading). Distinct from Wave 1: 15 pts/correct (not 10), always-on next button (no auto-advance on correct), and a custom prompt card replacing `MediaPromptCard` because the sentence-with-inline-blank can't fit the card's word/translation slots.

## Fill Blanks Game (React — Slice 3.7)

```
React route /#/game/fill-blanks
  └─ GameHostPage.tsx → REACT_GAMES['fill-blanks'] → FillBlanksGamePage.tsx
      ├─ beginFillBlanksSession()  (src/bridge/fill-blanks.ts)
      │   ├─ speechManager.setGameContext('fill-blanks')
      │   ├─ Resume from savedGame_<userId>_fill-blanks if mid-session
      │   ├─ V2 gating (MIN_LEARNED=30): if learnedCount < 30 → render <FillBlanksLearnFirst />
      │   └─ getRandomSentences(10, 'beginner', themes) → shuffledQuestions clamped to settings.questionsPerGame
      ├─ Loop: theme badge + Hebrew translation + sentence-with-blank + speaker button + <AnswerGrid variant='text'>
      │   ├─ On new question: auto-speak full English sentence once (voice readiness poll); shuffle options (correct=blank.options[0])
      │   ├─ Option click → recordFillBlanksAnswer(question, selectedWord)
      │   │   → isCorrect = selectedWord.toLowerCase() === blank.options[0].toLowerCase()
      │   │   → pointsAwarded = isCorrect ? 10 : 0
      │   │   → recordWordAttempt(blankWordVocabEntry) + scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   │   → correct: re-speak full sentence; incorrect: speak target word; both reveal correctIndex in grid
      │   └─ "השאלה הבאה" (always shown after any answer — no auto-advance, kids need to read)
      └─ Final question → finishFillBlanksSession() → gameManager.endGame()
          → RewardModal opens → voices English tier via speak()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Fill Blanks reuses the Slice 3.6 (Word Builder) page shape verbatim — same custom sentence-with-blank prompt card, always-on next button, and AnswerGrid. Differences vs Word Builder: 10 pts/correct (matches Wave 1), MIN_LEARNED=30 (higher gate), base sentence count 10 (no over-fetch since `questionsPerGame` cap is also 10), resume score divisor is /10. Audio-state localStorage key is `v2_fillblanks_audio_<userId>`.

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
