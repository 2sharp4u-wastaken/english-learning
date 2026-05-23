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

## Fill Blanks Game (React — Slices 3.7 + 3.7.1)

```
React route /#/game/fill-blanks
  └─ GameHostPage.tsx → REACT_GAMES['fill-blanks'] → FillBlanksGamePage.tsx
      ├─ beginFillBlanksSession()  (src/bridge/fill-blanks.ts)
      │   ├─ speechManager.setGameContext('fill-blanks')
      │   ├─ Resume from savedGame_<userId>_fill-blanks if mid-session
      │   ├─ V2 gating (MIN_LEARNED=30): if learnedCount < 30 → render <FillBlanksLearnFirst />
      │   └─ getRandomSentences(10, 'beginner', themes) → shuffledQuestions clamped to settings.questionsPerGame
      ├─ Loop: Hebrew translation + sentence-with-blank + speaker button + <AnswerGrid variant='text'>
      │   ├─ On new question: auto-speak full English sentence once (voice readiness poll); shuffle options (correct=blank.options[0])
      │   ├─ Option click → recordFillBlanksAnswer(question, selectedWord)
      │   │   → isCorrect = selectedWord.toLowerCase() === blank.options[0].toLowerCase()
      │   │   → pointsAwarded = isCorrect ? 15 : 0   ← 3.7.1 raised from 10 (folded word-builder's rate)
      │   │   → recordWordAttempt(blankWordVocabEntry) + scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   │   → correct: re-speak full sentence; incorrect: speak target word; both reveal correctIndex in grid
      │   └─ "השאלה הבאה" (always shown after any answer — no auto-advance, kids need to read)
      └─ Final question → finishFillBlanksSession() → gameManager.endGame()
          → RewardModal opens → voices English tier via speak()
          → standard word-attempt persistence chain (see "Word Attempt During Gameplay")
```

Slice 3.7.1 retired the duplicate `word-builder` game (shipped briefly in 3.6) and folded its 15 pts/correct scoring into Fill Blanks — both games pulled from the same `data/sentences.js` pool with near-identical UX, so the duplication was UI-only. Legacy `/#/game/word-builder` bookmarks redirect via `GameHostPage.RETIRED_GAMES`. Orphan localStorage (`savedGame_<uid>_word-builder`, `v2_wordbuilder_audio_<uid>`) is swept on first boot in `app.js:setupWithAuth`. Audio-state key for the surviving game is `v2_fillblanks_audio_<userId>`.

## Sentence Scramble Game (React — Slice 3.8)

```
React route /#/game/scramble
  └─ GameHostPage.tsx → REACT_GAMES['scramble'] → SentenceScrambleGamePage.tsx
      ├─ beginScrambleSession()  (src/bridge/sentence-scramble.ts)
      │   ├─ speechManager.setGameContext('scramble')
      │   ├─ Resume from savedGame_<userId>_scramble if mid-session (requires shuffledQuestions[i].words array)
      │   ├─ V2 gating (MIN_LEARNED=30): if learnedCount < 30 → render <ScrambleLearnFirst />
      │   └─ getRandomSentences(10, 'beginner', themes) → shuffledQuestions clamped to settings.questionsPerGame
      ├─ Per question:
      │   ├─ buildShuffledBank(question) — words stripped of trailing punctuation, Fisher-Yates shuffled, stable keys
      │   ├─ Auto-speak full English sentence once on mount (no audio gate, no plays budget)
      │   ├─ Tap word-bank chip → moves token to answer zone + speaks that word
      │   ├─ Tap placed chip (awaiting phase) → returns it to bank
      │   ├─ Drag chip within answer zone → reorder (native HTML5 DnD + parallel touch handlers via elementFromPoint)
      │   ├─ "השמע את המשפט שלי" speaks placed words in current order
      │   └─ "בדוק תשובה" enabled only when placed.length === question.words.length
      ├─ Check → recordScrambleAnswer(question, playerWords[])
      │   → isCorrect = playerWords.join(' ').toLowerCase() === question.words.map(stripPunct).join(' ').toLowerCase()
      │   → pointsAwarded = isCorrect ? 10 : 0   (legacy sentence-scramble-game.js:330)
      │   → recordWordAttempt for every vocab-bank word in the sentence + scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   → correct: re-speak full sentence + confetti + show "Next"
      │   → incorrect: stagger-reveal correct order (500ms initial delay + 180ms per word) before "Next" appears
      └─ Final question → finishScrambleSession() → gameManager.endGame() → RewardModal
```

