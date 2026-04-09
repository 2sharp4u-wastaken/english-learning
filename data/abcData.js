// ABC Alphabet Data for learning uppercase and lowercase letters

export const alphabet = [
    { letter: 'A', lowercase: 'a', phonetic: 'ay', word: 'Apple' },
    { letter: 'B', lowercase: 'b', phonetic: 'bee', word: 'Ball' },
    { letter: 'C', lowercase: 'c', phonetic: 'see', word: 'Cat' },
    { letter: 'D', lowercase: 'd', phonetic: 'dee', word: 'Dog' },
    { letter: 'E', lowercase: 'e', phonetic: 'ee', word: 'Elephant' },
    { letter: 'F', lowercase: 'f', phonetic: 'ef', word: 'Fish' },
    { letter: 'G', lowercase: 'g', phonetic: 'jee', word: 'Giraffe' },
    { letter: 'H', lowercase: 'h', phonetic: 'aitch', word: 'House' },
    { letter: 'I', lowercase: 'i', phonetic: 'eye', word: 'Ice cream' },
    { letter: 'J', lowercase: 'j', phonetic: 'jay', word: 'Juice' },
    { letter: 'K', lowercase: 'k', phonetic: 'kay', word: 'Kite' },
    { letter: 'L', lowercase: 'l', phonetic: 'el', word: 'Lion' },
    { letter: 'M', lowercase: 'm', phonetic: 'em', word: 'Moon' },
    { letter: 'N', lowercase: 'n', phonetic: 'en', word: 'Nose' },
    { letter: 'O', lowercase: 'o', phonetic: 'oh', word: 'Orange' },
    { letter: 'P', lowercase: 'p', phonetic: 'pee', word: 'Pizza' },
    { letter: 'Q', lowercase: 'q', phonetic: 'cue', word: 'Queen' },
    { letter: 'R', lowercase: 'r', phonetic: 'ar', word: 'Rainbow' },
    { letter: 'S', lowercase: 's', phonetic: 'ess', word: 'Sun' },
    { letter: 'T', lowercase: 't', phonetic: 'tee', word: 'Tree' },
    { letter: 'U', lowercase: 'u', phonetic: 'you', word: 'Umbrella' },
    { letter: 'V', lowercase: 'v', phonetic: 'vee', word: 'Violin' },
    { letter: 'W', lowercase: 'w', phonetic: 'double you', word: 'Water' },
    { letter: 'X', lowercase: 'x', phonetic: 'ex', word: 'X-ray' },
    { letter: 'Y', lowercase: 'y', phonetic: 'why', word: 'Yellow' },
    { letter: 'Z', lowercase: 'z', phonetic: 'zee', word: 'Zebra' }
];

// Get letter mastery from app progress
function getLetterMastery(letter) {
    if (!window.app || !window.app.userProgress || !window.app.userProgress.wordMastery) {
        return 0;
    }
    const key = `${letter.toUpperCase()}_abc`;
    const stats = window.app.userProgress.wordMastery[key];
    return stats?.masteryLevel || 0;
}

// Check if all letters are mastered
export function areAllLettersMastered() {
    return alphabet.every(l => getLetterMastery(l.letter) >= 0.8);
}

// Get count of unmastered letters
export function getUnmasteredLetterCount() {
    return alphabet.filter(l => getLetterMastery(l.letter) < 0.8).length;
}

