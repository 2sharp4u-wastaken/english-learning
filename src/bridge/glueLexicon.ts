/**
 * Glue lexicon — Hebrew glosses for common sentence "glue" words that are NOT in
 * the 873-word vocabulary bank (verbs, tenses, adjectives, everyday nouns). Used
 * as a fallback source by `detectNewWords` so words like "need"/"want"/"running"
 * become the same tappable, voiced, translated pill as bank words (beta #59 — the
 * grammar/articles/progressive sentences flooded the child with untranslated
 * words). Exposure-only, exactly like bank new-words: never recorded to mastery.
 *
 * Hebrew is authored WITH nikud inline on purpose. `applyNikud`/`nk()` replaces
 * only bare consonant-runs from `window.nikudMap` and leaves interleaved vowel
 * points untouched, so an already-pointed gloss renders correctly with the toggle
 * ON (marks preserved) and OFF (`stripNikud` removes them) — no dependency on the
 * network-only `build-nikud-map.py` rebuild.
 *
 * Curation rules:
 *  - Content words only (verbs / adjectives / adverbs / concrete nouns). Pure
 *    grammatical glue (a/the/and/for/pronouns) is intentionally omitted — glossing
 *    it is noise and would burn the inline-pill cap.
 *  - The sense chosen is the one the word actually carries across the authored
 *    sentences (kid-dominant). Genuinely misleading polysemes go in
 *    `AMBIGUOUS_SKIP` (see `newWords.ts`), not here.
 */
export const GLUE_LEXICON: Record<string, string> = {
  // ── Verbs — base / present ──────────────────────────────────────────────
  need: 'צָרִיךְ',
  want: 'רוֹצֶה',
  have: 'יֵשׁ',
  has: 'יֵשׁ',
  like: 'אוֹהֵב',
  help: 'עוֹזֵר',
  give: 'נוֹתֵן',
  talk: 'מְדַבֵּר',
  eat: 'אוֹכֵל',
  eats: 'אוֹכֵל',
  see: 'רוֹאֶה',
  look: 'מִסְתַּכֵּל',
  open: 'פּוֹתֵחַ',
  sing: 'שָׁר',
  live: 'גָּר',
  meet: 'פּוֹגֵשׁ',
  can: 'יָכוֹל',

  // ── Verbs — past ────────────────────────────────────────────────────────
  saw: 'רָאָה',
  read: 'קוֹרֵא',
  rode: 'רָכַב',
  drew: 'צִיֵּר',
  gave: 'נָתַן',
  bought: 'קָנָה',
  put: 'שָׂם',
  ran: 'רָץ',
  woke: 'הִתְעוֹרֵר',
  waited: 'חִכָּה',
  started: 'הִתְחִיל',
  rolled: 'הִתְגַּלְגֵּל',

  // ── Verbs — present continuous (-ing) ───────────────────────────────────
  going: 'הוֹלֵךְ',
  coming: 'בָּא',
  doing: 'עוֹשֶׂה',
  playing: 'מְשַׂחֵק',
  running: 'רָץ',
  reading: 'קוֹרֵא',
  sleeping: 'יָשֵׁן',
  watching: 'צוֹפֶה',
  wearing: 'לוֹבֵשׁ',
  cooking: 'מְבַשֵּׁל',
  jumping: 'קוֹפֵץ',
  shining: 'זוֹרֵחַ',
  raining: 'יוֹרֵד גֶּשֶׁם',
  shopping: 'עוֹשֶׂה קְנִיּוֹת',
  chases: 'רוֹדֵף',
  arrives: 'מַגִּיעַ',

  // ── Everyday nouns not in the bank ──────────────────────────────────────
  eraser: 'מַחַק',
  drawer: 'מְגֵרָה',
  fridge: 'מְקָרֵר',
  gate: 'שַׁעַר',
  keys: 'מַפְתְּחוֹת',
  movie: 'סֶרֶט',
  tv: 'טֶלֶוִיזְיָה',
  pond: 'בְּרֵכָה',
  presents: 'מַתָּנוֹת',
  puzzle: 'פָּזֶל',
  puppy: 'גּוּר',
  song: 'שִׁיר',
  soccer: 'כַּדּוּרֶגֶל',
  street: 'רְחוֹב',
  weather: 'מֶזֶג אֲוִיר',
  cream: 'שַׁמֶּנֶת',
  ice: 'קֶרַח',
  box: 'קֻפְסָה',
  color: 'צֶבַע',
  doctor: 'רוֹפֵא',
  name: 'שֵׁם',
  toys: 'צַעֲצוּעִים',
  umbrella: 'מִטְרִיָּה',

  // ── Adjectives / adverbs ────────────────────────────────────────────────
  bright: 'בָּהִיר',
  broken: 'שָׁבוּר',
  delicious: 'טָעִים',
  friendly: 'יְדִידוּתִי',
  loudly: 'בְּקוֹל רָם',
  ready: 'מוּכָן',
  together: 'בְּיַחַד',
  often: 'לְעִתִּים קְרוֹבוֹת',
  outside: 'בַּחוּץ',
  now: 'עַכְשָׁיו',
  not: 'לֹא',
}
