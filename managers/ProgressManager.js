// ProgressManager - Handles word mastery tracking, completion tracking, and progress persistence
// Part of the modular game manager system

export class ProgressManager {
    constructor() {
        this.wordMastery = {};
        this.topicProgress = {};
        this.courseProgress = {};
        this.certificates = [];
        this.learnedWords = {};   // V2: graduated words
        this.wordJourneyProgress = {}; // V2: per-word Word Journey stage completion
        this.gameUnlocks = {};    // V2: per-game unlock state

        // Mastery thresholds
        this.thresholds = {
            mastered: 0.8,      // 80%+ accuracy
            learning: 0.5,      // 50-79% accuracy
            struggling: 0.0,    // 0-49% accuracy
            minAttempts: 3,     // Minimum attempts for stable mastery
            consecutiveForMastery: 2  // Consecutive correct needed
        };
    }

    /**
     * Initialize from user progress data
     * @param {Object} userProgress - User progress object from localStorage
     */
    initialize(userProgress) {
        if (!userProgress) return;

        this.wordMastery = userProgress.wordMastery || {};
        this.topicProgress = userProgress.topicProgress || {};
        this.courseProgress = userProgress.courses || {};
        this.certificates = userProgress.certificates || [];
        this.learnedWords = userProgress.learnedWords || {};
        this.wordJourneyProgress = userProgress.wordJourneyProgress || {};
        this.gameUnlocks = userProgress.gameUnlocks || {};
    }

    // ==========================================
    // WORD MASTERY TRACKING
    // ==========================================

    /**
     * Get mastery stats for a specific word
     * @param {string} word
     * @param {string} category
     * @returns {Object|null}
     */
    getWordStats(word, category) {
        if (!word) return null;
        const key = `${word.toLowerCase()}_${category}`;
        // Also check original-case key for backward-compatible reads of existing saved data
        const legacyKey = `${word}_${category}`;
        return this.wordMastery[key] || this.wordMastery[legacyKey] || null;
    }

    /**
     * Record a word attempt and update mastery
     * @param {string} word
     * @param {string} category
     * @param {boolean} isCorrect
     * @param {string} gameType
     * @param {number} responseTime - Response time in ms (optional)
     * @returns {Object} Updated word stats
     */
    recordWordAttempt(word, category, isCorrect, gameType, responseTime = null) {
        const key = `${word.toLowerCase()}_${category}`;

        // Get or create word stats
        let stats = this.wordMastery[key] || this.createDefaultWordStats(word, category);

        // Update attempt counts
        stats.totalAttempts++;
        if (isCorrect) {
            stats.correctAttempts++;
            stats.consecutiveCorrect++;
        } else {
            stats.incorrectAttempts++;
            stats.consecutiveCorrect = 0;
        }

        // Update metadata
        stats.lastSeen = new Date().toISOString();
        stats.lastResult = isCorrect ? 'correct' : 'incorrect';

        // Track per-game-type stats
        if (!stats.gameTypeStats[gameType]) {
            stats.gameTypeStats[gameType] = { correct: 0, total: 0 };
        }
        stats.gameTypeStats[gameType].total++;
        if (isCorrect) {
            stats.gameTypeStats[gameType].correct++;
        }

        // Track response time if provided
        if (responseTime !== null) {
            if (!stats.responseTimes) {
                stats.responseTimes = [];
            }
            stats.responseTimes.push(responseTime);
            // Keep only last 10 response times
            if (stats.responseTimes.length > 10) {
                stats.responseTimes = stats.responseTimes.slice(-10);
            }
            stats.averageResponseTime = this.calculateAverageResponseTime(stats.responseTimes);
        }

        // Calculate new mastery level
        const previousMastery = stats.masteryLevel || 0;
        stats.masteryLevel = this.calculateMastery(stats);

        // Check for mastery level-up
        stats.justMastered = previousMastery < this.thresholds.mastered &&
                            stats.masteryLevel >= this.thresholds.mastered;

        // Save to object
        this.wordMastery[key] = stats;

        return stats;
    }

