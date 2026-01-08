// Centralized Feedback System
// Provides consistent English feedback messages for all games

// Feedback variations for variety
const correctFeedbacks = [
    { text: 'Excellent! Well done!', audio: 'Excellent!' },
    { text: 'Perfect! Great job!', audio: 'Perfect!' },
    { text: 'Amazing! You got it!', audio: 'Amazing!' },
    { text: 'Wonderful! Keep it up!', audio: 'Wonderful!' },
    { text: 'Outstanding! Nicely done!', audio: 'Outstanding!' }
];

const incorrectFeedbacks = [
    { text: 'Not quite. Try again!', audio: 'Try again!' },
    { text: 'Almost there. One more time!', audio: 'One more time!' },
    { text: 'Good try. Give it another shot!', audio: 'Give it another shot!' },
    { text: 'Keep trying. You can do it!', audio: 'You can do it!' },
    { text: 'Nice attempt. Try once more!', audio: 'Try once more!' }
];

function getRandomFeedback(isCorrect) {
    const feedbacks = isCorrect ? correctFeedbacks : incorrectFeedbacks;
    return feedbacks[Math.floor(Math.random() * feedbacks.length)];
}

const GameFeedback = {
    // General correct answers (will be randomized)
    correct: {
        text: 'Correct! Well done!',
        audio: 'Correct!'
    },

    // General incorrect answers (will be randomized)
    incorrect: {
        text: 'Not quite. Try again!',
        audio: 'Try again!'
    },

    // Vocabulary game specific
    vocabulary: {
        correct: {
            text: 'Excellent! Correct answer!',
            audio: 'Excellent!'
        },
        incorrect: {
            text: 'Not quite right. Try the next word!',
            audio: 'Incorrect!'
        }
    },

    // Grammar game specific
    grammar: {
        correct: {
            text: 'Correct! Great job!',
            audio: 'Correct!'
        },
        incorrect: {
            text: 'Incorrect.',
            audio: 'Incorrect!'
        }
    },

    // Listening game specific
    listening: {
        correct: {
            text: 'Excellent! Correct answer!',
            audio: 'Excellent!'
        },
        incorrect: {
            text: 'Incorrect. Try again!',
            audio: 'Incorrect!'
        }
    },

    // Pronunciation game specific
    pronunciation: {
        excellent: {
            text: 'Excellent pronunciation!',
            audio: 'Excellent pronunciation!'
        },
        good: {
            text: 'Good! Keep practicing.',
            audio: 'Good job!'
        },
        needsWork: {
            text: 'Keep practicing!',
            audio: 'Keep practicing!'
        },
        tryAgain: {
            text: 'Try to pronounce more clearly.',
            audio: 'Try again!'
        },
        recording: {
            text: 'Recording... Speak now!',
            audio: null
        },
        cancelled: {
            text: 'Recording cancelled',
            audio: null
        }
    },

    // Reading game specific
    reading: {
        correct: {
            text: 'Excellent! Correct answer!',
            audio: 'Excellent!'
        },
        incorrect: {
            text: 'Incorrect. Try again!',
            audio: 'Try again!'
        }
    },

    // Error messages
    errors: {
        speechNotSupported: {
            text: 'Speech recognition not supported in this browser.',
            audio: null
        },
        recordingFailed: {
            text: 'Recording failed. Please try again.',
            audio: null
        }
    }
};

// Helper function to get feedback with randomization
function getFeedback(game, type, includeExplanation = null) {
    let feedbackData;

    // Use random feedback for correct/incorrect
    if (type === 'correct' || type === 'incorrect') {
        feedbackData = getRandomFeedback(type === 'correct');
    } else {
        // Use specific feedback for other types
        feedbackData = GameFeedback[game]?.[type] || GameFeedback[type];
    }

    if (!feedbackData) {
        console.warn(`Feedback not found for game: ${game}, type: ${type}`);
        return { text: '', audio: null };
    }

    let text = feedbackData.text;

    // Add explanation for grammar game if provided
    if (game === 'grammar' && includeExplanation) {
        text = `<strong>${feedbackData.text}</strong><br>${includeExplanation}`;
    }

    // Play sound effects for correct/incorrect answers
    if (window.audioEffects) {
        if (type === 'correct' || type === 'excellent' || type === 'good') {
            window.audioEffects.playCorrect().catch(() => {});
        } else if (type === 'incorrect' || type === 'needsWork' || type === 'tryAgain') {
            window.audioEffects.playWrong().catch(() => {});
        }
    }

    return {
        text: text,
        audio: feedbackData.audio
    };
}

// Export for use in game modules
window.GameFeedback = GameFeedback;
window.getFeedback = getFeedback;
window.getRandomFeedback = getRandomFeedback;
