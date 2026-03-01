// Gamification Manager for English Learning Games
// Handles progress indicators, achievements, streaks, and collections

class GamificationManager {
    constructor() {
        this.streak = null;
        this.collection = null;
        this.initialized = false;
        this.practiceRefreshRetryTimer = null;
    }

    init() {
        if (this.initialized) return;

        this.streak = new StreakManager();
        this.collection = new CollectionManager();

        // Initialize all components
        this.streak.init();

        // Update all game card progress indicators
        this.updateAllGameCards();

        // Re-check practice badge shortly after init to handle script load-order races.
        setTimeout(() => this.updatePracticeModeCard(), 1200);

        this.initialized = true;
        console.log('✅ Gamification Manager initialized');
    }

    getFallbackPracticeWords() {
        const settings = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
        const selectedCategories = settings.selectedCategories || [];
        const difficulty = settings.difficulty || 'beginner';
        const wordMastery = window.app?.userProgress?.wordMastery || {};

        const baseVocabulary = (typeof gameData !== 'undefined' && gameData?.vocabulary)
            ? gameData.vocabulary
            : (window.vocabularyBank || []);

        let filteredVocabulary = baseVocabulary;
        if (selectedCategories.length > 0) {
            filteredVocabulary = baseVocabulary.filter(item => selectedCategories.includes(item.category));
        }

        if (difficulty === 'beginner') {
            filteredVocabulary = filteredVocabulary.filter(item => !item.word || item.word.length <= 6);
        } else if (difficulty === 'intermediate') {
            filteredVocabulary = filteredVocabulary.filter(item => !item.word || item.word.length <= 9);
        }

        // Keep behavior aligned with gameLogic fallback.
        if (filteredVocabulary.length < 20) {
            filteredVocabulary = baseVocabulary;
        }

        return filteredVocabulary
            .filter(word => {
                const key = `${word.word}_${word.category}`;
                const stats = wordMastery[key];
                return !!(stats && stats.totalAttempts > 0 && stats.masteryLevel < 0.5);
            })
            .sort((a, b) => {
                const statsA = wordMastery[`${a.word}_${a.category}`];
                const statsB = wordMastery[`${b.word}_${b.category}`];
                const accuracyA = statsA && statsA.totalAttempts > 0 ? statsA.correctAttempts / statsA.totalAttempts : 0;
                const accuracyB = statsB && statsB.totalAttempts > 0 ? statsB.correctAttempts / statsB.totalAttempts : 0;
                return accuracyA - accuracyB;
            });
    }

    updateAllGameCards() {
        const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading', 'memory', 'practice', 'abc'];
        gameTypes.forEach(gameType => {
            if (gameType === 'practice') {
                this.updatePracticeModeCard();
            } else {
                this.updateGameCardProgress(gameType);
            }
        });
    }

    updateGameCardProgress(gameType) {
        if (!window.app || !window.app.userProgress) return;

        const stats = this.getGameMasteryStats(gameType);
        const card = document.querySelector(`.game-card[data-game="${gameType}"]`);
        if (!card) return;

        // Update stats badges
        const masteredEl = card.querySelector('.stat-mastered');
        const learningEl = card.querySelector('.stat-learning');
        const strugglingEl = card.querySelector('.stat-struggling');

        if (masteredEl) masteredEl.textContent = `${stats.masteredWords} 🌟`;
        if (learningEl) learningEl.textContent = `${stats.learningWords} 📚`;
        if (strugglingEl) strugglingEl.textContent = `${stats.strugglingWords} ⚠️`;
    }