// Generate ABC game questions with smart selection based on mastery
export function generateABCQuestions(count = 20) {
    const questions = [];
    const questionTypes = ['match-case', 'letter-sound', 'identify-case', 'say-letter', 'alphabet-order', 'word-picture'];

    // Filter out mastered letters (mastery >= 0.8) - don't cycle back
    const unmasteredLetters = alphabet.filter(l => getLetterMastery(l.letter) < 0.8);

    // If all letters are mastered, return empty array (game will show congratulations)
    if (unmasteredLetters.length === 0) {
        console.log('[ABC] All letters mastered! Returning empty questions.');
        return [];
    }

    console.log(`[ABC] ${unmasteredLetters.length} unmastered letters remaining`);

    // Sort unmastered letters by mastery (lowest first - prioritize struggling letters)
    const lettersByMastery = [...unmasteredLetters].sort((a, b) => {
        const masteryA = getLetterMastery(a.letter);
        const masteryB = getLetterMastery(b.letter);
        if (masteryA !== masteryB) return masteryA - masteryB;
        return Math.random() - 0.5;
    });

    // NEW APPROACH: Create question pairs (letter + question type) to ensure variety
    // Each letter gets paired with different question types before repeating a type
    const letterTypeUsage = {}; // Track which question types each letter has been used with
    lettersByMastery.forEach(l => {
        letterTypeUsage[l.letter] = new Set();
    });

    // Determine how many questions we can generate with good variety
    // Aim for each letter to appear with a DIFFERENT question type each time
    const numLetters = lettersByMastery.length;
    const numTypes = questionTypes.length;

    // Limit questions to avoid too much repetition
    // If few letters, reduce total questions
    const maxQuestionsWithVariety = Math.min(count, numLetters * 2); // Each letter max 2 appearances
    const actualCount = Math.max(10, maxQuestionsWithVariety); // At least 10 questions

    let lastUsedLetter = null;

    for (let i = 0; i < actualCount; i++) {
        // Find letters that haven't been used with all question types yet
        let availableLetters = lettersByMastery.filter(l =>
            letterTypeUsage[l.letter].size < numTypes &&
            l.letter !== lastUsedLetter
        );

        // If all letters have been used with all types, reset and allow repeats
        if (availableLetters.length === 0) {
            availableLetters = lettersByMastery.filter(l => l.letter !== lastUsedLetter);
        }
        if (availableLetters.length === 0) {
            availableLetters = [...lettersByMastery];
        }

        // Weighted selection: 70% chance to pick from lower mastery half
        const cutoff = Math.ceil(availableLetters.length / 2);
        const useLowerMastery = Math.random() < 0.7;
        const selectionPool = useLowerMastery && cutoff > 0
            ? availableLetters.slice(0, cutoff)
            : availableLetters;

        const letterData = selectionPool[Math.floor(Math.random() * selectionPool.length)];
        lastUsedLetter = letterData.letter;

        // Find a question type this letter hasn't been used with yet
        const usedTypes = letterTypeUsage[letterData.letter];
        let availableTypes = questionTypes.filter(t => !usedTypes.has(t));

        // If all types used, allow any type
        if (availableTypes.length === 0) {
            availableTypes = [...questionTypes];
        }

        // Pick a random available type
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        usedTypes.add(type);

        let question;

        switch (type) {
            case 'match-case':
                question = generateMatchCaseQuestion(letterData);
                break;
            case 'letter-sound':
                question = generateLetterSoundQuestion(letterData);
                break;
            case 'identify-case':
                question = generateIdentifyCaseQuestion(letterData);
                break;
            case 'say-letter':
                question = generateSayLetterQuestion(letterData);
                break;
            case 'alphabet-order':
                question = generateAlphabetOrderQuestion(letterData);
                break;
            case 'word-picture':
                question = generateWordPictureQuestion(letterData);
                break;
        }

        questions.push(question);
    }

    return questions;
}

