// Lightweight vocabulary bank for non-game pages (stats/settings).
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
import { adjectivesWords } from './categories/adjectives.js';
import { feelingsWords } from './categories/feelings.js';
import { placesWords } from './categories/places.js';
import { sportsWords } from './categories/sports.js';
import { timeWords } from './categories/time.js';
import { weatherWords } from './categories/weather.js';

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
    ...weatherWords
];

window.vocabularyBank = vocabularyBank;
export { vocabularyBank };
