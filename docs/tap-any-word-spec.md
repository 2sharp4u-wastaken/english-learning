# Spec — "Tap any word to hear its translation" (beta #60)

Status: **T1 + T2 IMPLEMENTED (2026-07-10).** Maintainer chose T1+T2; T3 deferred.
What shipped vs. this design:
- **T1** — `detectGlossableWords` (`src/bridge/newWords.ts`) returns every bank/glue/
  gloss word tagged `isNew` (no learned-skip); `detectNewWords` is now its `isNew`
  subset. `SentenceText`/`NewWordPill` render `isNew` words as pills (capped
  `maxPills`) and the rest as a quiet `variant='quiet'` tap-to-hear word.
- **T2** — `src/bridge/sentenceGloss.ts` (third lookup source) + the maintainer tool
  `scripts/build-sentence-gloss.mjs`, which reports authored-sentence words with no
  gloss and exits non-zero until zero gaps. Current state: **0 gaps** (17 fills).
- **T3** — deferred (cloud translation for custom/unknown words), as recommended.
Tests: `src/bridge/__tests__/newWords.test.ts` (logic) +
`src/features/games/shared/__tests__/SentenceText.test.ts` (two-tier render).

## 1. The report (#60)

A parent tapped `astronaut` in the Articles game and got no translation, and
asked: *is it because the word is new vs. already-learned? Not all words in these
sentence games get a translation.*

## 2. Why it happens today (grounded in code)

The "new words" exposure layer (`src/bridge/newWords.ts` → `detectNewWords`,
rendered by `SentenceText`/`NewWordPill`) deliberately glosses **only unlearned,
translatable words**:

1. **Learned words are skipped** (`newWords.ts:81` — `learned.has(clean)`). The
   feature is *exposure of new vocabulary*, so a word the child already knows gets
   no pill. `astronaut` **is** in the bank (`data/categories/astronomy.js` →
   אסטרונאוט), so the only reason it wasn't tappable is that it's already learned.
2. **Translation source is bank → glue-lexicon only.** A word that is neither in
   the 873-word bank nor in the ~82-word `GLUE_LEXICON` has no Hebrew source, so it
   can't be glossed at all.
3. **Inline cap of 3** (`MAX_INLINE_NEW_WORDS`) — only the first 3 new words become
   inline pills (full set is in the after-answer `WordTable`).
