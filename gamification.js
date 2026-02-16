// Gamification Manager for English Learning Games
// Handles progress indicators, mascot, achievements, streaks, and collections

class GamificationManager {
    constructor() {
        this.mascot = null;
        this.streak = null;
        this.collection = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        this.mascot = new MascotManager();
        this.streak = new StreakManager();
        this.collection = new CollectionManager();

        // Initialize all components
        this.mascot.init();
        this.streak.init();

        // Update all game card progress indicators
        this.updateAllGameCards();

        this.initialized = true;
        console.log('✅ Gamification Manager initialized');
    }

    updateAllGameCards() {
        const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading', 'practice', 'abc'];
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

        // Update progress ring
        const ring = card.querySelector('.progress-ring-fill');
        if (ring) {
            const circumference = 2 * Math.PI * 26;
            const offset = circumference - (stats.averageMastery * circumference);
            ring.style.strokeDashoffset = offset;
        }

        // Update percentage text
        const percentageEl = card.querySelector('.progress-percentage');
        if (percentageEl) {
            percentageEl.textContent = `${Math.round(stats.averageMastery * 100)}%`;
        }

        // Update stats badges
        const masteredEl = card.querySelector('.stat-mastered');
        const learningEl = card.querySelector('.stat-learning');
        const strugglingEl = card.querySelector('.stat-struggling');

        if (masteredEl) masteredEl.textContent = `${stats.masteredWords} 🌟`;
        if (learningEl) learningEl.textContent = `${stats.learningWords} 📚`;
        if (strugglingEl) strugglingEl.textContent = `${stats.strugglingWords} ⚠️`;
    }

    getGameMasteryStats(gameType) {
        const wordMastery = window.app.userProgress.wordMastery || {};
        const settings = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
        const selectedCategories = settings.selectedCategories || [];

        let totalWords = 0;
        let masteredWords = 0;
        let learningWords = 0;
        let strugglingWords = 0;
        let newWords = 0;
        let totalMastery = 0;

        // Get all words from vocabulary data
        const allWords = window.vocabularyBank || [];

        allWords.forEach(wordObj => {
            // Skip if word's category is not selected
            if (!selectedCategories.includes(wordObj.category)) return;

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
        if (!window.app || !window.app.userProgress) return;

        const wordMastery = window.app.userProgress.wordMastery || {};
        const settings = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
        const selectedCategories = settings.selectedCategories || [];
        let strugglingCount = 0;

        // Use the SAME logic as generatePracticeWords() in gameLogic.js
        // Get vocabulary data (same source as practice mode uses)
        const allWords = window.vocabularyBank || [];

        // Filter by selected categories (same as gameLogic.loadGameData does)
        const filteredWords = selectedCategories.length > 0
            ? allWords.filter(word => selectedCategories.includes(word.category))
            : allWords;

        // Count struggling words (same criteria as generatePracticeWords)
        filteredWords.forEach(word => {
            const key = `${word.word}_${word.category}`;
            const stats = wordMastery[key];
            const hasAttempts = stats && stats.totalAttempts > 0;
            const isStruggling = stats && stats.masteryLevel < 0.5;
            if (hasAttempts && isStruggling) {
                strugglingCount++;
            }
        });

        console.log(`📊 [PRACTICE] Counted ${strugglingCount} struggling words from ${filteredWords.length} filtered words (${selectedCategories.length} categories selected)`);

        // Store struggling count for click handler access
        this.practiceWordCount = strugglingCount;

        // Update practice button in top nav - only show when there are words to practice
        const practiceNavBtn = document.querySelector('.top-game-btn[data-game="practice"]');
        if (practiceNavBtn) {
            if (strugglingCount === 0) {
                // Hide practice button when no words to practice
                practiceNavBtn.style.display = 'none';
                practiceNavBtn.classList.remove('has-words');
            } else {
                // Show practice button with badge
                practiceNavBtn.style.display = '';
                practiceNavBtn.classList.add('has-words');

                // Update badge with count
                const badge = practiceNavBtn.querySelector('.practice-badge');
                if (badge) {
                    badge.textContent = strugglingCount;
                }
            }
        }
    }

    getPracticeWordCount() {
        return this.practiceWordCount || 0;
    }
}

// Mascot Manager
class MascotManager {
    constructor() {
        this.messages = {
            welcome: [
                "מוכן למשחק? בוא נתחיל! 💪",
                "יאללה, בוא נלמד אנגלית ביחד! 🦉",
                "בואו נתחיל! 🎉"
            ],
            firstCorrect: [
                "כל הכבוד! תשובה ראשונה נכונה! ⭐",
                "יופי! התחלה מעולה! 🌟"
            ],
            streak3: [
                "וואו! 3 תשובות נכונות ברצף! 🔥",
                "אתה בוער! המשך ככה! 💪"
            ],
            streak5: [
                "5 ברצף! פשוט מדהים! 🎉",
                "חמש נכונות! אתה אלוף! 👑"
            ],
            mastered: [
                "כל הכבוד! שלטת במילה הזאת! 👑",
                "מצוין! המילה הזאת שלך! ⭐"
            ],
            struggled: [
                "זה בסדר, נמשיך לתרגל! 💪",
                "אל תוותר! אתה יכול! 🌟"
            ],
            gameComplete: [
                "סיימת! עבודה נהדרת! 🎊",
                "משחק מעולה! גאה בך! 🌟"
            ]
        };
        this.container = null;
        this.bubble = null;
        this.isVisible = false;
    }

    init() {
        // Mascot will be added to DOM when needed
        this.createMascotElement();
    }

    createMascotElement() {
        if (document.getElementById('mascot-container')) return;

        const container = document.createElement('div');
        container.className = 'mascot-container';
        container.id = 'mascot-container';
        container.innerHTML = `
            <div class="mascot-character" id="mascot-character">
                <span class="mascot-emoji">🦉</span>
            </div>
            <div class="mascot-speech-bubble" id="mascot-speech-bubble" style="display: none;">
                <div class="mascot-message"></div>
                <button class="mascot-close">✕</button>
            </div>
        `;

        document.body.appendChild(container);
        this.container = container;
        this.bubble = container.querySelector('.mascot-speech-bubble');

        // Add click handler for close button
        container.querySelector('.mascot-close').addEventListener('click', () => {
            this.hideMessage();
        });

        // Add click handler for mascot to show random encouragement
        container.querySelector('.mascot-character').addEventListener('click', () => {
            this.showMessage('welcome');
        });
    }

    showMessage(type, customMessage = null) {
        if (!this.bubble) this.createMascotElement();

        const message = customMessage || this.getRandomMessage(type);
        this.bubble.querySelector('.mascot-message').textContent = message;
        this.bubble.style.display = 'block';
        this.isVisible = true;

        // Auto-hide after 5 seconds
        setTimeout(() => this.hideMessage(), 5000);
    }

    hideMessage() {
        if (this.bubble) {
            this.bubble.style.display = 'none';
            this.isVisible = false;
        }
    }

    getRandomMessage(type) {
        const messages = this.messages[type] || this.messages.welcome;
        return messages[Math.floor(Math.random() * messages.length)];
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

        // Mascot message
        if (window.gamificationManager?.mascot) {
            window.gamificationManager.mascot.showMessage('streak', `${days} ימים ברצף! אתה בוער! 🔥`);
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

        return allWords
            .filter(word => selectedCategories.includes(word.category))
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
