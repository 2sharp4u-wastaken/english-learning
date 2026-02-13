// Grammar questions for Hebrew-speaking children aged 6-9
// Each question focuses on basic English grammar concepts
// Questions are tagged with categories for filtering

export const grammarCategories = {
    'all': { name: 'הכל', icon: '📚' },
    'verb-to-be': { name: 'I am / She is', icon: '🔵' },
    'verb-to-be-negative': { name: 'I am not', icon: '🚫' },
    'verb-to-be-question': { name: 'Is she...?', icon: '❓' },
    'verb-to-be-past': { name: 'was / were', icon: '⏮️' },
    'present-simple': { name: 'Present Simple', icon: '▶️' },
    'present-continuous': { name: 'Present Continuous', icon: '🔄' },
    'past-simple': { name: 'Past Simple', icon: '⏪' },
    'plurals': { name: 'Plurals', icon: '👥' },
    'prepositions': { name: 'Prepositions', icon: '📍' },
    'possessives': { name: 'Possessives', icon: '👤' },
    'pronouns': { name: 'Pronouns', icon: '👆' },
    'question-words': { name: 'Question Words', icon: '🤔' },
    'comparatives': { name: 'Comparatives', icon: '📊' },
    'articles': { name: 'a / an / the', icon: '📝' },
    'modals': { name: 'can / can\'t', icon: '💪' },
    'future': { name: 'Future (will)', icon: '🔮' }
};

