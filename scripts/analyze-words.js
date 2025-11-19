#!/usr/bin/env node

// Analyze words and find their categories
import { readFileSync } from 'fs';
import { animalsWords } from '../data/categories/animals.js';
import { colorsWords } from '../data/categories/colors.js';
import { numbersWords } from '../data/categories/numbers.js';
import { foodWords } from '../data/categories/food.js';
import { bodyWords } from '../data/categories/body.js';
import { familyWords } from '../data/categories/family.js';
import { clothesWords } from '../data/categories/clothes.js';
import { homeWords } from '../data/categories/home.js';
import { actionsWords } from '../data/categories/actions.js';
import { natureWords } from '../data/categories/nature.js';
import { schoolWords } from '../data/categories/school.js';
import { minecraftWords } from '../data/categories/minecraft.js';
import { gamingWords } from '../data/categories/gaming.js';
import { robloxWords } from '../data/categories/roblox.js';

// Combine all vocabulary
const allCategories = {
    animals: animalsWords,
    colors: colorsWords,
    numbers: numbersWords,
    food: foodWords,
    body: bodyWords,
    family: familyWords,
    clothes: clothesWords,
    home: homeWords,
    actions: actionsWords,
    nature: natureWords,
    school: schoolWords,
    minecraft: minecraftWords,
    gaming: gamingWords,
    roblox: robloxWords
};

// Read words to replace
const wordsToReplace = readFileSync('words_to_replace_icons.sh', 'utf-8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);

console.log(`\n📋 Analyzing ${wordsToReplace.length} words...\n`);

const results = {
    found: [],
    notFound: [],
    byCategory: {}
};

// Find each word
for (const searchWord of wordsToReplace) {
    let found = false;

    for (const [categoryName, words] of Object.entries(allCategories)) {
        const match = words.find(w => w.word.toLowerCase() === searchWord);

        if (match) {
            found = true;
            results.found.push({
                word: match.word,
                category: categoryName,
                translation: match.translation,
                currentEmoji: match.image,
                hasImageUrl: !!match.imageUrl
            });

            if (!results.byCategory[categoryName]) {
                results.byCategory[categoryName] = [];
            }
            results.byCategory[categoryName].push(match);
            break;
        }
    }

    if (!found) {
        results.notFound.push(searchWord);
    }
}

// Print results
console.log('✅ FOUND WORDS:\n');
console.log(`Total: ${results.found.length} words\n`);

for (const [category, words] of Object.entries(results.byCategory)) {
    console.log(`\n📁 ${category.toUpperCase()} (${words.length} words):`);
    words.forEach(w => {
        const status = w.imageUrl ? '✓ has imageUrl' : '✗ needs imageUrl';
        console.log(`   ${w.word.padEnd(20)} ${w.image}  ${status}`);
    });
}

if (results.notFound.length > 0) {
    console.log('\n\n❌ NOT FOUND (${results.notFound.length} words):\n');
    results.notFound.forEach(w => console.log(`   - ${w}`));
}

// Summary
console.log('\n\n📊 SUMMARY:');
console.log(`   Found: ${results.found.length}`);
console.log(`   Not Found: ${results.notFound.length}`);
console.log(`   Already have imageUrl: ${results.found.filter(w => w.hasImageUrl).length}`);
console.log(`   Need imageUrl: ${results.found.filter(w => !w.hasImageUrl).length}`);

// Export for other scripts
import { writeFileSync } from 'fs';
writeFileSync('scripts/words-analysis.json', JSON.stringify(results, null, 2));
console.log('\n💾 Analysis saved to: scripts/words-analysis.json');