No audio-state localStorage key (no gate). The reveal animation uses setTimeouts tracked in `revealTimersRef` and cleared on unmount, exit-confirm, or reset to avoid stale chips bleeding into the next question.

## Grammar Beginner Game (React — Slice 3.9)

```
React route /#/game/grammar-beginner
  └─ GameHostPage.tsx → REACT_GAMES['grammar-beginner'] → GrammarBeginnerGamePage.tsx
      ├─ beginGrammarBeginnerSession()  (src/bridge/grammar-beginner.ts)
      │   ├─ speechManager.setGameContext('grammar-beginner')
      │   ├─ Resume from savedGame_<userId>_grammar-beginner if mid-session
      │   └─ Fresh: generateGrammarBeginnerQuestions(settings.questionsPerGame)
      │       from data/grammarBeginnerData.js — regenerates each fresh start
      │       (no smartQuestionSelection, no V2 learn-first gate, no audio-state key)
      ├─ Per question — branches on question.type (discriminated union):
      │   ├─ who-says-it     → <WhoSaysItView>     auto-speaks sentenceAudio on enter; tap subject image
      │   ├─ complete-sound  → <CompleteSoundView> auto-speaks subjectAudio + 500ms + predicate.word; tap verb chip
      │   ├─ sounds-right    → <SoundsRightView>   no auto-play (legacy parity); tap sentence card to hear, tap option
      │   └─ match-picture   → <MatchPictureView>  auto-speaks sentenceAudio on enter; tap subject image
      ├─ Select option → recordGrammarBeginnerAnswer(question, selected, attemptsBefore=0)
      │   → isCorrect = selected === question.correctAnswer
      │   → pointsAwarded = isCorrect ? max(0, 10 - attempts + 1) : 0  (legacy grammar-beginner-game.js:331)
      │   → scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   → both paths: <TranslationFlash hebrew={hebrewSentence}> + speak full correctSentence + "השאלה הבאה"
      └─ Final question → finishGrammarBeginnerSession() → gameManager.endGame() → RewardModal
```

Subtype views live in `src/features/games/grammar-beginner/components/` and are intentionally NOT promoted to shared primitives — no other game uses image-grid subject pickers or verb audio chips. Hebrew agreement (masc/fem/plural predicate forms) is handled by `getPredicateHebrew(predicate, subjectKey)` in the bridge, mirroring `data/grammarBeginnerData.js`.

## Grammar Game (React — Slice 3.10)

```
React route /#/game/grammar
  └─ GameHostPage.tsx → REACT_GAMES['grammar'] → GrammarGamePage.tsx
      ├─ beginGrammarSession()  (src/bridge/grammar.ts)
      │   ├─ speechManager.setGameContext('grammar')
      │   ├─ Resume from savedGame_<userId>_grammar if mid-session
      │   │   (guard: shuffledQuestions[i].options[0] must be a string —
      │   │    rejects stale grammar-beginner-shape entries, mirrors gameLogic.js:2072)
      │   ├─ Fresh: gameManager.getFilteredGrammarQuestions() filters
      │   │   gameData.grammar by settings.selectedCategories
      │   └─ smartQuestionSelection() orders by mastery + session rotation,
      │       capped to settings.questionsPerGame (default 10)
      ├─ Per question:
      │   ├─ Render Hebrew sentence (blank filled with hebrewOptions[correct]
      │   │   for full meaning), English sentence with `___` blank, audio button,
      │   │   and AnswerGrid of shuffled options (English + Hebrew sublabel)
      │   ├─ Auto-play once per question (sentence with blank skipped via comma
      │   │   pause); manual play button speaks the full filled sentence after answer
      │   └─ caseMode + showNikud toggles apply to English + Hebrew display
      ├─ Select option → recordGrammarAnswer(question, selectedWord)
      │   → isCorrect = selectedWord === question.options[question.correct]
      │   → pointsAwarded = isCorrect ? 10 : 0   (legacy grammar-game.js:143)
      │   → scoreManager.addPoints + currentQuestionIndex++ + saveGameState
      │   → correct: blank fills green + confetti + speak praise audio then full sentence + show "Next"
      │   → incorrect: blank fills red with the correct word + explanation surfaces + speak full sentence + show "Next"
      └─ Final question → finishGrammarSession() → gameManager.endGame() → RewardModal
```

