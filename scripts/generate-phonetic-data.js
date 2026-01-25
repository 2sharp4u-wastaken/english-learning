#!/usr/bin/env node

// Phonetic Data Generation Script
// Analyzes all vocabulary words and generates phonetic similarity index
// Run: node scripts/generate-phonetic-data.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phonetic constants
const DIGRAPHS = ['ch', 'sh', 'th', 'wh', 'ph', 'gh'];
const BLENDS = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl',
                'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn',
                'sp', 'st', 'sw', 'tr', 'tw'];
const VOWEL_DIGRAPHS = ['ai', 'ay', 'ea', 'ee', 'ei', 'ie', 'oa',
                        'oo', 'ou', 'ow', 'ue', 'ui'];

// Extract initial sound (handles digraphs and blends)
function extractInitialSound(word) {
  const lower = word.toLowerCase();

  // Check digraphs first (ch, sh, th, etc.)
  for (const digraph of DIGRAPHS) {
    if (lower.startsWith(digraph)) {
      return digraph;
    }
  }

  // Check consonant blends (br, gl, tr, etc.)
  for (const blend of BLENDS) {
    if (lower.startsWith(blend)) {
      return blend;
    }
  }

  // Single letter (consonant or vowel)
  return lower[0];
}

// Extract rhyme pattern (last 2-3 characters)
function extractRhymePattern(word) {
  const lower = word.toLowerCase();

  // Very short words - use whole word
  if (lower.length <= 2) {
    return lower;
  }

  // Short words (3-4 letters) - last 2 chars
  if (lower.length <= 4) {
    return lower.slice(-2);
  }

  // Longer words - last 3 chars (more context)
  return lower.slice(-3);
}

// Extract vowel pattern sequence
function extractVowelPattern(word) {
  const lower = word.toLowerCase();
  const vowels = [];
  let i = 0;

  while (i < lower.length) {
    // Check for vowel digraphs (ai, ea, oo, etc.)
    const twoChar = lower.slice(i, i + 2);
    if (VOWEL_DIGRAPHS.includes(twoChar)) {
      vowels.push(twoChar);
      i += 2;
      continue;
    }

    // Single vowel
    if ('aeiou'.includes(lower[i])) {
      vowels.push(lower[i]);
    }
    i++;
  }

  return vowels.join('-') || 'none';
}

// Estimate syllable count
function estimateSyllables(word) {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');

  // Count vowel groups
  let count = 0;
  let inVowelGroup = false;

  for (let i = 0; i < lower.length; i++) {
    const isVowel = 'aeiouy'.includes(lower[i]);

    if (isVowel && !inVowelGroup) {
      count++;
      inVowelGroup = true;
    } else if (!isVowel) {
      inVowelGroup = false;
    }
  }

  // Silent 'e' rule - reduce count if ends in 'e' and has multiple syllables
  if (lower.endsWith('e') && count > 1 && !lower.endsWith('le')) {
    count--;
  }

  // Minimum 1 syllable
  return Math.max(1, count);
}

// Calculate Levenshtein distance between two words
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const len1 = s1.length;
  const len2 = s2.length;

  // Create distance matrix
  const matrix = Array(len1 + 1).fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

