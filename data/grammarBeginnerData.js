// Grammar Beginner Data - Audio-Visual Grammar for Non-Readers
// Teaches basic English grammar (am/is/are) through pictures and audio only

// Subject images/emojis with their pronouns
export const subjects = {
    'I': {
        image: '👦☝️',
        hebrew: 'אני',
        verb: 'am',
        audioText: 'I'
    },
    'you': {
        image: '👉😊',
        hebrew: 'אתה/את',
        verb: 'are',
        audioText: 'you'
    },
    'he': {
        image: '👦',
        hebrew: 'הוא',
        verb: 'is',
        audioText: 'he'
    },
    'she': {
        image: '👧',
        hebrew: 'היא',
        verb: 'is',
        audioText: 'she'
    },
    'it': {
        image: '🐕',
        hebrew: 'זה',
        verb: 'is',
        audioText: 'it'
    },
    'we': {
        image: '👨‍👩‍👧',
        hebrew: 'אנחנו',
        verb: 'are',
        audioText: 'we'
    },
    'they': {
        image: '👫👫',
        hebrew: 'הם',
        verb: 'are',
        audioText: 'they'
    }
};

// Simple adjectives/states that kids know (with pictures)
export const predicates = [
    { word: 'happy', image: '😊', hebrew: 'שמח' },
    { word: 'sad', image: '😢', hebrew: 'עצוב' },
    { word: 'hungry', image: '🍽️', hebrew: 'רעב' },
    { word: 'tired', image: '😴', hebrew: 'עייף' },
    { word: 'big', image: '🐘', hebrew: 'גדול' },
    { word: 'small', image: '🐁', hebrew: 'קטן' },
    { word: 'fast', image: '🏃', hebrew: 'מהיר' },
    { word: 'playing', image: '⚽', hebrew: 'משחק' },
    { word: 'eating', image: '🍎', hebrew: 'אוכל' },
    { word: 'sleeping', image: '😴', hebrew: 'ישן' },
    { word: 'at home', image: '🏠', hebrew: 'בבית' },
    { word: 'at school', image: '🏫', hebrew: 'בבית ספר' }
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
    // Get 2 wrong subject options
    const wrongSubjects = getWrongSubjects(subjectKey, 2);

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
        predicate: predicate
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
        fullSentence: `${subjectKey} ${correctVerb} ${predicate.word}`
    };
}

// Type 3: "What Sounds Right?" - Pick correct vs incorrect sentence
function createSoundsRightQuestion(subjectKey, subject, predicate, correctSentence) {
    // Create a wrong sentence with incorrect verb
    const wrongVerbs = ['am', 'is', 'are'].filter(v => v !== subject.verb);
    const wrongVerb = wrongVerbs[Math.floor(Math.random() * wrongVerbs.length)];
    const wrongSentence = `${subjectKey} ${wrongVerb} ${predicate.word}`;

    const options = [
        { sentence: correctSentence, audio: correctSentence, isCorrect: true },
        { sentence: wrongSentence, audio: wrongSentence, isCorrect: false }
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
        correctAnswer: correctSentence
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

    // Pick 2 wrong options - prefer different verbs for learning
    let wrongOptions = [];
    if (differentVerbSubjects.length >= 2) {
        shuffleArray(differentVerbSubjects);
        wrongOptions = differentVerbSubjects.slice(0, 2);
    } else {
        const allWrong = [...differentVerbSubjects, ...sameVerbSubjects];
        shuffleArray(allWrong);
        wrongOptions = allWrong.slice(0, 2);
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
        correctAnswer: subjectKey
    };
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
