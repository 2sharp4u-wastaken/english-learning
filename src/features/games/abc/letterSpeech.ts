// M18 (beta #15/#34/#37/#38) — letter-name audio that TTS pronounces correctly.
//
// The ABC data's `phonetic` field (data/abcData.js) drives the SAY-LETTER
// matcher (expected STT transcript) — it stays as-is there.
// This map is AUDIO-ONLY (never feeds the matcher or the on-screen glyph).
//
// Strategy (revised after #37/#38):
// - Short 2–3 char strings that look like abbreviations (em, ee, el, ef, en, ess)
//   get spelled out letter-by-letter by Android TTS regardless of length.
// - Single UPPERCASE letters are unambiguous: TTS cannot spell a single character
//   and must say its name (E→"ee", M→"em", N→"en", etc.).
// - For letters where a common English WORD matches the name, use the word:
//   R→"are" (verb), X→"ex" (noun), and the already-word-like set (bee, see, …).
const LETTER_SPEECH: Record<string, string> = {
  A: 'ay',
  B: 'bee',
  C: 'see',
  D: 'dee',
  E: 'E',
  F: 'F',
  G: 'jee',
  H: 'aitch',
  I: 'eye',
  J: 'jay',
  K: 'kay',
  L: 'L',
  M: 'M',
  N: 'N',
  O: 'oh',
  P: 'pee',
  Q: 'cue',
  R: 'are',
  S: 'S',
  T: 'tee',
  U: 'you',
  V: 'vee',
  W: 'double-you',
  X: 'ex',
  Y: 'why',
  Z: 'zee',
}

/**
 * The text to feed `speak()` for a letter's name. Pass the canonical single
 * uppercase letter (`question.letterUpper`); falls back to the supplied
 * phonetic for anything not in the 26-letter map.
 */
export function getLetterSpeech(letterUpper: string, fallbackPhonetic = ''): string {
  const key = (letterUpper || '').trim().toUpperCase()
  return LETTER_SPEECH[key] ?? fallbackPhonetic
}