    /**
     * Create default word stats object
     * @param {string} word
     * @param {string} category
     * @returns {Object}
     */
    createDefaultWordStats(word, category) {
        return {
            word: word,
            category: category,
            totalAttempts: 0,
            correctAttempts: 0,
            incorrectAttempts: 0,
            consecutiveCorrect: 0,
            lastSeen: null,
            lastResult: null,
            masteryLevel: 0,
            gameTypeStats: {},
            responseTimes: [],
            averageResponseTime: null
        };
    }

    /**
     * Calculate mastery level based on performance
     * @param {Object} stats - Word stats object
     * @returns {number} Mastery level (0-1)
     */
    calculateMastery(stats) {
        if (!stats || stats.totalAttempts === 0) {
            return 0;
        }

        const accuracy = stats.correctAttempts / stats.totalAttempts;
        const hasMinAttempts = stats.totalAttempts >= this.thresholds.minAttempts;
        const hasHighAccuracy = accuracy >= 0.90;
        const hasConsecutive = stats.consecutiveCorrect >= this.thresholds.consecutiveForMastery;

        // Base mastery is accuracy
        let masteryLevel = accuracy;

        // Bonus for meeting all mastery criteria
        if (hasMinAttempts && hasHighAccuracy && hasConsecutive) {
            masteryLevel = Math.min(1.0, masteryLevel + 0.1);
        }

        return Math.round(masteryLevel * 100) / 100;
    }

    /**
     * Calculate average response time
     * @param {Array<number>} times
     * @returns {number}
     */
    calculateAverageResponseTime(times) {
        if (!times || times.length === 0) return null;
        const sum = times.reduce((a, b) => a + b, 0);
        return Math.round(sum / times.length);
    }

    /**
     * Get words by mastery level
     * @param {string} level - 'mastered', 'learning', 'struggling', 'new'
     * @param {Array<string>} categories - Optional filter by categories
     * @returns {Array<Object>}
     */
    getWordsByMasteryLevel(level, categories = null) {
        const words = [];

        Object.values(this.wordMastery).forEach(stats => {
            // Filter by category if specified
            if (categories && !categories.includes(stats.category)) {
                return;
            }

            const mastery = stats.masteryLevel || 0;
            let matchesLevel = false;

            switch (level) {
                case 'mastered':
                    matchesLevel = mastery >= this.thresholds.mastered;
                    break;
                case 'learning':
                    matchesLevel = mastery >= this.thresholds.learning && mastery < this.thresholds.mastered;
                    break;
                case 'struggling':
                    matchesLevel = mastery > 0 && mastery < this.thresholds.learning;
                    break;
                case 'new':
                    matchesLevel = mastery === 0;
                    break;
            }

            if (matchesLevel) {
                words.push(stats);
            }
        });

        return words;
    }

    /**
     * Get mastery statistics summary
     * @param {Array<string>} categories - Optional filter by categories
     * @returns {Object}
     */
    getMasteryStats(categories = null) {
        let total = 0;
        let mastered = 0;
        let learning = 0;
        let struggling = 0;
        let newWords = 0;
        let totalMastery = 0;

        Object.values(this.wordMastery).forEach(stats => {
            if (categories && !categories.includes(stats.category)) {
                return;
            }

            total++;
            const mastery = stats.masteryLevel || 0;
            totalMastery += mastery;

            if (mastery >= this.thresholds.mastered) {
                mastered++;
            } else if (mastery >= this.thresholds.learning) {
                learning++;
            } else if (mastery > 0) {
                struggling++;
            } else {
                newWords++;
            }
        });

        return {
            total,
            mastered,
            learning,
            struggling,
            newWords,
            averageMastery: total > 0 ? totalMastery / total : 0
        };
    }

    // ==========================================
    // TOPIC PROGRESS TRACKING
    // ==========================================

