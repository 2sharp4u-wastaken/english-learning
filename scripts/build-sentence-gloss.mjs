// Maintainer tool (#60 — T2). Enumerates every content token across the authored
// sentence banks (grammar / articles / progressive) and reports the ones that have
// NO Hebrew gloss in any lookup source (vocabulary bank → GLUE_LEXICON →
// SENTENCE_GLOSS). Fill the reported words into `src/bridge/sentenceGloss.ts` (one
// line each, Hebrew with nikud inline) and re-run until it prints "0 gaps", so that
// every word in every sentence game is tappable (regardless of learned status).
//
// Run:  node scripts/build-sentence-gloss.mjs
// Exits non-zero when gaps remain (CI-friendly "fail loudly").

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// ── Sentence banks (each exports an array of question objects with `sentence`) ──
const SENTENCE_MODULES = [
  ['data/grammarQuestions.js', 'grammarQuestions'],
  ['data/articlesData.js', 'articlesQuestions'],
  ['data/progressiveData.js', 'progressiveQuestions'],
]

// Pure grammatical glue + pronouns we intentionally never gloss (noise). Mirrors
// the "content words only" rule in GLUE_LEXICON / sentenceGloss.ts.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'if', 'to', 'of', 'in', 'on', 'at',
  'by', 'for', 'with', 'from', 'as', 'into', 'than', 'then', 'that', 'this',
  'these', 'those', 'there', 'here', 'is', 'am', 'are', 'was', 'were', 'be',
  'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'shall', 'should', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'mine', 'yours', 'not', 'no', 'yes', 'please', 'up', 'down', 'out',
  'off', 'over', 'again', 'very', 'too', 'also', 'just', 'now', 'yet',
])

const PUNCT_EDGE = /^[.,!?;:'"()]+|[.,!?;:'"()]+$/g

async function loadNamed(relPath, exportName) {
  const mod = await import(resolve(root, relPath))
  const arr = mod[exportName]
  if (!Array.isArray(arr)) throw new Error(`${relPath} has no array export "${exportName}"`)
  return arr
}

// Extract lowercased keys from a TS `Record<string,string>` literal (glue / gloss).
function lexiconKeys(relPath) {
  const src = readFileSync(resolve(root, relPath), 'utf8')
  const keys = new Set()
  // Match `  need: '…'` and `  'phrasal-verb': '…'` — a key at line start before ':'.
  for (const m of src.matchAll(/^\s*['"]?([A-Za-z][A-Za-z'\- ]*?)['"]?\s*:/gm)) {
    keys.add(m[1].trim().toLowerCase())
  }
  return keys
}

async function bankWords() {
  const cats = await import(resolve(root, 'data/categories/_index.js'))
  const set = new Set()
  for (const val of Object.values(cats)) {
    if (!Array.isArray(val)) continue
    for (const w of val) {
      if (w && typeof w.word === 'string') set.add(w.word.toLowerCase())
    }
  }
  return set
}

function covered(clean, bank, glue, gloss) {
  if (bank.has(clean) || glue.has(clean) || gloss.has(clean)) return true
  // Shallow "-s" stem, matching newWords.ts lookup().
  if (clean.length > 3 && clean.endsWith('s') && bank.has(clean.slice(0, -1))) return true
  return false
}

async function main() {
  const bank = await bankWords()
  const glue = lexiconKeys('src/bridge/glueLexicon.ts')
  const gloss = lexiconKeys('src/bridge/sentenceGloss.ts')

  const sentences = []
  for (const [rel, name] of SENTENCE_MODULES) {
    for (const q of await loadNamed(rel, name)) {
      if (q && typeof q.sentence === 'string') sentences.push(q.sentence)
    }
  }

  const gaps = new Map() // word -> example sentence
  let tokenCount = 0
  for (const sentence of sentences) {
    for (const raw of sentence.replace('___', ' ').split(/\s+/)) {
      const clean = raw.replace(PUNCT_EDGE, '').toLowerCase()
      // Skip empties, function words, and bare numerals ("8" — a digit needs no gloss).
      if (!clean || STOPWORDS.has(clean) || /^\d+$/.test(clean)) continue
      tokenCount++
      if (covered(clean, bank, glue, gloss)) continue
      if (!gaps.has(clean)) gaps.set(clean, sentence)
    }
  }

  console.log(`Scanned ${sentences.length} sentences (${tokenCount} content tokens).`)
  console.log(`Sources: bank=${bank.size}, glue=${glue.size}, gloss=${gloss.size}.`)
  if (gaps.size === 0) {
    console.log('✅ 0 gaps — every content word in the sentence banks has a gloss.')
    return
  }
  console.log(`\n❌ ${gaps.size} word(s) with NO gloss — add to src/bridge/sentenceGloss.ts:\n`)
  for (const [word, example] of [...gaps].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${word.padEnd(16)} e.g. "${example}"`)
  }
  process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
