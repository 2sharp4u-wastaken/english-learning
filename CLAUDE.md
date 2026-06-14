# CLAUDE.md — English Learning Game (v3 — React Migration)

Behavioral rules for Claude Code in this project. These override defaults.

## Project Identity
- Hebrew-speaking kids, ages 5–8, learning English
- RTL interface (`dir="rtl"`, `lang="he"`)
- Hybrid app: React (Vite + TypeScript + Tailwind) progressively replacing legacy vanilla JS
- **Master plan:** `docs/master-plan.md` — the source of truth for migration phases and decisions (history + the *why*)
- **Open work:** `docs/backlog.md` — the single source of truth for what's left to do; the other docs point here for status

## Dev Setup
- **Run the app:** `npm run dev` (Vite, port 3002) — that's all. As of Slice 4.3 the app is **fully Python-free** (no `/api/*` calls). Open `http://localhost:3002`.
- **`server.py` is OPTIONAL** (port 3000) — a maintainer-only tool for regenerating the static `data/nikud-map.json` (Dicta Nakdan CORS proxy) and baking authored content to source. Nothing the running app does requires it.
- **Microphone:** `localhost` is a secure context over HTTP, so mic games work with just `npm run dev`. For LAN-IP testing add `server.https` in `vite.config.ts` (or use the optional `server.py` with `server.crt`/`server.key`).

## Rules

### Never auto-commit or auto-push
Always ask before committing or pushing. Show the diff summary and wait for explicit approval.

### Slice closeout discipline
Before committing a non-trivial change or ending a session, consult the `feedback_cross_session_continuity` memory and run its closeout (master-plan + wiring-map + memory with WHY annotations + lean auto-load + cold-start verification). This includes a **forward-propagation review**: ask whether what this slice taught should update the instructions for *following* slices, *broader*/template-level patterns, or project-wide conventions — and edit those (master-plan slice entries, templates/recipes, docs, CLAUDE.md) so a fresh session inherits it without the user re-stating it. A PreToolUse hook nudges this on every `git commit` — don't ignore it. Skip for doc/typo/trivial fixes.

### Read before modifying
Read every file you plan to change before touching it. Do not suggest changes to code you haven't read.

### Keep the logger lean
`utils/consoleLogger.js` must use an in-memory array only — never localStorage persistence per log call, as it causes severe UI slowdown.

### Keep docs in sync
When changing any setting, game mechanic, or learning flow — update the relevant file in `docs/` in the same session.

### Bridge is the only gateway to legacy
React components must never access `window.*` globals or `localStorage` directly. All legacy data access goes through `src/bridge/*.ts` modules. React hooks in `src/hooks/` consume bridge modules. Existing bridges: `auth`, `audio`, `categories`, `courses`, `courseSession`, `feedback`, `games`, `progress`, `settings`, `stats`, `storage`, `textPrefs`, `vocabulary`. Add new ones as needed; never bypass. `courseSession` is the only gateway for launching a topic's activity from `/courses` (sets the legacy course context so the game pool scopes to the topic words). Note: the CourseManager global is `window.courseManager` / `window.app.courseManager` — there is **no** `window.appManager`.

### CSS containment
- Tailwind Preflight is **disabled** — the React app supplies its own reset under `#react-root` in `src/styles/globals.css`
- **As of Slice 4.5 the legacy `styles.css` + `game-completion-styles.css` are DELETED.** All styling is `src/styles/*` (tokens/themes/globals) + Tailwind utilities + the one scoped `src/features/auth/login.css` (the ported LoginPage `.auth-*` block). `index.html` is React-only; no global legacy stylesheet, no font-awesome/Poppins CDN (Lucide icons + Heebo/Fredoka fonts)
- No Tailwind prefix — utility classes don't collide (no more legacy semantic class names in play). If a collision with `login.css` is ever found, fix it per-case