    /**
     * Get progress for a specific topic
     * @param {string} topicId
     * @returns {Object}
     */
    getTopicProgress(topicId) {
        return this.topicProgress[topicId] || {
            unlocked: false,
            started: false,
            mastery: 0,
            completedActivities: [],
            certificateEarned: false
        };
    }

    /**
     * Update topic progress
     * @param {string} topicId
     * @param {Object} updates
     */
    updateTopicProgress(topicId, updates) {
        if (!this.topicProgress[topicId]) {
            this.topicProgress[topicId] = {
                unlocked: false,
                started: false,
                mastery: 0,
                completedActivities: [],
                certificateEarned: false
            };
        }

        Object.assign(this.topicProgress[topicId], updates);
    }

    /**
     * Mark an activity as completed for a topic
     * @param {string} topicId
     * @param {string} activityType
     */
    completeActivity(topicId, activityType) {
        if (!this.topicProgress[topicId]) {
            this.updateTopicProgress(topicId, { started: true });
        }

        const activities = this.topicProgress[topicId].completedActivities || [];
        if (!activities.includes(activityType)) {
            activities.push(activityType);
            this.topicProgress[topicId].completedActivities = activities;
        }
    }

    /**
     * Check if all activities are completed for a topic
     * @param {string} topicId
     * @param {Array<string>} requiredActivities
     * @returns {boolean}
     */
    isTopicComplete(topicId, requiredActivities) {
        const progress = this.getTopicProgress(topicId);
        return requiredActivities.every(activity =>
            progress.completedActivities.includes(activity)
        );
    }

    /**
     * Unlock a topic
     * @param {string} topicId
     */
    unlockTopic(topicId) {
        this.updateTopicProgress(topicId, { unlocked: true });
    }

    // ==========================================
    // COURSE PROGRESS TRACKING
    // ==========================================

    /**
     * Get progress for a course
     * @param {string} courseId
     * @returns {Object}
     */
    getCourseProgress(courseId) {
        return this.courseProgress[courseId] || {
            unlocked: false,
            startedDate: null,
            currentUnit: null,
            currentTopic: null,
            completedUnits: [],
            completedTopics: []
        };
    }

    /**
     * Start a course
     * @param {string} courseId
     * @param {string} firstUnitId
     * @param {string} firstTopicId
     */
    startCourse(courseId, firstUnitId, firstTopicId) {
        this.courseProgress[courseId] = {
            unlocked: true,
            startedDate: new Date().toISOString(),
            currentUnit: firstUnitId,
            currentTopic: firstTopicId,
            completedUnits: [],
            completedTopics: []
        };
    }

    /**
     * Update current position in course
     * @param {string} courseId
     * @param {string} unitId
     * @param {string} topicId
     */
    updateCoursePosition(courseId, unitId, topicId) {
        if (this.courseProgress[courseId]) {
            this.courseProgress[courseId].currentUnit = unitId;
            this.courseProgress[courseId].currentTopic = topicId;
        }
    }

    /**
     * Mark a topic as completed in course
     * @param {string} courseId
     * @param {string} topicId
     */
    completeCourseTopicProgress(courseId, topicId) {
        const progress = this.courseProgress[courseId];
        if (progress && !progress.completedTopics.includes(topicId)) {
            progress.completedTopics.push(topicId);
        }
    }

    // ==========================================
    // CERTIFICATE TRACKING
    // ==========================================

    /**
     * Award a certificate
     * @param {string} certificateId
     * @param {string} topicId
     * @param {number} score
     * @returns {Object} The certificate object
     */
    awardCertificate(certificateId, topicId, score) {
        const certificate = {
            id: certificateId,
            topicId: topicId,
            earnedDate: new Date().toISOString(),
            score: score
        };

        // Check if already earned
        const existing = this.certificates.find(c => c.id === certificateId);
        if (!existing) {
            this.certificates.push(certificate);
        } else if (score > existing.score) {
            // Update if new score is higher
            existing.score = score;
            existing.earnedDate = certificate.earnedDate;
        }

        return certificate;
    }