    getGameMasteryStats(gameType) {
        if (!window.app || !window.app.userProgress) {
            return {
                totalWords: 0,
                masteredWords: 0,
                learningWords: 0,
                strugglingWords: 0,
                newWords: 0,
                averageMastery: 0
            };
        }

        const wordMastery = window.app.userProgress.wordMastery || {};
        const settings = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
        const selectedCategories = settings.selectedCategories || [];
        const hasCategoryFilter = Array.isArray(selectedCategories) && selectedCategories.length > 0;

        let totalWords = 0;
        let masteredWords = 0;
        let learningWords = 0;
        let strugglingWords = 0;
        let newWords = 0;
        let totalMastery = 0;

        // Get all words from vocabulary data
        const allWords = window.vocabularyBank || [];

        allWords.forEach(wordObj => {
            // If specific categories are selected, skip words outside them.
            if (hasCategoryFilter && !selectedCategories.includes(wordObj.category)) return;

            const key = `${wordObj.word}_${wordObj.category}`;
            const stats = wordMastery[key];

            if (stats && stats.masteryLevel !== undefined) {
                totalWords++;
                totalMastery += stats.masteryLevel;

                if (stats.masteryLevel >= 0.8) {
                    masteredWords++;
                } else if (stats.masteryLevel >= 0.5) {
                    learningWords++;
                } else if (stats.masteryLevel > 0) {
                    strugglingWords++;
                } else {
                    newWords++;
                }
            } else {
                newWords++;
                totalWords++;
            }
        });

        const averageMastery = totalWords > 0 ? totalMastery / totalWords : 0;

        return {
            totalWords,
            masteredWords,
            learningWords,
            strugglingWords,
            newWords,
            averageMastery
        };
    }

    updatePracticeModeCard() {
        let strugglingCount = 0;

        if (window.gameManager?.getPracticeWords) {
            const practiceWords = window.gameManager.getPracticeWords({ refreshData: true });
            strugglingCount = practiceWords.length;
        } else {
            const practiceWords = this.getFallbackPracticeWords();
            strugglingCount = practiceWords.length;

            // Retry once gameManager likely finishes initializing.
            if (!this.practiceRefreshRetryTimer) {
                this.practiceRefreshRetryTimer = setTimeout(() => {
                    this.practiceRefreshRetryTimer = null;
                    this.updatePracticeModeCard();
                }, 1000);
            }
        }

        // Store struggling count for click handler access
        this.practiceWordCount = strugglingCount;

        // Keep practice button visible on home as a stable entry point.
        // Only badge/highlight depend on the current count.
        const practiceNavBtn = document.querySelector('.top-game-btn[data-game="practice"]');
        if (practiceNavBtn) {
            practiceNavBtn.style.display = '';
            const badge = practiceNavBtn.querySelector('.practice-badge');

            if (strugglingCount > 0) {
                practiceNavBtn.classList.add('has-words');
                if (badge) badge.textContent = strugglingCount;
            } else {
                practiceNavBtn.classList.remove('has-words');
                if (badge) badge.textContent = '';
            }
        }
    }

    getPracticeWordCount(refresh = false) {
        if (refresh) {
            if (window.gameManager?.getPracticeWords) {
                this.practiceWordCount = window.gameManager.getPracticeWords({ refreshData: true }).length;
            } else {
                this.practiceWordCount = this.getFallbackPracticeWords().length;
            }
        }
        return this.practiceWordCount || 0;
    }
}

// Streak Manager
class StreakManager {
    constructor() {
        this.widget = null;
    }

    init() {
        this.updateStreakDisplay();
    }

    updateStreakDisplay() {
        const count = window.app?.userProgress?.streakDays || 0;
        const widget = document.getElementById('streak-count');

        if (widget) {
            widget.textContent = count;

            // Check for milestones
            this.checkMilestone(count);
        }
    }

    checkMilestone(days) {
        const milestones = [7, 14, 30, 60, 100];
        if (milestones.includes(days)) {
            this.celebrateStreak(days);
        }
    }

    celebrateStreak(days) {
        // Confetti celebration
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#ff6600', '#ffaa00', '#ffd700']
            });
        }

        // Non-blocking morale feedback
        if (window.gameManager?.showToast) {
            window.gameManager.showToast(`${days} ימים ברצף! אתה בוער! 🔥`, 'fa-fire', '#f59e0b');
        }

        // Play sound
        if (window.audioEffects) {
            window.audioEffects.playLevelUp();
        }
    }
}

// Collection Manager
class CollectionManager {
    constructor() {
        this.modal = null;
    }

