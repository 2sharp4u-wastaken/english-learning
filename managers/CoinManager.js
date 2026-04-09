/**
 * CoinManager.js
 * Manages coins/points economy, rewards, and animations
 */

export class CoinManager {
    constructor(userProgress) {
        this.userProgress = userProgress;
        this.initialized = false;

        // Reward values (can be configured)
        this.rewards = {
            correctAnswer: 10,
            correctAnswerRetry: 5,
            perfectAnswer: 15,
            completeActivity: 20,
            completeTopic: 50,
            completeUnit: 100,
            dailyLogin: 10,
            streakBonus: 50,      // 7-day streak
            perfectGame: 30,      // 100% score
            firstTry: 5,          // Bonus for first-try correct
            speedBonus: 10,       // Fast correct answer
            comboBonus: 20        // 5 correct in a row
        };

        this.animationQueue = [];
        this.isAnimating = false;
    }

    /**
     * Initialize coin system
     */
    initialize() {
        if (this.initialized) return;

        // Ensure userProgress has coin fields
        if (typeof this.userProgress.coins === 'undefined') {
            this.userProgress.coins = 0;
        }
        if (typeof this.userProgress.totalCoinsEarned === 'undefined') {
            this.userProgress.totalCoinsEarned = 0;
        }
        if (!this.userProgress.coinHistory) {
            this.userProgress.coinHistory = [];
        }

        // Check daily login bonus
        this.checkDailyBonus();

        // Always sync the display with the current balance
        this.updateCoinDisplay();

        this.initialized = true;
    }

    /**
     * Award coins with reason
     * @param {number} amount - Coin amount
     * @param {string} reason - Reason for award
     * @param {boolean} showAnimation - Show visual feedback
     * @returns {number} New balance
     */
    awardCoins(amount, reason = 'reward', showAnimation = true) {
        if (amount <= 0) return this.userProgress.coins;

        // Update balance
        this.userProgress.coins += amount;
        this.userProgress.totalCoinsEarned += amount;

        // Record in history
        const gameType = window.gameManager?.currentGame || null;
        this.userProgress.coinHistory.push({
            amount,
            reason,
            gameType,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            balance: this.userProgress.coins
        });

        // Keep only last 100 entries
        if (this.userProgress.coinHistory.length > 100) {
            this.userProgress.coinHistory = this.userProgress.coinHistory.slice(-100);
        }

        // Update UI
        this.updateCoinDisplay();

        // Show animation
        if (showAnimation) {
            this.showCoinAnimation(amount, reason);
        }

        this.saveProgress();

        console.log(`[CoinManager] Awarded ${amount} coins for: ${reason}. New balance: ${this.userProgress.coins}`);
        return this.userProgress.coins;
    }

    /**
     * Spend coins (for future shop features)
     * @param {number} amount - Coins to spend
     * @param {string} reason - What was purchased
     * @returns {boolean} Success
     */
    spendCoins(amount, reason = 'purchase') {
        if (amount <= 0) return false;
        if (this.userProgress.coins < amount) {
            console.warn('[CoinManager] Insufficient coins');
            return false;
        }

        this.userProgress.coins -= amount;

        // Record in history
        this.userProgress.coinHistory.push({
            amount: -amount,
            reason,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            balance: this.userProgress.coins
        });

        this.updateCoinDisplay();
        this.saveProgress();

        console.log(`[CoinManager] Spent ${amount} coins on: ${reason}. New balance: ${this.userProgress.coins}`);
        return true;
    }

    /**
     * Get current coin balance
     * @returns {number}
     */
    getBalance() {
        return this.userProgress.coins || 0;
    }

    /**
     * Get total coins ever earned
     * @returns {number}
     */
    getTotalEarned() {
        return this.userProgress.totalCoinsEarned || 0;
    }

