// Grammar Beginner Data - Audio-Visual Grammar for Non-Readers
// Teaches basic English grammar (am/is/are) through pictures and audio only

// Subject images/emojis with their pronouns
export const subjects = {
    'I': {
        image: '👦☝️',
        hebrew: 'אני',
        verb: 'am',
        audioText: 'I',
        gender: 'masculine'
    },
    'you': {
        image: '👉😊',
        hebrew: 'אתה/את',
        verb: 'are',
        audioText: 'you',
        gender: 'masculine'
    },
    'he': {
        image: '👦',
        hebrew: 'הוא',
        verb: 'is',
        audioText: 'he',
        gender: 'masculine'
    },
    'she': {
        image: '👧',
        hebrew: 'היא',
        verb: 'is',
        audioText: 'she',
        gender: 'feminine'
    },
    'it': {
        image: '🧸',
        hebrew: 'זה',
        verb: 'is',
        audioText: 'it',
        gender: 'masculine'
    },
    'we': {
        image: '👨‍👩‍👧',
        hebrew: 'אנחנו',
        verb: 'are',
        audioText: 'we',
        gender: 'plural'
    },
    'they': {
        image: '👫👫',
        hebrew: 'הם',
        verb: 'are',
        audioText: 'they',
        gender: 'plural'
    }
};

