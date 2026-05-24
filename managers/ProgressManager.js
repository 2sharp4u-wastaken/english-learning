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

        // V3 mastery-driven lifecycle (see docs/learning-flow-redesign.md).
        // Light spacing: a Learned word resurfaces as "Due" after a growing gap,
        // indexed by its per-word reviewStage (advances on a correct review,
        // resets to 0 on a missed review). Last bucket repeats indefinitely.
        this.reviewIntervalsDays = [3, 7, 14, 30];
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

        this.migrateToLifecycleModel();
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

        // V3 spacing: snapshot due-state from PRE-update state, so a correct
        // answer to a due word advances its review interval (and a miss resets it).
        const wasDue = this.isWordDue(word, category);

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
        // Older wordMastery entries (pre-gameTypeStats) lack this field — guard
        // against TypeError on `stats.gameTypeStats[gameType]`.
        if (!stats.gameTypeStats) stats.gameTypeStats = {};
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

        // V3 spacing: only words that were Due move the review clock.
        if (typeof stats.reviewStage !== 'number') stats.reviewStage = 0;
        if (wasDue) {
            stats.reviewStage = isCorrect ? stats.reviewStage + 1 : 0;
        }

        // V3 lifecycle hysteresis: a word becomes Learned the moment its mastery
        // is stable (`_isDerivedLearned`), and stays Learned through a single slip —
        // it is only DEMOTED after 2 consecutive misses (a correct answer in between
        // forgives). Prevents a kid's "learned" count flickering down on one mistake.
        if (typeof stats.lapses !== 'number') stats.lapses = 0;
        if (this._isDerivedLearned(stats)) {
            stats.reachedLearned = true;
            stats.lapses = 0;
        } else if (stats.reachedLearned) {
            if (isCorrect) {
                stats.lapses = 0; // still demonstrating it — reset the lapse counter
            } else {
                stats.lapses += 1;
                if (stats.lapses >= 2) {     // second miss → demote to Learning
                    stats.reachedLearned = false;
                    stats.lapses = 0;
                }
            }
        }

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
            averageResponseTime: null,
            reviewStage: 0,        // V3 spacing: index into reviewIntervalsDays
            reachedLearned: false, // V3: has ever crossed the Learned bar (sticky w/ hysteresis)
            lapses: 0              // V3: consecutive misses while Learned; demote at 2
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
                certificateEarned: false,
                completed: false
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

    /**
     * Calculate topic mastery from the average mastery of its words.
     * Learned words count as fully mastered for course progression purposes.
     * @param {Array<string>} topicWords
     * @returns {number}
     */
    calculateTopicMastery(topicWords = []) {
        if (!Array.isArray(topicWords) || topicWords.length === 0) {
            return 0;
        }

        const bank = window.vocabularyBank || [];
        let totalMastery = 0;
        let countedWords = 0;

        topicWords.forEach(rawWord => {
            const normalizedWord = String(rawWord || '').trim().toLowerCase();
            if (!normalizedWord) return;

            const bankEntry = bank.find(entry => entry.word.toLowerCase() === normalizedWord);
            const category = bankEntry?.category;
            const stats = category ? this.getWordStats(rawWord, category) : null;
            const learned = category ? this.isWordLearned(rawWord, category) : false;

            totalMastery += learned ? 1 : (stats?.masteryLevel || 0);
            countedWords++;
        });

        if (countedWords === 0) return 0;
        return Math.round((totalMastery / countedWords) * 100) / 100;
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
            t => t?.completed === true || t?.certificateEarned === true
        ).length;
    }

    // ==========================================
    // V3 MASTERY-DRIVEN WORD LIFECYCLE
    // (see docs/learning-flow-redesign.md)
    // ==========================================

    /** Canonical lowercased `${word}_${category}` key. */
    _key(word, category) {
        return `${String(word ?? '').toLowerCase()}_${category}`;
    }

    /**
     * One-time, idempotent, NON-DESTRUCTIVE migration to the lifecycle model.
     *
     * Grandfather is enforced at READ time in `getWordStatus` (any key present in
     * `learnedWords` counts as Learned, forever — no current child loses access).
     * This pass only tags existing learned entries for auditability and back-fills
     * the `reviewStage` field on older mastery entries. It never deletes data.
     */
    migrateToLifecycleModel() {
        for (const entry of Object.values(this.learnedWords)) {
            if (entry && entry.grandfathered === undefined) entry.grandfathered = true;
        }
        for (const stats of Object.values(this.wordMastery)) {
            if (!stats) continue;
            if (typeof stats.reviewStage !== 'number') stats.reviewStage = 0;
            if (typeof stats.lapses !== 'number') stats.lapses = 0;
            // Seed the sticky flag from current mastery so already-mastered words
            // inherit the same 2-miss protection from their next attempt onward.
            if (stats.reachedLearned === undefined) stats.reachedLearned = this._isDerivedLearned(stats);
        }
    }

    /** True if a word has ever been encountered (Word Journey or any review game). */
    isWordIntroduced(word, category) {
        if (this._key(word, category) in this.learnedWords) return true; // grandfather
        const stats = this.getWordStats(word, category);
        return !!stats && (stats.totalAttempts || 0) > 0;
    }

    /** Derived "Learned" purely from mastery — no grandfather, can revert (decay). */
    _isDerivedLearned(stats) {
        if (!stats) return false;
        const t = this.thresholds;
        return (stats.totalAttempts || 0) >= t.minAttempts
            && (stats.masteryLevel || 0) >= t.mastered
            && (stats.consecutiveCorrect || 0) >= t.consecutiveForMastery;
    }

    /**
     * Live lifecycle status of a word: 'new' | 'learning' | 'learned'.
     * - new:      never introduced
     * - learning: introduced but mastery not yet stable at ≥0.8
     * - learned:  mastery-stable now, OR Learned-with-protection (≤1 lapse since),
     *             OR grandfathered (sticky for old users)
     * "Due" is an overlay on Learned — see `isWordDue`.
     */
    getWordStatus(word, category) {
        const grandfathered = this._key(word, category) in this.learnedWords;
        const stats = this.getWordStats(word, category);
        const introduced = grandfathered || (!!stats && (stats.totalAttempts || 0) > 0);
        if (!introduced) return 'new';
        // `reachedLearned` carries the 2-miss hysteresis: it's only cleared in
        // recordWordAttempt after the second consecutive miss.
        const stickyLearned = !!stats && stats.reachedLearned === true;
        if (grandfathered || this._isDerivedLearned(stats) || stickyLearned) return 'learned';
        return 'learning';
    }

    /** Review interval (days) for a given reviewStage; last bucket repeats. */
    reviewIntervalDays(reviewStage = 0) {
        const a = this.reviewIntervalsDays;
        return a[Math.min(Math.max(reviewStage | 0, 0), a.length - 1)];
    }

    /** Most recent review/graduation anchor (ms epoch), or null if never anchored. */
    _lastReviewedAt(word, category) {
        const key = this._key(word, category);
        const lw = this.learnedWords[key];
        const candidates = [
            this.wordMastery[key]?.lastSeen,
            lw?.lastPracticed,
            lw?.graduatedDate,
        ].filter(Boolean).map(d => Date.parse(d)).filter(n => !Number.isNaN(n));
        return candidates.length ? Math.max(...candidates) : null;
    }

    /** True if a Learned word is past its review interval (or never anchored). */
    isWordDue(word, category, now = Date.now()) {
        if (this.getWordStatus(word, category) !== 'learned') return false;
        const last = this._lastReviewedAt(word, category);
        if (last === null) return true; // learned but never anchored → review it
        const days = (now - last) / 86400000;
        const stage = this.getWordStats(word, category)?.reviewStage || 0;
        return days >= this.reviewIntervalDays(stage);
    }

    /**
     * Visit every distinct vocabulary word the child has touched (union of
     * mastery entries + grandfathered learned words), excluding ABC letters.
     */
    _eachVocabWord(cb) {
        const seen = new Set();
        const visit = (word, category) => {
            if (!word || category === 'abc') return;
            const key = this._key(word, category);
            if (seen.has(key)) return;
            seen.add(key);
            cb(word, category, key);
        };
        Object.values(this.wordMastery).forEach(s => visit(s.word, s.category));
        Object.keys(this.learnedWords).forEach(k => {
            const idx = k.lastIndexOf('_');
            if (idx > 0) visit(k.slice(0, idx), k.slice(idx + 1));
        });
    }

    /** All words at a given lifecycle status, optionally filtered by categories. */
    getWordsByStatus(status, categories = null) {
        const out = [];
        this._eachVocabWord((word, category) => {
            if (categories && !categories.includes(category)) return;
            if (this.getWordStatus(word, category) === status) out.push({ word, category });
        });
        return out;
    }

    /** All Learned words currently Due for review (fuels review games + Practice). */
    getDueWords(categories = null) {
        const out = [];
        this._eachVocabWord((word, category) => {
            if (categories && !categories.includes(category)) return;
            if (this.isWordDue(word, category)) out.push({ word, category });
        });
        return out;
    }

    /** Single-pass lifecycle tally: { learning, learned, due, introduced, total }. */
    getLifecycleCounts(categories = null) {
        const counts = { learning: 0, learned: 0, due: 0, introduced: 0, total: 0 };
        this._eachVocabWord((word, category) => {
            if (categories && !categories.includes(category)) return;
            counts.total++;
            const status = this.getWordStatus(word, category);
            if (status === 'learning') counts.learning++;
            else if (status === 'learned') {
                counts.learned++;
                if (this.isWordDue(word, category)) counts.due++;
            }
            if (status !== 'new') counts.introduced++;
        });
        return counts;
    }

    /**
     * Count of words the child has been introduced to (Learning + Learned).
     * Gates the review-tier games under the redesign.
     */
    getIntroducedCount(categories = null) {
        return this.getLifecycleCounts(categories).introduced;
    }

    /**
     * Count of words genuinely Learned (derived ∪ grandfathered).
     * The new meaning of "learned count" — gates the consolidation-tier games.
     * NOTE: legacy `getLearnedWordCount()` still counts the raw `learnedWords`
     * stamp; gating is switched to this method in the step-3 (gate re-tier) slice.
     */
    getDerivedLearnedCount(categories = null) {
        return this.getLifecycleCounts(categories).learned;
    }

    /**
     * Set of `${word}_${category}` keys for every word the child has been
     * introduced to (Learning ∪ Learned). This is the eligibility pool for the
     * REVIEW-tier games — including Learning words is what lets review promote
     * them to Learned. Used by GameManager._getLearnedWordSet under the redesign.
     */
    getIntroducedWordKeys(categories = null) {
        const keys = new Set();
        this._eachVocabWord((word, category, key) => {
            if (categories && !categories.includes(category)) return;
            if (this.getWordStatus(word, category) !== 'new') keys.add(key);
        });
        return keys;
    }

    /**
     * Set of `${word}_${category}` keys for words genuinely Learned (derived ∪
     * grandfathered). Eligibility pool for the CONSOLIDATION-tier games.
     */
    getLearnedWordKeys(categories = null) {
        const keys = new Set();
        this._eachVocabWord((word, category, key) => {
            if (categories && !categories.includes(category)) return;
            if (this.getWordStatus(word, category) === 'learned') keys.add(key);
        });
        return keys;
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

        // V3 tiered gating (docs/learning-flow-redesign.md): review-tier games gate
        // on words INTRODUCED (so the child can promote them through play);
        // consolidation-tier games gate on words genuinely LEARNED. The passed
        // `learnedCount` is kept for call-site compatibility but is superseded by
        // the authoritative derived counts below. Unlocks are one-way, so existing
        // users never lose a game (grandfathered words count toward both totals).
        const introduced = this.getIntroducedCount();
        const learned = this.getDerivedLearnedCount();
        void learnedCount;

        const tryUnlock = (gameType, condition) => {
            const entry = this.gameUnlocks[gameType];
            if (entry && !entry.unlocked && condition) {
                entry.unlocked = true;
                entry.unlockedDate = today;
                newlyUnlocked.push(gameType);
            }
        };

        // Review tier — gate on introduced count, draw from Learning ∪ Due.
        tryUnlock('listening',     introduced >= 5);
        tryUnlock('picture-match', introduced >= 5);
        tryUnlock('true-or-not',   introduced >= 5);
        tryUnlock('vocabulary',    introduced >= 10);
        tryUnlock('pronunciation', introduced >= 10);
        tryUnlock('reading',       introduced >= 10 && abcMastery >= 60);

        // Consolidation tier — gate on genuinely-Learned count.
        tryUnlock('story-time',    learned >= 15);
        tryUnlock('fill-blanks',   learned >= 30 && topicsDone >= 2);
        tryUnlock('scramble',      learned >= 30 && topicsDone >= 2);
        tryUnlock('grammar',       learned >= 50 && topicsDone >= 3);

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