    /**
     * Check if a certificate is earned
     * @param {string} certificateId
     * @returns {boolean}
     */
    hasCertificate(certificateId) {
        return this.certificates.some(c => c.id === certificateId);
    }

    /**
     * Get all certificates
     * @returns {Array<Object>}
     */
    getAllCertificates() {
        return [...this.certificates];
    }

    // ==========================================
    // V2 LEARNING SYSTEM — WORD GRADUATION
    // ==========================================

    /**
     * Graduate a word after successful Word Journey completion.
     * If the word was already graduated, updates journeyCompletions and score.
     * @param {string} word
     * @param {string} category
     * @param {number} journeyScore  0-100 percentage accuracy for this journey run
     */
    graduateWord(word, category, journeyScore) {
        const key = `${word.toLowerCase()}_${category}`;
        const today = new Date().toISOString().slice(0, 10);
        const allJourneyStages = ['discover', 'listen-match', 'spell-tiles', 'say-word', 'recall'];

        if (this.learnedWords[key]) {
            // Re-run — update completions count and best score
            this.learnedWords[key].journeyCompletions++;
            if (journeyScore > this.learnedWords[key].journeyScore) {
                this.learnedWords[key].journeyScore = journeyScore;
            }
            this.learnedWords[key].lastPracticed = today;
        } else {
            this.learnedWords[key] = {
                graduatedDate: today,
                journeyScore,
                journeyCompletions: 1,
                reinforcedIn: [],
                lastPracticed: today,
            };
        }

        const existingJourney = this.wordJourneyProgress[key] || {
            completedStages: [],
            startedDate: today,
        };
        this.wordJourneyProgress[key] = {
            ...existingJourney,
            completedStages: [...new Set([...(existingJourney.completedStages || []), ...allJourneyStages])],
            completed: true,
            completedDate: today,
            lastUpdated: today,
        };
    }

    /**
     * Record that a learned word was practiced in a specific game.
     * @param {string} word
     * @param {string} category
     * @param {string} gameType
     */
    recordWordReinforcement(word, category, gameType) {
        const key = `${word.toLowerCase()}_${category}`;
        if (!this.learnedWords[key]) return;
        const today = new Date().toISOString().slice(0, 10);
        if (!this.learnedWords[key].reinforcedIn.includes(gameType)) {
            this.learnedWords[key].reinforcedIn.push(gameType);
        }
        this.learnedWords[key].lastPracticed = today;
    }

    /**
     * Get all learned word entries.
     * @returns {Object} { "word_category": { graduatedDate, journeyScore, ... } }
     */
    getLearnedWords() {
        return { ...this.learnedWords };
    }

    /**
     * Record that a Word Journey stage was completed for a set of words.
     * @param {Array<{word: string, category: string}>} words
     * @param {string} stageId
     */
    recordJourneyStageCompletion(words, stageId) {
        if (!Array.isArray(words) || words.length === 0 || !stageId) return;

        const today = new Date().toISOString().slice(0, 10);
        words.forEach(({ word, category }) => {
            if (!word || !category) return;
            const key = `${word.toLowerCase()}_${category}`;
            const existing = this.wordJourneyProgress[key] || {
                completedStages: [],
                startedDate: today,
            };

            this.wordJourneyProgress[key] = {
                ...existing,
                completedStages: existing.completedStages.includes(stageId)
                    ? existing.completedStages
                    : [...existing.completedStages, stageId],
                lastUpdated: today,
            };
        });
    }

    /**
     * Get all persisted per-word Word Journey progress entries.
     * @returns {Object}
     */
    getWordJourneyProgress() {
        return { ...this.wordJourneyProgress };
    }

    /**
     * Count how many distinct words have been graduated.
     * @returns {number}
     */
    getLearnedWordCount() {
        return Object.keys(this.learnedWords).length;
    }

