// Phonetics Utilities Module
// Runtime distractor selection based on phonetic similarity and mastery levels

let phoneticIndex = null;
let isInitialized = false;

// Initialize phonetics system by loading the pre-computed index
export async function initializePhonetics() {
  console.log('🎯 [PHONETICS] initializePhonetics() called at', new Date().toISOString());

  if (isInitialized) {
    console.log('⚠️  [PHONETICS] Index already initialized');
    return;
  }

  try {
    console.log('🎯 [PHONETICS] Fetching phonetic-index.json...');
    const response = await fetch('/data/phonetic-index.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    phoneticIndex = await response.json();
    isInitialized = true;

    const wordCount = Object.keys(phoneticIndex).length;
    console.log(`✅ [PHONETICS] Index loaded: ${wordCount} words at`, new Date().toISOString());
  } catch (error) {
    console.error('❌ [PHONETICS] Failed to load phonetic index:', error);
    console.warn('⚠️  [PHONETICS] Falling back to category-based distractor selection');
    phoneticIndex = null;
    isInitialized = false;
  }
}

// Shuffle array utility
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Apply word length similarity filter
function applyLengthFilter(candidates, targetLength, tolerance = 1) {
  return candidates.filter(word => {
    const diff = Math.abs(word.length - targetLength);
    return diff <= tolerance;
  });
}

// Fallback distractor selection when phonetic matching insufficient
function fallbackDistractors(targetWord, vocabularyBank, targetLength = null) {
  console.warn(`[FALLBACK] Insufficient phonetic matches for: ${targetWord}`);

  // Find the target word object
  const targetObj = vocabularyBank.find(w =>
    w.word.toLowerCase() === targetWord.toLowerCase()
  );

  if (!targetObj) {
    console.error(`Target word "${targetWord}" not found in vocabulary bank`);
    return [];
  }

  // Strategy 1: Same category + similar length
  let pool = vocabularyBank.filter(w =>
    w.category === targetObj.category &&
    w.word.toLowerCase() !== targetWord.toLowerCase()
  );

  // Apply length filter if available
  if (targetLength && pool.length > 3) {
    const lengthFiltered = pool.filter(w =>
      Math.abs(w.word.length - targetLength) <= 1
    );

    if (lengthFiltered.length >= 3) {
      pool = lengthFiltered;
    }
  }

  // Strategy 2: If still insufficient, use all categories with length filter
  if (pool.length < 3 && targetLength) {
    pool = vocabularyBank.filter(w =>
      w.word.toLowerCase() !== targetWord.toLowerCase() &&
      Math.abs(w.word.length - targetLength) <= 2 // Increased tolerance
    );
  }

  // Strategy 3: Last resort - any words from category
  if (pool.length < 3) {
    pool = vocabularyBank.filter(w =>
      w.category === targetObj.category &&
      w.word.toLowerCase() !== targetWord.toLowerCase()
    );
  }

  // Shuffle and select up to 3
  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, 3).map(w => w.word);

  console.log(`[FALLBACK] Selected ${selected.length} distractors:`, selected);
  return selected;
}

// Main distractor selection function
export function selectDistractors(targetWord, masteryLevel = 0, vocabularyBank) {
  console.log(`🎯 [PHONETICS] selectDistractors("${targetWord}") - isInitialized: ${isInitialized}, hasIndex: ${!!phoneticIndex}`);

  // Check if phonetics system is initialized
  if (!isInitialized || !phoneticIndex) {
    console.warn('[PHONETICS] System not initialized, using fallback');
    return fallbackDistractors(targetWord, vocabularyBank);
  }

  // Get phonetic metadata for target word
  const normalized = targetWord.toLowerCase();
  const metadata = phoneticIndex[normalized];

  if (!metadata) {
    console.warn(`[PHONETICS] No metadata for "${targetWord}", using fallback`);
    return fallbackDistractors(targetWord, vocabularyBank);
  }

  let candidatePool = [];
  let difficultyTier = 'UNKNOWN';

  // Tier 1: New words (mastery === 0 or undefined)
  if (!masteryLevel || masteryLevel === 0) {
    // EASY: Similar initial sound only
    candidatePool = [...metadata.similarInitial];
    difficultyTier = 'EASY (Initial Sound)';
  }
  // Tier 2: Struggling (0 < mastery < 0.5)
  else if (masteryLevel < 0.5) {
    // MEDIUM: Rhyming words
    candidatePool = [...metadata.similarRhyme];
    difficultyTier = 'MEDIUM (Rhyming)';
  }
  // Tier 3: Learning (0.5 <= mastery < 0.8)
  else if (masteryLevel < 0.8) {
    // HARD: Vowel pattern + complex rhymes (different starting sound)
    candidatePool = [
      ...metadata.similarVowel,
      ...metadata.similarRhyme.filter(w => {
        const wMeta = phoneticIndex[w.toLowerCase()];
        return wMeta && wMeta.initialSound !== metadata.initialSound;
      })
    ];
    difficultyTier = 'HARD (Vowel + Complex Rhyme)';
  }
  // Tier 4: Mastered (mastery >= 0.8)
  else {
    // MIXED: Combine all phonetic patterns for variety
    candidatePool = [
      ...metadata.phoneticNeighbors.slice(0, 5).map(n => n.word),
      ...metadata.similarInitial.slice(0, 3),
      ...metadata.similarRhyme.slice(0, 3),
      ...metadata.similarVowel.slice(0, 3)
    ];
    difficultyTier = 'MASTERED (Mixed Patterns)';
  }

  // Remove duplicates and the target word itself
  candidatePool = [...new Set(candidatePool)]
    .filter(w => w.toLowerCase() !== normalized);

  console.log(`[${difficultyTier}] "${targetWord}" (mastery: ${masteryLevel.toFixed(2)}) - Found ${candidatePool.length} candidates before length filter`);

  // Apply word length filter (±1 character tolerance)
  const lengthFiltered = applyLengthFilter(candidatePool, metadata.length, 1);

  console.log(`[LENGTH FILTER] After filter: ${lengthFiltered.length} candidates (±1 char from ${metadata.length})`);

  // Check if we have enough distractors after filtering
  if (lengthFiltered.length >= 3) {
    const selected = shuffleArray(lengthFiltered).slice(0, 3);
    console.log(`[SUCCESS] Selected distractors:`, selected);
    return selected;
  }

  // Not enough matches - try with relaxed length filter
  if (candidatePool.length >= 3) {
    const relaxedFiltered = applyLengthFilter(candidatePool, metadata.length, 2);
    if (relaxedFiltered.length >= 3) {
      const selected = shuffleArray(relaxedFiltered).slice(0, 3);
      console.log(`[RELAXED] Selected distractors with ±2 length:`, selected);
      return selected;
    }
  }

  // Still insufficient - use fallback
  return fallbackDistractors(targetWord, vocabularyBank, metadata.length);
}

// Helper: Get phonetic metadata for a word (for debugging/testing)
export function getPhoneticMetadata(word) {
  if (!phoneticIndex) {
    console.warn('[PHONETICS] Index not loaded');
    return null;
  }

  return phoneticIndex[word.toLowerCase()] || null;
}

// Helper: Check if phonetics system is ready
export function isPhoneticSystemReady() {
  return isInitialized && phoneticIndex !== null;
}

// Export for use in other modules
export default {
  initializePhonetics,
  selectDistractors,
  getPhoneticMetadata,
  isPhoneticSystemReady
};