// Simple adjectives/states that kids know (with pictures)
// hebrew = masculine form; hebrewFem = feminine; hebrewPlural = plural
export const predicates = [
    // Feelings
    { word: 'happy',      image: '😊',  hebrew: 'שמח',        hebrewFem: 'שמחה',       hebrewPlural: 'שמחים' },
    { word: 'sad',        image: '😢',  hebrew: 'עצוב',       hebrewFem: 'עצובה',      hebrewPlural: 'עצובים' },
    { word: 'angry',      image: '😠',  hebrew: 'כועס',       hebrewFem: 'כועסת',      hebrewPlural: 'כועסים' },
    { word: 'excited',    image: '🤩',  hebrew: 'מתרגש',      hebrewFem: 'מתרגשת',     hebrewPlural: 'מתרגשים' },
    { word: 'scared',     image: '😨',  hebrew: 'מפחד',       hebrewFem: 'מפחדת',      hebrewPlural: 'מפחדים' },
    { word: 'bored',      image: '😑',  hebrew: 'משועמם',     hebrewFem: 'משועממת',    hebrewPlural: 'משועממים' },
    { word: 'surprised',  image: '😲',  hebrew: 'מופתע',      hebrewFem: 'מופתעת',     hebrewPlural: 'מופתעים' },
    { word: 'funny',      image: '🤣',  hebrew: 'מצחיק',      hebrewFem: 'מצחיקה',     hebrewPlural: 'מצחיקים' },
    // Body states
    { word: 'hungry',     image: '🍽️', hebrew: 'רעב',        hebrewFem: 'רעבה',       hebrewPlural: 'רעבים' },
    { word: 'thirsty',    image: '🥤',  hebrew: 'צמא',        hebrewFem: 'צמאה',       hebrewPlural: 'צמאים' },
    { word: 'tired',      image: '😴',  hebrew: 'עייף',       hebrewFem: 'עייפה',      hebrewPlural: 'עייפים' },
    { word: 'sick',       image: '🤒',  hebrew: 'חולה',       hebrewFem: 'חולה',       hebrewPlural: 'חולים' },
    { word: 'cold',       image: '🥶',  hebrew: 'קר',         hebrewFem: 'קרה',        hebrewPlural: 'קרים' },
    { word: 'hot',        image: '🥵',  hebrew: 'חם',         hebrewFem: 'חמה',        hebrewPlural: 'חמים' },
    // Sizes & qualities
    { word: 'big',        image: '🐋',  hebrew: 'גדול',       hebrewFem: 'גדולה',      hebrewPlural: 'גדולים' },
    { word: 'small',      image: '🐜',  hebrew: 'קטן',        hebrewFem: 'קטנה',       hebrewPlural: 'קטנים' },
    { word: 'tall',       image: '🦒',  hebrew: 'גבוה',       hebrewFem: 'גבוהה',      hebrewPlural: 'גבוהים' },
    { word: 'fast',       image: '⚡',  hebrew: 'מהיר',       hebrewFem: 'מהירה',      hebrewPlural: 'מהירים' },
    { word: 'strong',     image: '💪',  hebrew: 'חזק',        hebrewFem: 'חזקה',       hebrewPlural: 'חזקים' },
    { word: 'smart',      image: '🧠',  hebrew: 'חכם',        hebrewFem: 'חכמה',       hebrewPlural: 'חכמים' },
    { word: 'cute',       image: '🥰',  hebrew: 'חמוד',       hebrewFem: 'חמודה',      hebrewPlural: 'חמודים' },
    { word: 'clean',      image: '🧼',  hebrew: 'נקי',        hebrewFem: 'נקייה',      hebrewPlural: 'נקיים' },
    { word: 'dirty',      image: '🤧',  hebrew: 'מלוכלך',     hebrewFem: 'מלוכלכת',    hebrewPlural: 'מלוכלכים' },
    // Actions
    { word: 'playing',    image: '⚽',  hebrew: 'משחק',       hebrewFem: 'משחקת',      hebrewPlural: 'משחקים' },
    { word: 'eating',     image: '🍎',  hebrew: 'אוכל',       hebrewFem: 'אוכלת',      hebrewPlural: 'אוכלים' },
    { word: 'sleeping',   image: '😴',  hebrew: 'ישן',        hebrewFem: 'ישנה',       hebrewPlural: 'ישנים' },
    { word: 'running',    image: '🏃',  hebrew: 'רץ',         hebrewFem: 'רצה',        hebrewPlural: 'רצים' },
    { word: 'jumping',    image: '🦘',  hebrew: 'קופץ',       hebrewFem: 'קופצת',      hebrewPlural: 'קופצים' },
    { word: 'swimming',   image: '🏊',  hebrew: 'שוחה',       hebrewFem: 'שוחה',       hebrewPlural: 'שוחים' },
    { word: 'reading',    image: '📚',  hebrew: 'קורא',       hebrewFem: 'קוראת',      hebrewPlural: 'קוראים' },
    { word: 'singing',    image: '🎵',  hebrew: 'שר',         hebrewFem: 'שרה',        hebrewPlural: 'שרים' },
    { word: 'dancing',    image: '💃',  hebrew: 'רוקד',       hebrewFem: 'רוקדת',      hebrewPlural: 'רוקדים' },
    { word: 'laughing',   image: '😂',  hebrew: 'צוחק',       hebrewFem: 'צוחקת',      hebrewPlural: 'צוחקים' },
    { word: 'cooking',    image: '👨‍🍳', hebrew: 'מבשל',       hebrewFem: 'מבשלת',      hebrewPlural: 'מבשלים' },
    { word: 'drawing',    image: '🎨',  hebrew: 'מצייר',      hebrewFem: 'מציירת',     hebrewPlural: 'מציירים' },
    // Locations
    { word: 'home',       image: '🏠',  hebrew: 'בבית',       hebrewFem: 'בבית',       hebrewPlural: 'בבית' },
    { word: 'in school',  image: '🏫',  hebrew: 'בבית ספר',   hebrewFem: 'בבית ספר',   hebrewPlural: 'בבית ספר' },
    { word: 'outside',    image: '🌳',  hebrew: 'בחוץ',       hebrewFem: 'בחוץ',       hebrewPlural: 'בחוץ' },
    { word: 'in bed',     image: '🛏️',  hebrew: 'במיטה',      hebrewFem: 'במיטה',      hebrewPlural: 'במיטה' },
];

