/**
 * Strip emoji / pictographs from a string before it is spoken aloud. (M11,
 * 2026-06-14.) The owl mascot and encouragement bubbles keep their trailing
 * emoji visually, but TTS would read them out ("...מילים! ממשיכים star") —
 * emojis must never be voiced. Applied at the speak boundary (bridge/audio.ts)
 * so display text is untouched.
 *
 * NOTE: speechSynthesis.js speak() carries the SAME strip as a legacy-internal
 * safety net (a classic <script>, it can't import this module) — keep the two
 * regexes in sync, the way platform.ts/SPEECH_IS_ANDROID are mirrored.
 */
export function stripSpeechEmoji(text: string): string {
  if (!text) return text
  return text
    // Keycap sequences (1️⃣) are digit + combiner — strip the whole sequence so
    // no bare digit is left behind (a standalone "1" is untouched).
    .replace(/[0-9#*]️?⃣/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    // Variation selectors, ZWJ, keycap combiner, skin-tone modifiers — the
    // glue/modifier codepoints that surround the pictographs above.
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
