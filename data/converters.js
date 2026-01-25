// Data transformation functions to convert vocabulary into game-specific formats
// These functions prepare the data for different game types

import { selectDistractors } from './phonetics.js';

// Function to generate Hebrew options for vocabulary questions
function generateHebrewOptions(correctTranslation, category, vocabularyBank) {
    // Prefer same category, fallback to all, ensure uniqueness and no collisions
    const pool = [
        ...vocabularyBank.filter(w => w.category === category && w.translation !== correctTranslation),
        ...vocabularyBank.filter(w => w.translation !== correctTranslation)
    ];
    const seen = new Set();
    const distractors = [];
    for (const item of pool.sort(() => Math.random() - 0.5)) {
        if (distractors.length === 3) break;
        if (!seen.has(item.translation)) {
            seen.add(item.translation);
            distractors.push(item.translation);
        }
    }
    const set = new Set([correctTranslation, ...distractors]);
    const options = Array.from(set).sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctTranslation);
    return { options, correct: correctIndex };
}

// Convert vocabularyBank to vocabulary game format
export function convertToVocabulary(vocabularyBank) {
    return vocabularyBank.map(item => {
        const { options, correct } = generateHebrewOptions(item.translation, item.category, vocabularyBank);

        return {
            word: item.word,
            pronunciation: `/${item.word.toLowerCase()}/`, // Simple pronunciation
            hebrew: item.translation,
            picture: item.image,
            imageUrl: item.imageUrl, // Support for real images
            options: options,
            correct: correct,
            difficulty: "beginner",
            category: item.category
        };
    });
}

// Convert for reading game (simpler format)
export function convertToReading(vocabularyBank) {
    return vocabularyBank.map(item => ({
        word: item.word.toUpperCase(),
        picture: item.image,
        imageUrl: item.imageUrl, // Support for real images
        hebrew: item.translation,
        phonics: item.word.split('').join('-'),
        extraLetters: ["M", "T", "R", "S", "N", "L"], // Common extra letters
        difficulty: "beginner",
        category: item.category // Preserve category for filtering
    }));
}

// Convert for pronunciation game
export function convertToPronunciation(vocabularyBank) {
    return vocabularyBank.map(item => ({
        word: item.word,
        phonetic: `/${item.word.toLowerCase()}/`,
        hebrew: item.translation,
        picture: item.image,
        imageUrl: item.imageUrl, // Support for real images
        difficulty: "beginner",
        category: item.category // Preserve category for filtering
    }));
}

// Convert for listening game - show English words as options
export function convertToListening(vocabularyBank) {
    console.log('📋 [CONVERTER] convertToListening() called at', new Date().toISOString());
    console.log('📋 [CONVERTER] Converting', vocabularyBank.length, 'words for listening game');
    return vocabularyBank.map(item => {
        // Get mastery level for adaptive difficulty
        const masteryKey = `${item.word}_${item.category}`;
        const wordMastery = window.app?.userProgress?.wordMastery || {};
        const masteryLevel = wordMastery[masteryKey]?.masteryLevel || 0;

        // Generate phonetically similar distractors based on mastery
        let distractors = selectDistractors(item.word, masteryLevel, vocabularyBank);

        // Ensure we have exactly 3 distractors
        // If phonetic selection returned fewer, pad with category-based fallback
        if (distractors.length < 3) {
            console.warn(`[CONVERTER] Only ${distractors.length} distractors for "${item.word}", padding with category fallback`);

            const pool = vocabularyBank.filter(w =>
                w.category === item.category &&
                w.word !== item.word &&
                !distractors.includes(w.word)
            );

            const shuffled = pool.sort(() => Math.random() - 0.5);
            const needed = 3 - distractors.length;
            const extras = shuffled.slice(0, needed).map(w => w.word);
            distractors = [...distractors, ...extras];
        }

        // Take only first 3 distractors (in case we got more)
        distractors = distractors.slice(0, 3);

        // Shuffle all options and find correct index
        const optionSet = new Set([item.word, ...distractors]);
        const options = Array.from(optionSet).sort(() => Math.random() - 0.5);
        const correct = options.indexOf(item.word);

        return {
            word: item.word,
            hebrew: item.translation,
            picture: item.image,
            imageUrl: item.imageUrl, // Support for real images
            options: options,
            correct: correct,
            difficulty: "beginner",
            category: item.category, // Preserve category for filtering
            masteryLevel: masteryLevel // Store for debugging
        };
    });
}