function generateMatchCaseQuestion(letterData) {
    // 70% chance to show lowercase (so user finds uppercase)
    // This helps kids learn lowercase by seeing it prominently and matching to known uppercase
    const showUppercase = Math.random() < 0.3;
    const shownLetter = showUppercase ? letterData.letter : letterData.lowercase;
    const correctAnswer = showUppercase ? letterData.lowercase : letterData.letter;

    // Generate wrong options (same case as correct answer)
    const wrongOptions = alphabet
        .filter(l => l.letter !== letterData.letter)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(l => showUppercase ? l.lowercase : l.letter);

    // Combine and shuffle options
    const options = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctAnswer);

    return {
        type: 'match-case',
        questionType: 'abc',
        letter: shownLetter,
        letterUpper: letterData.letter,
        phonetic: letterData.phonetic,
        isUppercase: showUppercase,
        options: options,
        correct: correctIndex,
        category: 'abc',
        word: letterData.letter, // For mastery tracking
        instruction: showUppercase ? 'מצא את האות הקטנה' : 'מצא את האות הגדולה',
        instructionEn: showUppercase ? 'Find the lowercase letter' : 'Find the uppercase letter'
    };
}

function generateLetterSoundQuestion(letterData) {
    // Show both cases in options (Aa format) for learning
    const correctOption = `${letterData.letter}${letterData.lowercase}`;

    // Generate wrong options with both cases
    const wrongOptions = alphabet
        .filter(l => l.letter !== letterData.letter)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(l => `${l.letter}${l.lowercase}`);

    // Combine and shuffle options
    const options = [correctOption, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctOption);

    return {
        type: 'letter-sound',
        questionType: 'abc',
        letter: letterData.letter,
        letterLower: letterData.lowercase,
        letterBoth: `${letterData.letter}${letterData.lowercase}`,
        letterUpper: letterData.letter,
        phonetic: letterData.phonetic,
        word: letterData.letter, // For mastery tracking
        category: 'abc',
        options: options,
        correct: correctIndex,
        instruction: 'הקשב ובחר את האות הנכונה',
        instructionEn: 'Listen and choose the correct letter'
    };
}

function generateIdentifyCaseQuestion(letterData) {
    // 70% chance to show lowercase
    const showUppercase = Math.random() < 0.3;
    const shownLetter = showUppercase ? letterData.letter : letterData.lowercase;

    // Options are always the same: uppercase or lowercase
    const options = ['אות גדולה (Uppercase)', 'אות קטנה (Lowercase)'];
    const correctIndex = showUppercase ? 0 : 1;

    return {
        type: 'identify-case',
        questionType: 'abc',
        letter: shownLetter,
        letterUpper: letterData.letter,
        phonetic: letterData.phonetic,
        isUppercase: showUppercase,
        options: options,
        correct: correctIndex,
        category: 'abc',
        word: letterData.letter, // For mastery tracking
        instruction: 'האם זו אות גדולה או קטנה?',
        instructionEn: 'Is this uppercase or lowercase?'
    };
}

function generateSayLetterQuestion(letterData) {
    // Show both cases (Aa format) for learning
    return {
        type: 'say-letter',
        questionType: 'abc',
        letter: `${letterData.letter}${letterData.lowercase}`, // Show both: Aa
        letterUpper: letterData.letter,
        letterLower: letterData.lowercase,
        letterBoth: `${letterData.letter}${letterData.lowercase}`,
        phonetic: letterData.phonetic,
        category: 'abc',
        word: letterData.letter, // For mastery tracking
        instruction: 'אמור את שם האות',
        instructionEn: 'Say the letter name'
    };
}

