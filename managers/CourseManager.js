/**
 * CourseManager.js
 * Manages course/unit/topic progression, unlocking, and navigation
 */

export class CourseManager {
    constructor(userProgress, progressManager) {
        this.userProgress = userProgress;
        this.progressManager = progressManager;
        this.courses = new Map(); // courseId -> course data
        this.initialized = false;
    }

    /**
     * Initialize course structure
     * Ensures userProgress has course-related fields
     */
    initialize() {
        if (this.initialized) return;

        // Ensure userProgress has required fields
        if (!this.userProgress.courses) {
            this.userProgress.courses = {};
        }
        if (!this.userProgress.topicProgress) {
            this.userProgress.topicProgress = {};
        }
        Object.values(this.userProgress.topicProgress).forEach(progress => {
            if (typeof progress.completed !== 'boolean') {
                progress.completed = false;
            }
        });
        if (!this.userProgress.certificates) {
            this.userProgress.certificates = [];
        }
        if (typeof this.userProgress.coins === 'undefined') {
            this.userProgress.coins = 0;
            this.userProgress.totalCoinsEarned = 0;
        }

        this.initialized = true;
    }

    /**
     * Register a course
     * @param {Object} course - Course data object
     */
    registerCourse(course) {
        if (!course.id) {
            console.error('[CourseManager] Course must have an id');
            return;
        }

        this.courses.set(course.id, course);
        console.log(`[CourseManager] Registered course: ${course.id}`);

        // Auto-unlock first course if no courses are unlocked
        const unlockedCourses = this.getUnlockedCourses();
        if (unlockedCourses.length === 0 && this.courses.size === 1) {
            this.unlockCourse(course.id);
        }

        this.checkAndUnlockCourses();
    }

    /**
     * Get course by ID
     * @param {string} courseId - Course identifier
     * @returns {Object|null}
     */
    getCourse(courseId) {
        return this.courses.get(courseId) || null;
    }

    /**
     * Get all courses
     * @returns {Array<Object>}
     */
    getAllCourses() {
        return Array.from(this.courses.values());
    }

    /**
     * Get unlocked courses
     * @returns {Array<Object>}
     */
    getUnlockedCourses() {
        return this.getAllCourses().filter(course =>
            this.isCourseUnlocked(course.id)
        );
    }

    /**
     * Check if course is unlocked
     * @param {string} courseId
     * @returns {boolean}
     */
    isCourseUnlocked(courseId) {
        return this.userProgress.courses[courseId]?.unlocked || false;
    }

    /**
     * Check whether a course's unlock requirement is satisfied.
     * @param {Object} course
     * @returns {boolean}
     */
    meetsCourseUnlockRequirement(course) {
        if (!course?.unlockRequirement) return true;

        const { course: requiredCourseId, completionPercentage = 100 } = course.unlockRequirement;
        if (!requiredCourseId) return true;

        return this.getCourseProgress(requiredCourseId) >= completionPercentage;
    }

    /**
     * Get a readable unlock requirement string for the UI.
     * @param {Object|string} courseOrId
     * @returns {string}
     */
    getCourseUnlockRequirementText(courseOrId) {
        const course = typeof courseOrId === 'string' ? this.getCourse(courseOrId) : courseOrId;
        if (!course?.unlockRequirement) return '';

        const { course: requiredCourseId, completionPercentage = 100 } = course.unlockRequirement;
        const requiredCourse = this.getCourse(requiredCourseId);
        const requiredName = requiredCourse?.nameHebrew || requiredCourse?.name || requiredCourseId;

        return `נפתח אחרי ${completionPercentage}% ב-${requiredName}`;
    }

    /**
     * Unlock any courses whose requirements are now satisfied.
     * @returns {string[]} Newly unlocked course ids
     */
    checkAndUnlockCourses() {
        const newlyUnlocked = [];

        this.getAllCourses().forEach(course => {
            if (this.isCourseUnlocked(course.id)) return;
            if (!this.meetsCourseUnlockRequirement(course)) return;

            this.unlockCourse(course.id);
            newlyUnlocked.push(course.id);
        });

        return newlyUnlocked;
    }