    showCollection(gameType = null) {
        const words = this.getWordsForCollection(gameType);
        const modal = this.getOrCreateModal();
        const grid = modal.querySelector('.collection-grid');

        // Update stats
        const stats = this.calculateStats(words);
        modal.querySelector('#collection-total').textContent = stats.total;
        modal.querySelector('#collection-mastered').textContent = stats.mastered;

        // Update title
        const gameName = this.getGameName(gameType);
        modal.querySelector('.collection-title').textContent = gameType ?
            `אוסף מילים - ${gameName}` : 'אוסף המילים שלי';

        // Clear and populate grid
        grid.innerHTML = '';
        words.forEach(wordData => {
            const card = this.createWordCard(wordData);
            grid.appendChild(card);
        });

        modal.style.display = 'flex';
    }

    getOrCreateModal() {
        let modal = document.getElementById('collection-modal');
        if (modal) return modal;

        // Create modal
        modal = document.createElement('div');
        modal.className = 'collection-modal';
        modal.id = 'collection-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="collection-modal-content">
                <div class="collection-header">
                    <h2 class="collection-title">אוסף המילים שלי</h2>
                    <button class="collection-close-btn">✕</button>
                </div>
                <div class="collection-stats">
                    <div class="stat-box">
                        <div class="stat-number" id="collection-total">0</div>
                        <div class="stat-label">סך הכל</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number" id="collection-mastered">0</div>
                        <div class="stat-label">שולטים</div>
                    </div>
                </div>
                <div class="collection-grid" id="collection-grid"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add close handlers
        modal.querySelector('.collection-close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        return modal;
    }

    createWordCard(wordData) {
        const card = document.createElement('div');
        const masteryLevel = wordData.masteryLevel || 0;
        const masteryClass = this.getMasteryClass(masteryLevel);
        const masteryPercent = Math.round(masteryLevel * 100);

        card.className = `collection-word-card mastery-level-${masteryClass}`;
        card.innerHTML = `
            <div class="word-icon">${wordData.picture || wordData.image || '📝'}</div>
            <div class="word-english">${wordData.word}</div>
            <div class="word-hebrew">${wordData.translation || wordData.hebrewTranslation || ''}</div>
            <div class="word-mastery-bar">
                <div class="mastery-bar-fill" style="width: ${masteryPercent}%"></div>
            </div>
            <div class="word-stats">
                <span>✓ ${wordData.correctAttempts || 0}</span>
                <span>✗ ${(wordData.totalAttempts - wordData.correctAttempts) || 0}</span>
            </div>
        `;

        // Click to hear pronunciation
        card.addEventListener('click', () => {
            if (window.speechManager) {
                window.speechManager.speakWord(wordData.word, '', 'collection');
            }
        });

        return card;
    }

    getWordsForCollection(gameType) {
        const allWords = window.vocabularyBank || [];
        const masteryData = window.app?.userProgress?.wordMastery || {};
        const settings = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
        const selectedCategories = settings.selectedCategories || [];
        const hasCategoryFilter = Array.isArray(selectedCategories) && selectedCategories.length > 0;

        return allWords
            .filter(word => !hasCategoryFilter || selectedCategories.includes(word.category))
            .map(word => {
                const key = `${word.word}_${word.category}`;
                return {
                    ...word,
                    ...(masteryData[key] || {
                        totalAttempts: 0,
                        correctAttempts: 0,
                        masteryLevel: 0
                    })
                };
            })
            .sort((a, b) => (b.masteryLevel || 0) - (a.masteryLevel || 0));
    }

    calculateStats(words) {
        const total = words.length;
        const mastered = words.filter(w => (w.masteryLevel || 0) >= 0.8).length;
        return { total, mastered };
    }

    getMasteryClass(level) {
        if (level >= 0.8) return 'mastered';
        if (level >= 0.5) return 'learning';
        if (level > 0) return 'struggling';
        return 'new';
    }

    getGameName(gameType) {
        const names = {
            vocabulary: 'אוצר מילים',
            grammar: 'דקדוק',
            pronunciation: 'הגייה',
            listening: 'הקשבה',
            reading: 'קריאה'
        };
        return names[gameType] || 'כל המשחקים';
    }
}

// Initialize gamification manager globally
window.gamificationManager = new GamificationManager();
