# Spec — E8: Grammar as a "new words" learning surface

**Status:** ✅ SHIPPED 2026-06-09. Serves bug-dump-2026-06-07 **E8**. Builds on the E6 (Story Time) new-word detection and the shared `WordTable` (F3).

**As built:** `src/bridge/newWords.ts` (`detectNewWords`), `src/features/games/shared/NewWordPill.tsx` (`NewWordPill` + `SentenceText`), wired into `GrammarGamePage` and `BlankFillGamePage` (Articles + Progressive). Decisions §5 below.

## 1. Goal

Each Grammar question is currently a pure grammar drill (pick `am`/`is`/`are`). But its sentences are full of real vocabulary the child could learn — `friend`, `park`, `student`, `dog`, `happy`, `tired`, `playing`, `soccer`, `rain`. Today those words are inert static text. E8 turns every Grammar question into a **vocabulary exposure surface** too: surface the *new* (not-yet-learned) words in the sentence with their Hebrew translation + audio, mirroring what E6 did for Story Time.

The grammar drill itself does not change — this is purely additive vocabulary exposure layered on top.

## 2. What counts as a "new word" (reuse E6's rule)

A token in the displayed English sentence is surfaced when it is:
- present in the vocabulary bank (`window.vocabularyBank`), AND
- **not** in the child's derived-learned set (`getLearnedWordKeySet()` via `bridge/progress`).

Matching is exact-lowercase first, then a shallow `-s` strip (`runs`→`run`), identical to E6. Translation comes from the **bank entry** — no per-question Hebrew authoring needed (the grammar function-word glosses in `hebrewOptions` stay as they are; this is a separate, additive lookup). Words not in the bank (`soccer`, `yesterday`, `outside`, `doctor`) are simply not surfaced — same as E6.

The grammar function words being drilled (`am`/`is`/`are`/`be`/`the`/`not`…) are not in the bank, so they're naturally excluded — no overlap with the answer options.

## 3. Proposed shared helper (forward-propagation)

E6 currently inlines the scan inside `data/stories.js`. E8 should **extract a shared browser-side helper** both can lean on, instead of a second copy:

```ts
// src/bridge/newWords.ts
export interface NewWord { word: string; hebrew: string; category?: string }
/** Bank words in `text` (or each of `texts`) not in the learned set, de-duped,
 *  in first-seen order. Exact + shallow -s stem. Translation from the bank. */
export function detectNewWords(texts: string | string[], opts?: {
  learnedSet?: Set<string>   // defaults to getLearnedWordKeySet()-derived lowercased words
  bank?: VocabWord[]         // defaults to window.vocabularyBank
}): NewWord[]
```

E6 can later be refactored to call this (optional cleanup; not required for E8 to ship).

## 4. Source text for the scan

Scan the **full sentence with the blank filled by the correct answer** so the sentence is complete and the surrounding content words are all present:

```
"She ___ my friend"  →  "she is my friend"  →  new words: { friend }
"They ___ at the park" → "they are at the park" → { park }
```

The blank's own answer is a grammar function word (not in bank) so it never becomes a "new word" itself.

## 5. Decisions (user, 2026-06-08)

- **D1 = Blue pills.** New content words render as the Story-Time blue speaker-pill (E4/E6 look) inside the sentence.
- **D2 = Always interactive.** Tappable from the start (while choosing), not just after answering — aids comprehension during the drill.
- **D3 = One merged table.** Fold new words into the same after-answer `WordTable` as the answer options (no separate table). New-word rows have no ✓/✗ mark.
- **D4 = All three blank-fill games.** Grammar (standalone `GrammarGamePage`) **and** Articles + Progressive (shared `BlankFillGamePage`).

The original fork text is kept below for the record.

## 5b. Open decisions (original) — resolved above

### D1 — In-sentence treatment
How prominent should the new words be **inside the grammar sentence**?

- **A. Pills** — same blue speaker-pill look as Story Time (E4/E6). Most consistent, most discoverable, but makes the drill sentence visually busy for ages 5–8.
- **B. Dotted underline** *(recommended)* — new words get a subtle dotted underline + are tappable (translation tooltip + audio), but stay inline as plain text. Discoverable without competing with the blank/options.
- **C. Table only** — the grammar sentence stays completely clean; new words surface only in a table (D3). Lowest clutter, least discoverable.

### D2 — Timing
When are the new words interactive?

- **After answering only** *(recommended)* — keeps the drill focused; vocab exposure is a post-answer reward/review (same moment the answer-table + explanation already appear).
- **Always (incl. while choosing)** — tappable from the start; can *aid* comprehension of the sentence while deciding `am`/`is`/`are`.

### D3 — The table(s)
After answering there's already a `WordTable` titled "המילים" (the grammar answer options: correct ✓ + chosen ✗).

- **Separate second table** *(recommended)* — add a distinct "מילים חדשות במשפט" table below it for the content words. Two clearly-different purposes (grammar choice vs. vocabulary).
- **One merged table** — fold new words into the same table. Simpler visually but mixes function words and vocabulary.

### D4 — Scope
The standalone `GrammarGamePage` is separate from the shared `BlankFillGamePage` engine (Articles, Progressive tenses).

- **Grammar only** *(recommended for v1)* — ship on the Grammar game first; evaluate before extending.
- **Grammar + Articles + Progressive** — apply the same surface to all three blank-fill games at once (more reach, more surface area to verify).

## 6. Decided defaults (no need to ask)

- **Mastery:** exposure-only — surfaced new words are **not** recorded toward mastery (identical to the E6 decision; reading a grammar sentence must not auto-learn a word). The existing `recordGrammarAnswer` path is untouched.
- **Audio:** tap plays English then Hebrew (`speakWord` → `speakHebrew`), the shared E4 pattern already used by `WordTable`/Story Time.
- **Case + nikud:** new words honor the case toggle (English) and route Hebrew through `nk()`/`applyNikud` like everything else; the `WordTable` already owns this.

## 7. Build outline (after approval)

1. `src/bridge/newWords.ts` — `detectNewWords()` (+ optional E6 refactor to use it).
2. `GrammarGamePage`: compute `newWords = detectNewWords(filledSentence)` for the current question; render per D1/D2 (in-sentence tappable) and D3 (table titled "מילים חדשות במשפט").
3. Playwright assertion in the Grammar suite: after answering a seeded question whose sentence contains a known-unlearned bank word, the new-words table/affordance appears with that word.
4. Update `docs/word-table-spec.md` build order (E8 row), `docs/wiring-map.md` (Grammar chain), and memory.