function generateAlphabetOrderQuestion(letterData) {
    const letterIndex = alphabet.findIndex(l => l.letter === letterData.letter);

    // Randomly choose "what comes after" or "what comes before"
    // But avoid edge cases (A has nothing before, Z has nothing after)
    let askAfter = Math.random() < 0.5;

    // Handle edge cases
    if (letterIndex === 0) askAfter = true;  // A - can only ask what comes after
    if (letterIndex === 25) askAfter = false; // Z - can only ask what comes before

    let correctLetter;
    let instruction;
    let instructionEn;
    const letterBoth = `${letterData.letter}${letterData.lowercase}`;

    if (askAfter) {
        correctLetter = alphabet[letterIndex + 1];
        instruction = `מה בא אחרי "${letterBoth}"?`;
        instructionEn = `What comes after "${letterBoth}"?`;
    } else {
        correctLetter = alphabet[letterIndex - 1];
        instruction = `מה בא לפני "${letterBoth}"?`;
        instructionEn = `What comes before "${letterBoth}"?`;
    }

    // Show both cases in options (Aa format)
    const correctOption = `${correctLetter.letter}${correctLetter.lowercase}`;

    // Generate wrong options (nearby letters make it harder)
    const possibleWrong = [];

    // Add letters that are close but not the correct one
    for (let i = Math.max(0, letterIndex - 3); i <= Math.min(25, letterIndex + 3); i++) {
        if (i !== letterIndex && alphabet[i] !== correctLetter) {
            possibleWrong.push(alphabet[i]);
        }
    }

    // Shuffle and take 3, show both cases
    const wrongOptions = possibleWrong
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(l => `${l.letter}${l.lowercase}`);

    // If we don't have enough nearby letters, add random ones
    while (wrongOptions.length < 3) {
        const randomLetter = alphabet[Math.floor(Math.random() * 26)];
        const option = `${randomLetter.letter}${randomLetter.lowercase}`;
        if (option !== correctOption && !wrongOptions.includes(option)) {
            wrongOptions.push(option);
        }
    }

    // Combine and shuffle options
    const options = [correctOption, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctOption);

    return {
        type: 'alphabet-order',
        questionType: 'abc',
        letter: letterBoth, // Show both cases: Aa
        letterUpper: letterData.letter,
        letterLower: letterData.lowercase,
        letterBoth: letterBoth,
        phonetic: letterData.phonetic,
        askAfter: askAfter,
        options: options,
        correct: correctIndex,
        category: 'abc',
        word: letterData.letter, // For mastery tracking
        instruction: instruction,
        instructionEn: instructionEn
    };
}

// Word-picture question: Show a word with picture, identify the letter
function generateWordPictureQuestion(letterData) {
    const wordLower = letterData.word.toLowerCase();
    const letterBoth = `${letterData.letter}${letterData.lowercase}`;

    // Get emoji for the word
    const wordEmojis = {
        'Apple': '🍎', 'Ball': '⚽', 'Cat': '🐱', 'Dog': '🐕', 'Elephant': '🐘',
        'Fish': '🐟', 'Giraffe': '🦒', 'House': '🏠', 'Ice cream': '🍦', 'Juice': '🧃',
        'Kite': '🪁', 'Lion': '🦁', 'Moon': '🌙', 'Nose': '👃', 'Orange': '🍊',
        'Pizza': '🍕', 'Queen': '👸', 'Rainbow': '🌈', 'Sun': '☀️', 'Tree': '🌳',
        'Umbrella': '☂️', 'Violin': '🎻', 'Water': '💧', 'X-ray': '🩻', 'Yellow': '💛', 'Zebra': '🦓'
    };

    const emoji = wordEmojis[letterData.word] || '📝';

    // Always ask for starting letter - don't reveal the word in text!
    const instruction = `הקשב ומצא את האות הראשונה`;
    const instructionEn = `Listen and find the first letter`;

    // Generate wrong options (show both cases)
    const wrongOptions = alphabet
        .filter(l => l.letter !== letterData.letter)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(l => `${l.letter}${l.lowercase}`);

    const correctOption = letterBoth;

    // Combine and shuffle options
    const options = [correctOption, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctOption);

    return {
        type: 'word-picture',
        questionType: 'abc',
        letter: letterBoth,
        letterUpper: letterData.letter,
        letterLower: letterData.lowercase,
        letterBoth: letterBoth,
        phonetic: letterData.phonetic,
        displayWord: letterData.word,
        displayWordLower: wordLower,
        emoji: emoji,
        options: options,
        correct: correctIndex,
        category: 'abc',
        word: letterData.letter, // For mastery tracking
        instruction: instruction,
        instructionEn: instructionEn
    };
}