// Load all vocabulary from category files
function loadVocabulary() {
  const categoriesPath = path.join(__dirname, '..', 'data', 'categories');
  const files = fs.readdirSync(categoriesPath)
    .filter(f => f.endsWith('.js'));

  const allWords = [];

  for (const file of files) {
    const filePath = path.join(categoriesPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract vocabulary array from file
    // Files export: export const categoryName = [ ... ];
    const match = content.match(/export\s+const\s+\w+\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      try {
        // Use eval in controlled environment (only for build script)
        const vocabulary = eval(match[1]);
        allWords.push(...vocabulary);
        console.log(`✓ Loaded ${vocabulary.length} words from ${file}`);
      } catch (error) {
        console.error(`✗ Error loading ${file}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Total vocabulary loaded: ${allWords.length} words\n`);
  return allWords;
}

// Find words with similar initial sound
function findSimilarInitial(targetWord, targetInitial, allWords) {
  return allWords
    .filter(w => {
      if (w.word.toLowerCase() === targetWord.toLowerCase()) return false;
      const initial = extractInitialSound(w.word);
      return initial === targetInitial;
    })
    .map(w => w.word)
    .slice(0, 25); // Limit to top 25 matches
}

// Find words with similar rhyme pattern
function findSimilarRhyme(targetWord, targetRhyme, allWords) {
  return allWords
    .filter(w => {
      if (w.word.toLowerCase() === targetWord.toLowerCase()) return false;
      const rhyme = extractRhymePattern(w.word);
      return rhyme === targetRhyme;
    })
    .map(w => w.word)
    .slice(0, 25); // Limit to top 25 matches
}

// Find words with similar vowel pattern
function findSimilarVowel(targetWord, targetVowel, allWords) {
  return allWords
    .filter(w => {
      if (w.word.toLowerCase() === targetWord.toLowerCase()) return false;
      const vowel = extractVowelPattern(w.word);
      return vowel === targetVowel;
    })
    .map(w => w.word)
    .slice(0, 25); // Limit to top 25 matches
}

// Find phonetically closest neighbors using Levenshtein distance
function findPhoneticNeighbors(targetWord, allWords) {
  const neighbors = [];

  for (const wordObj of allWords) {
    if (wordObj.word.toLowerCase() === targetWord.toLowerCase()) continue;

    const distance = levenshteinDistance(targetWord, wordObj.word);

    // Only keep words with distance ≤ 3 (very similar)
    if (distance <= 3) {
      neighbors.push({
        word: wordObj.word,
        distance: distance
      });
    }
  }

  // Sort by distance (closest first) and limit to top 15
  return neighbors
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 15);
}

// Generate phonetic index for all words
function generatePhoneticIndex(vocabulary) {
  const phoneticIndex = {};
  const total = vocabulary.length;
  let processed = 0;

  console.log('Analyzing phonetic features...\n');

  // Progress bar helper
  const printProgress = () => {
    const percent = Math.round((processed / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
    process.stdout.write(`\r[${bar}] ${percent}% (${processed}/${total})`);
  };

  for (const wordObj of vocabulary) {
    const word = wordObj.word;
    const normalized = word.toLowerCase();

    // Extract phonetic features
    const length = normalized.length;
    const initialSound = extractInitialSound(normalized);
    const finalSound = extractRhymePattern(normalized);
    const vowelPattern = extractVowelPattern(normalized);
    const syllableCount = estimateSyllables(normalized);

    // Find similar words by each feature
    const similarInitial = findSimilarInitial(word, initialSound, vocabulary);
    const similarRhyme = findSimilarRhyme(word, finalSound, vocabulary);
    const similarVowel = findSimilarVowel(word, vowelPattern, vocabulary);

    // Find phonetically closest neighbors
    const phoneticNeighbors = findPhoneticNeighbors(word, vocabulary);

    // Store in index
    phoneticIndex[normalized] = {
      length,
      initialSound,
      finalSound,
      vowelPattern,
      syllableCount,
      similarInitial,
      similarRhyme,
      similarVowel,
      phoneticNeighbors
    };

    processed++;
    if (processed % 10 === 0 || processed === total) {
      printProgress();
    }
  }

  console.log('\n\n✅ Phonetic analysis complete!\n');
  return phoneticIndex;
}

// Generate statistics report
function generateStatistics(phoneticIndex) {
  const words = Object.keys(phoneticIndex);
  let totalInitialMatches = 0;
  let totalRhymeMatches = 0;
  let totalVowelMatches = 0;
  let wordsWithFewMatches = 0;

  for (const word of words) {
    const data = phoneticIndex[word];
    totalInitialMatches += data.similarInitial.length;
    totalRhymeMatches += data.similarRhyme.length;
    totalVowelMatches += data.similarVowel.length;

    // Count words with <3 matches in any category
    if (data.similarInitial.length < 3 ||
        data.similarRhyme.length < 3) {
      wordsWithFewMatches++;
    }
  }

  const avgInitial = (totalInitialMatches / words.length).toFixed(1);
  const avgRhyme = (totalRhymeMatches / words.length).toFixed(1);
  const avgVowel = (totalVowelMatches / words.length).toFixed(1);
  const fallbackPercent = ((wordsWithFewMatches / words.length) * 100).toFixed(1);

  console.log('📊 Statistics:');
  console.log(`   Total words analyzed: ${words.length}`);
  console.log(`   Avg similar initial sounds: ${avgInitial} per word`);
  console.log(`   Avg rhyming words: ${avgRhyme} per word`);
  console.log(`   Avg similar vowel patterns: ${avgVowel} per word`);
  console.log(`   Words requiring fallback: ${wordsWithFewMatches} (${fallbackPercent}%)`);
  console.log('');
}

// Main execution
function main() {
  console.log('🎯 Phonetic Data Generation Script\n');
  console.log('=' .repeat(50) + '\n');

  // Load vocabulary
  const vocabulary = loadVocabulary();

  if (vocabulary.length === 0) {
    console.error('❌ No vocabulary loaded. Check data/categories/ directory.');
    process.exit(1);
  }

  // Generate phonetic index
  const phoneticIndex = generatePhoneticIndex(vocabulary);

  // Generate statistics
  generateStatistics(phoneticIndex);

  // Write to file
  const outputPath = path.join(__dirname, '..', 'data', 'phonetic-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(phoneticIndex, null, 2), 'utf8');

  const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`✅ Phonetic index saved to: ${outputPath}`);
  console.log(`   File size: ${fileSizeKB} KB`);
  console.log('\n✨ Done! You can now use the phonetic distractor system.\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  extractInitialSound,
  extractRhymePattern,
  extractVowelPattern,
  estimateSyllables,
  levenshteinDistance
};