    /**
     * Unlock a course
     * @param {string} courseId
     */
    unlockCourse(courseId) {
        if (!this.userProgress.courses[courseId]) {
            this.userProgress.courses[courseId] = {
                unlocked: true,
                startedDate: new Date().toISOString().split('T')[0],
                currentUnit: null,
                currentTopic: null
            };
        } else {
            this.userProgress.courses[courseId].unlocked = true;
        }

        // Unlock first topic in first unit
        const course = this.getCourse(courseId);
        if (course && course.units && course.units.length > 0) {
            const firstUnit = course.units[0];
            if (firstUnit.topics && firstUnit.topics.length > 0) {
                const firstTopic = firstUnit.topics[0];
                this.unlockTopic(firstTopic.id);
                this.userProgress.courses[courseId].currentUnit = firstUnit.id;
                this.userProgress.courses[courseId].currentTopic = firstTopic.id;
            }
        }

        this.saveProgress();
    }

    /**
     * Get course progress percentage
     * @param {string} courseId
     * @returns {number} 0-100
     */
    getCourseProgress(courseId) {
        const course = this.getCourse(courseId);
        if (!course || !course.units) return 0;

        let totalTopics = 0;
        let completedTopics = 0;

        course.units.forEach(unit => {
            if (unit.topics) {
                unit.topics.forEach(topic => {
                    totalTopics++;
                    if (this.isTopicCompleted(topic.id)) {
                        completedTopics++;
                    }
                });
            }
        });

        return totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    }

    /**
     * Get topic by ID (searches all courses)
     * @param {string} topicId
     * @returns {Object|null} {topic, unit, course}
     */
    getTopic(topicId) {
        for (const course of this.courses.values()) {
            if (!course.units) continue;

            for (const unit of course.units) {
                if (!unit.topics) continue;

                const topic = unit.topics.find(t => t.id === topicId);
                if (topic) {
                    return { topic, unit, course };
                }
            }
        }
        return null;
    }

    /**
     * Check if topic is unlocked
     * @param {string} topicId
     * @returns {boolean}
     */
    isTopicUnlocked(topicId) {
        const progress = this.userProgress.topicProgress[topicId];
        return progress?.unlocked || false;
    }

    /**
     * Check if topic is completed
     * @param {string} topicId
     * @returns {boolean}
     */
    isTopicCompleted(topicId) {
        const progress = this.userProgress.topicProgress[topicId];
        if (!progress) return false;

        const data = this.getTopic(topicId);
        if (!data) return false;

        const { topic } = data;

        // Topic is completed if all activities are done
        if (!topic.activities) return false;

        const completedActivities = progress.completedActivities || [];
        return topic.activities.every(activity =>
            completedActivities.includes(activity)
        );
    }

    /**
     * Unlock a topic
     * @param {string} topicId
     */
    unlockTopic(topicId) {
        if (!this.userProgress.topicProgress[topicId]) {
            this.userProgress.topicProgress[topicId] = {
                unlocked: true,
                started: false,
                mastery: 0,
                completedActivities: [],
                certificateEarned: false,
                completed: false
            };
        } else {
            this.userProgress.topicProgress[topicId].unlocked = true;
        }

        this.saveProgress();
    }

    /**
     * Start a topic (mark as started)
     * @param {string} topicId
     */
    startTopic(topicId) {
        if (!this.userProgress.topicProgress[topicId]) {
            this.unlockTopic(topicId);
        }
        this.userProgress.topicProgress[topicId].started = true;
        this.saveProgress();
    }