    /**
     * Update coin display in UI
     */
    updateCoinDisplay() {
        const balance = this.userProgress.coins;
        // Target all known coin display elements by ID
        ['hub-coin-balance', 'topics-coin-balance', 'profile-coin-count', 'user-coins', 'header-coin-count'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = balance;
        });
        // Legacy class-based selectors
        document.querySelectorAll('.coin-balance, .coins-display span').forEach(el => {
            el.textContent = balance;
        });
    }

    /**
     * Show coin animation
     * @param {number} amount - Coin amount
     * @param {string} reason - Reason text
     */
    showCoinAnimation(amount, reason) {
        // Add to queue
        this.animationQueue.push({ amount, reason });

        // Process queue if not already animating
        if (!this.isAnimating) {
            this.processAnimationQueue();
        }
    }

    /**
     * Process animation queue
     */
    async processAnimationQueue() {
        if (this.animationQueue.length === 0) {
            this.isAnimating = false;
            return;
        }

        this.isAnimating = true;
        const { amount, reason } = this.animationQueue.shift();

        // Create floating coin animation
        const coinEl = document.createElement('div');
        coinEl.className = 'coin-animation';
        coinEl.innerHTML = `
            <div class="coin-float">
                <span class="coin-icon">💰</span>
                <span class="coin-amount">+${amount}</span>
            </div>
        `;

        // Position near top-right where coin balance is usually displayed
        coinEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            animation: coinFloat 1.5s ease-out;
            pointer-events: none;
        `;

        document.body.appendChild(coinEl);

        // Play coin sound
        this.playCoinSound();

        // Remove after animation
        setTimeout(() => {
            coinEl.remove();
            this.processAnimationQueue();
        }, 1500);
    }

    /**
     * Play coin collection sound
     */
    playCoinSound() {
        if (!window.AudioContext && !window.webkitAudioContext) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Coin sound: quick ascending tone
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            // Silently fail if audio context is not available
        }
    }

    /**
     * Award coins for correct answer
     * @param {boolean} isFirstTry - Was it correct on first try
     * @param {boolean} isFast - Was answer given quickly
     * @returns {number} Coins awarded
     */
    awardCorrectAnswer(isFirstTry = true, isFast = false) {
        let amount = isFirstTry ? this.rewards.correctAnswer : this.rewards.correctAnswerRetry;

        if (isFirstTry && isFast) {
            amount += this.rewards.speedBonus;
        }

        this.awardCoins(amount, 'correct answer');
        return amount;
    }

    /**
     * Award coins for perfect answer (pronunciation, etc.)
     * @returns {number} Coins awarded
     */
    awardPerfectAnswer() {
        this.awardCoins(this.rewards.perfectAnswer, 'perfect answer');
        return this.rewards.perfectAnswer;
    }

    /**
     * Award coins for completing activity
     * @returns {number} Coins awarded
     */
    awardActivityComplete() {
        this.awardCoins(this.rewards.completeActivity, 'activity complete');
        return this.rewards.completeActivity;
    }

    /**
     * Award coins for completing topic
     * @returns {number} Coins awarded
     */
    awardTopicComplete() {
        this.awardCoins(this.rewards.completeTopic, 'topic complete');
        return this.rewards.completeTopic;
    }

    /**
     * Award coins for perfect game (100% score)
     * @returns {number} Coins awarded
     */
    awardPerfectGame() {
        this.awardCoins(this.rewards.perfectGame, 'perfect game');
        return this.rewards.perfectGame;
    }

    /**
     * Award streak bonus
     * @param {number} streakDays
     * @returns {number} Coins awarded
     */
    awardStreakBonus(streakDays) {
        const amount = Math.floor(streakDays / 7) * this.rewards.streakBonus;
        if (amount > 0) {
            this.awardCoins(amount, `${streakDays}-day streak`);
        }
        return amount;
    }

    /**
     * Check and award daily login bonus
     */
    checkDailyBonus() {
        const today = new Date().toISOString().split('T')[0];
        const lastLogin = this.userProgress.lastLoginDate;

        if (lastLogin !== today) {
            this.userProgress.lastLoginDate = today;

            // Award daily bonus
            this.awardCoins(this.rewards.dailyLogin, 'daily login', false);

            // Update streak
            this.updateStreak(lastLogin, today);

            this.saveProgress();
        }
    }

    /**
     * Update login streak
     * @param {string} lastLogin - Last login date (YYYY-MM-DD)
     * @param {string} today - Today's date (YYYY-MM-DD)
     */
    updateStreak(lastLogin, today) {
        if (!lastLogin) {
            this.userProgress.streakDays = 1;
            return;
        }

        const lastDate = new Date(lastLogin);
        const currentDate = new Date(today);
        const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === 1) {
            // Consecutive day
            this.userProgress.streakDays = (this.userProgress.streakDays || 0) + 1;

            // Award streak bonus at 7-day intervals
            if (this.userProgress.streakDays % 7 === 0) {
                this.awardStreakBonus(this.userProgress.streakDays);
            }
        } else if (dayDiff > 1) {
            // Streak broken
            this.userProgress.streakDays = 1;
        }
    }

    /**
     * Get coin history
     * @param {number} limit - Number of recent entries
     * @returns {Array<Object>}
     */
    getHistory(limit = 20) {
        return this.userProgress.coinHistory.slice(-limit).reverse();
    }

    /**
     * Get coins earned today
     * @returns {number}
     */
    getCoinsEarnedToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.userProgress.coinHistory
            .filter(entry => entry.date === today && entry.amount > 0)
            .reduce((sum, entry) => sum + entry.amount, 0);
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            currentBalance: this.getBalance(),
            totalEarned: this.getTotalEarned(),
            earnedToday: this.getCoinsEarnedToday(),
            streak: this.userProgress.streakDays || 0,
            historyLength: this.userProgress.coinHistory.length
        };
    }

    /**
     * Save progress
     */
    saveProgress() {
        try {
            if (window.app?.saveUserProgress) {
                window.app.saveUserProgress();
            } else {
                // Fallback: save to the user-suffixed key using currentUser
                const userId = localStorage.getItem('currentUser') || 'O';
                localStorage.setItem(`userProgress_${userId}`, JSON.stringify(this.userProgress));
            }
        } catch (error) {
            console.error('[CoinManager] Error saving progress:', error);
        }
    }

    /**
     * Reset coins (for testing)
     */
    reset() {
        this.userProgress.coins = 0;
        this.userProgress.totalCoinsEarned = 0;
        this.userProgress.coinHistory = [];
        this.updateCoinDisplay();
        this.saveProgress();
    }
}
