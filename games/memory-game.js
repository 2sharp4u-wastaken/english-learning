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

        console.log('[MemoryGame] Initialized');
    }

    /**
     * Initialize and start a new memory game
     * @param {Array} words - Array of word objects with {word, translation, image}
     * @param {number} pairCount - Number of pairs (6, 8, or 10)
     */
    async startGame(words, pairCount = 6) {
        console.log(`[MemoryGame] Starting game with ${pairCount} pairs`);

        // Validate pair count
        if (![6, 8, 10, 12].includes(pairCount)) {
            console.error('[MemoryGame] Invalid pair count. Using default of 6.');
            pairCount = 6;
        }

        // Select random words for the game
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        this.gameWords = shuffled.slice(0, pairCount);
        this.totalPairs = pairCount;

        // Reset game state
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.startTime = Date.now();
        this.isProcessing = false;

        // Create card pairs (English word + image/translation)
        this.createCardPairs();

        // Render the game board
        this.renderGameBoard();

        // Update UI
        this.updateStats();
    }

    /**
     * Create pairs of cards (word card + image card)
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

            // Card 2: Image/emoji
            this.cards.push({
                id: `image-${index}`,
                pairId: index,
                type: 'image',
                content: wordObj.image || '🎯',
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

        // Set grid columns based on pair count
        const columns = this.totalPairs <= 6 ? 3 : this.totalPairs <= 8 ? 4 : 5;
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

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

        if (card.type === 'word') {
            cardFront.textContent = card.content;
            cardFront.style.fontSize = card.content.length > 8 ? '1.2em' : '1.5em';
        } else {
            // Image card
            cardFront.innerHTML = `<div class="memory-card-image">${card.content}</div>`;
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
        this.flippedCards.push(index);

        // Play flip sound
        this.playFlipSound();

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

        // Play success sound and speak word
        this.playMatchSound();
        await this.speakWord(card.wordObj.word);

        // Increment matched pairs
        this.matchedPairs++;
        this.updateStats();

        // Record progress
        if (this.progressManager) {
            this.progressManager.recordWordAttempt(card.wordObj.word, true);
        }

        // Check if game is complete
        if (this.matchedPairs === this.totalPairs) {
            setTimeout(() => {
                this.handleGameComplete();
            }, 1000);
        }

        // Reset flipped cards
        this.flippedCards = [];
        this.isProcessing = false;
    }

    /**
     * Handle mismatch
     */
    handleMismatch(index1, index2) {
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
        const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const score = this.calculateScore(this.moves, timeElapsed);

        console.log(`[MemoryGame] Game complete! Moves: ${this.moves}, Time: ${timeElapsed}s, Score: ${score}`);

        // Award score
        if (this.scoreManager) {
            this.scoreManager.addScore(score, `Memory game: ${this.matchedPairs} pairs`);
        }

        // Show completion message
        this.showCompletionMessage(score, timeElapsed);

        // Play celebration sound
        this.playCelebrationSound();
    }

    /**
     * Calculate score based on moves and time
     * Fewer moves and faster time = higher score
     */
    calculateScore(moves, timeSeconds) {
        const perfectMoves = this.totalPairs; // One move per pair would be perfect
        const baseScore = 100;

        // Penalize for extra moves
        const movePenalty = Math.max(0, (moves - perfectMoves) * 5);

        // Bonus for speed (if completed in under 60 seconds)
        const timeBonus = timeSeconds < 60 ? Math.max(0, 60 - timeSeconds) : 0;

        const score = Math.max(10, baseScore - movePenalty + timeBonus);

        return Math.round(score);
    }

    /**
     * Update game stats display
     */
    updateStats() {
        const movesElement = document.getElementById('memory-moves');
        const pairsElement = document.getElementById('memory-pairs');

        if (movesElement) {
            movesElement.textContent = this.moves;
        }

        if (pairsElement) {
            pairsElement.textContent = `${this.matchedPairs} / ${this.totalPairs}`;
        }
    }

    /**
     * Show completion message
     */
    showCompletionMessage(score, timeSeconds) {
        const feedback = document.getElementById('memory-feedback');
        if (feedback) {
            let message = '';

            if (this.moves === this.totalPairs) {
                message = `🎯 Perfect! ${this.moves} moves in ${timeSeconds}s! +${score} points!`;
            } else if (this.moves <= this.totalPairs * 1.5) {
                message = `⭐ Great job! ${this.moves} moves in ${timeSeconds}s! +${score} points!`;
            } else {
                message = `✅ Well done! ${this.moves} moves in ${timeSeconds}s! +${score} points!`;
            }

            feedback.textContent = message;
            feedback.className = 'feedback success';
            feedback.style.display = 'block';
        }

        // Show play again button
        const playAgainBtn = document.getElementById('memory-play-again');
        if (playAgainBtn) {
            playAgainBtn.style.display = 'block';
        }
    }

    /**
     * Reset and play again
     */
    playAgain() {
        const feedback = document.getElementById('memory-feedback');
        if (feedback) {
            feedback.style.display = 'none';
        }

        const playAgainBtn = document.getElementById('memory-play-again');
        if (playAgainBtn) {
            playAgainBtn.style.display = 'none';
        }

        // Start new game with same words
        this.startGame(this.gameWords, this.totalPairs);
    }

    /**
     * Speak a word using speech synthesis
     */
    async speakWord(word) {
        if (typeof speechManager !== 'undefined') {
            await speechManager.speak(word, 'en-US');
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
    }
}

// Export a singleton instance factory
export function createMemoryGame(gameManager, scoreManager, progressManager) {
    return new MemoryGame(gameManager, scoreManager, progressManager);
}