    /**
     * Complete an activity within a topic.
     * Only counted if the score meets the topic threshold.
     * @param {string} topicId
     * @param {string} activityType - e.g., 'vocabulary', 'listening'
     * @param {number} score - Score achieved (0-100)
     * @returns {Object|null}
     */
    completeActivity(topicId, activityType, score) {
        const data = this.getTopic(topicId);
        if (!data) return null;
        const { topic } = data;

        if (!(topic.activities || []).includes(activityType)) {
            return null;
        }

        if (!this.userProgress.topicProgress[topicId]) {
            this.unlockTopic(topicId);
        }

        const progress = this.userProgress.topicProgress[topicId];
        progress.started = true;

        const threshold = topic.milestone?.scoreThreshold ?? 70;
        if (score < threshold) {
            if (topic.words?.length) {
                progress.mastery = this.progressManager.calculateTopicMastery(topic.words);
            }
            this.saveProgress();
            return {
                topicId,
                topic,
                thresholdMet: false,
                threshold,
                activityCompletedNow: false,
                topicCompletedNow: false
            };
        }

        const wasActivityCompleted = (progress.completedActivities || []).includes(activityType);
        const wasTopicCompleted = this.isTopicCompleted(topicId);

        // Add to completed activities if not already there
        if (!progress.completedActivities) {
            progress.completedActivities = [];
        }
        if (!progress.completedActivities.includes(activityType)) {
            progress.completedActivities.push(activityType);
        }

        // Update mastery from word-level progress
        if (topic.words?.length) {
            progress.mastery = this.progressManager.calculateTopicMastery(topic.words);
        }

        // Check if topic is now completed
        const isNowCompleted = this.isTopicCompleted(topicId);
        progress.completed = isNowCompleted;

        if (isNowCompleted && !wasTopicCompleted) {
            this.onTopicCompleted(topicId);
        }

        this.saveProgress();

        return {
            topicId,
            topic,
            thresholdMet: true,
            threshold,
            activityCompletedNow: !wasActivityCompleted,
            topicCompletedNow: isNowCompleted && !wasTopicCompleted
        };
    }

    /**
     * Called when a topic is fully completed
     * @param {string} topicId
     */
    onTopicCompleted(topicId) {
        const data = this.getTopic(topicId);
        if (!data) return;

        const progress = this.userProgress.topicProgress[topicId];
        if (!progress) return;

        const { unit } = data;
        progress.completed = true;

        // Unlock next topic in sequence
        const currentTopicIndex = unit.topics.findIndex(t => t.id === topicId);
        if (currentTopicIndex !== -1 && currentTopicIndex < unit.topics.length - 1) {
            const nextTopic = unit.topics[currentTopicIndex + 1];
            this.unlockTopic(nextTopic.id);
        }

        this.checkAndUnlockCourses();
        this.saveProgress();
    }

    /**
     * Check if topic unlock requirements are met
     * @param {Object} topic
     * @returns {boolean}
     */
    checkUnlockRequirements(topic) {
        if (!topic.unlockRequirement) return true;

        const { topic: requiredTopicId, mastery: requiredMastery } = topic.unlockRequirement;
        const progress = this.userProgress.topicProgress[requiredTopicId];

        if (!progress) return false;
        return progress.mastery >= requiredMastery;
    }

    /**
     * Get next recommended topic
     * @returns {Object|null} {topic, unit, course}
     */
    getNextRecommendedActivity() {
        for (const course of this.getUnlockedCourses()) {
            if (!course.units) continue;

            for (const unit of course.units) {
                if (!unit.topics) continue;

                for (const topic of unit.topics) {
                    if (this.isTopicUnlocked(topic.id) && !this.isTopicCompleted(topic.id)) {
                        const completedActivities = this.userProgress.topicProgress[topic.id]?.completedActivities || [];
                        const activityType = (topic.activities || []).find(activity =>
                            !completedActivities.includes(activity)
                        ) || topic.activities?.[0];

                        return { topic, unit, course, activityType };
                    }
                }
            }
        }
        return null;
    }

    /**
     * Backward-compatible alias for older callers.
     * @returns {Object|null}
     */
    getNextRecommendedTopic() {
        return this.getNextRecommendedActivity();
    }

