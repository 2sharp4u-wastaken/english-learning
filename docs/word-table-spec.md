# Spec — shared `WordTable` component (F2 / F3 / E7 / E8)

**Status:** draft 2026-06-08. Serves bug-dump-2026-06-07 items **F2, F3** and feeds the **E7/E8** Grammar redesign. One component, several call sites — author once, adapt per consumer.

## 1. Goal

A compact "word → Hebrew translation → play" review table the child sees after answering (or alongside a sentence), so they can revisit each word, read its meaning, and hear it. Replaces the four separate asks (F2, F3, E7, E8) with one shared primitive.

## 2. Component API

`src/features/games/shared/WordTable.tsx`

```ts
export interface WordTableRow {
  /** English word/phrase (stored case; component applies the case toggle). */
  word: string
  /** Hebrew translation/gloss (already authored — see §6 data sources). */
  hebrew: string
  /** Optional marker for answer-based games: 'correct' → green ✓, 'wrong' →
   *  red ✗ (the option the child picked when it was wrong). Story Time passes
   *  no mark (it's a plain highlight list). */
  mark?: 'correct' | 'wrong'
}

export interface WordTableProps {
  rows: WordTableRow[]
  /** Optional heading, e.g. "המילים שלמדנו". Wrapped in nk() internally. */
  title?: string
  /** Defaults to a sensible play: English word then Hebrew (see §4). Override
   *  only if a caller needs different audio. */
  onPlay?: (row: WordTableRow) => void
  className?: string
}
```

- **Case:** read `caseMode` from `useTextPrefs()` inside the component and apply it to `row.word` (English only) — callers must NOT pre-case.
- **Nikud:** wrap `row.hebrew` and `title` in `nk()` **once inside the component** (it lives in the `[data-react-nikud-owned]` subtree). Callers pass raw Hebrew. (Mirrors AnswerGrid/MediaPromptCard — see CLAUDE.md nikud section.)
- **De-dupe:** the component de-dupes rows by `word.toLowerCase()` so repeated answer words collapse to one row.
- **Empty:** render nothing when `rows` is empty.

## 3. Visual design (match the app)

- Container: `rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-3 backdrop-blur`, `dir="rtl"`, full width, `max-w-md mx-auto`.
- Optional `title`: small centered `text-[color:var(--slate-300)]`.
- One **row per word**, `flex items-center justify-between gap-3` (RTL): Hebrew on the right, English in the middle, the 🔊 play button on the left — consistent with the D5 grammar-beginner affordance (speaker on the physical left).
- Play button: small `rounded-full` pill (`size-8`, gradient `from-[color:var(--blue-400)] to-[color:var(--mint-400)]`, `Volume2 size-4`) — same look as MediaPromptCard's `audioIconOnly` speaker.
- Rows separated by a hairline (`divide-y divide-white/5`).
- `data-testid="word-table"`, each row `data-testid="word-table-row"` with `data-word`, play button `data-testid="word-table-play"`.

```
┌─────────────────────────────────────┐
│            המילים שלמדנו             │
├─────────────────────────────────────┤
│  🔊   cat            חתול            │
│  🔊   dog            כלב             │
│  🔊   bird           ציפור           │
└─────────────────────────────────────┘
```

## 4. Audio behavior (default `onPlay`)

Reuse the E4 pattern (already shipped in StoryReadPhase): **play English then Hebrew**.

```ts
await speakWord(row.word.toLowerCase(), gameContext)   // English (lowercase — TTS spells uppercase, see feedback memory)
await speakHebrew(row.hebrew)                            // Hebrew
```

Wrap in `void (async () => { try { … } catch {} })()`. Allow only one at a time (cancel a prior play on a new tap is optional; the per-word taps are short).

## 5. Per-consumer placement & adapter

| Item | Where | Rows from |
|---|---|---|
| **F2** Fill-blanks | after answering, **below the answer grid** (the "next" button is the pinned footer) | correct option (✓) + chosen-wrong option (✗), each `{ word, hebrew }` where `hebrew = getOptionHebrew(word)` ✅ data ready (`optionTranslations` map added 2026-06-09) |
| **F3** Story Time | read phase (below the text) or quiz recap | `story.highlights.map(h => ({ word: h.word, hebrew: h.translation }))` ✅ data ready |
| **F3 / E7 / E8** Grammar | after answering, below the sentence | `options.map((o,i) => ({ word: o, hebrew: hebrewOptions[i] }))` ✅ data ready (`hebrewOptions` added 2026-05-23) |

## 6. Data sources & the F2 prerequisite

- **Story Time** — `StoryHighlight { word, translation }` already carries per-word Hebrew. ✅
- **Grammar** — `GrammarQuestion.hebrewOptions?: string[]` (per-option gloss, same index order). ✅ Guard for older saves lacking the field (already merged-in by the bridge).
- **Fill-blanks** — ✅ **resolved 2026-06-09.** `current.blank.options` are bare English function words (`["how","what","when"]`) with no per-word Hebrew (`translation` is the whole-sentence gloss). Rather than a per-sentence `hebrewOptions` array (210 entries, most repeating), a **shared `optionTranslations` map** (lowercased word → Hebrew, all 184 unique option words) was authored in `data/sentences.js`; `getOptionHebrew(word)` resolves it, re-exported through `bridge/fill-blanks.ts`. Each option word has one consistent meaning across the bank, so the map stays DRY. Glosses authored without nikud; `scripts/build-nikud-map.py` added them (+8 manual homograph overrides where Dicta returned the noun/imperative voweling instead of the verb — `צד`/`רב`/`שר`/`נחת`/`שכח`/`משחק`/`שוחה`/`מוצא`; these survive re-runs like C5's goat fix).

## 7. Build order

1. ✅ Build `WordTable.tsx` (2026-06-08). No Vitest unit — no React component-test setup in repo; verified via Playwright instead (project pattern).
2. ✅ Wire **F3 Story Time** (read phase, highlights) — Playwright asserts table + row.
3. ✅ Wire **Grammar** (after every answer, correct ✓ + chosen ✗) — covers the table half of E7/E8.
4. ⬜ **E7's other half** (show the *full correct Hebrew sentence*, no blank-deduction) — separate Grammar change, still open.
5. ✅ **F2 Fill-blanks** (2026-06-09) — `optionTranslations` map + `getOptionHebrew` in `data/sentences.js`; WordTable wired below the answer grid (correct ✓ + chosen-wrong ✗). Playwright asserts the table + correct row + 2-row wrong-pick case.
6. ✅ **E8** "new words learning surface" (2026-06-09) — `detectNewWords()` + `NewWordPill`/`SentenceText` surface unlearned bank words as tappable pills in Grammar + Articles + Progressive, merged into the after-answer table. Spec: `docs/grammar-new-words-spec.md`.

## 8. Decisions (user, 2026-06-08)

- **Rows (answer games):** the **correct** word (mark `'correct'`, green ✓) + **the chosen** word (mark `'wrong'`, red ✗) when the pick was wrong. If correct, one row. Story Time still shows all its highlights (no marks).
- **Timing:** show the table **after every answer** (correct and wrong).
- **F2:** ✅ shipped 2026-06-09. Per `feedback_choose_dont_translate`, the glosses were **authored** (not delegated as a translation chore) into a shared `optionTranslations` map and surfaced for review; the table shows the correct + chosen-wrong rows (mirrors Grammar §8), not all 3 options.
