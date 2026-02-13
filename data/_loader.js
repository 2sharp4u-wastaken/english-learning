// Main data loader for English Learning Games
// Imports all vocabulary categories and exports combined game data

// Import all category modules
import { animalsWords } from './categories/animals.js';
import { colorsWords } from './categories/colors.js';
import { numbersWords } from './categories/numbers.js';
import { foodWords } from './categories/food.js';
import { bodyWords } from './categories/body.js';
import { familyWords } from './categories/family.js';
import { clothesWords } from './categories/clothes.js';
import { homeWords } from './categories/home.js';
import { actionsWords } from './categories/actions.js';
import { natureWords } from './categories/nature.js';
import { schoolWords } from './categories/school.js';
import { minecraftWords } from './categories/minecraft.js';
import { gamingWords } from './categories/gaming.js';
import { robloxWords } from './categories/roblox.js';

// Import grammar questions and categories
import { grammarQuestions, grammarCategories } from './grammarQuestions.js';

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
    ...robloxWords      // 40 words
];

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

console.log('Global gameData and difficultyLevels set successfully');