    /**
     * Try to infer which topic a free-play session belongs to based on the words used.
     * @param {string} activityType
     * @param {Array<{word: string, category?: string}>} sessionWords
     * @returns {Object|null}
     */
    inferTopicForActivity(activityType, sessionWords = []) {
        if (!activityType || !Array.isArray(sessionWords) || sessionWords.length === 0) {
            return null;
        }

        const bank = window.vocabularyBank || [];
        const sessionWordSet = new Set(sessionWords
            .map(entry => String(entry?.word || '').trim().toLowerCase())
            .filter(Boolean));

        if (sessionWordSet.size === 0) return null;

        let bestMatch = null;

        for (const course of this.getUnlockedCourses()) {
            for (const unit of (course.units || [])) {
                for (const topic of (unit.topics || [])) {
                    if (!this.isTopicUnlocked(topic.id)) continue;
                    if (!(topic.activities || []).includes(activityType)) continue;

                    const topicWords = (topic.words || [])
                        .map(word => bank.find(entry => entry.word.toLowerCase() === String(word).toLowerCase())?.word || word)
                        .map(word => String(word).toLowerCase());

                    if (topicWords.length === 0) continue;

                    const matchedCount = topicWords.filter(word => sessionWordSet.has(word)).length;
                    const coverage = matchedCount / topicWords.length;

                    if (matchedCount < 3 || coverage < 0.6) continue;

                    if (!bestMatch || matchedCount > bestMatch.matchedCount || coverage > bestMatch.coverage) {
                        bestMatch = {
                            topicId: topic.id,
                            topic,
                            unit,
                            course,
                            matchedCount,
                            coverage
                        };
                    }
                }
            }
        }

        return bestMatch;
    }

    /**
     * Mark a course activity complete from either course-launch or free-play.
     * @param {Object} params
     * @param {string} params.activityType
     * @param {number} params.score
     * @param {string} [params.topicId]
     * @param {Array<{word: string, category?: string}>} [params.sessionWords]
     * @returns {Object|null}
     */
    completeGameActivity({ topicId = null, activityType, score = 0, sessionWords = [] } = {}) {
        if (!activityType) return null;

        let resolvedTopicId = topicId;
        let topicData = resolvedTopicId ? this.getTopic(resolvedTopicId) : null;

        if (!topicData || !(topicData.topic.activities || []).includes(activityType)) {
            const inferred = this.inferTopicForActivity(activityType, sessionWords);
            if (!inferred) return null;
            resolvedTopicId = inferred.topicId;
            topicData = inferred;
        }

        const result = this.completeActivity(resolvedTopicId, activityType, score);
        if (!result) return null;

        const progress = this.userProgress.topicProgress[resolvedTopicId] || {};
        const newlyUnlockedCourses = this.checkAndUnlockCourses();

        return {
            ...result,
            topicId: resolvedTopicId,
            topic: topicData.topic,
            unit: topicData.unit,
            course: topicData.course,
            certificateEarned: Boolean(progress.certificateEarned),
            newlyUnlockedCourses
        };
    }

    /**
     * Get all topics for a unit
     * @param {string} courseId
     * @param {string} unitId
     * @returns {Array<Object>}
     */
    getUnitTopics(courseId, unitId) {
        const course = this.getCourse(courseId);
        if (!course || !course.units) return [];

        const unit = course.units.find(u => u.id === unitId);
        return unit?.topics || [];
    }

    /**
     * Get topic mastery percentage
     * @param {string} topicId
     * @returns {number} 0-100
     */
    getTopicMastery(topicId) {
        const progress = this.userProgress.topicProgress[topicId];
        return progress ? Math.round(progress.mastery * 100) : 0;
    }

    /**
     * Save progress to localStorage
     */
    saveProgress() {
        try {
            if (window.app?.saveUserProgress) {
                window.app.saveUserProgress();
            } else {
                const userId = localStorage.getItem('currentUser') || 'O';
                localStorage.setItem(`userProgress_${userId}`, JSON.stringify(this.userProgress));
            }
        } catch (error) {
            console.error('[CourseManager] Error saving progress:', error);
        }
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        let totalTopics = 0;
        let completedTopics = 0;
        let unlockedTopics = 0;

        this.getAllCourses().forEach(course => {
            if (!course.units) return;
            course.units.forEach(unit => {
                if (!unit.topics) return;
                unit.topics.forEach(topic => {
                    totalTopics++;
                    if (this.isTopicUnlocked(topic.id)) unlockedTopics++;
                    if (this.isTopicCompleted(topic.id)) completedTopics++;
                });
            });
        });

        return {
            totalCourses: this.courses.size,
            unlockedCourses: this.getUnlockedCourses().length,
            totalTopics,
            unlockedTopics,
            completedTopics,
            certificatesEarned: this.userProgress.certificates.length
        };
    }
}
