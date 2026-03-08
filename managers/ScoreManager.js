// ScoreManager - Handles scoring logic, points calculation, and coins economy
// Part of the modular game manager system

export class ScoreManager {
    constructor() {
        this.scores = {};
        this.coinRewards = {
            correctFirstTry: 10,
            correctRetry: 5,
            completeActivity: 20,
            completeTopic: 50,
            completeUnit: 100,
            dailyLogin: 10,
            streakBonus7: 50,
            streakBonus14: 100,
            streakBonus30: 200,
            perfectGame: 30
        };
    }

    /**
     * Initialize the score manager
     */
    initialize() {
        // Initialize scores for all game types
        const gameTypes = ['vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening', 'reading', 'practice', 'abc', 'memory', 'scramble', 'fill-blanks', 'word-journey', 'picture-match'];
        this.initializeScores(gameTypes);
        console.log('[ScoreManager] Initialized');
    }

    /**
     * Initialize scores for all game types
     * @param {Array<string>} gameTypes - List of game types
     */
    initializeScores(gameTypes) {
        gameTypes.forEach(type => {
            this.scores[type] = 0;
        });
    }

    /**
     * Get current score for a game type
     * @param {string} gameType
     * @returns {number}
     */
    getScore(gameType) {
        return this.scores[gameType] || 0;
    }

    /**
     * Set score for a game type
     * @param {string} gameType
     * @param {number} score
     */
    setScore(gameType, score) {
        this.scores[gameType] = score;
    }

    /**
     * Add points to a game's score
     * @param {string} gameType
     * @param {number} points
     * @returns {number} New score
     */
    addPoints(gameType, points) {
        if (!this.scores[gameType]) {
            this.scores[gameType] = 0;
        }
        this.scores[gameType] += points;
        return this.scores[gameType];
    }

    /**
     * Reset score for a game type
     * @param {string} gameType
     */
    resetScore(gameType) {
        this.scores[gameType] = 0;
    }

    /**
     * Reset all scores
     */
    resetAllScores() {
        Object.keys(this.scores).forEach(type => {
            this.scores[type] = 0;
        });
    }

    /**
     * Calculate coins earned for an action
     * @param {string} action - Action type (correctFirstTry, completeActivity, etc.)
     * @param {Object} context - Additional context (e.g., streak days)
     * @returns {number} Coins to award
     */
    calculateCoins(action, context = {}) {
        let coins = this.coinRewards[action] || 0;

        // Apply multipliers based on context
        if (context.isPerfect && action === 'completeActivity') {
            coins += this.coinRewards.perfectGame;
        }

        // Streak bonuses
        if (action === 'dailyLogin' && context.streakDays) {
            if (context.streakDays >= 30) {
                coins += this.coinRewards.streakBonus30;
            } else if (context.streakDays >= 14) {
                coins += this.coinRewards.streakBonus14;
            } else if (context.streakDays >= 7) {
                coins += this.coinRewards.streakBonus7;
            }
        }

        return coins;
    }

    /**
     * Calculate percentage score
     * @param {number} correct - Number of correct answers
     * @param {number} total - Total questions
     * @returns {number} Percentage (0-100)
     */
    calculatePercentage(correct, total) {
        if (total === 0) return 0;
        return Math.round((correct / total) * 100);
    }

    /**
     * Determine performance rating based on percentage
     * @param {number} percentage
     * @returns {Object} Rating with label and emoji
     */
    getPerformanceRating(percentage) {
        if (percentage >= 100) {
            return { label: 'מושלם!', labelEn: 'Perfect!', emoji: '🌟', level: 'perfect' };
        } else if (percentage >= 90) {
            return { label: 'מעולה!', labelEn: 'Excellent!', emoji: '🎉', level: 'excellent' };
        } else if (percentage >= 80) {
            return { label: 'טוב מאוד!', labelEn: 'Very Good!', emoji: '👏', level: 'very-good' };
        } else if (percentage >= 70) {
            return { label: 'טוב!', labelEn: 'Good!', emoji: '👍', level: 'good' };
        } else if (percentage >= 60) {
            return { label: 'לא רע!', labelEn: 'Not Bad!', emoji: '🙂', level: 'okay' };
        } else {
            return { label: 'המשך להתאמן!', labelEn: 'Keep Practicing!', emoji: '💪', level: 'needs-practice' };
        }
    }

    /**
     * Calculate XP points based on performance
     * @param {number} correct - Correct answers
     * @param {number} total - Total questions
     * @param {string} gameType - Type of game
     * @returns {number} XP points
     */
    calculateXP(correct, total, gameType) {
        const baseXP = correct * 10;
        const bonusMultiplier = this.getGameXPMultiplier(gameType);
        const perfectBonus = correct === total ? 20 : 0;

        return Math.round((baseXP * bonusMultiplier) + perfectBonus);
    }

    /**
     * Get XP multiplier for different game types
     * @param {string} gameType
     * @returns {number}
     */
    getGameXPMultiplier(gameType) {
        const multipliers = {
            vocabulary: 1.0,
            grammar: 1.2,
            'grammar-beginner': 1.0,
            pronunciation: 1.3,
            listening: 1.1,
            reading: 1.2,
            memory: 1.0,
            scramble: 1.5,
            'fill-blanks': 1.3,
            practice: 1.5,
            abc: 0.8
        };
        return multipliers[gameType] || 1.0;
    }

    /**
     * Get all scores
     * @returns {Object}
     */
    getAllScores() {
        return { ...this.scores };
    }

    /**
     * Restore scores from saved state
     * @param {Object} savedScores
     */
    restoreScores(savedScores) {
        if (savedScores && typeof savedScores === 'object') {
            this.scores = { ...savedScores };
        }
    }
}

// Export singleton instance
export const scoreManager = new ScoreManager();
