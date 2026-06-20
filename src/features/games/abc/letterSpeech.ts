// M18 (beta #15/#34) — letter-name audio that TTS pronounces correctly.
//
// The ABC data's `phonetic` field (data/abcData.js) drives the SAY-LETTER
// matcher (expected STT transcript) — it stays as-is there.
// This map is AUDIO-ONLY (never feeds the matcher or the on-screen glyph).
//
// Strategy: use real English words wherever the phonetic is a bare 2-char token
// that Android TTS spells out letter-by-letter (e.g. "em" → "E M", "ar" → "A R").
// "are" (verb) is read as a word; "ex" (noun) is read as a word; etc.
// For letters where no better word exists, keep the abcData phonetic as-is
// (shorter is safer than tripling consonants like "emm" → "E M M").
const LETTER_SPEECH: Record<string, string> = {
  A: 'ay',
  B: 'bee',
  C: 'see',
  D: 'dee',
  E: 'ee',
  F: 'ef',
  G: 'jee',
  H: 'aitch',
  I: 'eye',
  J: 'jay',
  K: 'kay',
  L: 'el',
  M: 'em',
  N: 'en',
  O: 'oh',
  P: 'pee',
  Q: 'cue',
  R: 'are',
  S: 'ess',
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
