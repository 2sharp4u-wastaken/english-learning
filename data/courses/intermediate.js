/**
 * intermediate.js
 * Intermediate Course - For learners who completed beginner level
 */

export const intermediateCourse = {
    id: 'intermediate',
    name: 'Intermediate English',
    nameHebrew: 'אנגלית ברמה בינונית',
    icon: '📖',
    description: 'Expand your vocabulary and learn basic grammar',
    descriptionHebrew: 'הרחב את אוצר המילים ולמד דקדוק בסיסי',
    difficulty: 'intermediate',
    unlockRequirement: {
        course: 'beginner-vocab',
        completionPercentage: 80
    },

    units: [
        {
            id: 'unit-1-actions',
            name: 'Actions & Verbs',
            nameHebrew: 'פעולות ופעלים',
            icon: '🏃',
            description: 'Learn common action words',

            topics: [
                {
                    id: 'basic-verbs',
                    name: 'Basic Verbs',
                    nameHebrew: 'פעלים בסיסיים',
                    icon: '🎯',
                    words: ['run', 'jump', 'walk', 'sit', 'stand', 'eat', 'drink', 'sleep'],
                    activities: ['vocabulary', 'listening', 'memory', 'scramble'],
                    unlockRequirement: null,
                    certificateId: 'cert-basic-verbs',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                },
                {
                    id: 'daily-actions',
                    name: 'Daily Actions',
                    nameHebrew: 'פעולות יומיומיות',
                    icon: '🌅',
                    words: ['wake up', 'brush teeth', 'get dressed', 'go to school', 'do homework', 'play', 'watch TV', 'go to bed'],
                    activities: ['vocabulary', 'listening', 'scramble', 'fill-blanks'],
                    unlockRequirement: { topic: 'basic-verbs', mastery: 0.7 },
                    certificateId: 'cert-daily-actions',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 15
                }
            ]
        },

        {
            id: 'unit-2-food',
            name: 'Food & Drinks',
            nameHebrew: 'אוכל ושתייה',
            icon: '🍎',
            description: 'Learn about different foods',

            topics: [
                {
                    id: 'fruits',
                    name: 'Fruits',
                    nameHebrew: 'פירות',
                    icon: '🍇',
                    words: ['apple', 'banana', 'orange', 'strawberry', 'watermelon', 'grape', 'pineapple', 'mango'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: { topic: 'daily-actions', mastery: 0.6 },
                    certificateId: 'cert-fruits',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                },
                {
                    id: 'vegetables',
                    name: 'Vegetables',
                    nameHebrew: 'ירקות',
                    icon: '🥕',
                    words: ['carrot', 'tomato', 'cucumber', 'potato', 'onion', 'pepper', 'lettuce', 'broccoli'],
                    activities: ['vocabulary', 'listening', 'memory'],
                    unlockRequirement: { topic: 'fruits', mastery: 0.7 },
                    certificateId: 'cert-vegetables',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                }
            ]
        },

        {
            id: 'unit-3-places',
            name: 'Places',
            nameHebrew: 'מקומות',
            icon: '🏠',
            description: 'Learn about different places',

            topics: [
                {
                    id: 'home-places',
                    name: 'Around the House',
                    nameHebrew: 'בבית',
                    icon: '🏡',
                    words: ['kitchen', 'bedroom', 'bathroom', 'living room', 'garden', 'garage'],
                    activities: ['vocabulary', 'listening', 'memory', 'fill-blanks'],
                    unlockRequirement: { topic: 'vegetables', mastery: 0.7 },
                    certificateId: 'cert-home-places',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                },
                {
                    id: 'city-places',
                    name: 'In the City',
                    nameHebrew: 'בעיר',
                    icon: '🏙️',
                    words: ['school', 'park', 'store', 'hospital', 'library', 'restaurant', 'museum'],
                    activities: ['vocabulary', 'listening', 'memory', 'scramble'],
                    unlockRequirement: { topic: 'home-places', mastery: 0.7 },
                    certificateId: 'cert-city-places',
                    milestone: { scoreThreshold: 70 },
                    estimatedMinutes: 12
                }
            ]
        }
    ]
};
