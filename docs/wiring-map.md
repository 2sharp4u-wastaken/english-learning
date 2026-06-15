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

> **Phonics** (`phonics`) uses this generic chain — it is "not abc", so unlike ABC
> its mastery does NOT feed `checkAndUnlockGames` (no game gates on phonics).
> `<sound>_phonics` mastery keys (sh_phonics, ee_phonics, …) flow through the
> normal `recordWordAttempt` chain below exactly like `<letter>_abc`, and only
> drive the phonics generator's own "all sounds mastered" filter.

## Word Attempt During Gameplay

```
gameManager.recordWordAttempt(word, category, correct)
  ├─ progressManager.recordWordAttempt() ──→ wordMastery[key] updated
  ├─ saveUserProgress()
  └─ If mastery crosses 0.8 ──→ in-game level-up celebration
```

## Auth / Login (Slice 4.4.b2 — React owns auth)

```
App.tsx
  └─ AuthGate (useAuthSession.isAuthenticated = SESSION valid, not user-record present)
      ├─ not authed → <LoginPage> (src/features/auth/LoginPage.tsx)
      │     user-select grid → password entry → bridge/auth.login(userId, pw)
      │       ├─ first login (password===null) adopts entered pw
      │       ├─ writes currentSession + currentUser (UNPREFIXED keys)
      │       └─ dispatch 'auth-changed' + 'user-logged-in'
      │             └─ onAuthChange fires → AuthGate flips to app; useEngineBoot.initEngine()
      └─ authed → <RouterProvider> (the app)

bridge/auth.ts = standalone owner (no window.authService):
  storage keys (UNPREFIXED): users · currentSession · currentUser
  idle expiry 30min — lazy in isAuthenticated() + 500ms onAuthChange poll;
    document mousedown/keydown/touch/scroll refresh the timer
  logout() = clear session + dispatch 'auth-changed' (NO page reload)
```

## Parent (Admin) Gate — per-device password (Tier 2, 2026-06-10)

```
Protected surface (settings tab / reset / UsersTab action)
  └─ <ParentPasswordModal> opens → mode decided per open:
      ├─ hasParentPassword() false → CREATE wizard (enter twice, min 4)
      │     └─ setParentPassword(pw) [hash → UNPREFIXED 'parentPassword' key]
      │           └─ flows into the SAME onSubmit → pending action proceeds
      └─ true → verify prompt → verifyAdminPassword(pw) checks stored hash
            └─ "שכחתי סיסמה" → resetParentPassword() (wipes ONLY that key)
                  └─ modal flips to create mode in place

No hard-coded admin password exists; verifyAdminPassword() = false until set up.
isCurrentUserAdmin() (role parent/manager) auto-unlocks tabs WITHOUT the modal →
any surface collecting the password inline (AddUserModal) must guard the
not-set-up state: UsersTab "הוסף משתמש" routes through a 'setup-for-add'
pending kind first. Client-only gate = devtools-bypassable by design (Tier 3 = backend).
```

## Beta Bug/Feedback Report (2026-06-16) — first backend seam

```
BugReportWidget (mounted in AppShell BOTH branches → on every page incl. games)
  user taps 🐞 → modal: upload screenshot + Hebrew/English description → submit
  └─ prepareScreenshot(file)  (bridge/bugReport)  canvas downscale ≤1280px JPEG
  └─ submitBugReport()
        ├─ bufferLocally()  → bugReports_local (capped; belt-and-suspenders)
        └─ POST /api/report  (multipart: payload JSON + screenshot)
              ↓ Cloudflare Worker (worker/index.ts, wired in wrangler.jsonc)
              ├─ screenshot → R2 REPORTS_BUCKET (english-learning-reports)
              │     → imageUrl = /api/report-image/:key  (served back from R2)
              └─ GitHub Issue via REST (GITHUB_TOKEN secret, GITHUB_REPO var,
                    label `beta-report`) ← the triage queue
non-/api request → env.ASSETS.fetch(request)  (serves the static SPA)

WHY this shape: GitHub Issues is the one queue both the user (Issues tab) and a
Claude session (`gh`) can triage; R2 holds the image because the Issues API
can't attach binaries. Worker is defensive — missing GITHUB_TOKEN ⇒ 200
{queued:true} (no issue, no crash); missing bucket ⇒ 503 on /api only, assets
keep serving. Details: docs/bug-report.md + project_bug_report_feature memory.
GOTCHA: provision R2/secret BEFORE referencing a binding in wrangler.jsonc
(a missing binding breaks the live auto-deploy = push). CLI logins need a REAL
terminal (the `!` bridge can't answer wrangler's skills prompt / gh's menu).
```

