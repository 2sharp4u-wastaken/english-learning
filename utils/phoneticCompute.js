/**
 * Browser-compatible phonetic entry computation.
 * Ported from scripts/generate-phonetic-data.js — pure JS, no Node.js deps.
 *
 * Sets window.computePhoneticEntry as a side effect so settings.js
 * (a classic non-module script) can call it after this module loads.
 */

const DIGRAPHS = ['ch', 'sh', 'th', 'wh', 'ph', 'gh'];
const BLENDS   = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl',
                  'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn',
                  'sp', 'st', 'sw', 'tr', 'tw'];
const VOWEL_DIGRAPHS = ['ai', 'ay', 'ea', 'ee', 'ei', 'ie', 'oa',
                        'oo', 'ou', 'ow', 'ue', 'ui'];

function extractInitialSound(word) {
    const l = word.toLowerCase();
    for (const d of DIGRAPHS) if (l.startsWith(d)) return d;
    for (const b of BLENDS)   if (l.startsWith(b)) return b;
    return l[0];
}

function extractRhymePattern(word) {
    const l = word.toLowerCase();
    if (l.length <= 2) return l;
    if (l.length <= 4) return l.slice(-2);
    return l.slice(-3);
}

function extractVowelPattern(word) {
    const l = word.toLowerCase();
    const vowels = [];
    let i = 0;
    while (i < l.length) {
        const two = l.slice(i, i + 2);
        if (VOWEL_DIGRAPHS.includes(two)) { vowels.push(two); i += 2; continue; }
        if ('aeiou'.includes(l[i])) vowels.push(l[i]);
        i++;
    }
    return vowels.join('-') || 'none';
}

function estimateSyllables(word) {
    const l = word.toLowerCase().replace(/[^a-z]/g, '');
    let count = 0, inVowel = false;
    for (const ch of l) {
        const isV = 'aeiouy'.includes(ch);
        if (isV && !inVowel) { count++; inVowel = true; }
        else if (!isV) inVowel = false;
    }
    if (l.endsWith('e') && count > 1 && !l.endsWith('le')) count--;
    return Math.max(1, count);
}

function levenshteinDistance(a, b) {
    const s1 = a.toLowerCase(), s2 = b.toLowerCase();
    const matrix = Array.from({ length: s1.length + 1 }, (_, i) =>
        Array.from({ length: s2.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[s1.length][s2.length];
}

/**
 * Compute the full phonetic index entry for a single word.
 * allWords is an array of vocabulary word objects ({ word, ... }).
 */
export function computePhoneticEntry(word, allWords) {
    const normalized = word.toLowerCase();
    const initialSound  = extractInitialSound(normalized);
    const finalSound    = extractRhymePattern(normalized);
    const vowelPattern  = extractVowelPattern(normalized);

    return {
        length: normalized.length,
        initialSound,
        finalSound,
        vowelPattern,
        syllableCount: estimateSyllables(normalized),
        similarInitial: allWords
            .filter(w => w.word.toLowerCase() !== normalized &&
                         extractInitialSound(w.word.toLowerCase()) === initialSound)
            .map(w => w.word).slice(0, 25),
        similarRhyme: allWords
            .filter(w => w.word.toLowerCase() !== normalized &&
                         extractRhymePattern(w.word.toLowerCase()) === finalSound)
            .map(w => w.word).slice(0, 25),
        similarVowel: allWords
            .filter(w => w.word.toLowerCase() !== normalized &&
                         extractVowelPattern(w.word.toLowerCase()) === vowelPattern)
            .map(w => w.word).slice(0, 25),
        phoneticNeighbors: allWords
            .filter(w => w.word.toLowerCase() !== normalized)
            .map(w => ({ word: w.word, distance: levenshteinDistance(normalized, w.word.toLowerCase()) }))
            .filter(n => n.distance <= 3)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 15)
    };
}

// Expose globally so settings.js (classic script) can call it
window.computePhoneticEntry = computePhoneticEntry;