No audio-state localStorage key (no gate, no per-question plays budget). Index advances regardless of correctness (legacy invariant — grammar-game.js:151 & 199).

### Slice 3.10 polish (2026-05-23) — bilingual options + filled Hebrew sentence

```
data/grammarQuestions.js  (now ships hebrewOptions: string[4] per question)
  └─ data/_loader.js — bumped cache-buster ?t= so Vite refetches grammar data
  └─ src/bridge/grammar.ts
      ├─ GrammarQuestion.hebrewOptions?: string[]   (optional, per-option Hebrew gloss)
      └─ Resume path re-hydrates each saved shuffledQuestion against the
         current gameData.grammar by sentence text — old saves (pre-hebrewOptions)
         pick up the new field on next resume.
  └─ src/features/games/grammar/GrammarGamePage.tsx
      ├─ Hebrew sentence blank fills with hebrewOptions[correct] for full meaning
      └─ Each AnswerGrid option carries `sublabel` = matching hebrewOptions entry
         (shuffled.order.indexOf back to options[] keeps the mapping intact)
  └─ src/features/games/shared/AnswerGrid.tsx — new optional `sublabel` per option
     (small dim Hebrew gloss under the main label; first consumer is grammar)
```

## Pronunciation Game (React — Slice 3.11)

```
React route /#/game/pronunciation
  └─ GameHostPage.tsx → REACT_GAMES['pronunciation'] → PronunciationGamePage.tsx
      ├─ beginPronunciationSession()  (src/bridge/pronunciation.ts)
      │   ├─ speechManager.setGameContext('pronunciation')
      │   ├─ Resume from savedGame_<userId>_pronunciation if mid-session
      │   │   (guard: shuffledQuestions[i].word must be a string)
      │   ├─ Fresh: gameManager.getScopedQuestionPool('pronunciation') →
      │   │   filtered to learned words (mirrors VOCAB_GATED_GAMES filter,
      │   │   gameLogic.js:2212–2223); <4 learned → kind:'learn-first'
      │   └─ smartQuestionSelection() orders by mastery, capped to
      │       settings.questionsPerGame (default 10)
      ├─ Per question:
      │   ├─ MediaPromptCard renders picture (img or emoji), English word
      │   │   (caseMode), Hebrew translation (showNikud)
      │   ├─ Auto-play target word once via speakWord(word.toLowerCase(),
      │   │   'pronunciation') after voices ready (10-attempt poll, ~250 ms)
      │   └─ Manual "Listen" speaker button replays target; disabled while
      │       recording so kids can't cheat
      ├─ Tap mic → startPronunciationRecording() (speechManager.startRecording)
      │   → cancels speech, requests mic permission on first use
      │   → returns { transcript, confidence }
      │   → tap mic again to stop (RECORDING_CANCELLED rejects gracefully)
      ├─ Result → recordPronunciationAttempt(question, { transcript })
      │   → speechManager.comparePronunciation(target, transcript)
      │     → { accuracy, feedback, audioFeedback }
      │   → isCorrect = accuracy >= 0.7
      │   → pointsAwarded = isCorrect ? round(accuracy * 10) : 0  (legacy
      │     pronunciation-game.js:253)
      │   → recordWordAttempt + scoreManager.addPoints +
      │     currentQuestionIndex++ + saveGameState (always, prevents retry exploit)
      │   → comparison panel renders target/transcript/accuracy %
      │   → correct: speak praise audio + confetti + auto-advance 1.5s
      │   → incorrect: speak praise audio + 400 ms pause + replay target word +
      │     show "Next" button + mic disabled (no retry)
      └─ Final question → finishPronunciationSession() → gameManager.endGame() → RewardModal
```

