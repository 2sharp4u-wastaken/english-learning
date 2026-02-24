// Memory/Matching Game Module
// Classic card-matching game for vocabulary practice

export class MemoryGame {
    constructor(gameManager, scoreManager, progressManager) {
        this.gameManager = gameManager;
        this.scoreManager = scoreManager;
        this.progressManager = progressManager;

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.moves = 0;
        this.startTime = null;
        this.isProcessing = false;
        this.gameWords = [];
        this.sourceWords = [];
        this.requestedPairCount = 6;
        this.awaitingFinish = false;
        this.levelConfigs = [
            { level: 1, pairs: 6, columns: 4 },
            { level: 2, pairs: 9, columns: 6 },
            { level: 3, pairs: 12, columns: 8 }
        ];
        this.currentLevelIndex = 0;
        this.totalSessionScore = 0;
        this.totalSessionCoins = 0;
        this.currentGridColumns = 4;

        console.log('[MemoryGame] Initialized');
    }

    /**
     * Initialize and start a new memory game
     * @param {Array} words - Array of word objects with {word, translation, image}
     * @param {number} pairCount - Preferred start difficulty (maps to level 1/2/3)
     */
    async startGame(words, pairCount = 6) {
        console.log(`[MemoryGame] Starting memory session (requested pairs: ${pairCount})`);
        this.removeCompletionScreen();
        this.hideFeedback();

        // Normalize full source bank (same bank passed from gameManager)
        this.sourceWords = (Array.isArray(words) ? words : [])
            .map((wordObj, index) => this.normalizeWordObject(wordObj, index))
            .filter(wordObj => wordObj && wordObj.word)
            .filter(wordObj => wordObj.word !== '—');

        if (this.sourceWords.length === 0) {
            console.warn('[MemoryGame] No valid words available for memory game');
            const feedback = document.getElementById('memory-feedback');
            if (feedback) {
                feedback.textContent = 'אין כרגע מילים תקינות למשחק הזיכרון';
                feedback.className = 'feedback';
                feedback.style.display = 'block';
            }
            return;
        }

        const requestedLevelConfig = this.getLevelConfigForRequestedPairs(pairCount);
        this.currentLevelIndex = requestedLevelConfig.level - 1;
        this.requestedPairCount = requestedLevelConfig.pairs;
        this.totalSessionScore = 0;
        this.totalSessionCoins = 0;

        this.startLevel(this.currentLevelIndex);
    }

    startLevel(levelIndex) {
        const levelConfig = this.levelConfigs[levelIndex];
        if (!levelConfig) {
            console.error(`[MemoryGame] Invalid level index: ${levelIndex}`);
            return;
        }

        this.currentLevelIndex = levelIndex;
        this.currentGridColumns = levelConfig.columns;

        const pairsToUse = Math.min(levelConfig.pairs, Math.floor(this.sourceWords.length));
        const shuffled = [...this.sourceWords].sort(() => Math.random() - 0.5);
        this.gameWords = shuffled.slice(0, pairsToUse);
        this.totalPairs = this.gameWords.length;
        if (this.totalPairs === 0) return;

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.startTime = Date.now();
        this.isProcessing = false;
        this.awaitingFinish = false;

        this.createCardPairs();
        this.renderGameBoard();
        this.updateStats();
        this.setFinishButtonVisible(false);
    }

    /**
     * Create pairs of cards (word card + translation card)
     */
    createCardPairs() {
        this.cards = [];

        this.gameWords.forEach((wordObj, index) => {
            // Card 1: English word
            this.cards.push({
                id: `word-${index}`,
                pairId: index,
                type: 'word',
                content: wordObj.word,
                wordObj: wordObj,
                isFlipped: false,
                isMatched: false
            });

            // Card 2: Translation (or visual fallback)
            this.cards.push({
                id: `translation-${index}`,
                pairId: index,
                type: 'translation',
                content: wordObj.translation,
                wordObj: wordObj,
                isFlipped: false,
                isMatched: false
            });
        });

        // Shuffle cards
        this.cards = this.cards.sort(() => Math.random() - 0.5);
    }

