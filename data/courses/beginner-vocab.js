/**
 * beginner-vocab.js
 * Beginner Vocabulary Course - First course for young learners
 */

export const beginnerVocabCourse = {
    id: 'beginner-vocab',
    name: 'Beginner Vocabulary',
    nameHebrew: 'אוצר מילים למתחילים',
    icon: '📚',
    description: 'Learn essential English words for everyday life',
    descriptionHebrew: 'למד מילים בסיסיות באנגלית לחיי היומיום',
    difficulty: 'beginner',

    units: [
        {
            id: 'unit-1-colors',
            name: 'Colors',
            nameHebrew: 'צבעים',
            icon: '🎨',
            description: 'Learn basic and advanced colors',

            topics: [
                {
                    id: 'basic-colors',
                    name: 'Basic Colors',
                    nameHebrew: 'צבעים בסיסיים',
                    icon: '🌈',
                    words: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: null,  // First topic always unlocked
                    certificateId: 'cert-basic-colors',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 10
                },
                {
                    id: 'more-colors',
                    name: 'More Colors',
                    nameHebrew: 'צבעים נוספים',
                    icon: '🎨',
                    words: ['gray', 'silver', 'gold', 'beige', 'navy', 'maroon'],
                    activities: ['vocabulary', 'listening', 'scramble'],
                    unlockRequirement: { topic: 'basic-colors', mastery: 0.7 },
                    certificateId: 'cert-more-colors',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 8
                }
            ]
        },

        {
            id: 'unit-2-numbers',
            name: 'Numbers',
            nameHebrew: 'מספרים',
            icon: '🔢',
            description: 'Count from 1 to 100',

            topics: [
                {
                    id: 'numbers-1-10',
                    name: 'Numbers 1-10',
                    nameHebrew: 'מספרים 1-10',
                    icon: '1️⃣',
                    words: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: { topic: 'more-colors', mastery: 0.6 },
                    certificateId: 'cert-numbers-1-10',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 10
                },
                {
                    id: 'numbers-11-20',
                    name: 'Numbers 11-20',
                    nameHebrew: 'מספרים 11-20',
                    icon: '2️⃣',
                    words: ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
                    activities: ['vocabulary', 'listening', 'fill-blanks'],
                    unlockRequirement: { topic: 'numbers-1-10', mastery: 0.7 },
                    certificateId: 'cert-numbers-11-20',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 10
                }
            ]
        },

        {
            id: 'unit-3-animals',
            name: 'Animals',
            nameHebrew: 'חיות',
            icon: '🐾',
            description: 'Meet animals from around the world',

            topics: [
                {
                    id: 'farm-animals',
                    name: 'Farm Animals',
                    nameHebrew: 'חיות משק',
                    icon: '🐮',
                    words: ['cow', 'pig', 'chicken', 'horse', 'sheep', 'goat', 'duck', 'rooster'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: { topic: 'numbers-11-20', mastery: 0.6 },
                    certificateId: 'cert-farm-animals',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                },
                {
                    id: 'wild-animals',
                    name: 'Wild Animals',
                    nameHebrew: 'חיות בר',
                    icon: '🦁',
                    words: ['lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'bear', 'wolf'],
                    activities: ['vocabulary', 'listening', 'scramble'],
                    unlockRequirement: { topic: 'farm-animals', mastery: 0.7 },
                    certificateId: 'cert-wild-animals',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                },
                {
                    id: 'pets',
                    name: 'Pets',
                    nameHebrew: 'חיות מחמד',
                    icon: '🐕',
                    words: ['dog', 'cat', 'fish', 'bird', 'hamster', 'rabbit', 'turtle'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: { topic: 'wild-animals', mastery: 0.7 },
                    certificateId: 'cert-pets',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 10
                }
            ]
        },

        {
            id: 'unit-4-body',
            name: 'Body Parts',
            nameHebrew: 'חלקי הגוף',
            icon: '👤',
            description: 'Learn parts of the body',

            topics: [
                {
                    id: 'face-body',
                    name: 'Face & Body',
                    nameHebrew: 'פנים וגוף',
                    icon: '😊',
                    words: ['head', 'face', 'eye', 'nose', 'mouth', 'ear', 'hand', 'foot', 'arm', 'leg'],
                    activities: ['vocabulary', 'listening', 'memory', 'fill-blanks'],
                    unlockRequirement: { topic: 'pets', mastery: 0.7 },
                    certificateId: 'cert-face-body',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                }
            ]
        },

        {
            id: 'unit-5-family',
            name: 'Family',
            nameHebrew: 'משפחה',
            icon: '👨‍👩‍👧‍👦',
            description: 'Meet the family members',

            topics: [
                {
                    id: 'family-members',
                    name: 'Family Members',
                    nameHebrew: 'בני משפחה',
                    icon: '👨‍👩‍👧',
                    words: ['mother', 'father', 'sister', 'brother', 'grandmother', 'grandfather', 'baby'],
                    activities: ['vocabulary', 'listening', 'memory', 'scramble'],
                    unlockRequirement: { topic: 'face-body', mastery: 0.7 },
                    certificateId: 'cert-family-members',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 10
                }
            ]
        }
    ]
};
