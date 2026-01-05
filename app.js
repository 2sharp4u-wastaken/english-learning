// Main Application File - English Learning Games

class AppManager {
    constructor() {
        // Wait for auth to be ready before initializing
        this.currentUser = null;
        this.userProgress = null;
        this.settings = this.loadSettings();
        this.achievements = [];

        this.initializeApp();
    }

    initializeApp() {
        // Check if authService is ready
        if (typeof authService !== 'undefined') {
            this.setupWithAuth();
        } else {
            // Fallback if auth.js not loaded (shouldn't happen)
            console.warn('Auth service not found, using legacy mode');
            this.setupLegacyMode();
        }

        this.setupGlobalEventListeners();
        this.checkBrowserCompatibility();
        // this.displayWelcomeMessage(); // Disabled - user prefers login selection modal
        this.loadAchievements();
        this.updatePracticeModeIndicator();
        this.filterDisabledGames();

        // Wire language toggle if present
        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.addEventListener('click', () => {
                if (typeof gameManager !== 'undefined' && gameManager?.toggleLanguage) {
                    gameManager.toggleLanguage();
                }
            });
        }
    }

    setupWithAuth() {
        // Get current authenticated user
        const userId = authService.getCurrentUserId();

        if (userId) {
            this.currentUser = userId;
            this.userProgress = this.loadUserProgress();
            console.log(`App initialized for user: ${userId}`);
        } else {
            console.log('No authenticated user, waiting for login');
            // User will login, then we'll reload
        }
    }

    setupLegacyMode() {
        // Old user selector logic (fallback)
        this.setupUserSelector();
    }

    updatePracticeModeIndicator() {
        const badge = document.getElementById('practice-badge');
        if (badge && typeof SettingsManager !== 'undefined' && SettingsManager.isPracticeMode()) {
            badge.style.display = 'inline-block';
        }
    }

    filterDisabledGames() {
        const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
        if (!settings || !settings.enabledGames) return;

        // Hide game buttons for disabled games
        Object.keys(settings.enabledGames).forEach(gameType => {
            if (!settings.enabledGames[gameType]) {
                const gameBtn = document.querySelector(`.game-btn[data-game="${gameType}"]`);
                if (gameBtn) {
                    gameBtn.style.display = 'none';
                }
            }
        });
    }

    setupUserSelector() {
        // Load saved user or default to 'O'
        this.currentUser = localStorage.getItem('currentUser') || 'O';

        // Set active state on load
        const userButtons = document.querySelectorAll('.user-btn');
        userButtons.forEach(btn => {
            if (btn.dataset.user === this.currentUser) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            // Add click listener
            btn.addEventListener('click', (e) => {
                const selectedUser = e.currentTarget.dataset.user;
                this.switchUser(selectedUser);
            });
        });

        console.log(`Current user: ${this.currentUser}`);
    }

    switchUser(userName) {
        this.currentUser = userName;
        localStorage.setItem('currentUser', userName);

        // Update UI
        document.querySelectorAll('.user-btn').forEach(btn => {
            if (btn.dataset.user === userName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reload user progress
        this.userProgress = this.loadUserProgress();

        console.log(`Switched to user: ${userName}`);

        // Show a nice notification
        this.showUserSwitchNotification(userName);
    }

    showUserSwitchNotification(userName) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 50%;
            transform: translateX(50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 1.2rem;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            z-index: 10000;
            animation: slideDown 0.5s ease, fadeOut 0.5s ease 2.5s;
        `;
        notification.textContent = `שלום ${userName}! 👋`;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    setupGlobalEventListeners() {
        // Hamburger menu removed - sidebar always visible on mobile via CSS

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const isSpace = e.code === 'Space' || e.key === ' ';
            const tag = (e.target.tagName || '').toUpperCase();
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
            if (isSpace && !isTyping) {
                e.preventDefault();
                this.handleSpacebarPress();
            }
            if (e.key === 'Enter' && e.target.classList.contains('option-btn')) {
                e.preventDefault();
                e.target.click();
            }
        });

        // Prevent context menu on game elements for better mobile experience
        document.querySelectorAll('.game-area').forEach(area => {
            area.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        // Handle visibility change (pause when tab is not active)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            } else {
                this.resumeGame();
            }
        });
    }

    handleSpacebarPress() {
        const currentGame = gameManager.currentGame;
        const byGame = {
            vocabulary: '#vocab-audio',
            grammar: '',
            pronunciation: '#pronunciation-listen',
            listening: '#listening-audio',
            reading: '#reading-audio',
        };
        const selector = byGame[currentGame];
        if (!selector) return;
        const audioBtn = document.querySelector(selector);
        if (audioBtn && audioBtn.style.display !== 'none') audioBtn.click();
    }

    checkBrowserCompatibility() {
        const warnings = [];
        
        if (!speechManager.isSpeechSynthesisSupported()) {
            warnings.push('Speech synthesis not supported - audio features will be limited');
        }
        
        if (!speechManager.isSpeechRecognitionSupported()) {
            warnings.push('Speech recognition not supported - pronunciation practice will be limited');
        }
        
        if (warnings.length > 0) {
            this.showCompatibilityWarning(warnings);
        }
    }

    showCompatibilityWarning(warnings) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'compatibility-warning';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <h4>⚠️ Browser Compatibility Notice</h4>
                <ul>
                    ${warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
                <p>For the best experience, use Chrome, Firefox, or Safari.</p>
                <button onclick="this.parentElement.parentElement.remove()">Got it</button>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
            }
        }, 10000);
    }

    displayWelcomeMessage() {
        // Show welcome message for first-time users
        // Skip if user not authenticated yet
        if (!this.userProgress) {
            console.log('No user progress yet, skipping welcome message');
            return;
        }

        if (!this.userProgress.hasPlayedBefore) {
            this.showWelcomeModal();
            this.userProgress.hasPlayedBefore = true;
            this.saveUserProgress();
        }
    }

    showWelcomeModal() {
        const modal = document.createElement('div');
        modal.className = 'welcome-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🎉 Welcome to English Learning Games!</h2>
                <div class="welcome-text">
                    <p><strong>English:</strong> Practice vocabulary, grammar, and pronunciation with fun interactive games!</p>
                    <p><strong>עברית:</strong> תרגלו אוצר מילים, דקדוק והגייה עם משחקים אינטראקטיביים מהנים!</p>
                </div>
                <div class="game-tips">
                    <h3>Tips for Success:</h3>
                    <ul>
                        <li>🎧 Use headphones for better audio experience</li>
                        <li>🎤 Allow microphone access for pronunciation practice</li>
                        <li>⌨️ Press SPACE to replay audio</li>
                        <li>🔄 Switch between English/Hebrew interface anytime</li>
                    </ul>
                </div>
                <button class="start-btn" onclick="appManager.closeWelcomeModal()">
                    Let's Start Learning! / בואו נתחיל ללמוד!
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    closeWelcomeModal() {
        const modal = document.querySelector('.welcome-modal');
        if (modal) {
            modal.remove();
        }
    }

    pauseGame() {
        if (speechManager.isRecording) {
            speechManager.stopRecording();
        }
        speechManager.synthesis.cancel();
    }

    resumeGame() {
        // Game will resume naturally when user interacts
    }

    loadUserProgress() {
        // Get current user from auth service if available
        let userId = this.currentUser;

        if (typeof authService !== 'undefined' && !userId) {
            userId = authService.getCurrentUserId();
        }

        // Fallback to old format or 'O'
        if (!userId) {
            userId = localStorage.getItem('currentUser') || 'O';
        }

        const storageKey = `userProgress_${userId}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const progress = JSON.parse(saved);
                return this.migrateUserProgress(progress);
            } catch (error) {
                console.error('Error loading user progress:', error);
                return this.getDefaultProgress();
            }
        }
        return this.getDefaultProgress();
    }

    migrateUserProgress(oldProgress) {
        // Migrate from version 1 (or unversioned) to version 2
        if (oldProgress.version === 2) {
            return oldProgress;  // Already migrated
        }

        console.log('Migrating user progress from v1 to v2...');

        // Add new fields while preserving existing data
        const migratedProgress = {
            ...oldProgress,
            wordMastery: oldProgress.wordMastery || {},
            version: 2
        };

        return migratedProgress;
    }

    getDefaultProgress() {
        return {
            hasPlayedBefore: false,
            totalGamesPlayed: 0,
            bestScores: {
                vocabulary: 0,
                grammar: 0,
                pronunciation: 0,
                listening: 0,
                reading: 0
            },
            streakDays: 0,
            lastPlayDate: null,
            totalCorrectAnswers: 0,
            preferredDifficulty: 'beginner',
            wordMastery: {},  // Track mastery per word: { "Dog": { totalAttempts, correctAttempts, ... } }
            version: 2  // Data structure version for migrations
        };
    }

    saveUserProgress() {
        // Get current user from auth service if available
        let userId = this.currentUser;

        if (typeof authService !== 'undefined' && !userId) {
            userId = authService.getCurrentUserId();
        }

        // Fallback to old format or 'O'
        if (!userId) {
            userId = localStorage.getItem('currentUser') || 'O';
        }

        const storageKey = `userProgress_${userId}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.userProgress));
        } catch (error) {
            console.error('Error saving user progress:', error);
        }
    }

    getWordStats(word, category) {
        // Get statistics for a specific word
        if (!this.userProgress || !this.userProgress.wordMastery) {
            return null;
        }

        const wordKey = `${word}_${category}`;  // Use compound key to handle same word in different categories
        return this.userProgress.wordMastery[wordKey] || null;
    }

    saveWordStats(word, category, stats) {
        // Save statistics for a specific word
        if (!this.userProgress) {
            console.warn('Cannot save word stats: userProgress not initialized');
            return;
        }

        if (!this.userProgress.wordMastery) {
            this.userProgress.wordMastery = {};
        }

        const wordKey = `${word}_${category}`;
        this.userProgress.wordMastery[wordKey] = stats;

        // Save to localStorage immediately
        this.saveUserProgress();
    }

    calculateMastery(wordStats) {
        // Calculate mastery level (0-1) based on performance
        // Criteria: 3 attempts, 90% accuracy, 2 consecutive correct
        if (!wordStats || wordStats.totalAttempts === 0) {
            return 0;
        }

        const accuracy = wordStats.correctAttempts / wordStats.totalAttempts;
        const hasMinAttempts = wordStats.totalAttempts >= 3;
        const hasHighAccuracy = accuracy >= 0.90;
        const hasConsecutive = wordStats.consecutiveCorrect >= 2;

        // Mastery is a weighted combination
        let masteryLevel = accuracy;  // Base on accuracy

        // Bonus for meeting all criteria
        if (hasMinAttempts && hasHighAccuracy && hasConsecutive) {
            masteryLevel = Math.min(1.0, masteryLevel + 0.1);  // Cap at 1.0
        }

        return Math.round(masteryLevel * 100) / 100;  // Round to 2 decimals
    }

    loadSettings() {
        const saved = localStorage.getItem('englishLearningSettings');
        return saved ? JSON.parse(saved) : {
            soundEnabled: true,
            speechRate: 0.9,
            autoPlayAudio: true,
            showPhonetics: true,
            language: 'en'
        };
    }

    saveSettings() {
        localStorage.setItem('englishLearningSettings', JSON.stringify(this.settings));
    }

    updateProgress(gameType, score) {
        // Safety check - ensure userProgress exists
        if (!this.userProgress) {
            console.warn('Cannot update progress: userProgress not initialized');
            return;
        }

        this.userProgress.totalGamesPlayed++;

        if (score > this.userProgress.bestScores[gameType]) {
            this.userProgress.bestScores[gameType] = score;
            this.showAchievement(`New ${gameType} high score: ${score}!`);
        }

        // Update streak
        const today = new Date().toDateString();
        if (this.userProgress.lastPlayDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (this.userProgress.lastPlayDate === yesterday.toDateString()) {
                this.userProgress.streakDays++;
            } else {
                this.userProgress.streakDays = 1;
            }

            this.userProgress.lastPlayDate = today;
        }

        this.saveUserProgress();
        this.checkAchievements();
    }

    loadAchievements() {
        this.achievements = [
            {
                id: 'first_game',
                name: 'First Steps',
                description: 'Complete your first game',
                condition: () => this.userProgress.totalGamesPlayed >= 1,
                unlocked: false
            },
            {
                id: 'perfect_score',
                name: 'Perfect!',
                description: 'Get a perfect score in any game',
                condition: () => Object.values(this.userProgress.bestScores).some(score => score === 100),
                unlocked: false
            },
            {
                id: 'streak_week',
                name: 'Week Warrior',
                description: 'Play for 7 days in a row',
                condition: () => this.userProgress.streakDays >= 7,
                unlocked: false
            },
            {
                id: 'vocabulary_master',
                name: 'Vocabulary Master',
                description: 'Score 80+ in vocabulary game',
                condition: () => this.userProgress.bestScores.vocabulary >= 80,
                unlocked: false
            },
            {
                id: 'grammar_guru',
                name: 'Grammar Guru',
                description: 'Score 80+ in grammar game',
                condition: () => this.userProgress.bestScores.grammar >= 80,
                unlocked: false
            }
        ];
    }

    checkAchievements() {
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.condition()) {
                achievement.unlocked = true;
                this.showAchievement(`🏆 Achievement Unlocked: ${achievement.name}!`);
            }
        });
    }

    showAchievement(message) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Adaptive difficulty based on performance
    getAdaptiveDifficulty(gameType) {
        const recentScores = this.getRecentScores(gameType);
        const averageScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        
        if (averageScore >= 80) return 'advanced';
        if (averageScore >= 60) return 'intermediate';
        return 'beginner';
    }

    getRecentScores(gameType) {
        // This would be implemented with more detailed score tracking
        return [this.userProgress.bestScores[gameType]];
    }

    // Export progress for sharing or backup
    exportProgress() {
        const data = {
            progress: this.userProgress,
            settings: this.settings,
            achievements: this.achievements.filter(a => a.unlocked),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'english-learning-progress.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize app manager
let appManager;
document.addEventListener('DOMContentLoaded', () => {
    appManager = new AppManager();
    // Make it accessible as window.app for gameLogic.js
    window.app = appManager;

    // Initialize gamification features after a short delay to ensure all data is loaded
    setTimeout(() => {
        if (window.gamificationManager) {
            window.gamificationManager.init();
        }
    }, 500);
});