export const grammarQuestions = [
    // =====================================================
    // VERB "TO BE": I am / you are / he, she, it is / we, they are
    // =====================================================
    { sentence: "I ___ happy today", options: ["am", "is", "are", "be"], correct: 0, category: "verb-to-be", explanation: "Use 'am' with 'I'", hebrewExplanation: "משתמשים ב'am' עם 'I'", difficulty: "beginner" },
    { sentence: "She ___ my friend", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be", explanation: "Use 'is' with 'she'", hebrewExplanation: "משתמשים ב'is' עם 'she'", difficulty: "beginner" },
    { sentence: "They ___ at the park", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be", explanation: "Use 'are' with 'they'", hebrewExplanation: "משתמשים ב'are' עם 'they'", difficulty: "beginner" },
    { sentence: "He ___ a good student", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be", explanation: "Use 'is' with 'he'", hebrewExplanation: "משתמשים ב'is' עם 'he'", difficulty: "beginner" },
    { sentence: "We ___ playing a game", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be", explanation: "Use 'are' with 'we'", hebrewExplanation: "משתמשים ב'are' עם 'we'", difficulty: "beginner" },
    { sentence: "It ___ a big dog", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be", explanation: "Use 'is' with 'it'", hebrewExplanation: "משתמשים ב'is' עם 'it'", difficulty: "beginner" },
    { sentence: "You ___ very kind", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be", explanation: "Use 'are' with 'you'", hebrewExplanation: "משתמשים ב'are' עם 'you'", difficulty: "beginner" },
    { sentence: "I ___ six years old", options: ["am", "is", "are", "be"], correct: 0, category: "verb-to-be", explanation: "Use 'am' with 'I'", hebrewExplanation: "משתמשים ב'am' עם 'I'", difficulty: "beginner" },
    { sentence: "My sister ___ tall", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be", explanation: "Use 'is' with 'my sister' (she)", hebrewExplanation: "משתמשים ב'is' עם 'my sister' (גוף שלישי)", difficulty: "beginner" },
    { sentence: "The boys ___ in the classroom", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be", explanation: "Use 'are' with plural 'the boys'", hebrewExplanation: "משתמשים ב'are' עם רבים 'the boys'", difficulty: "beginner" },
    { sentence: "The children ___ happy right now", options: ["is", "am", "are", "was"], correct: 2, category: "verb-to-be", explanation: "Use 'are' with the plural subject 'children'", hebrewExplanation: "משתמשים ב'are' עם הנושא ברבים 'children'", difficulty: "beginner" },
    { sentence: "I ___ happy to see you", options: ["am", "is", "are", "be"], correct: 0, category: "verb-to-be", explanation: "Use 'am' with 'I'", hebrewExplanation: "משתמשים ב'am' עם 'I'", difficulty: "beginner" },
    { sentence: "The sun ___ shining brightly", options: ["is", "are", "do", "does"], correct: 0, category: "verb-to-be", explanation: "Use 'is' with the singular subject 'sun' in present continuous", hebrewExplanation: "משתמשים ב'is' עם הנושא היחיד 'sun' בזמן הווה מתמשך", difficulty: "beginner" },

    // =====================================================
    // VERB "TO BE" - NEGATIVE FORMS
    // =====================================================
    { sentence: "I ___ not tired", options: ["am", "is", "are", "be"], correct: 0, category: "verb-to-be-negative", explanation: "Use 'am not' with 'I'", hebrewExplanation: "משתמשים ב'am not' עם 'I'", difficulty: "beginner" },
    { sentence: "She ___ not at home", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be-negative", explanation: "Use 'is not' with 'she'", hebrewExplanation: "משתמשים ב'is not' עם 'she'", difficulty: "beginner" },
    { sentence: "They ___ not playing now", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be-negative", explanation: "Use 'are not' with 'they'", hebrewExplanation: "משתמשים ב'are not' עם 'they'", difficulty: "beginner" },
    { sentence: "He ___ not a doctor", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be-negative", explanation: "Use 'is not' with 'he'", hebrewExplanation: "משתמשים ב'is not' עם 'he'", difficulty: "beginner" },
    { sentence: "We ___ not ready yet", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be-negative", explanation: "Use 'are not' with 'we'", hebrewExplanation: "משתמשים ב'are not' עם 'we'", difficulty: "beginner" },
    { sentence: "It ___ not raining today", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be-negative", explanation: "Use 'is not' with 'it'", hebrewExplanation: "משתמשים ב'is not' עם 'it'", difficulty: "beginner" },
    { sentence: "You ___ not late", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be-negative", explanation: "Use 'are not' with 'you'", hebrewExplanation: "משתמשים ב'are not' עם 'you'", difficulty: "beginner" },
    { sentence: "The cat ___ not hungry", options: ["am", "is", "are", "be"], correct: 1, category: "verb-to-be-negative", explanation: "Use 'is not' with 'the cat' (it)", hebrewExplanation: "משתמשים ב'is not' עם 'the cat' (גוף שלישי)", difficulty: "beginner" },
    { sentence: "My parents ___ not home", options: ["am", "is", "are", "be"], correct: 2, category: "verb-to-be-negative", explanation: "Use 'are not' with plural 'my parents'", hebrewExplanation: "משתמשים ב'are not' עם רבים 'my parents'", difficulty: "beginner" },
    { sentence: "I ___ not scared", options: ["am", "is", "are", "be"], correct: 0, category: "verb-to-be-negative", explanation: "Use 'am not' with 'I'", hebrewExplanation: "משתמשים ב'am not' עם 'I'", difficulty: "beginner" },

    // =====================================================
    // VERB "TO BE" - QUESTION FORMS
    // =====================================================
    { sentence: "___ I late?", options: ["Am", "Is", "Are", "Be"], correct: 0, category: "verb-to-be-question", explanation: "Use 'Am' with 'I' in questions", hebrewExplanation: "משתמשים ב'Am' עם 'I' בשאלות", difficulty: "beginner" },
    { sentence: "___ she your sister?", options: ["Am", "Is", "Are", "Be"], correct: 1, category: "verb-to-be-question", explanation: "Use 'Is' with 'she' in questions", hebrewExplanation: "משתמשים ב'Is' עם 'she' בשאלות", difficulty: "beginner" },
    { sentence: "___ they coming?", options: ["Am", "Is", "Are", "Be"], correct: 2, category: "verb-to-be-question", explanation: "Use 'Are' with 'they' in questions", hebrewExplanation: "משתמשים ב'Are' עם 'they' בשאלות", difficulty: "beginner" },
    { sentence: "___ he a teacher?", options: ["Am", "Is", "Are", "Be"], correct: 1, category: "verb-to-be-question", explanation: "Use 'Is' with 'he' in questions", hebrewExplanation: "משתמשים ב'Is' עם 'he' בשאלות", difficulty: "beginner" },
    { sentence: "___ we ready?", options: ["Am", "Is", "Are", "Be"], correct: 2, category: "verb-to-be-question", explanation: "Use 'Are' with 'we' in questions", hebrewExplanation: "משתמשים ב'Are' עם 'we' בשאלות", difficulty: "beginner" },
    { sentence: "___ it cold outside?", options: ["Am", "Is", "Are", "Be"], correct: 1, category: "verb-to-be-question", explanation: "Use 'Is' with 'it' in questions", hebrewExplanation: "משתמשים ב'Is' עם 'it' בשאלות", difficulty: "beginner" },
    { sentence: "___ you happy?", options: ["Am", "Is", "Are", "Be"], correct: 2, category: "verb-to-be-question", explanation: "Use 'Are' with 'you' in questions", hebrewExplanation: "משתמשים ב'Are' עם 'you' בשאלות", difficulty: "beginner" },
    { sentence: "___ the dog friendly?", options: ["Am", "Is", "Are", "Be"], correct: 1, category: "verb-to-be-question", explanation: "Use 'Is' with 'the dog' (it) in questions", hebrewExplanation: "משתמשים ב'Is' עם 'the dog' בשאלות", difficulty: "beginner" },
    { sentence: "___ the children playing?", options: ["Am", "Is", "Are", "Be"], correct: 2, category: "verb-to-be-question", explanation: "Use 'Are' with plural 'children' in questions", hebrewExplanation: "משתמשים ב'Are' עם רבים 'children' בשאלות", difficulty: "beginner" },
    { sentence: "___ I doing it right?", options: ["Am", "Is", "Are", "Be"], correct: 0, category: "verb-to-be-question", explanation: "Use 'Am' with 'I' in questions", hebrewExplanation: "משתמשים ב'Am' עם 'I' בשאלות", difficulty: "beginner" },

    // =====================================================
    // VERB "TO BE" - PAST TENSE (was / were)
    // =====================================================
    { sentence: "I ___ playing soccer when it started to rain", options: ["was", "were", "am", "is"], correct: 0, category: "verb-to-be-past", explanation: "Use 'was' with 'I' for the past continuous tense", hebrewExplanation: "משתמשים ב'was' עם 'I' בזמן עבר מתמשך", difficulty: "beginner" },
    { sentence: "They ___ happy about the trip", options: ["was", "were", "is", "am"], correct: 1, category: "verb-to-be-past", explanation: "Use 'were' with 'they' for the past tense of 'to be'", hebrewExplanation: "משתמשים ב'were' עם 'they' בזמן עבר של הפועל 'להיות'", difficulty: "beginner" },
    { sentence: "She ___ at school yesterday", options: ["was", "were", "is", "are"], correct: 0, category: "verb-to-be-past", explanation: "Use 'was' with 'she' in past tense", hebrewExplanation: "משתמשים ב'was' עם 'she' בזמן עבר", difficulty: "beginner" },
    { sentence: "We ___ very tired last night", options: ["was", "were", "am", "are"], correct: 1, category: "verb-to-be-past", explanation: "Use 'were' with 'we' in past tense", hebrewExplanation: "משתמשים ב'were' עם 'we' בזמן עבר", difficulty: "beginner" },
    { sentence: "The weather ___ nice yesterday", options: ["was", "were", "is", "are"], correct: 0, category: "verb-to-be-past", explanation: "Use 'was' with singular 'weather' in past tense", hebrewExplanation: "משתמשים ב'was' עם יחיד 'weather' בזמן עבר", difficulty: "beginner" },
    { sentence: "You ___ very kind to help me", options: ["was", "were", "is", "am"], correct: 1, category: "verb-to-be-past", explanation: "Use 'were' with 'you' in past tense", hebrewExplanation: "משתמשים ב'were' עם 'you' בזמן עבר", difficulty: "beginner" },

    // =====================================================
    // PRESENT SIMPLE
    // =====================================================
    { sentence: "I ___ to school every day", options: ["go", "goes", "going", "went"], correct: 0, category: "present-simple", explanation: "Use 'go' with 'I' in present tense", hebrewExplanation: "משתמשים ב'go' עם 'I' בזמן הווה", difficulty: "beginner" },
    { sentence: "The cat ___ on the mat", options: ["sit", "sits", "sitting", "sat"], correct: 1, category: "present-simple", explanation: "Use 'sits' with third person singular", hebrewExplanation: "משתמשים ב'sits' עם גוף שלישי יחיד", difficulty: "beginner" },
    { sentence: "She ___ to eat ice cream", options: ["want", "wants", "wanting", "wanted"], correct: 1, category: "present-simple", explanation: "Use 'wants' with third person singular 'she' in present simple", hebrewExplanation: "משתמשים ב'wants' עם גוף שלישי יחיד 'she' בזמן הווה פשוט", difficulty: "beginner" },
    { sentence: "My parents ___ shopping every Saturday", options: ["goes", "go", "is going", "went"], correct: 1, category: "present-simple", explanation: "Use 'go' with the plural subject 'parents' in present tense", hebrewExplanation: "משתמשים ב'go' עם הנושא ברבים 'parents' בזמן הווה", difficulty: "beginner" },
    { sentence: "He ___ his teeth every morning", options: ["brush", "brushes", "brushing", "brushed"], correct: 1, category: "present-simple", explanation: "Use 'brushes' with third person singular 'he' for a habit in the present simple", hebrewExplanation: "משתמשים ב'brushes' עם גוף שלישי יחיד 'he' להרגל בזמן הווה פשוט", difficulty: "beginner" },
    { sentence: "We ___ not go to the cinema often", options: ["am", "is", "do", "does"], correct: 2, category: "present-simple", explanation: "Use 'do not' ('don't') with 'we' for present simple negative", hebrewExplanation: "משתמשים ב'do not' עם 'we' לשלילה בזמן הווה פשוט", difficulty: "beginner" },

    // =====================================================
    // PRESENT CONTINUOUS
    // =====================================================
    { sentence: "They ___ watching TV now", options: ["is", "am", "are", "be"], correct: 2, category: "present-continuous", explanation: "Use 'are' with 'they' for the present continuous tense", hebrewExplanation: "משתמשים ב'are' עם 'they' בזמן הווה מתמשך", difficulty: "beginner" },
    { sentence: "My mother ___ cooking dinner", options: ["is", "am", "are", "be"], correct: 0, category: "present-continuous", explanation: "Use 'is' with third person singular", hebrewExplanation: "משתמשים ב'is' עם גוף שלישי יחיד", difficulty: "beginner" },
    { sentence: "It ___ raining outside right now", options: ["do", "does", "is", "are"], correct: 2, category: "present-continuous", explanation: "Use 'is' with 'it' for the present continuous tense", hebrewExplanation: "משתמשים ב'is' עם 'it' בזמן הווה מתמשך", difficulty: "beginner" },
    { sentence: "The baby ___ loudly now", options: ["cry", "cries", "is crying", "cried"], correct: 2, category: "present-continuous", explanation: "Use 'is crying' for an action happening 'now' (present continuous)", hebrewExplanation: "משתמשים ב'is crying' לפעולה שמתרחשת 'now' (הווה מתמשך)", difficulty: "beginner" },

    // =====================================================
    // PAST SIMPLE
    // =====================================================
    { sentence: "She ___ a book yesterday", options: ["read", "reads", "reading", "will read"], correct: 0, category: "past-simple", explanation: "Use past tense 'read' for yesterday", hebrewExplanation: "משתמשים בזמן עבר 'read' עבור אתמול", difficulty: "beginner" },
    { sentence: "He ___ his homework last night", options: ["do", "does", "doing", "did"], correct: 3, category: "past-simple", explanation: "Use the past tense 'did' for 'last night'", hebrewExplanation: "משתמשים בזמן עבר 'did' עבור 'last night'", difficulty: "beginner" },
    { sentence: "I ___ a bike when I was six", options: ["ride", "rides", "rode", "riding"], correct: 2, category: "past-simple", explanation: "Use the past tense 'rode' for a completed action in the past", hebrewExplanation: "משתמשים בזמן עבר 'rode' לפעולה שהושלמה בעבר", difficulty: "beginner" },
    { sentence: "He ___ a delicious cake last week", options: ["make", "makes", "making", "made"], correct: 3, category: "past-simple", explanation: "Use the past tense 'made' for a completed action 'last week'", hebrewExplanation: "משתמשים בזמן עבר 'made' לפעולה שהושלמה 'last week'", difficulty: "beginner" },
    { sentence: "He ___ a new bicycle for his birthday", options: ["get", "gets", "getting", "got"], correct: 3, category: "past-simple", explanation: "Use the past tense 'got' for a completed action", hebrewExplanation: "משתמשים בזמן עבר 'got' לפעולה שהושלמה", difficulty: "beginner" },
    { sentence: "She ___ to school on foot yesterday", options: ["walk", "walks", "walking", "walked"], correct: 3, category: "past-simple", explanation: "Use the past tense 'walked' for the action that happened 'yesterday'", hebrewExplanation: "משתמשים בזמן עבר 'walked' לפעולה שקרתה 'yesterday'", difficulty: "beginner" },

    // =====================================================
    // FUTURE (will)
    // =====================================================
    { sentence: "We ___ to the beach tomorrow", options: ["go", "goes", "will go", "went"], correct: 2, category: "future", explanation: "Use 'will go' for a future action", hebrewExplanation: "משתמשים ב'will go' לפעולה עתידית", difficulty: "beginner" },

    // =====================================================
    // PLURALS
    // =====================================================
    { sentence: "I have two ___ (apple)", options: ["apples", "apple's", "apple", "appled"], correct: 0, category: "plurals", explanation: "The plural form of 'apple' is 'apples'", hebrewExplanation: "צורת הרבים של 'apple' היא 'apples'", difficulty: "beginner" },
    { sentence: "There are three ___ (man) in the picture", options: ["mans", "men", "man's", "manned"], correct: 1, category: "plurals", explanation: "The irregular plural of 'man' is 'men'", hebrewExplanation: "הרבים הבלתי רגיל של 'man' הוא 'men'", difficulty: "beginner" },
    { sentence: "I saw two ___ (fish) in the pond", options: ["fishes", "fish", "fish's", "fishing"], correct: 1, category: "plurals", explanation: "The plural form of 'fish' is often 'fish'", hebrewExplanation: "צורת הרבים של 'fish' היא לעתים קרובות 'fish'", difficulty: "beginner" },
    { sentence: "My dog chases ___ (bird) in the garden", options: ["bird", "birds", "bird's", "birdies"], correct: 1, category: "plurals", explanation: "The plural form of 'bird' is 'birds'", hebrewExplanation: "צורת הרבים של 'bird' היא 'birds'", difficulty: "beginner" },
    { sentence: "We saw many ___ (woman) at the market", options: ["womans", "women", "woman's", "womened"], correct: 1, category: "plurals", explanation: "The irregular plural of 'woman' is 'women'", hebrewExplanation: "הרבים הבלתי רגיל של 'woman' הוא 'women'", difficulty: "beginner" },

    // =====================================================
    // PREPOSITIONS
    // =====================================================
    { sentence: "The book is ___ the table", options: ["in", "on", "at", "to"], correct: 1, category: "prepositions", explanation: "Use 'on' to indicate a position on a surface", hebrewExplanation: "משתמשים ב'on' כדי לציין מיקום על משטח", difficulty: "beginner" },
    { sentence: "The mouse is ___ the box", options: ["under", "on", "at", "to"], correct: 0, category: "prepositions", explanation: "Use 'under' to indicate a position below something", hebrewExplanation: "משתמשים ב'under' כדי לציין מיקום מתחת למשהו", difficulty: "beginner" },
    { sentence: "I like to talk ___ my friends", options: ["in", "on", "to", "at"], correct: 2, category: "prepositions", explanation: "The correct collocation is 'talk to someone'", hebrewExplanation: "הצירוף הנכון הוא 'talk to someone'", difficulty: "beginner" },
    { sentence: "The ball rolled ___ the chair and the table", options: ["on", "next to", "between", "at"], correct: 2, category: "prepositions", explanation: "Use 'between' to indicate a position in the middle of two things", hebrewExplanation: "משתמשים ב'between' כדי לציין מיקום באמצע שני דברים", difficulty: "beginner" },
    { sentence: "The bus arrives ___ 8 o'clock", options: ["in", "on", "at", "to"], correct: 2, category: "prepositions", explanation: "Use 'at' for specific times", hebrewExplanation: "משתמשים ב'at' עבור זמנים ספציפיים", difficulty: "beginner" },
    { sentence: "The picture is ___ the wall", options: ["in", "on", "at", "under"], correct: 1, category: "prepositions", explanation: "Use 'on' for items attached to a vertical surface like a wall", hebrewExplanation: "משתמשים ב'on' עבור פריטים המחוברים למשטח אנכי כמו קיר", difficulty: "beginner" },
    { sentence: "I put the milk ___ the fridge", options: ["on", "at", "in", "to"], correct: 2, category: "prepositions", explanation: "Use 'in' to indicate something is inside a container or enclosed space", hebrewExplanation: "משתמשים ב'in' כדי לציין שמשהו נמצא בתוך מיכל או חלל סגור", difficulty: "beginner" },
    { sentence: "She ran ___ the street to meet her friend", options: ["in", "on", "across", "at"], correct: 2, category: "prepositions", explanation: "Use 'across' to mean from one side to the other", hebrewExplanation: "משתמשים ב'across' כדי לומר מצד אחד לשני", difficulty: "beginner" },
    { sentence: "The flowers are ___ the house", options: ["in front of", "behind", "on", "over"], correct: 0, category: "prepositions", explanation: "Use 'in front of' to indicate a position ahead of something", hebrewExplanation: "משתמשים ב'in front of' כדי לציין מיקום לפני משהו", difficulty: "beginner" },
    { sentence: "I woke up ___ seven o'clock", options: ["in", "on", "at", "to"], correct: 2, category: "prepositions", explanation: "Use 'at' for specific times", hebrewExplanation: "משתמשים ב'at' עבור זמנים ספציפיים", difficulty: "beginner" },
    { sentence: "The keys are ___ the drawer", options: ["on", "at", "in", "to"], correct: 2, category: "prepositions", explanation: "Use 'in' to indicate something is inside a container", hebrewExplanation: "משתמשים ב'in' כדי לציין שמשהו נמצא בתוך מיכל", difficulty: "beginner" },
    { sentence: "They waited ___ the school gate", options: ["in", "on", "at", "to"], correct: 2, category: "prepositions", explanation: "Use 'at' for a specific, non-enclosed point", hebrewExplanation: "משתמשים ב'at' לנקודה ספציפית ולא סגורה", difficulty: "beginner" },

    // =====================================================
    // POSSESSIVES
    // =====================================================
    { sentence: "She is wearing ___ new shoes", options: ["her", "she", "his", "it"], correct: 0, category: "possessives", explanation: "Use the possessive adjective 'her' before a noun", hebrewExplanation: "משתמשים בכינוי השייכות 'her' לפני שם עצם", difficulty: "beginner" },
    { sentence: "The ___ (boy) toys are broken", options: ["boys", "boy's", "boys'", "boy"], correct: 1, category: "possessives", explanation: "Use 'boy's' for singular possessive (one boy)", hebrewExplanation: "משתמשים ב-'boy's' לשייכות יחיד (ילד אחד)", difficulty: "beginner" },
    { sentence: "These are ___ (child) books", options: ["childs", "childrens", "children's", "child's"], correct: 2, category: "possessives", explanation: "Use 'children's' for plural possessive (more than one child)", hebrewExplanation: "משתמשים ב-'children's' לשייכות רבים (יותר מילד אחד)", difficulty: "beginner" },
    { sentence: "This is ___ (we) house", options: ["our", "us", "we", "ours"], correct: 0, category: "possessives", explanation: "Use the possessive adjective 'our' before a noun", hebrewExplanation: "משתמשים בכינוי השייכות 'our' לפני שם עצם", difficulty: "beginner" },
    { sentence: "They like ___ new game", options: ["their", "there", "they're", "them"], correct: 0, category: "possessives", explanation: "Use the possessive adjective 'their' before a noun", hebrewExplanation: "משתמשים בכינוי השייכות 'their' לפני שם עצם", difficulty: "beginner" },
    { sentence: "The ___ (box) color is red", options: ["box", "boxes", "box's", "boxs"], correct: 2, category: "possessives", explanation: "Use 'box's' for singular possessive (the color belonging to one box)", hebrewExplanation: "משתמשים ב-'box's' לשייכות יחיד (הצבע ששייך לקופסה אחת)", difficulty: "beginner" },

    // =====================================================
    // PRONOUNS
    // =====================================================
    { sentence: "Can ___ help me?", options: ["he", "his", "him", "he's"], correct: 0, category: "pronouns", explanation: "Use the subject pronoun 'he' before the verb", hebrewExplanation: "משתמשים בכינוי גוף נושא 'he' לפני הפועל", difficulty: "beginner" },
    { sentence: "I like ___ movie more than that one", options: ["this", "these", "those", "them"], correct: 0, category: "pronouns", explanation: "Use the singular demonstrative pronoun 'this' for a singular noun nearby", hebrewExplanation: "משתמשים בכינוי הרמז ביחיד 'this' עבור שם עצם יחיד קרוב", difficulty: "beginner" },
    { sentence: "Can you give ___ the book?", options: ["I", "me", "my", "mine"], correct: 1, category: "pronouns", explanation: "Use the object pronoun 'me' after the verb 'give'", hebrewExplanation: "משתמשים בכינוי גוף מושא 'me' אחרי הפועל 'give'", difficulty: "beginner" },
    { sentence: "They gave the presents to ___", options: ["we", "us", "our", "ours"], correct: 1, category: "pronouns", explanation: "Use the object pronoun 'us' after the verb 'gave'", hebrewExplanation: "משתמשים בכינוי גוף מושא 'us' אחרי הפועל 'gave'", difficulty: "beginner" },

    // =====================================================
    // QUESTION WORDS
    // =====================================================
    { sentence: "___ is your name?", options: ["Where", "What", "Who", "When"], correct: 1, category: "question-words", explanation: "Use 'What' to ask for information or identity", hebrewExplanation: "משתמשים ב'What' כדי לשאול על מידע או זהות", difficulty: "beginner" },
    { sentence: "___ are you going?", options: ["What", "Who", "Where", "Why"], correct: 2, category: "question-words", explanation: "Use 'Where' to ask about location or direction", hebrewExplanation: "משתמשים ב'Where' כדי לשאול על מיקום או כיוון", difficulty: "beginner" },
    { sentence: "___ many pencils do you have?", options: ["How", "What", "Which", "When"], correct: 0, category: "question-words", explanation: "Use 'How many' to ask about the quantity of countable nouns", hebrewExplanation: "משתמשים ב'How many' כדי לשאול על כמות של שמות עצם ספירים", difficulty: "beginner" },
    { sentence: "___ book is this?", options: ["Who", "Whose", "Who's", "Whom"], correct: 1, category: "question-words", explanation: "Use 'Whose' to ask about possession", hebrewExplanation: "משתמשים ב'Whose' כדי לשאול על שייכות", difficulty: "beginner" },
    { sentence: "___ did you go to bed?", options: ["Where", "What", "When", "Who"], correct: 2, category: "question-words", explanation: "Use 'When' to ask about time", hebrewExplanation: "משתמשים ב'When' כדי לשאול על זמן", difficulty: "beginner" },
    { sentence: "___ do you live?", options: ["What", "Who", "Where", "When"], correct: 2, category: "question-words", explanation: "Use 'Where' to ask about location", hebrewExplanation: "משתמשים ב'Where' כדי לשאול על מיקום", difficulty: "beginner" },

    // =====================================================
    // COMPARATIVES & SUPERLATIVES
    // =====================================================
    { sentence: "This is a ___ car", options: ["big", "biggest", "more big", "bigly"], correct: 0, category: "comparatives", explanation: "Use the base form 'big' as an adjective", hebrewExplanation: "משתמשים בצורת הבסיס 'big' כתואר שם", difficulty: "beginner" },
    { sentence: "She is a ___ girl", options: ["happy", "happier", "happiest", "happily"], correct: 0, category: "comparatives", explanation: "Use the adjective 'happy' to describe the noun 'girl'", hebrewExplanation: "משתמשים בתואר השם 'happy' כדי לתאר את שם העצם 'girl'", difficulty: "beginner" },
    { sentence: "He is ___ than his sister", options: ["tall", "taller", "tallest", "tallly"], correct: 1, category: "comparatives", explanation: "Use the comparative adjective 'taller' when comparing two things", hebrewExplanation: "משתמשים בתואר ההשוואה 'taller' כאשר משווים שני דברים", difficulty: "beginner" },
    { sentence: "It is the ___ (small) puppy in the litter", options: ["small", "smaller", "smallest", "more small"], correct: 2, category: "comparatives", explanation: "Use the superlative adjective 'smallest' when comparing three or more", hebrewExplanation: "משתמשים בתואר העילוי 'smallest' כאשר משווים שלושה או יותר", difficulty: "beginner" },
    { sentence: "This puzzle is ___ than that one", options: ["easy", "easier", "easiest", "easily"], correct: 1, category: "comparatives", explanation: "Use the comparative adjective 'easier' when comparing two things", hebrewExplanation: "משתמשים בתואר ההשוואה 'easier' כאשר משווים שני דברים", difficulty: "beginner" },

    // =====================================================
    // ARTICLES (a / an / the)
    // =====================================================
    { sentence: "I bought ___ book", options: ["a", "an", "the", "this"], correct: 0, category: "articles", explanation: "Use the indefinite article 'a' before a singular countable noun starting with a consonant sound", hebrewExplanation: "משתמשים ב'a' לפני שם עצם ספיר ביחיד שמתחיל בצליל עיצור", difficulty: "beginner" },
    { sentence: "I need ___ eraser for my pencil", options: ["a", "an", "the", "this"], correct: 1, category: "articles", explanation: "Use the indefinite article 'an' before a singular countable noun starting with a vowel sound", hebrewExplanation: "משתמשים ב'an' לפני שם עצם ספיר ביחיד שמתחיל בצליל תנועה", difficulty: "beginner" },

    // =====================================================
    // MODALS (can / can't)
    // =====================================================
    { sentence: "We ___ play outside in the rain", options: ["can", "canned", "cans", "can't"], correct: 3, category: "modals", explanation: "Use 'can't' (cannot) to express lack of ability or prohibition", hebrewExplanation: "משתמשים ב'can't' (לא יכול) כדי לבטא חוסר יכולת או איסור", difficulty: "beginner" },
    { sentence: "We ___ sing a song together", options: ["is", "are", "do", "can"], correct: 3, category: "modals", explanation: "Use the modal verb 'can' to express ability", hebrewExplanation: "משתמשים בפועל מודאלי 'can' כדי לבטא יכולת", difficulty: "beginner" }
];
