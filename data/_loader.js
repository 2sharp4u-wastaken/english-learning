// Main data loader for English Learning Games
// Imports all vocabulary categories and exports combined game data

// ── Nikud utilities — must be imported first so window.getHebrew / setHebrew
//    are defined synchronously before any game module tries to use them. ──────
import { getHebrew, setHebrew, loadNikudMap, enrichVocabularyBank } from '../utils/nikud.js';
import { initNikudDOM } from '../utils/nikudDOM.js?t=1773784000';
window.getHebrew = getHebrew;
window.setHebrew = setHebrew;

// Import all category modules (single source of truth: categories/_index.js)
import {
    animalsWords, colorsWords, numbersWords, foodWords, bodyWords,
    familyWords, clothesWords, homeWords, actionsWords, natureWords,
    schoolWords, minecraftWords, gamingWords, robloxWords, feelingsWords,
    adjectivesWords, placesWords, timeWords, weatherWords, sportsWords,
    transportationWords, toolsWords, signsWords, musicWords,
    customWords
} from './categories/_index.js';

// Import grammar questions and categories
import { grammarQuestions, grammarCategories } from './grammarQuestions.js?t=1779000000';

// Import focused grammar-practice banks (React blank-fill engine)
import { articlesQuestions } from './articlesData.js';
import { progressiveQuestions } from './progressiveData.js';

// Import grammar beginner data (audio-visual grammar for non-readers)
import { subjects, predicates, generateGrammarBeginnerQuestions } from './grammarBeginnerData.js';

// Import ABC alphabet data
import { alphabet, generateABCQuestions } from './abcData.js';

// Import converter functions
import {
    convertToVocabulary,
    convertToReading,
    convertToPronunciation,
    convertToListening,
    convertToPictureMatch
} from './converters.js?t=1775800000';

// Import phonetics system
import { initializePhonetics, selectDistractors } from './phonetics.js';

// Import the Phase 5 expression bank (idioms + phrasal verbs + slang).
// Kept SEPARATE from vocabularyBank below — no vocabulary game may pick it up.
import { expressionBank } from './expressions/_index.js';
// Slice 5.4 — plain-English synonym per phrase, used by the Context Swap game.
import { plainForms as expressionPlainForms } from './expressions/plainForms.js';

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
    ...sportsWords,           // 29 words
    ...transportationWords,   // 26 words
    ...toolsWords,            // 16 words
    ...signsWords,            // 12 words
    ...musicWords,            // 11 words
    ...customWords            // parent-saved words (committed to source)
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

// Apply parent translation overrides from localStorage (Slice 4.3 — replaces the
// legacy Python save-to-source path; applied live at boot, BEFORE nikud
// enrichment + gameData build, so games pick up the overridden Hebrew).
try {
    const transOverrides = JSON.parse(localStorage.getItem('wordTranslationOverrides') || '{}');
    let applied = 0;
    for (const w of vocabularyBank) {
        const t = transOverrides[`${w.category}:${w.word}`];
        if (t) { w.translation = t; applied++; }
    }
    if (applied > 0) console.log(`Applied ${applied} translation override(s) from localStorage`);
} catch (e) {
    console.warn('Failed to apply translation overrides:', e);
}

// Hydrate parent image overrides from localStorage (Slice 4.4 — moved here from the
// deleted utils/imageRenderer.js). 8 React game pages read window.wordImageOverrides
// SYNCHRONOUSLY at render, so it must be populated at boot, before /src/main.tsx.
// The guard keeps the runtime setter in src/bridge/customContent.ts as the owner of
// live updates (Settings → Word Images tab).
if (!window.wordImageOverrides) {
    try { window.wordImageOverrides = JSON.parse(localStorage.getItem('wordImageOverrides') || '{}'); }
    catch (e) { window.wordImageOverrides = {}; }
}

// Make vocabulary accessible for phonetics BEFORE initialization
window.vocabularyBank = vocabularyBank;

// ── Nikud enrichment — load map and set w.hebrew on all words ────────────────
// This runs concurrently with phonetics init; words without a map entry will
// fetch from the Nakdan API automatically and persist the result.
const nikudMap = await enrichVocabularyBank(vocabularyBank, await loadNikudMap());
// Make map available globally so nikudDOM.js can reuse it without re-fetching
window.nikudMap = nikudMap;
// Start DOM scanner (enriches all Hebrew text nodes in the page, including UI)
initNikudDOM();