    /**
     * Render the game board with cards
     */
    renderGameBoard() {
        const container = document.getElementById('memory-game-container');
        const grid = document.getElementById('memory-grid');

        if (!container || !grid) {
            console.error('[MemoryGame] Required elements not found');
            return;
        }

        // Clear existing grid
        grid.innerHTML = '';

        // Keep memory board at 3 rows and increase columns by level difficulty.
        const cardsCount = this.cards.length;
        const columnsByCards = Math.max(4, Math.ceil(cardsCount / 3));
        const columns = Math.max(this.currentGridColumns || 4, columnsByCards);
        grid.style.gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
        grid.style.gridTemplateColumns = `repeat(${columns}, minmax(82px, 1fr))`;

        // Create card elements
        this.cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            grid.appendChild(cardElement);
        });

        // Show the game container
        container.style.display = 'block';
    }

    /**
     * Create a single card element
     */
    createCardElement(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'memory-card';
        cardDiv.dataset.index = index;

        // Card inner (for flip animation)
        const cardInner = document.createElement('div');
        cardInner.className = 'memory-card-inner';

        // Card front (back side - hidden initially)
        const cardFront = document.createElement('div');
        cardFront.className = 'memory-card-front';

        const safeContent = String(card.content || '—');
        cardFront.textContent = safeContent;
        cardFront.style.fontSize = safeContent.length > 10 ? '0.85em' : '1em';
        if (card.type === 'translation') {
            cardFront.classList.add('memory-card-translation');
        }

        // Card back (card back design)
        const cardBack = document.createElement('div');
        cardBack.className = 'memory-card-back';
        cardBack.innerHTML = '<div class="card-pattern">?</div>';

        cardInner.appendChild(cardBack);
        cardInner.appendChild(cardFront);
        cardDiv.appendChild(cardInner);

        // Add click handler
        cardDiv.addEventListener('click', () => this.handleCardClick(index));

        return cardDiv;
    }

    /**
     * Handle card click
     */
    async handleCardClick(index) {
        // Prevent interactions during processing
        if (this.isProcessing) return;

        const card = this.cards[index];

        // Ignore if already flipped or matched
        if (card.isFlipped || card.isMatched) return;

        // Flip the card
        this.flipCard(index, true);
        this.playFlipSound();
        this.playRevealAudio(card);
        this.flippedCards.push(index);

        // Check if two cards are flipped
        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            this.moves++;
            this.updateStats();

            // Check for match after a short delay
            setTimeout(() => {
                this.checkForMatch();
            }, 800);
        }
    }

    /**
     * Flip a card
     */
    flipCard(index, flipped) {
        const card = this.cards[index];
        card.isFlipped = flipped;

        const cardElement = document.querySelector(`[data-index="${index}"]`);
        if (cardElement) {
            if (flipped) {
                cardElement.classList.add('flipped');
            } else {
                cardElement.classList.remove('flipped');
            }
        }
    }

    /**
     * Check if flipped cards match
     */
    async checkForMatch() {
        const [index1, index2] = this.flippedCards;
        const card1 = this.cards[index1];
        const card2 = this.cards[index2];

        if (card1.pairId === card2.pairId) {
            // Match found!
            this.handleMatch(index1, index2, card1);
        } else {
            // No match - flip cards back
            this.handleMismatch(index1, index2);
        }
    }

    /**
     * Handle successful match
     */
    async handleMatch(index1, index2, card) {
        console.log('[MemoryGame] Match found!', card.wordObj.word);

        // Mark cards as matched
        this.cards[index1].isMatched = true;
        this.cards[index2].isMatched = true;

        // Add matched class for animation
        const cardElement1 = document.querySelector(`[data-index="${index1}"]`);
        const cardElement2 = document.querySelector(`[data-index="${index2}"]`);

        if (cardElement1) cardElement1.classList.add('matched');
        if (cardElement2) cardElement2.classList.add('matched');
        const matchedPairId = card?.pairId ?? this.cards[index1]?.pairId ?? 0;
        this.applyMatchedPairGradient(cardElement1, matchedPairId);
        this.applyMatchedPairGradient(cardElement2, matchedPairId);

        // Increment matched pairs and reset flip state
        this.matchedPairs++;
        this.flippedCards = [];
        // Release processing lock BEFORE awaiting speech — prevents permanent board lock
        // if speech synthesis hangs (known Chrome bug)
        this.isProcessing = false;
        this.updateStats();

        // Play success sound
        this.playMatchSound();

        // Record progress
        if (this.progressManager) {
            this.progressManager.recordWordAttempt(card.wordObj.word, true);
        }
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(true);
        }

        // Check if game is complete
        if (this.matchedPairs === this.totalPairs) {
            this.awaitingFinish = true;
            this.setFinishButtonVisible(true);
        }
    }

    /**
     * Handle mismatch
     */
    handleMismatch(index1, index2) {
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(false);
        }

        // Flip cards back after delay
        setTimeout(() => {
            this.flipCard(index1, false);
            this.flipCard(index2, false);

            // Reset flipped cards
            this.flippedCards = [];
            this.isProcessing = false;
        }, 1000);
    }

    /**
     * Handle game completion
     */
    handleGameComplete() {
        const levelConfig = this.levelConfigs[this.currentLevelIndex];
        const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const metrics = this.calculateLevelPerformance(this.moves, timeElapsed, levelConfig);
        const evaluation = this.evaluateAdvancement(metrics);
        const levelCoins = this.awardLevelRewards(metrics, levelConfig);

        this.totalSessionScore += metrics.score;
        this.totalSessionCoins += levelCoins;

        console.log(`[MemoryGame] Level ${levelConfig.level} complete. Score: ${metrics.score}, stars: ${metrics.stars}`);

        if (this.scoreManager) {
            this.scoreManager.addPoints('memory', metrics.score);
        }

        const hasNextLevel = this.currentLevelIndex < this.levelConfigs.length - 1;
        const shouldGoToNext = hasNextLevel && evaluation.canAdvance;

        if (shouldGoToNext) {
            this.showLevelTransitionMessage(metrics, levelConfig, levelCoins);
            return;
        }

        if (hasNextLevel && !evaluation.canAdvance) {
            this.showRetryLevelMessage(metrics, levelConfig, evaluation, levelCoins);
            return;
        }

        this.showCompletionMessage(metrics, levelConfig, levelCoins);
        this.playCelebrationSound();
    }

    /**
     * Calculate level performance based on moves, time, and difficulty.
     */
    calculateLevelPerformance(moves, timeSeconds, levelConfig) {
        const perfectMoves = Math.max(1, this.totalPairs);
        const accuracy = Math.min(1, perfectMoves / Math.max(moves, perfectMoves));
        const mistakes = Math.max(0, moves - perfectMoves);
        const speedTargetSeconds = this.totalPairs * 8;
        const levelBase = 30 + (levelConfig.level * 10);
        const accuracyScore = Math.round(accuracy * 55);
        const speedScore = Math.max(0, Math.round((speedTargetSeconds - timeSeconds) * 0.7));
        const mistakePenalty = mistakes * (levelConfig.level * 2);
        const score = Math.max(15, Math.min(140, levelBase + accuracyScore + speedScore - mistakePenalty));
        const starCount = mistakes === 0
            ? 3
            : mistakes <= Math.floor(this.totalPairs * 0.4)
                ? 2
                : 1;

        return {
            score,
            accuracy,
            mistakes,
            speedTargetSeconds,
            stars: starCount
        };
    }

    evaluateAdvancement(metrics) {
        const requiredStars = 2;
        return {
            stars: metrics.stars,
            canAdvance: metrics.stars >= requiredStars,
            requiredStars
        };
    }

    awardLevelRewards(metrics, levelConfig) {
        let coins = 10 + (levelConfig.level * 6);
        if (metrics.stars === 3) coins += 10;
        else if (metrics.stars === 2) coins += 6;
        if (metrics.mistakes === 0) coins += 6;
        if (metrics.accuracy >= 0.7) coins += 6;
        if (metrics.mistakes <= 2) coins += 4;

        if (window.coinManager?.awardCoins) {
            window.coinManager.awardCoins(coins, `memory level ${levelConfig.level}`);
        }

        return coins;
    }

    /**
     * Update game stats display
     */
    updateStats() {
        const movesElement = document.getElementById('memory-moves');
        const pairsElement = document.getElementById('memory-pairs');
        const currentProgressElement = document.getElementById('memory-current-q');
        const totalProgressElement = document.getElementById('memory-total-q');
        const progressFillElement = document.getElementById('memory-progress-fill');
        const levelElement = document.getElementById('memory-level');

        if (movesElement) {
            movesElement.textContent = this.moves;
        }

        if (pairsElement) {
            pairsElement.textContent = `${this.matchedPairs} מתוך ${this.totalPairs}`;
        }

        if (currentProgressElement) currentProgressElement.textContent = this.matchedPairs;
        if (totalProgressElement) totalProgressElement.textContent = this.totalPairs;
        if (levelElement) levelElement.textContent = `${this.currentLevelIndex + 1}/${this.levelConfigs.length}`;

        if (progressFillElement) {
            const progress = this.totalPairs > 0 ? (this.matchedPairs / this.totalPairs) * 100 : 0;
            progressFillElement.style.width = `${progress}%`;
        }
    }

    /**
     * Show completion message
     */
    showLevelTransitionMessage(metrics, levelConfig, levelCoins) {
        const nextLevelNumber = levelConfig.level + 1;
        const starLine = this.renderStars(metrics.stars);

        this.hideBoardForSummary();
        const completionDiv = this.buildSummaryCard(`
            <div class="completion-content">
                <h2><i class="fas fa-arrow-up"></i> מעולה! עוברים לרמה ${nextLevelNumber}</h2>
                <p>${starLine} ביצועים</p>
                <div class="score-display">
                    <div class="score-circle">
                        <span class="score-number">${metrics.score}</span>
                        <span class="score-label">ניקוד רמה ${levelConfig.level}</span>
                    </div>
                    <div class="score-details">
                        <p>${this.moves} מהלכים · ${Math.floor((Date.now() - this.startTime) / 1000)} שניות</p>
                        <p>תגמול: +${levelCoins} מטבעות</p>
                    </div>
                </div>
                <div class="completion-actions">
                    <button class="restart-game-btn js-next-level">
                        <i class="fas fa-forward"></i> לרמה הבאה
                    </button>
                    <button class="choose-game-btn js-restart-memory">
                        <i class="fas fa-redo"></i> התחל מהתחלה
                    </button>
                </div>
            </div>
        `);

        completionDiv.querySelector('.js-next-level').addEventListener('click', () => {
            completionDiv.remove();
            this.startLevel(this.currentLevelIndex + 1);
        });
        completionDiv.querySelector('.js-restart-memory').addEventListener('click', () => this.playAgain());
    }

    showRetryLevelMessage(metrics, levelConfig, evaluation, levelCoins) {
        const starLine = this.renderStars(metrics.stars);
        const requiredStarLine = this.renderStars(evaluation.requiredStars);

        this.hideBoardForSummary();
        const completionDiv = this.buildSummaryCard(`
            <div class="completion-content">
                <h2><i class="fas fa-rotate"></i> רמה ${levelConfig.level} הושלמה</h2>
                <p>${starLine} — צריך לפחות ${requiredStarLine} כדי לעבור לרמה הבאה.</p>
                <div class="score-display">
                    <div class="score-circle">
                        <span class="score-number">${metrics.score}</span>
                        <span class="score-label">ניקוד רמה ${levelConfig.level}</span>
                    </div>
                    <div class="score-details">
                        <p>תגמול: +${levelCoins} מטבעות</p>
                    </div>
                </div>
                <div class="completion-actions">
                    <button class="restart-game-btn js-retry-level">
                        <i class="fas fa-redo"></i> נסה שוב רמה ${levelConfig.level}
                    </button>
                    <button class="choose-game-btn js-home-memory">
                        <i class="fas fa-home"></i> בחר משחק אחר
                    </button>
                </div>
            </div>
        `);

        completionDiv.querySelector('.js-retry-level').addEventListener('click', () => {
            completionDiv.remove();
            this.startLevel(this.currentLevelIndex);
        });
        completionDiv.querySelector('.js-home-memory').addEventListener('click', () => window.location.replace('index.html'));
    }

    showCompletionMessage(metrics, levelConfig, levelCoins) {
        const stars = this.renderStars(metrics.stars);

        // Hide game UI elements
        this.hideBoardForSummary();

        const completionDiv = this.buildSummaryCard(`
            <div class="completion-content">
                <h2><i class="fas fa-trophy"></i> משחק הושלם!</h2>
                <div class="completion-stars">${stars}</div>
                <div class="score-display">
                    <div class="score-circle">
                        <span class="score-number">${this.totalSessionScore}</span>
                        <span class="score-label">ניקוד כולל</span>
                    </div>
                    <div class="score-details">
                        <p>רמה ${levelConfig.level}: ${this.moves} מהלכים · ${Math.floor((Date.now() - this.startTime) / 1000)} שניות</p>
                        <p>ניקוד רמה: ${metrics.score}</p>
                        <p>תגמול רמה: +${levelCoins} מטבעות</p>
                        <p>סה״כ תגמול בסשן: +${this.totalSessionCoins} מטבעות</p>
                    </div>
                </div>
                <div class="completion-actions">
                    <button class="restart-game-btn">
                        <i class="fas fa-redo"></i> שחק שוב
                    </button>
                    <button class="choose-game-btn">
                        <i class="fas fa-home"></i> בחר משחק אחר
                    </button>
                </div>
            </div>
        `);

        // Wire buttons
        completionDiv.querySelector('.restart-game-btn').addEventListener('click', () => this.playAgain());
        completionDiv.querySelector('.choose-game-btn').addEventListener('click', () => window.location.replace('index.html'));

        // Victory audio and confetti (3 stars = perfect performance)
        try { window.audioEffects?.playVictory(); } catch (e) {}
        if (metrics.stars === 3 && typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
    }

    hideBoardForSummary() {
        const gameContainer = document.getElementById('memory-game-container');
        if (gameContainer) gameContainer.style.display = 'none';
        this.setFinishButtonVisible(false);
        this.hideFeedback();
    }

    buildSummaryCard(innerHtml) {
        this.removeCompletionScreen();
        const gameEl = document.getElementById('memory-game');
        const completionDiv = document.createElement('div');
        completionDiv.className = 'game-complete';
        completionDiv.innerHTML = innerHtml;
        if (gameEl) gameEl.appendChild(completionDiv);
        return completionDiv;
    }

    removeCompletionScreen() {
        const gameEl = document.getElementById('memory-game');
        const completionDiv = gameEl?.querySelector('.game-complete');
        if (completionDiv) completionDiv.remove();
    }

    hideFeedback() {
        const feedback = document.getElementById('memory-feedback');
        if (feedback) feedback.style.display = 'none';
    }

    renderStars(count) {
        const clamped = Math.max(1, Math.min(3, Math.floor(count || 0)));
        return '⭐'.repeat(clamped);
    }

    /**
     * Reset and play again
     */
    playAgain() {
        this.startGame(this.sourceWords, this.requestedPairCount);
    }

    setFinishButtonVisible(visible) {
        const finishBtn = document.getElementById('memory-finish-btn');
        if (!finishBtn) return;

        if (!finishBtn.dataset.bound) {
            finishBtn.addEventListener('click', () => {
                if (!this.awaitingFinish) return;
                this.awaitingFinish = false;
                this.handleGameComplete();
            });
            finishBtn.dataset.bound = 'true';
        }

        finishBtn.style.display = visible ? 'inline-flex' : 'none';
    }

    getLevelConfigForRequestedPairs(pairCount) {
        if (typeof pairCount !== 'number') return this.levelConfigs[0];

        const closest = this.levelConfigs.reduce((best, cfg) => {
            return Math.abs(cfg.pairs - pairCount) < Math.abs(best.pairs - pairCount) ? cfg : best;
        }, this.levelConfigs[0]);

        return closest;
    }

    applyMatchedPairGradient(cardElement, pairId) {
        if (!cardElement) return;
        const front = cardElement.querySelector('.memory-card-front');
        if (!front) return;

        const palette = [
            ['#11998e', '#38ef7d'],
            ['#3b82f6', '#22d3ee'],
            ['#8b5cf6', '#ec4899'],
            ['#f59e0b', '#f97316'],
            ['#ef4444', '#f43f5e'],
            ['#14b8a6', '#84cc16'],
            ['#6366f1', '#06b6d4'],
            ['#a855f7', '#f43f5e']
        ];

        const [start, end] = palette[Math.abs(pairId) % palette.length];
        front.style.setProperty('--match-grad-start', start);
        front.style.setProperty('--match-grad-end', end);
    }

    /**
     * Speak a word using speech synthesis
     */
    async speakWord(word) {
        if (typeof speechManager !== 'undefined') {
            await speechManager.speakWord(word, '', 'memory', true);
        }
    }

    /**
     * Normalize a raw word object into memory-safe fields.
     */
    normalizeWordObject(wordObj, index) {
        if (!wordObj || typeof wordObj !== 'object') return null;

        const normalizedWord = this.normalizeText(
            wordObj.word || wordObj.english || wordObj.term || wordObj.label || wordObj.text
        );

        const normalizedTranslation = this.normalizeText(
            wordObj.translation || wordObj.hebrew || wordObj.meaning || wordObj.native
        );

        const normalizedVisual = this.normalizeText(
            wordObj.image || wordObj.picture || wordObj.icon || wordObj.emoji
        );

        const safeWord = normalizedWord || `Word ${index + 1}`;
        const safeTranslation = normalizedTranslation || normalizedVisual || safeWord;

        return {
            ...wordObj,
            word: safeWord,
            translation: safeTranslation
        };
    }

    normalizeText(value) {
        if (typeof value !== 'string') return '';
        return value.trim();
    }

    playRevealAudio(card) {
        if (!card?.wordObj) return;

        const englishWord = card.wordObj.word;
        const hebrewWord = card.wordObj.translation || card.wordObj.hebrew;

        const speakPromise = card.type === 'translation'
            ? this.speakHebrewWord(hebrewWord)
            : this.speakWord(englishWord);

        speakPromise.catch(error => {
            console.warn('[MemoryGame] Reveal audio failed, continuing text-only mode:', error);
        });
    }

    async speakHebrewWord(word) {
        if (!word) return;

        if (typeof speechManager !== 'undefined' && typeof speechManager.speakHebrew === 'function') {
            await speechManager.speakHebrew(word, { allowOverlap: true });
        }
    }

    /**
     * Play flip sound
     */
    playFlipSound() {
        // Play a subtle flip sound
        if (typeof window.audioManager !== 'undefined') {
            window.audioManager.playEffect('flip');
        } else {
            // Fallback: play a beep
            this.playTone(440, 0.05, 0.1);
        }
    }

    /**
     * Play match sound
     */
    playMatchSound() {
        if (typeof window.audioManager !== 'undefined') {
            window.audioManager.playEffect('correct');
        } else {
            // Fallback: play success tones
            this.playTone(523, 0.1, 0.15);
            setTimeout(() => this.playTone(659, 0.1, 0.15), 100);
        }
    }

    /**
     * Play celebration sound
     */
    playCelebrationSound() {
        if (typeof window.audioManager !== 'undefined') {
            window.audioManager.playEffect('celebration');
        } else {
            // Fallback: play celebration melody
            const notes = [523, 587, 659, 784];
            notes.forEach((freq, i) => {
                setTimeout(() => this.playTone(freq, 0.15, 0.2), i * 100);
            });
        }
    }

    /**
     * Play a simple tone (fallback audio)
     */
    playTone(frequency, duration, volume = 0.1) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            gainNode.gain.value = volume;

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.warn('[MemoryGame] Audio playback failed:', e);
        }
    }

    /**
     * Clean up and hide game
     */
    cleanup() {
        const container = document.getElementById('memory-game-container');
        if (container) {
            container.style.display = 'none';
        }

        // Reset state
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.moves = 0;
        this.isProcessing = false;
        this.gameWords = [];
        this.sourceWords = [];
        this.requestedPairCount = 6;
        this.awaitingFinish = false;
        this.currentLevelIndex = 0;
        this.totalSessionScore = 0;
        this.totalSessionCoins = 0;
        this.currentGridColumns = 4;
        this.setFinishButtonVisible(false);
        this.removeCompletionScreen();
        this.hideFeedback();
    }
}

// Export a singleton instance factory
export function createMemoryGame(gameManager, scoreManager, progressManager) {
    return new MemoryGame(gameManager, scoreManager, progressManager);
}
