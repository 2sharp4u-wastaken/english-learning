// Main data loader for English Learning Games
// Imports all vocabulary categories and exports combined game data

// Import all category modules (single source of truth: categories/_index.js)
import {
    animalsWords, colorsWords, numbersWords, foodWords, bodyWords,
    familyWords, clothesWords, homeWords, actionsWords, natureWords,
    schoolWords, minecraftWords, gamingWords, robloxWords, feelingsWords,
    adjectivesWords, placesWords, timeWords, weatherWords, sportsWords,
    customWords
} from './categories/_index.js';

// Import grammar questions and categories
import { grammarQuestions, grammarCategories } from './grammarQuestions.js?t=1774903002';

// Import grammar beginner data (audio-visual grammar for non-readers)
import { generateGrammarBeginnerQuestions } from './grammarBeginnerData.js';

// Import ABC alphabet data
import { alphabet, generateABCQuestions } from './abcData.js';

// Import converter functions
import {
    convertToVocabulary,
    convertToReading,
    convertToPronunciation,
    convertToListening
} from './converters.js?t=1762593312';

// Import phonetics system
import { initializePhonetics } from './phonetics.js';

// Combine all vocabulary into single bank
const vocabularyBank = [
    ...animalsWords,    // 60 words
    ...colorsWords,     // 30 words
    ...numbersWords,    // 52 words
    ...foodWords,       // 60 words
    ...bodyWords,       // 30 words
    ...familyWords,     // 20 words
    ...clothesWords,    // 30 words
    ...homeWords,       // 62 words
    ...actionsWords,    // 40 words
    ...natureWords,     // 30 words
    ...schoolWords,     // 20 words
    ...minecraftWords,  // 50 words
    ...gamingWords,     // 50 words
    ...robloxWords,     // 40 words
    ...feelingsWords,   // 22 words
    ...adjectivesWords, // 34 words
    ...placesWords,     // 18 words
    ...timeWords,       // 20 words
    ...weatherWords,    // 15 words
    ...sportsWords,     // 18 words
    ...customWords      // parent-saved words (committed to source)
];

// Inject parent custom words from localStorage
try {
    const customWords = JSON.parse(localStorage.getItem('customWords_global') || '[]');
    if (customWords.length > 0) {
        vocabularyBank.push(...customWords);
        console.log(`Injected ${customWords.length} custom words into vocabulary bank`);
    }
} catch (e) {
    console.warn('Failed to inject custom words:', e);
}

// Make vocabulary accessible for phonetics BEFORE initialization
window.vocabularyBank = vocabularyBank;

// Initialize phonetic distractor system BEFORE converting listening data
console.log('🎯 Loading phonetic distractor system...');
try {
    await initializePhonetics();
    console.log('✅ Phonetic system ready - listening games will use phonetic distractors');
} catch (error) {
    console.warn('⚠️  Phonetic system failed to initialize:', error);
    console.warn('⚠️  Falling back to category-based distractors');
}

// Apply converters to create game-specific data formats
// Note: convertToListening now runs AFTER phonetics is initialized
const convertedVocabulary = convertToVocabulary(vocabularyBank);
const convertedReading = convertToReading(vocabularyBank);
const convertedPronunciation = convertToPronunciation(vocabularyBank);
const convertedListening = convertToListening(vocabularyBank);

// Generate ABC questions
const abcQuestions = generateABCQuestions(30); // Generate pool of 30 questions

// Generate grammar beginner questions (audio-visual for non-readers)
const grammarBeginnerQuestions = generateGrammarBeginnerQuestions(15);

// Main game data structure
const gameData = {
    vocabulary: convertedVocabulary,
    grammar: grammarQuestions,
    'grammar-beginner': grammarBeginnerQuestions,
    pronunciation: convertedPronunciation,
    listening: convertedListening,
    reading: convertedReading,
    abc: abcQuestions
};

// Difficulty levels for adaptive learning
const difficultyLevels = {
    beginner: { name: "מתחיל", color: "#48bb78" },
    intermediate: { name: "בינוני", color: "#ed8936" },
    advanced: { name: "מתקדם", color: "#e53e3e" }
};

// Debug logging to identify issues
console.log('Starting gameData.js loading...');
console.log('vocabularyBank length:', vocabularyBank.length);
console.log('convertedVocabulary length:', convertedVocabulary.length);
console.log('grammarQuestions length:', grammarQuestions.length);
console.log('convertedPronunciation length:', convertedPronunciation.length);
console.log('convertedListening length:', convertedListening.length);
console.log('convertedReading length:', convertedReading.length);

console.log('Game data loaded successfully:', {
    vocabulary: gameData.vocabulary.length,
    grammar: gameData.grammar.length,
    pronunciation: gameData.pronunciation.length,
    listening: gameData.listening.length,
    reading: gameData.reading.length,
    abc: gameData.abc.length
});

// Make gameData and difficultyLevels available globally and for ES module import
window.gameData = gameData;
window.difficultyLevels = difficultyLevels;
window.grammarCategories = grammarCategories;
export { gameData, difficultyLevels, grammarCategories };
// vocabularyBank already set above before phonetics initialization

// Called when another tab saves new custom words (storage event).
// Diffs localStorage vs in-memory vocabularyBank, converts new words with full
// bank context (for correct distractors), and appends to gameData.
window.refreshCustomWords = function () {
    try {
        const fresh = JSON.parse(localStorage.getItem('customWords_global') || '[]');
        const existingSet = new Set(vocabularyBank.map(w => w.word.toLowerCase()));
        const newWords = fresh.filter(w => !existingSet.has(w.word.toLowerCase()));

        if (newWords.length === 0) return;

        // Extend vocabularyBank first so distractor generation has the full pool
        vocabularyBank.push(...newWords);
        window.vocabularyBank = vocabularyBank;

        // Slice index where new words start (they were pushed to the end)
        const startIdx = vocabularyBank.length - newWords.length;

        // vocabulary + listening need full bank for distractor generation — convert
        // all then take the tail. reading + pronunciation are purely per-word.
        gameData.vocabulary.push(...convertToVocabulary(vocabularyBank).slice(startIdx));
        gameData.reading.push(...convertToReading(newWords));
        gameData.pronunciation.push(...convertToPronunciation(newWords));
        gameData.listening.push(...convertToListening(vocabularyBank).slice(startIdx));

        console.log(`[refreshCustomWords] Appended ${newWords.length} new custom word(s) to gameData`);
    } catch (e) {
        console.warn('[refreshCustomWords] Failed:', e);
    }
};

console.log('Global gameData and difficultyLevels set successfully');
