// M18 (beta #15) — letter-name audio that TTS pronounces correctly.
//
// The ABC data's `phonetic` field (data/abcData.js) doubles as the say-letter
// matcher's expected token, so it stays as-is there. But several of those
// respellings are two-character lowercase tokens — "ee"(E), "ef"(F), "el"(L),
// "em"(M), "en"(N), "ar"(R), "ex"(X) — which the Web Speech engine treats as
// initialisms and SPELLS OUT letter-by-letter ("ar" → "ay arr", "ee" → "ee ee").
// That's the reported bug: "Rr" voiced as "a r", "Ee" as "e e".
//
// This map is AUDIO-ONLY (it never feeds the matcher or the on-screen glyph).
// It keeps the already-word-like names and replaces only the spell-prone ones
// with forms the synth reads as a single word — doubling the consonant / adding
// a vowel so the token no longer looks like an abbreviation.
const LETTER_SPEECH: Record<string, string> = {
  A: 'ay',
  B: 'bee',
  C: 'see',
  D: 'dee',
  E: 'eee',
  F: 'eff',
  G: 'jee',
  H: 'aitch',
  I: 'eye',
  J: 'jay',
  K: 'kay',
  L: 'ell',
  M: 'emm',
  N: 'enn',
  O: 'oh',
  P: 'pee',
  Q: 'cue',
  R: 'arr',
  S: 'ess',
  T: 'tee',
  U: 'you',
  V: 'vee',
  W: 'double-you',
  X: 'ecks',
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