### RTL-first
Design and implement RTL first. Use Tailwind logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`) and RTL utilities (`rtl:`, `ltr:`). Test RTL in every slice.

## Architecture Quick Reference

### Hybrid structure
```
/                    ← project root
  index.html         ← Vite entrypoint (has both #react-root and legacy markup)
  app.js             ← legacy orchestration / AppManager engine (kept until Slice 4.4.b)
  gameLogic.js       ← legacy GameManager engine — still the live backend the React bridges drive (kept until Slice 4.4.b)
  games/             ← EMPTY: legacy game-UI files deleted in Slice 4.4.a (React renders every game)
  managers/          ← legacy managers (ScoreManager, ProgressManager, etc.) — still driven by bridges
  data/              ← shared data (used by both legacy and React)
  src/               ← React app (Vite + TypeScript + Tailwind)
    bridge/          ← typed adapters to legacy globals and localStorage
    hooks/           ← React hooks consuming bridge modules
    features/        ← page-level features (home, profile, settings, etc.)
    ui/              ← shadcn/ui primitives
    components/      ← shared app components
    app/             ← shell, router, providers
    styles/          ← tokens, themes, scoped reset
```

### Routing
Hash-based routing via React Router (`createHashRouter`):
- `/#/home`, `/#/profile`, `/#/courses`, `/#/stats`, `/#/settings`, `/#/game/:gameId`
- `index.html` is the only HTML file (Slice 4.5 deleted the last legacy markup); every page is a React route

### Word object schema
```js
{ word, translation, category, image, imageUrl? }
```

### localStorage keys
- `currentUser` — active user ID
- `v2_userProgress_<userId>` — progress, wordMastery, streak, certificates
- `v2_englishLearningSettings` — app settings
- `v2_authUsers` — all user accounts
- `customWords_global` — parent-added custom words (note: **no** `v2_` prefix; read at boot by `data/_loader.js` and via `src/bridge/customContent.ts`). Related parent-content keys (also unprefixed): `wordImageOverrides`, `wordTranslationOverrides`, `nikudCache`, `expressionMeaningOverrides` (Phase 5 — expression Hebrew-meaning overrides keyed by phrase, applied live by `src/bridge/expressions.ts`).
- `parentPassword` — per-device parent (admin) password hash, unprefixed (Tier 2, 2026-06-10). There is NO hard-coded admin password anymore: `verifyAdminPassword()` is false until the `ParentPasswordModal` create wizard runs on first protected access. Any surface that collects the parent password inline (not via the modal) must guard the not-set-up state. Tests seed the hash (`seedParentPassword` in `tests/react-routes.spec.js`).
- All keys use `v2_` prefix (set in `app.js`)

### Managers (legacy, in `managers/`)
ScoreManager, ProgressManager, GameRegistry, CourseManager, CertificateManager, CoinManager
Initialized after auth in `app.js → AppManager.setupWithAuth()`.
Accessed from React only via `src/bridge/` modules.

### Game types
`vocabulary`, `grammar`, `grammar-beginner`, `pronunciation`, `listening`, `reading`, `practice`, `abc`, `phonics`, `memory`, `scramble`, `fill-blanks`, `word-journey`, `story-time`, `picture-match`, `true-or-not`, plus the Phase 5 expression games `expr-meaning`, `expr-truefalse`, `expr-blank`, `expr-build`, `expr-swap`.

**Expression games (Phase 5, Slices 5.3–5.4)** are a *self-contained* surface — they do NOT go through the legacy `gameManager` word-pool selection / `wordMastery` recording like the vocabulary games. They read register-filtered phrases from `getExpressionBank()` (via `src/bridge/expressionGame.ts`), one parameterized page `src/features/games/expressions/ExpressionGamePage.tsx` (`mode` per game id — 5 modes: meaning/truefalse/blank/build/**swap**), and record into a separate `expressionMastery` map keyed by phrase (`recordExpressionAttempt` on the engine). They live on the Home "ביטויים" tier and are gated at 50 derived-learned words by `getExpressionUnlock()` (the single source of truth — NOT the `gameUnlocks` map). **`expr-swap` (Context Swap, Slice 5.4)** shows a plain-English synonym (`data/expressions/plainForms.js` → `window.expressionPlainForms` → `getExpressionPlainForm()`) and asks the child to pick the matching expression; phrases without an authored plain form are skipped. **Slice 5.5** surfaces `expressionMastery` in Profile/Stats and awards the `milestone_expressions_30` "אלוף ביטויים" certificate (awarded inside `gameManager.recordExpressionAttempt` at 30 mastered). Details: `project_slice53_expression_games` + `project_slice54_55_expressions` memories.

### React games registry
- `src/features/games/reactGames.ts` — `REACT_GAME_IDS` set; the source of truth for which games run in React vs legacy. Adding an ID here triggers `react-shell-active` to stay on during that game route so the legacy DOM is suppressed.
- `src/features/games/GameHostPage.tsx` — `REACT_GAMES` record maps ID → component. Every catalog game is in the record; as of Slice 4.4.a the legacy game-UI layer is deleted, so `bridge/games.launchGame()` is just a `console.warn` for an unknown gameId (no legacy fallthrough left).

### Shared game primitives (Phase 3 reuse, do not duplicate)
- `src/features/games/shared/GameScreenShell.tsx` — hero + header + progress + main + footer slots. Forwards `header.title/icon/subtitle` to `<GameHero>` and the rest of `header` to `<GameHeader>`. **`fitViewport` defaults `true`** (since the 2026-05-27 UX pass): the shell is one screen (`100dvh`), header/title/progress/footer stay pinned, and only `<main>` scrolls if it overflows — so a footer "next" button is never pushed below the fold. New games get this free; pass `fitViewport={false}` only if a game genuinely needs page scroll.
- `src/features/games/shared/GameHero.tsx` — **canonical title placement** (adopted 2026-05-23). Big centered icon + title rendered *between* the header card and the progress strip, with a hairline gradient divider. Every React game gets this for free via `GameScreenShell`; pages just declare `headerProps = { title, icon, score, onBack }` as before. Do NOT render the title anywhere else, and do NOT add another title element inside game pages. Optional `header.heroAside` slot renders content to the physical LEFT of the centered title (stacks below on narrow screens).
- `src/features/games/shared/GameHeader.tsx` — controls row only: back button, score, coins, case + nikud toggles (via `useTextPrefs`). `title`/`icon`/`subtitle` are accepted on the props for shell forwarding but intentionally not rendered here.
- `src/features/games/shared/QuestionProgress.tsx` — "שאלה N מתוך M" + reset button. Optional `center` slot sits between the label (right) and reset (left) — Word Journey puts its `WJStageBar` there.
- `src/features/games/shared/MediaPromptCard.tsx` — word/translation/media slot + audio button (`audioIconOnly` for legacy speaker look; omit `word` for audio-only games). `wordHidden` reserves the word's layout box but hides it (`visibility:hidden`) — use it to flash-then-hide a word without the card shifting (Reading), instead of toggling `word` to `undefined`.
- `src/features/games/shared/AnswerGrid.tsx` — N options grid (`columns={2|3|4}`, `variant='text'|'media'`, `hidden` for audio gate). Supports an optional `sublabel` per option, rendered as small Hebrew gloss under the main label (used by Slice 3.10 Grammar for bilingual options).
- `src/features/games/shared/FeedbackBanner.tsx` — correct/incorrect floating banner
- `src/features/games/shared/RewardModal.tsx` — end-of-session reward
- `src/features/games/shared/ExitConfirmDialog.tsx` — "leave game?" modal
- `src/features/games/shared/SpellingComparison.tsx` — "learn from the mistake" panel for letter-building games: correct word (green) above the child's attempt with per-position green/red letters. Used by Reading + Word Journey spell. Pair it with voicing the correct word on a correct answer.
- `src/features/games/shared/SentenceComparison.tsx` — word-order sibling of `SpellingComparison` for word-sequence games (Sentence Scramble): correct sentence (green word-chips) above the attempt, each attempted word green when it's in the right position, red otherwise.
- `src/features/games/shared/WordTable.tsx` — shared "word → Hebrew → 🔊 play" review table (`rows: {word, hebrew, mark?}[]`). Hebrew right · English+optional ✓/✗ mark middle · play left. Owns the case toggle (English), nikud (`nk()` the Hebrew), de-dupe, and default English→Hebrew audio. Used by Story Time (read-phase highlights) + Grammar + Fill-blanks (after-answer correct ✓ / chosen ✗). Fill-blanks options are bare function words with no per-word Hebrew, so its glosses resolve from a shared `optionTranslations` map in `data/sentences.js` (`getOptionHebrew`, re-exported via `bridge/fill-blanks.ts`) rather than a per-sentence array. Spec: `docs/word-table-spec.md`.
- `src/features/games/shared/useMicPlayback.ts` — reusable parallel mic-capture hook for a "שמע את עצמך" (hear-yourself) replay button. webkitSpeechRecognition doesn't expose its audio, so this opens a second getUserMedia stream + MediaRecorder alongside the recognition call: `await start()` before recognition, `const url = await stop()` after, render `new Audio(url)`. Owns the latest object URL (revokes on next stop/release/unmount). Used by Pronunciation + Word Journey's say-word stage.
- `src/lib/speechMatch.ts` — **`isBalancedSpeechMatch(target, transcript, {aliases, threshold})`**: the say-it scorer for ABC say-letter, Phonics say-sound, Word Journey say-word (via `bridge/abc`, `bridge/phonics`, `SayWordStage`). Exact short-circuit + per-word first-letter gate + length-scaled similarity + 0.7 bar; rejects wrong words ("beach"≠"peach", "see"/C≠"bee"/B) while tolerating ASR noise. Numeral fold (19↔nineteen) built in. Pronunciation/Practice use the legacy `comparePronunciation` instead (already balanced) — converge later. Do NOT reintroduce a per-game `said.includes(target) || levenshtein≤2` matcher. WHY: backlog M10.
- `src/bridge/micHold.ts` — **mic keep-alive (G1 cure)**: the OS freezes frame delivery when an audio capture closes, which used to land under the answer confetti on mic games. Recording bridges call `ensureMicHold()` at capture start and `scheduleMicRelease()` (8s linger) at capture end. A NEW mic game must route recording through an existing bridge (`bridge/pronunciation` etc.) or add these two calls — otherwise its confetti stutters. **Android gate (M1):** the hold AND the `useMicPlayback` hear-yourself recorder no-op via `isAndroid()` (`src/lib/platform.ts`) — Android speech recognition hears silence while the page holds another mic stream; never add a parallel capture without this gate. Chain: `docs/wiring-map.md` → "Mic Keep-Alive"; WHY: `project_confetti_first_burst_lag` memory.
- `src/features/games/shared/LetterSlots.tsx` — slot-based letter builder (fixed underline slots per letter + colored tile bank, tap-slot-to-backspace, green/red result via `result` prop, reset via `resetKey`, reports built word via `onChange`). Shared by Reading + Word Journey spell so both have identical slot mechanics (mirrors legacy `wj-slot`).
- `src/bridge/newWords.ts` (`detectNewWords`) + `src/features/games/shared/NewWordPill.tsx` (`NewWordPill` + `SentenceText`) — **"new words" exposure layer** (bug-dump E6/E8). `detectNewWords(text|texts)` returns vocab-bank words NOT in the child's learned set (exact + shallow `-s` stem; translation from the bank; **exposure-only — never record to mastery**). `SentenceText(text, newWords, renderWord)` swaps matched tokens in a sentence fragment for tappable blue `NewWordPill`s (tap → Hebrew tooltip + English→Hebrew audio). Used by Grammar + Articles + Progressive (`GrammarGamePage`/`BlankFillGamePage`), merged into the after-answer `WordTable`. Story Time (E6) uses the same *rule* but inlines it in `data/stories.js` (build-time). Spec: `docs/grammar-new-words-spec.md`.
- `src/bridge/nikud.ts` — **React owns Hebrew nikud** (FU-4.4-nikud, 2026-06-03). `const nk = useNikud()` then wrap every hardcoded Hebrew *chrome* literal in `nk(...)` (buttons, "טוען…", status, gate/empty screens). Hebrew passed as a prop to a shared primitive (GameHero `title`, MediaPromptCard `prompt`/`translation`/`audioLabel`/`audioHint`, ExitConfirm `message`, AnswerGrid `label`/`sublabel`, RewardModal text) is wrapped ONCE there — don't re-wrap at the call site. `GameHostPage` marks the game subtree `[data-react-nikud-owned]` so `utils/nikudDOM.js` leaves it alone. `showNikud` defaults true, so a new game that forgets `nk()` silently renders chrome with no vowels. Details: `project_fu44_nikud_react_owned` memory.
  - **TWO nikud systems — pick the right one (Theme A, 2026-06-07):** (a) **pre-enriched** Hebrew gets nikud at boot — vocab `word.hebrew` via `enrichVocabularyBank`, and grammar/article/progressive `hebrewSentence`/`hebrewExplanation` + grammar-beginner `subject/predicate.hebrew` enriched in `data/_loader.js`; for these a strip-only path (`showNikud ? s : stripNikud(s)`) is correct. (b) **ANY OTHER Hebrew** — translations, option glosses, story title/question text, chrome literals — is NOT pre-enriched, so strip-only leaves the toggle inert when ON; route it through `applyNikud(s, showNikud)` / `nk()` (the `window.nikudMap` lookup that *adds* points ON, strips OFF). Mapped words must exist in `data/nikud-map.json`: when you add Hebrew chrome or a new Hebrew data bank, **re-run `python3 scripts/build-nikud-map.py`** (now scans `.ts`/`.tsx` too; preserves existing entries, so manual nikud overrides survive) or the toggle appears dead. Do NOT wrap English feedback, aria-labels, or `window.confirm`. Regression coverage: `tests/nikud-case-toggle.spec.js`.
  - **NEVER nikud-ize player names (M2, 2026-06-14):** user-entered names are not chrome — the word-keyed map drops matres lectionis (עידן→עדן, זוהר→זהר), silently changing a name the parent chose. Mark every name-rendering element `data-nikud-skip` (nikudDOM skips that subtree, like `data-react-nikud-owned`); when a name is inline with chrome (e.g. `שלום <span data-nikud-skip>{name}</span>!`) wrap ONLY the name so the chrome still vocalizes. Current sites: home greeting, profile heading, login cards, stats selector, UsersTab rows. Any NEW name display needs the marker.
- `src/features/games/shared/BlankFillGamePage.tsx` + `src/bridge/grammarLike.ts` — **shared blank-fill engine** for focused fill-in-the-sentence grammar games. One parameterised page + one generic bridge back MANY small games. To add another (e.g. plurals, prepositions): author a data bank `data/<key>.js` (shape mirrors `grammarQuestions.js`, add optional `emoji`), wire it into `data/_loader.js` → `window.gameData.<key>`, add a thin wrapper page `<X>GamePage` rendering `<BlankFillGamePage gameType dataKey title icon/>`, register the id in `reactGames.ts` + `GameHostPage.tsx` + `src/engine/gameRegistry.ts` (catalog metadata — **NOTE: `gameLogic.js` and `app.js` were deleted in Slice 4.4.b; game-type metadata lives in `gameRegistry.ts` and default `gameUnlocks` in `src/engine/appState.ts` now**) + `GAME_ORDER` in HomePage. Reuse `feedbackKey='grammar'` (default). Articles (`articles`) + Progressive tenses (`progressive`) are the first two; do NOT clone the grammar page per-game. The standalone `grammar/GrammarGamePage.tsx` predates this engine and stays separate (its tests pin it).

## Phase 3 game migration pattern

**Phase 3 is COMPLETE (Slice 3.16 Practice, 2026-05-25): every catalog game runs in React; `REACT_GAME_IDS` covers them all. The next migration work is Phase 4 (retire legacy game files), not more 3.x slices.** The pattern below stays as reference for any future game.

Slices 3.2–3.16 clone Slice 3.1 (Vocabulary). Copy `src/bridge/vocabulary.ts` + `src/features/games/vocabulary/VocabularyGamePage.tsx`, register the new game ID in `src/features/games/reactGames.ts` + `GameHostPage.tsx`. Reuse shared primitives and bridges unchanged. Do NOT re-implement the bridge shape, audio gate, mid-game resume, or audio-state persistence — full checklist + lifecycle invariants in the `feedback_phase3_game_template` memory and slice-specific diffs in `docs/master-plan.md`. The two mic games (Pronunciation 3.11, Practice 3.16) are a sub-pattern: no AnswerGrid/audio-gate/resume — Practice is a near-clone of `PronunciationGamePage` with a Due-first Learned pool, and its speech helpers are re-exported from `bridge/pronunciation`.