4. **`AMBIGUOUS_SKIP`** removes misleading polysemes (`right`, #55).

So #60 is **working as designed** — but exposes a real product gap: the child/parent
can't hear *every* word, only the "new" ones.

## 3. Goals / non-goals

**Goals**
- Any word in an authored sentence game can be tapped to hear it (English audio +
  Hebrew) — regardless of learned status.
- Keep the pedagogical **"these are NEW words"** signal intact (don't drown the
  sentence in identical highlights).
- Offline-safe, no new privacy surface (children's data), no per-tap network cost.

**Non-goals (this iteration)**
- Live/arbitrary translation of parent **custom** words or truly unknown tokens
  (deferred to a later cloud-translation tier).
- Recording any of these taps toward mastery (stays exposure-only, as today).

## 4. The tension to resolve

If *every* word becomes an identical blue highlighted pill, the sentence turns into
visual noise and the "new word" cue is lost. The design therefore **separates two
affordances** rather than widening the existing one:

| Tier | Which words | Visual | Behavior |
|---|---|---|---|
| **A — New-word pill** (unchanged) | unlearned + translatable, capped 3 inline | prominent blue pill + 🔊, dotted highlight | tap → Hebrew tooltip + EN→HE audio |
| **B — Quiet "hear it"** (new) | *every other* word that has a gloss | plain text, faint affordance on hover/press | tap → same tooltip + audio, no persistent highlight |

Tier A stays exactly as it is (keeps the learn-these signal). Tier B is the new
"tap anything" layer beneath it.

## 5. Translation sourcing — three tiers (ship incrementally)

### T1 — Drop the learned-filter for Tier B (small, fixes the reported case)
Make **every bank/glue word** tappable regardless of learned status. Since the
sentence banks are authored mostly from bank vocabulary, this alone covers the vast
majority — and fixes `astronaut` directly.
- Code: `detectNewWords` gains an `includeLearned?: boolean` (or a sibling
  `detectGlossableWords`) that runs the same bank/glue lookup **without** the
  `learned.has()` skip. `SentenceText` renders learned matches as Tier-B (quiet)
  and unlearned matches as Tier-A (pill), so the highlight cap still applies only to
  genuinely-new words.
- Effort: **S.** One bridge tweak + a render branch. No data work.

### T2 — Build-time authored-sentence gloss map (complete coverage of authored content)
The sentence banks are a **fixed, finite** authored set. A build script enumerates
every distinct token across `data/grammarQuestions.js`, `data/articlesData.js`,
`data/progressiveData.js`, `data/grammarBeginnerData.js`, `data/stories.js`, resolves
each from bank → glue-lexicon → a maintainer-filled `data/sentenceGloss.js`, and
**reports any token with no gloss** so the maintainer fills it once. Output is a
static `sentenceWordGloss.json` (mirrors the `build-nikud-map.py` /
`generate-phonetic-data.js` precedent in `scripts/`).
- Guarantees **100% of authored sentence words** are tappable, offline, zero runtime
  cost, no API.
- Effort: **M.** New `scripts/build-sentence-gloss.py|js` + a small
  maintainer-curated fill file + wire the map into `newWords.ts` lookup as a third
  source after glue-lexicon.

### T3 — Cloud translation for arbitrary/custom words (deferred)
Only needed for parent **custom** words or free-typed tokens outside all offline
maps. Same trade-offs as the M1-c cloud-STT note (Worker + paid API key, per-tap
round-trip, becomes online-only, adds a data-controller responsibility). **Not worth
it now** — authored content is fully covered by T1+T2; revisit only if custom-word
sentences become a thing.

## 6. Recommended scope

**Ship T1 now** (fixes #60's literal case + most words, tiny risk), and **queue T2**
as the completeness follow-up (a build-time map, no runtime cost). Leave T3 deferred.

## 7. Implementation sketch (T1 + Tier B)

- `src/bridge/newWords.ts`
  - Add `detectGlossableWords(texts, opts)` — same lookup, **no** learned-skip;
    returns `{ word, hebrew, category, isNew }` where `isNew = !learned.has(word)`.
  - Keep `detectNewWords` as a thin filter (`isNew` only) so existing callers/tests
    are unchanged.
- `src/features/games/shared/NewWordPill.tsx`
  - `SentenceText` takes the fuller map; render `isNew` tokens as `NewWordPill`
    (Tier A, capped), others as a new lightweight `QuietWordButton` (Tier B — no
    persistent ring, faint dotted underline, same tap handler → tooltip + audio).
- Callers unchanged (`BlankFillGamePage`, `GrammarGamePage`) beyond passing the new
  map; the after-answer `WordTable` still lists only genuinely-new words.
- `docs/grammar-new-words-spec.md` §8 — cross-reference this two-tier model.

## 8. Test plan

- Unit (`newWords`): a learned bank word (`astronaut`) is returned by
  `detectGlossableWords` with `isNew:false` and **excluded** from `detectNewWords`.
- Component: `SentenceText` renders a learned word as `data-testid="quiet-word"`
  (tappable) and an unlearned one as `data-testid="new-word-pill"`; inline pill cap
  still counts only new words.
- e2e: in Articles, tapping a learned word shows the Hebrew tooltip + fires audio.

## 9. Risks

- **Visual noise** — mitigated by the two-tier split (Tier B has no persistent
  highlight). Validate on a real ~360px screen (folds into #28).
- **Wrong-sense glosses** on newly-tappable learned words — reuse `AMBIGUOUS_SKIP`;
  a single bank sense is acceptable for exposure (never recorded to mastery).
- **T2 unglossed tokens** — the build script must *fail loudly* listing them, so the
  map is never silently partial.