## Mic Keep-Alive (G1 cure, 2026-06-11)

```
recording question starts (bridge/pronunciation·abc·phonics startXRecording,
                           useMicPlayback.start)
  └─ ensureMicHold() → one keep-alive getUserMedia stream (cancels pending release)
capture ends (same call sites)
  └─ scheduleMicRelease() → 8s linger timer → releaseMicHold()
        (next recording cancels it → all-mic games stay warm end-to-end;
         mixed games drop the mic dot seconds after a say-question)
hashchange off /game/* or pagehide → releaseMicHold() immediately

WHY: the OS freezes frame delivery for 175–524ms when an audio capture closes;
held device ⇒ per-answer captures don't close the device ⇒ confetti smooth.
Details: project_confetti_first_burst_lag memory + backlog §5 G1.

ANDROID GATE (M1, 2026-06-11): isAndroid() (src/lib/platform.ts) no-ops BOTH
ensureMicHold() and useMicPlayback.start() — Android Chrome's speech
recognition hears silence while the page holds any other getUserMedia stream
(the broken-mic bug on tablet/phone), and the freeze this cures is macOS-only.
The "שמע את עצמך" button self-hides there (it's gated on the captured URL).
ANY future parallel-capture feature must respect the same gate.
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

The legacy welcome-screen DOM + its `updateHomeCardStates`/`updateHeroCard`/hash-nav
handlers were retired in **Slice 4.1**. React owns the home now:

```
HomePage.tsx (React, route /#/home)
  ├─ useGameUnlocks() ──→ polls localStorage gameUnlocks every 500ms; locks card
  │                       when unlocks[id].unlocked === false (ABSENT = unlocked)
  ├─ useContinueTarget() ──→ continue-hero recommendation; recomputes on the
  │                       `engine-ready` event (NOT a one-shot memo) so fresh-login
  │                       and refresh agree on the target (FU-HOME-continue fix)
  ├─ useUserProgress() ──→ words-learned / streak
  └─ Profile is its own React route (/#/profile)
```
Caveat: gating reads *persisted* progress — a fresh user with no saved
`gameUnlocks` shows everything unlocked (see master-plan Slice 4.1 gotcha).
`gameManager.showWelcomeScreen()` (gameLogic.js) now just routes to `#/home`.

## Word Selection per Game

```
getFilteredWordsForGame(gameType)
  ├─ UNGATED (full bank): word-journey, abc, grammar-beginner, practice
  ├─ HYBRID (memory): learned words if ≥12, else full bank
  └─ GATED (all others): learned words only, empty → showLearnFirstPrompt()
```

---

## Expression Data Load + Controls (Phase 5, Slices 5.1–5.2 — no game consumes yet)

```
data/expressions/{idioms,phrasalVerbs,slang}.js
  └─ data/expressions/_index.js → expressionBank (full, unfiltered)
       └─ data/_loader.js: window.expressionBank = expressionBank   (parallel to window.vocabularyBank;
            NOT merged into vocabularyBank/gameData → vocabulary games never see expressions)
            └─ dispatches 'game-data-ready'
src/bridge/expressions.ts (ONLY gateway to window.expressionBank)
  ├─ master: settings.expressionsEnabled (false → getExpressionBank() = [])
  ├─ getEnabledRegisters() ← settings.expressionRegisters (default: kid-friendly on, casual/edgy off)
  ├─ withOverrides() ← customContent.getExpressionMeaningOverridesSync() (by phrase, applied live)
  ├─ getExpressionBank() = master ? withOverrides(raw filtered by registers) : []
  └─ getAllExpressions() = withOverrides(raw)   (ignores master + registers — for the manager)
       └─ src/hooks/useExpressions.ts re-reads on 'game-data-ready'

Settings tab "ביטויים" (parent-locked, ExpressionsTab):
  ├─ master + register Toggles → useSettings.updateSettings({ expressionsEnabled, expressionRegisters })
  └─ ExpressionsPanel edit → customContent.set/removeExpressionMeaningOverride(phrase, he)
       → expressionMeaningOverrides localStorage → next getExpressionBank/getAllExpressions reflects it
```

**Expression games (Slices 5.3–5.4 — SHIPPED):** self-contained surface, NOT the legacy
gameManager word-pool path.

```
data/expressions/plainForms.js (phrase → plainEn, Slice 5.4)
  └─ data/_loader.js: window.expressionPlainForms
       └─ src/bridge/expressions.ts: getExpressionPlainForm(phrase)

React route /#/game/expr-{meaning,truefalse,blank,build,swap}
  └─ GameHostPage → REACT_GAMES['expr-*'] → expressions/pages.tsx wrapper → ExpressionGamePage(mode)
      ├─ buildExpressionSession(mode)  (src/bridge/expressionGame.ts)
      │   ├─ getExpressionUnlock(): getDerivedLearnedCount() ≥ 50 AND getExpressionBank().length>0
      │   │     (single source of truth — HomePage expressions tier gate too; NOT gameUnlocks)
      │   └─ buildOne(mode): meaning/truefalse/blank/build + swap (plainEn prompt, skip if no plain form;
      │         distractors exclude shared meaningHe/plainEn → one defensible answer)
      └─ recordExpressionAnswer(phrase, ok) → gameManager.recordExpressionAttempt
            ├─ progressManager.recordExpressionAttempt → expressionMastery[phrase] (mastered at 3 correct)
            └─ Slice 5.5: getMasteredExpressionCount() ≥ 30 → certificateManager.awardCertificate(
                  'milestone_expressions_30', "אלוף ביטויים")  (idempotent via hasCertificate)

Progress surfaces (Slice 5.5):
  ├─ bridge/stats.ts buildExpressionStats() joins expressionMastery × getAllExpressions()
  │     → UserStatsModel.expressions → StatsPage ExpressionStatsCard (per-type breakdown)
  └─ bridge/progress.getMasteredExpressionCount() → ProfilePage "ביטויים" MiniStat (when >0)
```

**Invariants:** keep the two catalogs disjoint (pinned by `expressions.test.ts`); the dev route
`/#/dev/expressions` was retired in 5.2 — the parent ביטויים tab is the only browse/edit surface.
A NEW expression game id must be registered in 5 places (reactGames, GameHostPage, gameRegistry,
HomePage GAME_ORDER, pages.tsx wrapper).

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

## Parent Custom Content (Slice 4.3 — Python-free)

The parent "Advanced Tools" (settings `/#/settings` → כלי הורה) run entirely in
React via `src/bridge/customContent.ts` (async seam) — no `server.py`.

```
CustomWordsPanel  → wordImport.importCustomWords() → api.anthropic.com (browser-direct)
  → customContent.saveCustomWords() → localStorage.customWords_global
    → window.refreshCustomWords()  (data/_loader.js) → live vocabularyBank + gameData

WordImagesPanel image → customContent.setImageOverride()
  → localStorage.wordImageOverrides + window.wordImageOverrides (live, sync)
    → games read window.wordImageOverrides → real image OR emoji fallback
WordImagesPanel translation → customContent.setTranslationOverride()
  → localStorage.wordTranslationOverrides
    → applied at BOOT in data/_loader.js (before nikud + gameData build)  ⟹ reload to see it

Export/Import JSON → customContent.exportAll()/importAll()  (backup, replaces save-to-source)

Nikud: utils/nikud.js loadNikudMap() = static data/nikud-map.json ⊕ localStorage.nikudCache;
  missing words → Dicta API direct (CORS-fail → raw Hebrew) → persistNikudEntries() caches.
```

Boot hydration of `window.wordImageOverrides` currently comes from `utils/imageRenderer.js`
(loaded via the legacy `games/*.js` import chain). When Slice 4.4 deletes those, hydrate it
from the `customContent` bridge at React boot (see FU-4.3-idb).

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
      │   ├─ Sneak peek (F1): 👁 הצצה button re-flashes the hidden word for sneakPeekDuration; sneakPeekBudget peeks/question (settings; on by default)
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

Slice 3.7.1 retired the duplicate `word-builder` game (shipped briefly in 3.6) and folded its 15 pts/correct scoring into Fill Blanks — both games pulled from the same `data/sentences.js` pool with near-identical UX, so the duplication was UI-only. Legacy `/#/game/word-builder` bookmarks redirect via `GameHostPage.RETIRED_GAMES`. Orphan localStorage (`savedGame_<uid>_word-builder`, `v2_wordbuilder_audio_<uid>`) is swept on first boot in `src/engine/boot.ts:initEngine` (was `app.js:setupWithAuth` before the b1 engine cutover). Audio-state key for the surviving game is `v2_fillblanks_audio_<userId>`.

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

### E8 (bug-dump 2026-06-07, shipped 2026-06-09) — new-words exposure layer

```
src/bridge/newWords.ts  detectNewWords(text|texts, {learnedSet?, bank?})
  ├─ bank = window.vocabularyBank (index cached by array identity)
  ├─ learnedSet = lowercased words from getLearnedWordKeySet() (key.split('_')[0])
  └─ returns bank words in the text NOT learned (exact + shallow -s stem),
     de-duped, translation from the bank entry. Exposure-only.
src/features/games/shared/NewWordPill.tsx
  ├─ NewWordPill — blue speaker-pill; tap → Hebrew tooltip + speakWord→speakHebrew
  └─ SentenceText(text, newWords, renderWord) — tokenizes a fragment, swaps matched
     tokens for pills, leaves the rest plain.
GrammarGamePage + BlankFillGamePage (Articles, Progressive):
  ├─ newWordsList = detectNewWords(sentence.replace('___',' '))  (memo per question)
  ├─ before/after sentence fragments rendered via <SentenceText> (pills ALWAYS, D2)
  └─ after answering: new-word rows MERGED into the same WordTable (D3) — correct ✓,
     chosen ✗ (if wrong), then new words (no mark). NOT recorded to mastery.
```

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
      │   │   (fallbacks fill slots when a category has no learned word).
      │   │   buildStoryFromTemplate also auto-detects NEW words (E6): every
      │   │   bank word in the rendered text NOT in the learned set → story.
      │   │   highlights (exact + shallow -s stem); learned slot words → plain.
      │   │   story.reinforceWords = the learned slot words (recording source).
      │   └─ Stash on gameManager: shuffledQuestions=stories,
      │       totalQuestions=sum(quizQuestions), currentQuestionIndex=0
      ├─ Phase state machine (read → quiz → answered → next):
      │   ├─ Read phase: StoryReadPhase renders sentences with tappable
      │   │   highlights = NEW/unlearned words (speakWord→speakHebrew on tap +
      │   │   translation tooltip), a per-sentence 🔊 button (speak() on tap),
      │   │   and a "מילים חדשות בסיפור" WordTable of the same new words.
      │   ├─ "מוכן לשאלות" → switches to quiz phase, cancels speech.
      │   ├─ Quiz phase: StoryQuizPhase reuses shared AnswerGrid (2–3 cols,
      │   │   text variant) over question.options.
      │   └─ Answer → recordStoryQuizAnswer(story, question, idx):
      │       +15 pts on correct (legacy story-time-game.js:249) +
      │       recordWordAttempt for every story.reinforceWords entry (learned
      │       slot words only — NEW highlights are exposure-only, E6) +
      │       currentQuestionIndex++ + saveGameState (always).
      ├─ Correct → confetti + getGameFeedback audio + auto-advance 1.5s
      ├─ Incorrect → reveal correct option + "השאלה הבאה" footer button
      ├─ Advance order: next quiz Q within story → next story (back to read)
      │   → finishStoryTimeSession → gameManager.endGame → RewardModal.
      └─ Exit/reset/unmount → abortStoryTimeSession() + cancelSpeech.
```

Resume is intentionally unsupported in the React port: legacy story-time persists `currentQuestionIndex` (quiz answers across stories) but not `storyIndex`, so reopening silently restarts at story 0 — broken. The bridge clears saved state on every `begin` to keep behavior consistent with what legacy *appeared* to do. Total progress counter (`qp-current`) tracks answered quiz questions across all stories so the user sees one monotonic bar from story 1 through the final reward modal.

## Word Journey Game (React — Slice 3.13)

```
React route /#/game/word-journey
  └─ GameHostPage.tsx → REACT_GAMES['word-journey'] → WordJourneyGamePage.tsx
      ├─ beginWordJourney()  (src/bridge/word-journey.ts)
      │   ├─ setGameContext('word-journey') + deleteGameState (no resume)
      │   ├─ words = gameManager.getWordJourneyWords() (mastery-aware, paced
      │   │   3/5/8 by learningPace); <3 → kind:'no-words'
      │   ├─ Pre-builds per-stage data: listen-match options (selectDistractors),
      │   │   spell tiles (+distractor letters), recall word list
      │   └─ Stash on gameManager: shuffledQuestions=5 stage ids, totalQuestions=5
      ├─ Fixed stage machine (WJStageBar shows the map):
      │   ├─ Discover (unscored): picture+word+audio, per-word listen budget
      │   │   (Slice 3.0 carry-forward), Next enables after dwell + speech.
      │   ├─ Listen-Match (+10): audio gate → AnswerGrid media options.
      │   ├─ Spell (+10): letter bank → built word; correct voices the word,
      │   │   wrong shows shared SpellingComparison (letter-by-letter green/red).
      │   ├─ Say-Word (+10): reuses pronunciation bridge mic + local levenshtein
      │   │   compare, records under 'word-journey'. (No E2E — speech stub gap.)
      │   └─ Recall (+5/pair): memory grid; match = same word, word vs translation.
      ├─ Each scored answer → recordWJAttempt(word, isCorrect, points):
      │   recordWordAttempt('word-journey') (feeds the mastery lifecycle) +
      │   scoreManager.addPoints. Page tallies correct / totalScored in refs.
      ├─ After recall → finishWordJourney(words, correct, totalScored):
      │   history + totalPoints reconcile + coins (half in replay) +
      │   checkAndUnlockGames (NEW counts) + persist. **No graduateWord** — the
      │   legacy endGame batch-graduation path is never called. Returns
      │   {percentage, newlyUnlocked, summary[]}.
      ├─ Celebration: WJCelebration animates this journey's words in with
      │   picture + audio + status (✓ נלמד / ⏳ לומד). Play-again / practice
      │   (setReplayMode) / home.
      └─ Exit/reset/unmount → abortWordJourney() + cancelSpeech.
```

Per-word graduation is emergent: WJ records real per-word attempts each stage, so a word the child nails climbs toward Learned on its own while a fumbled word stays Learning — there is no batch ≥60% rule. `newlyUnlocked` from `finishWordJourney` will feed the app-wide unlock modal (step 6).

## Memory Game (React — Slice 3.14)

```
React route /#/game/memory
  └─ GameHostPage.tsx → REACT_GAMES['memory'] → MemoryGamePage.tsx
      ├─ beginMemory()  (src/bridge/memory.ts)
      │   ├─ setGameContext('memory') + deleteGameState (no resume)
      │   ├─ pool = vocabularyBank ∩ selectedCategories, then ∩ _getLearnedWordSet()
      │   │   (INTRODUCED keys) unless settings.gameUnlockOverride
      │   ├─ pool < 6 → kind:'learn-first' (prompt links to word-journey)
      │   └─ Stash on gameManager: shuffledQuestions=3 level configs, totalQuestions=3,
      │       resetScore('memory'), coinHistoryStartIndex
      ├─ 3 fixed levels (6/9/12 pairs, 4/6/8 cols). buildLevelCards(pool, idx):
      │   daily-seeded pair selection (parity) → word card + translation card per pair,
      │   shuffled. Cards expose data-pair/data-index/data-state.
      ├─ Flip mechanics in MemoryGamePage (refs, not state, for the timed callbacks):
      │   ├─ click → voice English word (allowOverlap); 2nd flip locks processingRef,
      │   │   moves++, resolvePair after 700ms.
      │   ├─ match (same pairId): combo++/maxCombo, points = 10 + (combo≥2?5×combo:0)
      │   │   + (firstTry?10:0); recordMemoryMatch (recordWordAttempt 'memory', correct);
      │   │   "<hebrew> is <english>" celebration (speechGen ref cancels on nav);
      │   │   playAnswerSfx('correct'); popup chip.
      │   └─ mismatch: combo=0, recordMemoryMismatch (both word-cards incorrect),
      │       playAnswerSfx('incorrect'), flip back after 1000ms.
      ├─ all pairs matched → finishMemoryLevel(idx, moves, time, levelScore, maxCombo):
      │   stars (mistakes thresholds + 4th speed star), coins (coinManager.awardCoins),
      │   scoreManager.addPoints(levelScore) → cumulative; personal best →
      │   memoryBest_<userId> (same shape stats reads). → MemoryLevelSummary.
      ├─ level < 3 → next-level button → setupLevel(idx+1). level 3 →
      │   finishMemoryGame(): updateProgress + saveGameScoreToHistory + totalPoints
      │   reconcile + checkAndUnlockGames(NEW counts) + queuePendingUnlocks + persist.
      │   **Never calls legacy endGame** (like Word Journey).
      └─ Exit/reset/unmount → abortMemory() + clearTimers + cancelSpeech.
```

Memory's React port intentionally gates on *introduced* words (legacy used the full bank, ungated) and drops mid-run resume — React owns the DOM, so the legacy phantom-flip guards (stale listeners, ghost-click lock, board generation) are not reimplemented.

## ABC Game (React — Slice 3.15)

```
React route /#/game/abc
  └─ GameHostPage.tsx → REACT_GAMES['abc'] → ABCGamePage.tsx
      ├─ beginABCSession({fresh?})  (src/bridge/abc.ts)
      │   ├─ setGameContext('abc')
      │   ├─ resume: loadGameState('abc') (savedGame_<userId>_abc) → restore
      │   │   shuffledQuestions/index/score (Grammar Beginner pattern)
      │   └─ fresh: generateABCQuestions(20) (legacy data/abcData.js, reads
      │       app.userProgress.wordMastery, filters letters at mastery ≥ 0.8)
      │       ├─ []  → kind:'all-mastered' → <ABCAllMastered/> congrats screen
      │       │        (reset → gameManager.resetABCMastery() + fresh restart)
      │       └─ else → stash on gameManager (shuffledQuestions=fresh, totalQuestions
      │                =min(20,len), resetScore('abc'), coinHistoryStartIndex). NOT
      │                reshuffled (generator pre-orders for variety).
      ├─ 6 subtypes, one page (switch on question.type):
      │   ├─ match-case / letter-sound / identify-case / alphabet-order → AnswerGrid,
      │   │   AUDIO-GATED: options hidden until letter phonetic auto-plays (voice
      │   │   readiness poll → setAudioRevealed). letter-sound shows '?' glyph.
      │   ├─ word-picture → emoji prompt, options shown immediately, voices the WORD.
      │   └─ say-letter → mic button (isSpeechRecognitionAvailable / startABCRecording);
      │       unsupported → message + skip. No audio gate.
      ├─ answer (MC) → recordABCAnswer(q, idx): recordWordAttempt(letter,'abc',correct)
      │   → <letter>_abc mastery; +10 on correct; mgr.currentQuestionIndex++; saveGameState.
      ├─ answer (say-letter) → recordABCSpeechAttempt(q, {transcript}): lenient match
      │   (contains phonetic/letter OR Levenshtein ≤ 2); same mastery/score/index advance.
      ├─ settleAnswer: getGameFeedback('abc',…) (fires SFX implicitly) + banner.
      │   correct → confetti + auto-advance 1.5s. wrong → voice correct letter/word +
      │   reveal correct option + abc-next button (manual advance).
      ├─ advance → index+1; next ≥ total → phase 'finished' → finishABCSession()
      │   (legacy endGame) → RewardModal.
      └─ Exit/reset/unmount → abortABCSession() + stopABCRecording + cancelSpeech.
```

ABC is mastery-driven (its own `<letter>_abc` keys), NOT learned-word gated — it is a
learn-tier game, always unlocked. Six subtypes live in one page (Grammar Beginner Slice 3.9
model). The `say-letter` mic path has no Playwright coverage (Slice 3.11 stub gap); tests
inject deterministic `match-case` saved state.

## Practice Game (React — Slice 3.16)

```
React route /#/game/practice
  └─ GameHostPage.tsx → REACT_GAMES['practice'] → PracticeGamePage.tsx
      ├─ beginPracticeSession()  (src/bridge/practice.ts)
      │   ├─ setGameContext('practice'); deleteGameState('practice')
      │   ├─ NO resume — practice is never persisted (legacy parity:
      │   │   gameLogic.js saveGameState/loadGameState special-case 'practice').
      │   ├─ pool = Due-first Learned set (redesign §5/§6):
      │   │   ├─ progressManager.getDueWords(cats)          → front of list
      │   │   ├─ progressManager.getWordsByStatus('learned',cats), minus the
      │   │   │   Due ones (Due is an overlay on Learned) → rest of list
      │   │   ├─ each {word,category} mapped to a full question object via
      │   │   │   gameData.pronunciation keyed by `word_category` (same convert
      │   │   │   shape as Pronunciation: word/phonetic/hebrew/picture/imageUrl)
      │   │   └─ gameUnlockOverride (parent bypass) → practice the whole bank
      │   ├─ 0 words → kind:'learn-first' → <PracticeEmpty/> ("nothing to review
      │   │   yet", CTA → /game/word-journey)
      │   └─ else → cap to settings.questionsPerGame (default 10); stash on
      │       gameManager (shuffledQuestions/totalQuestions/resetScore('practice')/
      │       coinHistoryStartIndex)
      ├─ Per question (identical mechanic to Pronunciation Slice 3.11):
      │   ├─ MediaPromptCard picture + word (caseMode) + Hebrew (showNikud)
      │   ├─ auto-play target word via speakWord(word.toLowerCase(),'practice')
      │   ├─ tap mic → startPronunciationRecording() (re-exported from
      │   │   bridge/pronunciation — GAME_TYPE-agnostic speech helpers)
      │   ├─ parallel MediaRecorder → "שמע את עצמך" playback (same as Slice 3.11)
      │   └─ result → recordPracticeAttempt(q,{transcript}):
      │       comparePronunciation → accuracy ≥ 0.7 correct; pts = round(acc*10)
      │       on correct; recordWordAttempt(word,cat,correct,0,'practice') +
      │       addPoints + currentQuestionIndex++  (NO saveGameState — ephemeral)
      ├─ correct → praise audio + confetti + auto-advance 1.5s
      ├─ incorrect → praise audio + 400 ms + replay target + practice-next button
      └─ Final question → finishPracticeSession() → RewardModal
          (self-contained: updateProgress + saveGameScoreToHistory('practice') +
           totalPoints delta + checkAndUnlockGames + saveUserProgress; NEVER the
           legacy DOM endGame, whose practice branch assumes #practice-game markup)
```

Practice is the dedicated **Due/weak-word review** surface under the learning-flow redesign.
It is the **last game type to migrate — Phase 3 game migration is now complete** (every entry
in the catalog renders in React). Divergences from legacy `games/practice-game.js`: pool is
Due-first Learned (legacy used struggling words at mastery < 0.5); the session is **scored and
banked to history/totalPoints** (legacy was "session-based, no scoring") for parity with every
other React game's RewardModal. Mic path has no Playwright coverage (Slice 3.11 stub gap); tests
cover the empty state, the Due-pool render, and exit.

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

## Nikud rendering (React-owned, FU-4.4-nikud — applies to ALL React games)

```
header-nikud-toggle click → toggleShowNikud() (bridge/textPrefs)
  → saveSettings({showNikud}) + dispatch 'nikud-changed'
  → useTextPrefs re-renders subscribers (showNikud state)
  → useNikud()'s nk(text) re-applies per the new flag:
       on  → text.replace(HebrewRun, w => window.nikudMap[w] || w)
       off → stripNikud(text)
GameHostPage wraps <ReactGame/> in <div data-react-nikud-owned>
  → utils/nikudDOM.js early-returns inside that subtree (no DOM mutation → no React reconcile crash)
```

Chrome literals are vowelized by React itself (`nk()` per component), NOT by nikudDOM. Word *data* Hebrew (`word.hebrew`) is pre-enriched at boot and toggled via `stripNikud`. The old crash was nikudDOM structurally mutating React nodes during the toggle re-render; excluding the subtree removes the shared-ownership conflict. `showNikud` defaults true. A new game that forgets `nk()` on its chrome silently renders it un-vowelized. See `project_fu44_nikud_react_owned` memory.

## Launchable Course Activity Chain (Slice C1)

```
CoursesPage: tap a topic's launchable activity badge (vocabulary|listening|picture-match|true-or-not)
  └─ bridge/courseSession.startTopicActivity({topicId, activityType, topicWords})
       ├─ courseManager.startTopic(topicId)                 ──→ topicProgress[id].started
       ├─ gameManager.deleteGameState(activityType)         ──→ no stale resume
       └─ gameManager.setCourseActivityContext(...)         ──→ currentTopicId/Activity/Words set
  └─ navigate('/game/<activityType>')
       └─ begin<Game>Session(): isCourseMode()===true
            ├─ skip mid-game resume + skip learned-word filter
            └─ pool = ONLY topic words. vocab/listening/picture-match via
               getScopedQuestionPool() (src/engine/gameManager.ts); true-or-not builds from
               getActiveTopicWords() directly (bypasses getScopedQuestionPool and must
               NOT fall back to allWords — that would un-scope a sparse topic)
               • CATEGORY-INDEPENDENT (baseline fix #1, 2026-06-05): in course mode
                 getScopedQuestionPool sources from the FULL converted bank
                 (gameDataProvider()[gameType]), NOT the category-/difficulty-filtered
                 this.gameData. So unchecking a topic's category in Settings no longer
                 empties its pool — the launched topic IS the curriculum. Non-course
                 play still respects the Settings filter (currentTopicActivity guard).
  └─ finish: finish<Game>Session() → gameManager.endGame()
       └─ (gameLogic.js:3404) app.updateProgress(%, getProgressUpdateContext())
            └─ (app.js:1641) _trackCourseActivityFromGame
                 └─ courseManager.completeGameActivity({topicId})  ──→ topic credited,
                    coins/cert awarded, next topic/course unlocked  (NO extra bridge call)
  └─ exit (RewardModal exit OR ExitConfirm): goExit()
       ├─ getActiveCourseSession() !== null → clearCourseSession() + navigate('/courses')
       └─ else navigate('/home')
```

> **Invariants:** never route through legacy `performGameSwitch` (it clears the context on a
> game-type mismatch, gameLogic.js:1733); clear the context ONLY on user-triggered exit, never
> at finish (endGame is async + reads context late → early clear races the credit). As of
> Slice 4.4.b3 the CourseManager (and all engine instances) are reached by APP CODE via
> `getApp()`/`getGameManager()` from `src/engine/instances.ts` — NOT `window.*`. `window.courseManager`
> is gone; `window.app`/`window.gameManager` survive ONLY as a Playwright test/debug seam
> (`courseManager` is read off `window.app.courseManager`). `window.appManager` never existed (its
> accidental use once left CoursesPage rendering empty).

## Critical File Locations

| Function | File | Line |
|----------|------|------|
| `graduateWord()` | managers/ProgressManager.js | ~580 |
| `checkAndUnlockGames()` | managers/ProgressManager.js | 644 |
| `getFilteredWordsForGame()` | app.js | 1553 |
| `getWordJourneyWords()` | gameLogic.js | 3403 |
| `endGame()` | gameLogic.js | ~2920 |
| `showLearnFirstPrompt()` | gameLogic.js | ~2321 |
| `useGameUnlocks()` (React; replaced legacy `updateHomeCardStates`) | src/hooks/useGameUnlocks.ts | — |
| `checkMilestoneCertificates()` | app.js | ~924 |
| `checkGameMilestoneCertificates()` | app.js | ~964 |
| `getRecommendation()` | app.js | ~662 |
| `showCelebration()` | games/word-journey-game.js | 1130 |
| `awardCoins()` | managers/CoinManager.js | 64 |
| `renderProfileScreen()` | app.js | ~527 |

> **Note:** Line numbers shift as the codebase evolves. Use function names for search, not line numbers.
