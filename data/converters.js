// Data transformation functions to convert vocabulary into game-specific formats
// These functions prepare the data for different game types

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
    return vocabularyBank.map(item => {
        // Generate English word options from same category; ensure uniqueness
        const pool = vocabularyBank.filter(w => w.category === item.category && w.word !== item.word);
        const seen = new Set();
        const wrongOptions = [];
        for (const w of pool.sort(() => Math.random() - 0.5)) {
            if (wrongOptions.length === 3) break;
            if (!seen.has(w.word)) { seen.add(w.word); wrongOptions.push(w.word); }
        }
        const optionSet = new Set([item.word, ...wrongOptions]);
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
            category: item.category // Preserve category for filtering
        };
    });
}
