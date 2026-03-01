// Lightweight vocabulary bank for non-game pages (stats/settings).
// Category list is maintained in categories/_index.js — add new categories there.
import {
    animalsWords, colorsWords, numbersWords, foodWords, bodyWords,
    familyWords, clothesWords, homeWords, actionsWords, natureWords,
    schoolWords, minecraftWords, gamingWords, robloxWords, feelingsWords,
    adjectivesWords, placesWords, timeWords, weatherWords, sportsWords,
    customWords
} from './categories/_index.js';

const vocabularyBank = [
    ...animalsWords,
    ...colorsWords,
    ...numbersWords,
    ...foodWords,
    ...bodyWords,
    ...familyWords,
    ...clothesWords,
    ...homeWords,
    ...actionsWords,
    ...natureWords,
    ...schoolWords,
    ...minecraftWords,
    ...gamingWords,
    ...robloxWords,
    ...adjectivesWords,
    ...feelingsWords,
    ...placesWords,
    ...sportsWords,
    ...timeWords,
    ...weatherWords,
    ...customWords      // parent-saved words (committed to source)
];

// Inject parent custom words from localStorage
try {
    const customWords = JSON.parse(localStorage.getItem('customWords_global') || '[]');
    if (customWords.length > 0) {
        vocabularyBank.push(...customWords);
    }
} catch (e) { /* ignore */ }

window.vocabularyBank = vocabularyBank;
export { vocabularyBank };
