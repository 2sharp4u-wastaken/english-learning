// Story templates for the Story Time game
// For Hebrew-speaking children aged 5-8 learning English
//
// Template structure:
// - id: unique story identifier
// - titleHebrew: Hebrew title shown to the child
// - difficulty: "beginner" or "intermediate"
// - sentences: array of sentence strings with {slotN} placeholders
// - slots: object mapping slot names to { category, fallback }
// - questions: comprehension questions with {slotN} placeholders
//   each question has: question (Hebrew), questionEn (English, spoken aloud),
//   options (English), correctIndex

export const storyTemplates = [
    // ===== BEGINNER STORIES =====
    {
        id: 'animal-friend',
        titleHebrew: 'החבר שלי',
        difficulty: 'beginner',
        sentences: [
            'I have a {slot1}.',
            'I like my {slot1}.',
            'I love my {slot1}!'
        ],
        slots: {
            slot1: { category: 'animals', fallback: 'dog' }
        },
        questions: [
            {
                question: 'מה יש לי?',
                questionEn: 'What do I have?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'animals' }
            },
            {
                question: 'מה אני מרגיש כלפי ה{slot1_he}?',
                questionEn: 'How do I feel about my {slot1}?',
                optionTemplate: ['love', 'sad', 'angry'],
                correctIndex: 0
            }
        ]
    },
    {
        id: 'favorite-food',
        titleHebrew: 'האוכל האהוב שלי',
        difficulty: 'beginner',
        sentences: [
            'I like {slot1}.',
            '{slot1} is yummy!',
            'I eat {slot1} every day.'
        ],
        slots: {
            slot1: { category: 'food', fallback: 'apple' }
        },
        questions: [
            {
                question: 'מה אני אוהב?',
                questionEn: 'What do I like?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'food' }
            },
            {
                question: 'מתי אני אוכל את זה?',
                questionEn: 'When do I eat it?',
                optionTemplate: ['every day', 'never', 'on Monday'],
                correctIndex: 0
            }
        ]
    },
    {
        id: 'my-family',
        titleHebrew: 'המשפחה שלי',
        difficulty: 'beginner',
        sentences: [
            'This is my {slot1}.',
            'My {slot1} is nice.',
            'I love my {slot1}.'
        ],
        slots: {
            slot1: { category: 'family', fallback: 'mom' }
        },
        questions: [
            {
                question: 'מי זה?',
                questionEn: 'Who is this?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'family' }
            },
            {
                question: 'איך הוא/היא?',
                questionEn: 'What is my family like?',
                optionTemplate: ['nice', 'sad', 'angry'],
                correctIndex: 0
            }
        ]
    },
    {
        id: 'favorite-color',
        titleHebrew: 'הצבע האהוב',
        difficulty: 'beginner',
        sentences: [
            'My favorite color is {slot1}.',
            'I also like {slot2}.',
            'I see {slot1} and {slot2} everywhere!'
        ],
        slots: {
            slot1: { category: 'colors', fallback: 'blue' },
            slot2: { category: 'colors', fallback: 'green' }
        },
        questions: [
            {
                question: 'מה הצבע האהוב עליי?',
                questionEn: 'What is my favorite color?',
                optionTemplate: ['{slot1}', '{slot2}', '{wrong1}'],
                correctIndex: 0,
                wrongPool: { category: 'colors' }
            },
            {
                question: 'איזה צבע אני גם אוהב?',
                questionEn: 'Which color do I also like?',
                optionTemplate: ['{slot2}', '{slot1}', '{wrong1}'],
                correctIndex: 0,
                wrongPool: { category: 'colors' }
            }
        ]
    },
    {
        id: 'at-school',
        titleHebrew: 'בבית הספר',
        difficulty: 'beginner',
        sentences: [
            'I go to school.',
            'I have a {slot1}.',
            'I like my {slot1}.'
        ],
        slots: {
            slot1: { category: 'school', fallback: 'book' }
        },
        questions: [
            {
                question: 'לאן אני הולך?',
                questionEn: 'Where do I go?',
                optionTemplate: ['school', 'home', 'park'],
                correctIndex: 0
            },
            {
                question: 'מה יש לי?',
                questionEn: 'What do I have?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'school' }
            }
        ]
    },
    {
        id: 'i-like-animals',
        titleHebrew: 'אני אוהב חיות',
        difficulty: 'beginner',
        sentences: [
            'I like the {slot1}.',
            'I also like the {slot2}.',
            'Animals are fun!'
        ],
        slots: {
            slot1: { category: 'animals', fallback: 'cat' },
            slot2: { category: 'animals', fallback: 'dog' }
        },
        questions: [
            {
                question: 'איזו חיה אני אוהב?',
                questionEn: 'Which animal do I like?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'animals' }
            },
            {
                question: 'איזו חיה אני גם אוהב?',
                questionEn: 'Which animal do I also like?',
                optionTemplate: ['{slot2}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'animals' }
            }
        ]
    },
    // ===== INTERMEDIATE STORIES =====
    {
        id: 'morning-routine',
        titleHebrew: 'הבוקר שלי',
        difficulty: 'intermediate',
        sentences: [
            'Good morning!',
            'I wake up and eat {slot1}.',
            'Then I go to school.',
            'I see my {slot2} at school.'
        ],
        slots: {
            slot1: { category: 'food', fallback: 'bread' },
            slot2: { category: 'family', fallback: 'friend' }
        },
        questions: [
            {
                question: 'מה אני אוכל בבוקר?',
                questionEn: 'What do I eat in the morning?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'food' }
            },
            {
                question: 'את מי אני רואה בבית הספר?',
                questionEn: 'Who do I see at school?',
                optionTemplate: ['{slot2}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'family' }
            }
        ]
    },
    {
        id: 'pet-day',
        titleHebrew: 'יום עם חיית המחמד',
        difficulty: 'intermediate',
        sentences: [
            'My {slot1} is happy today.',
            'We play in the park.',
            'The {slot1} runs fast!',
            'I give my {slot1} {slot2}.'
        ],
        slots: {
            slot1: { category: 'animals', fallback: 'dog' },
            slot2: { category: 'food', fallback: 'water' }
        },
        questions: [
            {
                question: 'איפה אנחנו משחקים?',
                questionEn: 'Where do we play?',
                optionTemplate: ['park', 'school', 'home'],
                correctIndex: 0
            },
            {
                question: 'מה אני נותן לחיית המחמד?',
                questionEn: 'What do I give my pet?',
                optionTemplate: ['{slot2}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'food' }
            },
            {
                question: 'מי רץ מהר?',
                questionEn: 'Who runs fast?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'animals' }
            }
        ]
    },
    {
        id: 'counting-things',
        titleHebrew: 'סופרים דברים',
        difficulty: 'intermediate',
        sentences: [
            'I see {slot1} {slot2}.',
            'I see {slot3} {slot4}.',
            'How many do I see?',
            'I see a lot!'
        ],
        slots: {
            slot1: { category: 'numbers', fallback: 'two' },
            slot2: { category: 'animals', fallback: 'cats' },
            slot3: { category: 'numbers', fallback: 'three' },
            slot4: { category: 'animals', fallback: 'dogs' }
        },
        questions: [
            {
                question: 'כמה {slot2_he} אני רואה?',
                questionEn: 'How many {slot2} do I see?',
                optionTemplate: ['{slot1}', '{slot3}', '{wrong1}'],
                correctIndex: 0,
                wrongPool: { category: 'numbers' }
            },
            {
                question: 'כמה {slot4_he} אני רואה?',
                questionEn: 'How many {slot4} do I see?',
                optionTemplate: ['{slot3}', '{slot1}', '{wrong1}'],
                correctIndex: 0,
                wrongPool: { category: 'numbers' }
            }
        ]
    },
    {
        id: 'rainy-day',
        titleHebrew: 'יום גשום',
        difficulty: 'intermediate',
        sentences: [
            'Today it is rainy.',
            'I stay at home.',
            'I play with my {slot1}.',
            'Then I eat {slot2}.',
            'Rainy days are fun!'
        ],
        slots: {
            slot1: { category: 'family', fallback: 'sister' },
            slot2: { category: 'food', fallback: 'soup' }
        },
        questions: [
            {
                question: 'איך מזג האוויר היום?',
                questionEn: 'How is the weather today?',
                optionTemplate: ['rainy', 'sunny', 'cold'],
                correctIndex: 0
            },
            {
                question: 'עם מי אני משחק?',
                questionEn: 'Who do I play with?',
                optionTemplate: ['{slot1}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'family' }
            },
            {
                question: 'מה אני אוכל?',
                questionEn: 'What do I eat?',
                optionTemplate: ['{slot2}', '{wrong1}', '{wrong2}'],
                correctIndex: 0,
                wrongPool: { category: 'food' }
            }
        ]
    }
];

/**
 * Build a playable story from a template by filling slots with learned words.
 * @param {Object} template - Story template from storyTemplates
 * @param {Array} learnedWords - Array of word objects { word, translation, category, image }
 * @param {Array} allWords - Full vocabulary bank for distractors
 * @returns {Object|null} Filled story { title, sentences[], highlights[], questions[] } or null if not enough words
 */
export function buildStoryFromTemplate(template, learnedWords, allWords) {
    const filledSlots = {};
    const usedWords = new Set();

    // Fill each slot from learned words matching the required category
    for (const [slotName, slotDef] of Object.entries(template.slots)) {
        const candidates = learnedWords.filter(
            w => w.category === slotDef.category && !usedWords.has(w.word.toLowerCase())
        );
        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            filledSlots[slotName] = pick;
            usedWords.add(pick.word.toLowerCase());
        } else {
            // Use fallback — find it in allWords or create minimal object
            const fallbackWord = allWords.find(
                w => w.word.toLowerCase() === slotDef.fallback.toLowerCase()
            ) || { word: slotDef.fallback, translation: slotDef.fallback, category: slotDef.category };
            filledSlots[slotName] = fallbackWord;
        }
    }

    // Build filled sentences and track which words are highlights (tappable)
    const highlights = []; // { word, translation, sentenceIdx, startIdx }
    const filledSentences = template.sentences.map((sentence, sIdx) => {
        let filled = sentence;
        for (const [slotName, wordObj] of Object.entries(filledSlots)) {
            const placeholder = `{${slotName}}`;
            if (filled.includes(placeholder)) {
                const idx = filled.indexOf(placeholder);
                highlights.push({
                    word: wordObj.word,
                    translation: wordObj.translation,
                    sentenceIndex: sIdx
                });
                filled = filled.replace(placeholder, wordObj.word);
            }
        }
        return filled;
    });

    // Build comprehension questions
    const filledQuestions = template.questions.map(q => {
        let questionText = q.question;
        // English question (spoken aloud) — only has {slotN} placeholders.
        let questionEnText = q.questionEn || '';
        // Replace slot references in question text
        for (const [slotName, wordObj] of Object.entries(filledSlots)) {
            questionText = questionText.replace(`{${slotName}}`, wordObj.word);
            questionText = questionText.replace(`{${slotName}_he}`, wordObj.translation);
            questionEnText = questionEnText.split(`{${slotName}}`).join(wordObj.word);
        }

        // Build options
        const options = q.optionTemplate.map(opt => {
            // Replace slot references
            for (const [slotName, wordObj] of Object.entries(filledSlots)) {
                opt = opt.replace(`{${slotName}}`, wordObj.word);
            }
            // Replace wrong-answer placeholders
            if (opt.includes('{wrong')) {
                const pool = q.wrongPool
                    ? allWords.filter(w => w.category === q.wrongPool.category &&
                        !Object.values(filledSlots).some(fs => fs.word.toLowerCase() === w.word.toLowerCase()))
                    : allWords;
                const pick = pool[Math.floor(Math.random() * pool.length)];
                opt = pick ? pick.word : 'other';
            }
            return opt;
        });

        // Ensure no duplicate options
        const seen = new Set();
        const uniqueOptions = options.map(o => {
            if (seen.has(o.toLowerCase())) {
                const altPool = (q.wrongPool
                    ? allWords.filter(w => w.category === q.wrongPool.category)
                    : allWords
                ).filter(w => !seen.has(w.word.toLowerCase()));
                const alt = altPool[Math.floor(Math.random() * altPool.length)];
                const replacement = alt ? alt.word : o + '?';
                seen.add(replacement.toLowerCase());
                return replacement;
            }
            seen.add(o.toLowerCase());
            return o;
        });

        return {
            question: questionText,
            questionEn: questionEnText,
            options: uniqueOptions,
            correctIndex: q.correctIndex
        };
    });

    return {
        id: template.id,
        title: template.titleHebrew,
        sentences: filledSentences,
        highlights: [...new Map(highlights.map(h => [h.word.toLowerCase(), h])).values()],
        questions: filledQuestions
    };
}

/**
 * Get a set of stories for the current session, filled with learned words.
 * @param {Array} learnedWords - Learned word objects
 * @param {Array} allWords - Full vocabulary bank
 * @param {number} count - Number of stories to return (default 3)
 * @returns {Array} Array of filled story objects
 */
export function getStoriesForSession(learnedWords, allWords, count = 3) {
    // Shuffle templates
    const shuffled = [...storyTemplates].sort(() => Math.random() - 0.5);
    const stories = [];

    for (const template of shuffled) {
        if (stories.length >= count) break;
        const story = buildStoryFromTemplate(template, learnedWords, allWords);
        if (story) stories.push(story);
    }

    return stories;
}