// Question types for the beginner grammar game
export const questionTypes = {
    WHO_SAYS_IT: 'who-says-it',           // Hear sentence, pick the subject picture
    COMPLETE_SOUND: 'complete-sound',      // See subject, pick am/is/are by audio
    SOUNDS_RIGHT: 'sounds-right',          // Pick correct vs incorrect sentence
    MATCH_PICTURE: 'match-picture'         // Hear sentence, match to picture
};

// Generate questions for the beginner grammar game
export function generateGrammarBeginnerQuestions(count = 10) {
    const questions = [];
    const subjectKeys = Object.keys(subjects);
    const types = Object.values(questionTypes);

    // Track used combinations to avoid repetition
    const usedCombinations = new Set();

    let attempts = 0;
    const maxAttempts = count * 10;

    while (questions.length < count && attempts < maxAttempts) {
        attempts++;

        // Pick random type, subject, and predicate
        const type = types[Math.floor(Math.random() * types.length)];
        const subjectKey = subjectKeys[Math.floor(Math.random() * subjectKeys.length)];
        const predicate = predicates[Math.floor(Math.random() * predicates.length)];

        const combinationKey = `${type}-${subjectKey}-${predicate.word}`;
        if (usedCombinations.has(combinationKey)) continue;
        usedCombinations.add(combinationKey);

        const subject = subjects[subjectKey];
        const sentence = `${subjectKey} ${subject.verb} ${predicate.word}`;

        let question;

        switch (type) {
            case questionTypes.WHO_SAYS_IT:
                question = createWhoSaysItQuestion(subjectKey, subject, predicate, sentence);
                break;
            case questionTypes.COMPLETE_SOUND:
                question = createCompleteSoundQuestion(subjectKey, subject, predicate);
                break;
            case questionTypes.SOUNDS_RIGHT:
                question = createSoundsRightQuestion(subjectKey, subject, predicate, sentence);
                break;
            case questionTypes.MATCH_PICTURE:
                question = createMatchPictureQuestion(subjectKey, subject, predicate, sentence);
                break;
        }

        if (question) {
            questions.push(question);
        }
    }

    // Shuffle questions
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return questions;
}

// Type 1: "Who Says It?" - Hear sentence, pick the subject picture
function createWhoSaysItQuestion(subjectKey, subject, predicate, sentence) {
    // Get 3 wrong subject options → 4 total
    const wrongSubjects = getWrongSubjects(subjectKey, 3);

    const options = [
        { key: subjectKey, image: subject.image, hebrew: subject.hebrew, isCorrect: true },
        ...wrongSubjects.map(ws => ({
            key: ws,
            image: subjects[ws].image,
            hebrew: subjects[ws].hebrew,
            isCorrect: false
        }))
    ];

    // Shuffle options
    shuffleArray(options);

    return {
        type: questionTypes.WHO_SAYS_IT,
        instruction: 'מי אמר את זה?',
        instructionAudio: 'Who said this?',
        sentence: sentence,
        sentenceAudio: sentence,
        options: options,
        correctAnswer: subjectKey,
        predicate: predicate,
        hebrewSentence: `${subject.hebrew} ${getPredicateHebrew(predicate, subject)}`
    };
}

// Type 2: "Complete the Sound" - See subject picture, pick am/is/are
function createCompleteSoundQuestion(subjectKey, subject, predicate) {
    const verbs = ['am', 'is', 'are'];
    const correctVerb = subject.verb;

    const options = verbs.map(verb => ({
        verb: verb,
        audio: verb,
        isCorrect: verb === correctVerb
    }));

    return {
        type: questionTypes.COMPLETE_SOUND,
        instruction: 'השלם את המשפט',
        instructionAudio: 'Complete the sentence',
        subjectKey: subjectKey,
        subjectImage: subject.image,
        subjectHebrew: subject.hebrew,
        subjectAudio: subjectKey,
        predicate: predicate,
        options: options,
        correctAnswer: correctVerb,
        fullSentence: `${subjectKey} ${correctVerb} ${predicate.word}`,
        hebrewSentence: `${subject.hebrew} ${getPredicateHebrew(predicate, subject)}`
    };
}

