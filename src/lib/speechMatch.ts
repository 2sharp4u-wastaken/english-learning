/**
 * Balanced speech matcher for the "say it" mini-games — ABC say-letter,
 * Phonics say-sound, Word Journey say-word. (2026-06-14, MOBILE1 M10.)
 *
 * Replaces an over-lenient rule those three shared:
 *     said.includes(target) || target.includes(said) || levenshtein(said,target) <= 2
 * which accepted whole wrong words ("beach" for "peach"), bare fragments
 * ("each" for "peach", "ee" for the letter B), and — on the tiny letter
 * phonetics — almost any short utterance (a levenshtein-2 tolerance spans most
 * 2–3 char strings, so "see"/C was accepted for "bee"/B).
 *
 * The balanced rule mirrors the principles already proven on-device in
 * speechManager.comparePronunciation (Pronunciation/Practice): exact-match
 * short-circuit, a per-word FIRST-LETTER gate (this is what rejects beach/peach
 * and bee/see), length-scaled similarity, and a 0.7 accuracy threshold. Kept
 * separate from comparePronunciation (legacy JS, lives on window) so it stays
 * pure and unit-testable; the two should converge eventually (backlog M10).
 */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** Convert a pure-digit token to its English word form, space-separated and
 *  hyphen-free ("31" → "thirty one", "19" → "nineteen") so a digit transcript
 *  matches a spelled-out target word-for-word. Returns null for ranges we don't
 *  expand (the token is then left untouched). "100"/"1000" stay the single
 *  words "hundred"/"thousand" to match the standalone vocab entries. */
function numeralToWords(token: string): string | null {
  if (!/^\d+$/.test(token)) return null
  const n = Number(token)
  if (n < 10) return ONES[n]
  if (n < 20) return TEENS[n - 10]
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)]
    const ones = n % 10
    return ones === 0 ? tens : `${tens} ${ONES[ones]}`
  }
  if (n === 100) return 'hundred'
  if (n === 1000) return 'thousand'
  return null
}

/** Lowercase, strip punctuation, fold hyphens/underscores to spaces, and expand
 *  standalone numerals to words ("19" → "nineteen", "31" → "thirty one") so
 *  digit/word transcripts match either direction (Word Journey relies on this). */
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => numeralToWords(w) ?? w)
    .join(' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** 0..1 edit-distance similarity over the longer string's length. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  const longer = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  return (longer.length - levenshtein(longer, shorter)) / longer.length
}

/** Per-word score with the first-letter gate + short-word strictness that
 *  comparePronunciation uses. A first-letter mismatch caps the score at 0.4
 *  (so it can never reach the 0.7 pass bar) — this is what makes "beach" fail
 *  "peach" and "see" fail "bee". */
function wordSimilarity(target: string, spoken: string): number {
  if (target === spoken) return 1
  if (!target || !spoken) return 0
  if (target[0] !== spoken[0]) return Math.min(similarity(target, spoken) * 0.5, 0.4)
  const base = similarity(target, spoken)
  return target.length <= 4 ? base * 0.9 : base
}

export interface SpeechMatchOptions {
  /** Extra strings that count as an exact match (e.g. the ABC bare letter "b"
   *  alongside the phonetic "bee"). Normalized before comparison. */
  aliases?: string[]
  /** Pass bar for the averaged per-word similarity. Default 0.7 (the value
   *  comparePronunciation treats as a confident match). */
  threshold?: number
}

/**
 * True when `transcript` is a balanced match for `target`. Multi-word targets
 * ("ice cream") require the same word count and average ≥ threshold per word.
 */
export function isBalancedSpeechMatch(
  target: string,
  transcript: string,
  opts: SpeechMatchOptions = {},
): boolean {
  const t = normalize(target)
  const s = normalize(transcript)
  if (!t || !s) return false
  if (s === t) return true
  if (opts.aliases?.some((a) => normalize(a) === s)) return true

  const tw = t.split(' ')
  const sw = s.split(' ')
  if (tw.length !== sw.length) return false

  const threshold = opts.threshold ?? 0.7
  let total = 0
  for (let i = 0; i < tw.length; i++) total += wordSimilarity(tw[i], sw[i])
  return total / tw.length >= threshold
}
