#!/usr/bin/env node

// Batch update all data files with imageUrl fields
import { readFileSync, writeFileSync } from 'fs';

// Load analysis results
const analysis = JSON.parse(readFileSync('scripts/words-analysis.json', 'utf-8'));

// Words that need imageUrl (excluding ones that already have it)
const wordsToUpdate = analysis.found.filter(w => !w.hasImageUrl);

console.log(`\n🔧 Preparing to update ${wordsToUpdate.length} words...\n`);

// Group by category
const updatesByCategory = {};
for (const word of wordsToUpdate) {
    if (!updatesByCategory[word.category]) {
        updatesByCategory[word.category] = [];
    }
    updatesByCategory[word.category].push(word);
}

// Generate imageUrl for each word
function generateImageUrl(word, category) {
    // For colors, use SVG circles
    if (category === 'colors') {
        const colorName = word.word.toLowerCase().replace(/\s+/g, '-');
        return `img/icons/colors/${colorName}-circle.svg`;
    }

    // For everything else, use PNG format
    // Filename format: word in lowercase, spaces replaced with hyphens
    const filename = word.word.toLowerCase().replace(/\s+/g, '-');
    return `img/icons/${category}/${filename}.png`;
}

// Category file paths
const categoryFiles = {
    animals: 'data/categories/animals.js',
    colors: 'data/categories/colors.js',
    numbers: 'data/categories/numbers.js',
    food: 'data/categories/food.js',
    body: 'data/categories/body.js',
    family: 'data/categories/family.js',
    clothes: 'data/categories/clothes.js',
    home: 'data/categories/home.js',
    actions: 'data/categories/actions.js',
    nature: 'data/categories/nature.js',
    school: 'data/categories/school.js',
    minecraft: 'data/categories/minecraft.js',
    gaming: 'data/categories/gaming.js',
    roblox: 'data/categories/roblox.js'
};

// Update each category file
let totalUpdated = 0;

for (const [category, words] of Object.entries(updatesByCategory)) {
    const filepath = categoryFiles[category];
    if (!filepath) {
        console.log(`⚠️  Unknown category: ${category}`);
        continue;
    }

    console.log(`\n📝 Updating ${filepath}...`);

    let content = readFileSync(filepath, 'utf-8');
    let updated = 0;

    for (const word of words) {
        const imageUrl = generateImageUrl(word, category);

        // Build the search pattern (existing line without imageUrl)
        // Pattern: { word: "Word", translation: "תרגום", category: "cat", image: "emoji" }
        const escapedWord = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedTranslation = word.translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedEmoji = word.currentEmoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Match patterns with or without spaces, with optional trailing comma
        const patterns = [
            // Compact format: { word: "X", translation: "Y", category: "Z", image: "E" }
            new RegExp(
                `(\\{\\s*word:\\s*"${escapedWord}"\\s*,\\s*translation:\\s*"${escapedTranslation}"\\s*,\\s*category:\\s*"${category}"\\s*,\\s*image:\\s*"${escapedEmoji}"\\s*)(\\})`,
                'g'
            ),
            // Spaced format
            new RegExp(
                `(\\{\\s*word:\\s*"${escapedWord}"\\s*,\\s*translation:\\s*"${escapedTranslation}"\\s*,\\s*category:\\s*"${category}"\\s*,\\s*image:\\s*"${escapedEmoji}"\\s*)(\\},)`,
                'g'
            )
        ];

        let matched = false;
        for (const pattern of patterns) {
            if (pattern.test(content)) {
                // Add imageUrl before closing brace
                content = content.replace(pattern, `$1, imageUrl: "${imageUrl}"$2`);
                matched = true;
                updated++;
                console.log(`   ✅ ${word.word} → ${imageUrl}`);
                break;
            }
        }

        if (!matched) {
            console.log(`   ⚠️  Could not find: ${word.word}`);
        }
    }

    // Write updated content
    if (updated > 0) {
        writeFileSync(filepath, content, 'utf-8');
        totalUpdated += updated;
        console.log(`   💾 Saved ${updated} updates`);
    }
}

console.log(`\n\n🎉 BATCH UPDATE COMPLETE!`);
console.log(`   Total updated: ${totalUpdated} words`);
console.log(`\n📋 Next steps:`);
console.log(`   1. ✅ Colors (15) - Already have SVGs!`);
console.log(`   2. 📥 Download remaining ${totalUpdated - 15} icons from Flaticon`);
console.log(`   3. 🔄 Hard refresh your browser`);