// Type 3: "What Sounds Right?" - Pick correct vs incorrect sentence
function createSoundsRightQuestion(subjectKey, subject, predicate, correctSentence) {
    // Both wrong verb forms as distractors → 3 options total
    const wrongVerbs = ['am', 'is', 'are'].filter(v => v !== subject.verb);

    const options = [
        { sentence: correctSentence, audio: correctSentence, isCorrect: true },
        ...wrongVerbs.map(v => ({
            sentence: `${subjectKey} ${v} ${predicate.word}`,
            audio: `${subjectKey} ${v} ${predicate.word}`,
            isCorrect: false
        }))
    ];

    // Shuffle options
    shuffleArray(options);

    return {
        type: questionTypes.SOUNDS_RIGHT,
        instruction: 'מה נשמע נכון?',
        instructionAudio: 'What sounds right?',
        subjectImage: subject.image,
        subjectHebrew: subject.hebrew,
        predicateImage: predicate.image,
        predicateHebrew: predicate.hebrew,
        options: options,
        correctAnswer: correctSentence,
        sentenceAudio: correctSentence,
        hebrewSentence: `${subject.hebrew} ${getPredicateHebrew(predicate, subject)}`
    };
}

// Type 4: "Match Picture to Sound" - Hear sentence, match to correct subject picture
function createMatchPictureQuestion(subjectKey, subject, predicate, sentence) {
    // Get subjects that use different verbs for variety
    const sameVerbSubjects = Object.entries(subjects)
        .filter(([key, s]) => s.verb === subject.verb && key !== subjectKey)
        .map(([key]) => key);

    const differentVerbSubjects = Object.entries(subjects)
        .filter(([key, s]) => s.verb !== subject.verb)
        .map(([key]) => key);

    // Pick 3 wrong options → 4 total; prefer different verbs for learning
    let wrongOptions = [];
    if (differentVerbSubjects.length >= 3) {
        shuffleArray(differentVerbSubjects);
        wrongOptions = differentVerbSubjects.slice(0, 3);
    } else {
        const allWrong = [...differentVerbSubjects, ...sameVerbSubjects];
        shuffleArray(allWrong);
        wrongOptions = allWrong.slice(0, 3);
    }

    const options = [
        {
            key: subjectKey,
            image: subject.image,
            hebrew: subject.hebrew,
            predicateImage: predicate.image,
            isCorrect: true
        },
        ...wrongOptions.map(ws => ({
            key: ws,
            image: subjects[ws].image,
            hebrew: subjects[ws].hebrew,
            predicateImage: predicate.image,
            isCorrect: false
        }))
    ];

    shuffleArray(options);

    return {
        type: questionTypes.MATCH_PICTURE,
        instruction: 'התאם את התמונה למשפט',
        instructionAudio: 'Match the picture to the sentence',
        sentence: sentence,
        sentenceAudio: sentence,
        predicate: predicate,
        options: options,
        correctAnswer: subjectKey,
        hebrewSentence: `${subject.hebrew} ${getPredicateHebrew(predicate, subject)}`
    };
}

// Helper: Return gender-correct Hebrew form of a predicate for a given subject
function getPredicateHebrew(predicate, subject) {
    if (subject.gender === 'feminine') return predicate.hebrewFem || predicate.hebrew;
    if (subject.gender === 'plural')   return predicate.hebrewPlural || predicate.hebrew;
    return predicate.hebrew;
}

// Helper: Get wrong subject options
function getWrongSubjects(correctKey, count) {
    const allKeys = Object.keys(subjects).filter(k => k !== correctKey);
    shuffleArray(allKeys);
    return allKeys.slice(0, count);
}

// Helper: Shuffle array in place
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