No audio-state localStorage key (recording isn't gated by a play budget). The learn-first view reuses `PictureMatchLearnFirst` since the gating threshold + CTA copy match exactly. Mic permission errors (`not-allowed`, `audio-capture`, `no-speech`, `network`) bubble up as Hebrew error strings from `speechManager` and render under the mic button without crashing the session.

### Slice 3.11 polish (2026-05-23, same-day)

```
src/bridge/feedback.ts
  └─ new playAnswerSfx('correct'|'incorrect') → window.audioEffects.play{Correct,Wrong}
     (other games hit this implicitly via getGameFeedback's side effect at
      legacy feedback.js:165; pronunciation reads comparison.feedback directly
      so it must call playAnswerSfx explicitly to fire the fanfare WAV).

src/features/games/pronunciation/PronunciationGamePage.tsx
  ├─ Parallel MediaRecorder alongside startPronunciationRecording():
  │   getUserMedia(audio) → MediaRecorder → Blob chunks → ObjectURL,
  │   plumbed into ComparisonState.recordingUrl. Released on advance/
  │   reset/exit/unmount via releaseRecordingUrl()/stopMediaCapture().
  │   "שמע את עצמך" button in comparison panel plays it back via new Audio().
  ├─ Resume autoplay suppression: autoPlayedRef = (resumeIndex > 0). Chrome
  │   autoplay policy blocks audio without prior gesture on a refreshed tab.
  ├─ "צָרִיךְ לוֹמַר" label (showNikud-aware: strips to "צריך לומר" when off).
  └─ playAnswerSfx fires before confetti/audio-feedback in both branches.

src/features/games/shared/QuestionProgress.tsx
  └─ Reset chip: amber border + bg + RotateCcw icon. Cross-cutting visual
     upgrade — every React game inherits it without any per-page change.
```

## Story Time Game (React — Slice 3.12)

```
React route /#/game/story-time
  └─ GameHostPage.tsx → REACT_GAMES['story-time'] → StoryTimeGamePage.tsx
      ├─ beginStoryTimeSession()  (src/bridge/story-time.ts)
      │   ├─ setGameContext('story-time') + deleteGameState (resume disabled)
      │   ├─ Learn-first gate: <15 learned words → kind:'learn-first'
      │   ├─ Build learnedWordsList from app.userProgress.learnedWords keys
      │   │   (mirrors gameLogic.js:2191–2196)
      │   ├─ getStoriesForSession(learned, vocabularyBank, 3) → 0..3 stories
      │   │   (fallbacks fill slots when a category has no learned word)
      │   └─ Stash on gameManager: shuffledQuestions=stories,
      │       totalQuestions=sum(quizQuestions), currentQuestionIndex=0
      ├─ Phase state machine (read → quiz → answered → next):
      │   ├─ Read phase: StoryReadPhase renders sentences with tappable
      │   │   highlights (speakWord on tap + 1.5s translation tooltip) and a
      │   │   per-sentence 🔊 button (speak() on tap).
      │   ├─ "מוכן לשאלות" → switches to quiz phase, cancels speech.
      │   ├─ Quiz phase: StoryQuizPhase reuses shared AnswerGrid (2–3 cols,
      │   │   text variant) over question.options.
      │   └─ Answer → recordStoryQuizAnswer(story, question, idx):
      │       +15 pts on correct (legacy story-time-game.js:249) +
      │       recordWordAttempt for every story.highlight +
      │       currentQuestionIndex++ + saveGameState (always).
      ├─ Correct → confetti + getGameFeedback audio + auto-advance 1.5s
      ├─ Incorrect → reveal correct option + "השאלה הבאה" footer button
      ├─ Advance order: next quiz Q within story → next story (back to read)
      │   → finishStoryTimeSession → gameManager.endGame → RewardModal.
      └─ Exit/reset/unmount → abortStoryTimeSession() + cancelSpeech.
```

Resume is intentionally unsupported in the React port: legacy story-time persists `currentQuestionIndex` (quiz answers across stories) but not `storyIndex`, so reopening silently restarts at story 0 — broken. The bridge clears saved state on every `begin` to keep behavior consistent with what legacy *appeared* to do. Total progress counter (`qp-current`) tracks answered quiz questions across all stories so the user sees one monotonic bar from story 1 through the final reward modal.

## Hero title (canonical placement, adopted 2026-05-23 — applies to ALL React games)

```
src/features/games/shared/GameScreenShell.tsx
  ├─ <GameHeader {...header} />                    ← top bar: back button + toggles + score/coins
  ├─ <GameHero title icon subtitle />              ← below header, above progress
  ├─ <QuestionProgress {...progress} />?
  ├─ <main>{children}</main>
  └─ <div className="pt-2">{footer}</div>?
```

Pages still declare a single `headerProps = { title, icon, score, onBack }` and the shell forwards the title/icon/subtitle to `<GameHero>`. `<GameHeader>` accepts those fields on the props for forwarding but no longer renders them — its center area is gone, so the back button and toggle/score pills aren't visually crowded by the title. The hero sits between the controls row and the progress strip so it reads as a section heading for the question card. Slices 3.1–3.9 inherit this for free; no per-page change.

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