// ── Enrich grammar data using the same nikud map ─────────────────────────────
// subjects and predicates are mutated in-place so generateGrammarBeginnerQuestions
// picks up the nikud-enriched fields when it runs below.
for (const subj of Object.values(subjects)) {
    subj.hebrew = nikudMap[subj.hebrew] || subj.hebrew;
}
for (const pred of predicates) {
    pred.hebrew       = nikudMap[pred.hebrew]       || pred.hebrew;
    pred.hebrewFem    = nikudMap[pred.hebrewFem]    || pred.hebrewFem;
    pred.hebrewPlural = nikudMap[pred.hebrewPlural] || pred.hebrewPlural;
}
for (const q of grammarQuestions) {
    if (q.hebrewSentence)    q.hebrewSentence    = nikudMap[q.hebrewSentence]    || q.hebrewSentence;
    if (q.hebrewExplanation) q.hebrewExplanation = nikudMap[q.hebrewExplanation] || q.hebrewExplanation;
}
for (const q of [...articlesQuestions, ...progressiveQuestions]) {
    if (q.hebrewSentence)    q.hebrewSentence    = nikudMap[q.hebrewSentence]    || q.hebrewSentence;
    if (q.hebrewExplanation) q.hebrewExplanation = nikudMap[q.hebrewExplanation] || q.hebrewExplanation;
}

// Initialize phonetic distractor system BEFORE converting listening data
console.log('🎯 Loading phonetic distractor system...');
try {
    await initializePhonetics();
    console.log('✅ Phonetic system ready - listening games will use phonetic distractors');
} catch (error) {
    console.warn('⚠️  Phonetic system failed to initialize:', error);
    console.warn('⚠️  Falling back to category-based distractors');
}

// Expose selectDistractors globally so any game can use it without needing
// a direct import from phonetics.js. New games showing English word options
// should call: window.selectDistractors(word, masteryLevel, vocabularyBank)
window.selectDistractors = selectDistractors;

// Apply converters to create game-specific data formats
// Note: convertToListening now runs AFTER phonetics is initialized
const convertedVocabulary = convertToVocabulary(vocabularyBank);
const convertedReading = convertToReading(vocabularyBank);
const convertedPronunciation = convertToPronunciation(vocabularyBank);
const convertedListening = convertToListening(vocabularyBank);
const convertedPictureMatch = convertToPictureMatch(vocabularyBank);

// Generate ABC questions
const abcQuestions = generateABCQuestions(30); // Generate pool of 30 questions

// Generate grammar beginner questions (audio-visual for non-readers)
const grammarBeginnerQuestions = generateGrammarBeginnerQuestions(15);

// Main game data structure
const gameData = {
    vocabulary: convertedVocabulary,
    grammar: grammarQuestions,
    articles: articlesQuestions,
    progressive: progressiveQuestions,
    'grammar-beginner': grammarBeginnerQuestions,
    pronunciation: convertedPronunciation,
    listening: convertedListening,
    reading: convertedReading,
    abc: abcQuestions,
    'picture-match': convertedPictureMatch
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
    abc: gameData.abc.length,
    expressions: expressionBank.length
});

// Make gameData and difficultyLevels available globally and for ES module import
window.gameData = gameData;
window.difficultyLevels = difficultyLevels;
window.grammarCategories = grammarCategories;
// Phase 5 expression bank — exposed parallel to vocabularyBank, read in React only
// through src/bridge/expressions.ts. Deliberately NOT merged into gameData/vocabulary.
window.expressionBank = expressionBank;
// Slice 5.4 — plain-English forms for Context Swap, read via bridge/expressions.ts.
window.expressionPlainForms = expressionPlainForms;
export { gameData, difficultyLevels, grammarCategories, expressionBank, expressionPlainForms };
// vocabularyBank already set above before phonetics initialization

// Called when another tab saves new custom words (storage event).
// Diffs localStorage vs in-memory vocabularyBank, converts new words with full
// bank context (for correct distractors), and appends to gameData.
window.refreshCustomWords = async function () {
    try {
        const fresh = JSON.parse(localStorage.getItem('customWords_global') || '[]');
        const existingSet = new Set(vocabularyBank.map(w => w.word.toLowerCase()));
        const newWords = fresh.filter(w => !existingSet.has(w.word.toLowerCase()));

        if (newWords.length === 0) return;

        // Extend vocabularyBank first so distractor generation has the full pool
        vocabularyBank.push(...newWords);
        window.vocabularyBank = vocabularyBank;

        // Enrich new words with nikud inline (fetches from API for any missing)
        await enrichVocabularyBank(newWords, nikudMap);

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

// ── Engine boot signal (Slice 4.4.b1) ───────────────────────────────────────
// React owns engine startup now (src/engine/boot.ts). It must wait until this
// module has populated window.gameData / vocabularyBank / nikudMap before
// instantiating the engine. There was no ready signal before; add a flag + event
// so the React boot can fire immediately if it loads after us, or on the event if
// it loads first. (This module uses top-level await, so reaching here means done.)
window.__gameDataReady = true;
window.dispatchEvent(new CustomEvent('game-data-ready'));