    /**
     * Check whether a specific word has been graduated.
     * @param {string} word
     * @param {string} category
     * @returns {boolean}
     */
    isWordLearned(word, category) {
        const key = `${word.toLowerCase()}_${category}`;
        return key in this.learnedWords;
    }

    /**
     * Count how many topics have any completed activities (used as a proxy for
     * "topics done" in unlock gate evaluation).
     * @returns {number}
     */
    getCompletedTopicCount() {
        return Object.values(this.topicProgress).filter(
            t => t.completedActivities && t.completedActivities.length > 0
        ).length;
    }

    // ==========================================
    // V2 LEARNING SYSTEM — GAME UNLOCKS
    // ==========================================

    /**
     * Get the unlock status for a specific game type.
     * @param {string} gameType
     * @returns {Object|null}  The gameUnlocks entry, or null if unknown.
     */
    getGameUnlockStatus(gameType) {
        return this.gameUnlocks[gameType] || null;
    }

    /**
     * Evaluate unlock gates and update gameUnlocks in-place.
     * Should be called after every word graduation and after ABC game completion.
     *
     * @param {number} learnedCount   Number of graduated words
     * @param {number} topicsDone     Number of topics with any activity completed
     * @param {number} abcMastery     ABC mastery percentage (0-100)
     * @returns {string[]}  List of game IDs that were newly unlocked in this call
     */
    checkAndUnlockGames(learnedCount, topicsDone, abcMastery = 0) {
        const today = new Date().toISOString().slice(0, 10);
        const newlyUnlocked = [];

        const tryUnlock = (gameType, condition) => {
            const entry = this.gameUnlocks[gameType];
            if (entry && !entry.unlocked && condition) {
                entry.unlocked = true;
                entry.unlockedDate = today;
                newlyUnlocked.push(gameType);
            }
        };

        tryUnlock('listening',     learnedCount >= 5);
        tryUnlock('picture-match', learnedCount >= 5);
        tryUnlock('reading',       learnedCount >= 10 && abcMastery >= 60);
        tryUnlock('pronunciation', learnedCount >= 10);
        tryUnlock('fill-blanks',   learnedCount >= 30 && topicsDone >= 2);
        tryUnlock('scramble',      learnedCount >= 30 && topicsDone >= 2);
        tryUnlock('grammar',       learnedCount >= 50 && topicsDone >= 3);
        tryUnlock('vocabulary',    learnedCount >= 10);

        return newlyUnlocked;
    }

    // ==========================================
    // PERSISTENCE
    // ==========================================

    /**
     * Get all progress data for saving
     * @returns {Object}
     */
    getProgressData() {
        return {
            wordMastery: { ...this.wordMastery },
            topicProgress: { ...this.topicProgress },
            courses: { ...this.courseProgress },
            certificates: [...this.certificates],
            learnedWords: { ...this.learnedWords },
            wordJourneyProgress: { ...this.wordJourneyProgress },
            gameUnlocks: { ...this.gameUnlocks },
        };
    }

    /**
     * Restore progress from saved data
     * @param {Object} data
     */
    restoreProgress(data) {
        if (data.wordMastery) {
            this.wordMastery = { ...data.wordMastery };
        }
        if (data.topicProgress) {
            this.topicProgress = { ...data.topicProgress };
        }
        if (data.courses) {
            this.courseProgress = { ...data.courses };
        }
        if (data.certificates) {
            this.certificates = [...data.certificates];
        }
        if (data.learnedWords) {
            this.learnedWords = { ...data.learnedWords };
        }
        if (data.wordJourneyProgress) {
            this.wordJourneyProgress = { ...data.wordJourneyProgress };
        }
        if (data.gameUnlocks) {
            this.gameUnlocks = { ...data.gameUnlocks };
        }
    }
}

// Export singleton instance
export const progressManager = new ProgressManager();
