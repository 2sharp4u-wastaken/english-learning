// Sentence Scramble Game Module
// Players tap words to arrange them into correct sentences
// Uses data/sentences.js for content

import { getRandomSentences } from '../data/sentences.js';

export class SentenceScrambleGame {
    constructor(scoreManager, progressManager) {
        this.scoreManager = scoreManager;
        this.progressManager = progressManager;

        this.currentSentence = null;
        this.sentences = [];
        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;

        this.selectedWords = [];    // Words placed in answer zone
        this.availableWords = [];   // Words still in the word bank
        this.isAnswerChecked = false;

        console.log('[SentenceScramble] Initialized');
    }

    /**
     * Start a new scramble game session
     * @param {string} difficulty - 'beginner' or 'intermediate'
     * @param {string} theme - Optional theme filter
     * @param {number} count - Number of sentences per session
     */
    startGame(difficulty = 'beginner', theme = null, count = 10) {
        console.log(`[SentenceScramble] Starting game: difficulty=${difficulty}, theme=${theme}`);

        // Load sentences
        this.sentences = getRandomSentences(count, difficulty, theme);

        if (this.sentences.length === 0) {
            console.error('[SentenceScramble] No sentences found for given criteria');
            return;
        }

        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.isAnswerChecked = false;

        // Show the game
        this.showGame();
        this.loadSentence();
    }

    /**
     * Show the game container
     */
    showGame() {
        const container = document.getElementById('scramble-game-container');
        if (container) {
            container.style.display = 'block';
        }

        const feedback = document.getElementById('scramble-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback';
            feedback.style.display = 'none';
        }

        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'none';

        this.updateProgress();
    }

    /**
     * Load the current sentence
     */
    loadSentence() {
        if (this.currentIndex >= this.sentences.length) {
            this.showGameComplete();
            return;
        }

        this.currentSentence = this.sentences[this.currentIndex];
        this.isAnswerChecked = false;
        this.selectedWords = [];

        // Shuffle the words for the word bank (strip trailing punctuation for display)
        this.availableWords = [...this.currentSentence.words]
            .map(w => w.replace(/[.,!?;:]+$/, ''))
            .sort(() => Math.random() - 0.5);

        // Render the sentence UI
        this.renderSentence();

        // Update progress
        this.updateProgress();

        // Auto-speak the hint (translation) via Hebrew display
        this.updateHintDisplay();
    }

    /**
     * Render the sentence scramble UI
     */
    renderSentence() {
        // Clear answer zone
        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) {
            answerZone.innerHTML = '';
            answerZone.innerHTML = '<div class="answer-placeholder">הקלק על מילה כדי להוסיף אותה</div>';
        }

        // Render word bank
        const wordBank = document.getElementById('scramble-word-bank');
        if (wordBank) {
            wordBank.innerHTML = '';

            this.availableWords.forEach((word, index) => {
                const wordBtn = document.createElement('button');
                wordBtn.className = 'scramble-word-btn';
                wordBtn.textContent = word;
                wordBtn.dataset.index = index;
                wordBtn.addEventListener('click', () => this.selectWord(word, index, wordBtn));
                wordBank.appendChild(wordBtn);
            });
        }

        // Reset check button — hidden until all words are placed
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.style.display = 'none';
        }

        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Clear feedback
        const feedback = document.getElementById('scramble-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.style.display = 'none';
        }
    }

    /**
     * Update the Hebrew hint display
     */
    updateHintDisplay() {
        const hintEl = document.getElementById('scramble-hint');
        if (hintEl && this.currentSentence) {
            hintEl.textContent = `🇮🇱 ${this.currentSentence.translation}`;
        }

        const themeEl = document.getElementById('scramble-theme');
        if (themeEl && this.currentSentence) {
            const themeIcons = {
                greetings: '👋', family: '👨‍👩‍👧‍👦', animals: '🐾',
                food: '🍎', colors: '🎨', numbers: '🔢',
                school: '🏫', daily: '☀️'
            };
            const icon = themeIcons[this.currentSentence.theme] || '📖';
            themeEl.textContent = `${icon} ${this.currentSentence.theme}`;
        }
    }

    /**
     * Handle word selection from word bank (move to answer zone)
     */
    selectWord(word, originalIndex, buttonElement) {
        if (this.isAnswerChecked) return;

        // Mark as used in word bank
        buttonElement.classList.add('used');
        buttonElement.disabled = true;

        // Add to selected words array
        this.selectedWords.push({ word, originalIndex });

        // Render the word in the answer zone
        this.renderAnswerZone();

        // Show check button only once all words are placed
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            const allPlaced = this.selectedWords.length === this.availableWords.length;
            checkBtn.style.display = allPlaced ? 'inline-block' : 'none';
            checkBtn.disabled = !allPlaced;
        }
    }

    /**
     * Handle word deselection from answer zone (move back to word bank)
     */
    deselectWord(word, selectedIndex) {
        if (this.isAnswerChecked) return;

        // Find the original word bank button and re-enable it
        const wordBank = document.getElementById('scramble-word-bank');
        if (wordBank) {
            const buttons = wordBank.querySelectorAll('.scramble-word-btn');
            buttons.forEach(btn => {
                if (btn.textContent === word && btn.disabled) {
                    btn.classList.remove('used');
                    btn.disabled = false;
                    return; // Only re-enable first match
                }
            });
        }

        // Remove from selected words
        this.selectedWords.splice(selectedIndex, 1);

        // Re-render answer zone
        this.renderAnswerZone();

        // Hide check button until all words are placed again
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.style.display = 'none';
            checkBtn.disabled = true;
        }
    }

    /**
     * Render the answer zone with selected words
     */
    renderAnswerZone() {
        const answerZone = document.getElementById('scramble-answer-zone');
        if (!answerZone) return;

        answerZone.innerHTML = '';

        if (this.selectedWords.length === 0) {
            answerZone.innerHTML = '<div class="answer-placeholder">הקלק על מילה כדי להוסיף אותה</div>';
            return;
        }

        this.selectedWords.forEach((item, index) => {
            const wordChip = document.createElement('button');
            wordChip.className = 'scramble-answer-chip';
            wordChip.textContent = item.word;
            wordChip.title = 'לחץ להסרה';
            wordChip.addEventListener('click', () => this.deselectWord(item.word, index));
            answerZone.appendChild(wordChip);
        });
    }

    /**
     * Check the player's answer
     */
    checkAnswer() {
        if (this.isAnswerChecked) return;
        if (this.selectedWords.length === 0) return;

        this.isAnswerChecked = true;

        const playerAnswer = this.selectedWords.map(item => item.word).join(' ');
        // Compare without trailing punctuation (since we strip it from word chips)
        const correctAnswer = this.currentSentence.words
            .map(w => w.replace(/[.,!?;:]+$/, '')).join(' ');
        const isCorrect = playerAnswer.toLowerCase() === correctAnswer.toLowerCase();
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        // Disable check button
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) checkBtn.style.display = 'none';

        // Show feedback
        this.showFeedback(isCorrect, correctAnswer);

        // Highlight answer zone
        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) {
            answerZone.querySelectorAll('.scramble-answer-chip').forEach(chip => {
                chip.classList.add(isCorrect ? 'correct' : 'incorrect');
            });
        }

        // Update score
        if (isCorrect) {
            this.correctCount++;
            const points = 15;
            this.score += points;
            if (this.scoreManager) {
                this.scoreManager.addPoints('scramble', points);
            }

            // Confetti and correct sound
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}

            // Speak the correct sentence then show Next button — no auto-advance
            this.speakSentence(this.currentSentence.sentence);
            const nextBtn = document.getElementById('scramble-next');
            if (nextBtn) nextBtn.style.display = 'block';
        } else {
            this.wrongCount++;
            // Wrong answer sound
            try { window.audioEffects?.playWrong(); } catch (e) {}
            // Speak the correct sentence so they hear it
            this.speakSentence(this.currentSentence.sentence);

            // Animate words into correct order, then show next button
            this.animateCorrectOrder();
        }

        this.updateProgress();
    }

    /**
     * Show feedback message
     */
    showFeedback(isCorrect, correctAnswer) {
        const feedback = document.getElementById('scramble-feedback');
        if (!feedback) return;

        if (isCorrect) {
            feedback.textContent = '🎉 כל הכבוד! נכון!';
            feedback.className = 'feedback success';
        } else {
            feedback.textContent = `❌ התשובה הנכונה: "${correctAnswer}"`;
            feedback.className = 'feedback error';
        }

        feedback.style.display = 'block';
    }

    /**
     * Animate the correct word order into the answer zone, then reveal next button
     */
    animateCorrectOrder() {
        const answerZone = document.getElementById('scramble-answer-zone');
        if (!answerZone) return;

        const correctWords = this.currentSentence.words.map(w => w.replace(/[.,!?;:]+$/, ''));
        const wordDelay = 180; // ms between each word appearing
        const animDuration = 420; // ms — long enough for the last chip's animation

        // Brief pause so the player sees the wrong-feedback first
        setTimeout(() => {
            answerZone.innerHTML = '';

            correctWords.forEach((word, index) => {
                setTimeout(() => {
                    const chip = document.createElement('span');
                    chip.className = 'scramble-answer-chip reveal-correct';
                    chip.textContent = word;
                    answerZone.appendChild(chip);
                }, index * wordDelay);
            });

            // Show next button after all chips have finished animating
            const totalTime = (correctWords.length - 1) * wordDelay + animDuration;
            setTimeout(() => {
                const nextBtn = document.getElementById('scramble-next');
                if (nextBtn) nextBtn.style.display = 'block';
            }, totalTime);
        }, 500);
    }

    /**
     * Move to next sentence
     */
    nextSentence() {
        this.currentIndex++;
        this.saveState();
        this.loadSentence();
    }

    /**
     * Persist current progress to localStorage so the home page footer shows
     * and the game can be resumed after a page refresh.
     */
    saveState() {
        if (!this.sentences.length) return;
        const userId = localStorage.getItem('currentUser') || 'default';
        const state = {
            gameType: 'scramble',
            currentQuestionIndex: this.currentIndex,
            score: this.score,
            totalQuestions: this.sentences.length,
            timestamp: Date.now(),
            shuffledQuestions: this.sentences,
            gameElapsedMs: 0
        };
        localStorage.setItem(`savedGame_${userId}_scramble`, JSON.stringify(state));
        if (window.gameManager) window.gameManager.updateHomeNotification();
    }

    /**
     * Remove saved state (game finished or restarted)
     */
    clearState() {
        const userId = localStorage.getItem('currentUser') || 'default';
        localStorage.removeItem(`savedGame_${userId}_scramble`);
        if (window.gameManager) window.gameManager.updateHomeNotification();
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const currentEl = document.getElementById('scramble-current-q');
        const totalEl = document.getElementById('scramble-total-q');
        const scoreEl = document.getElementById('scramble-score');
        const progressFill = document.getElementById('scramble-progress-fill');

        if (currentEl) currentEl.textContent = this.currentIndex + 1;
        if (totalEl) totalEl.textContent = this.sentences.length;
        if (scoreEl) scoreEl.textContent = this.score;

        if (progressFill && this.sentences.length > 0) {
            const pct = (this.currentIndex / this.sentences.length) * 100;
            progressFill.style.width = `${pct}%`;
        }
    }

    /**
     * Show game completion screen
     */
    showGameComplete() {
        const pct = Math.round((this.correctCount / this.sentences.length) * 100);
        const stars = pct >= 80 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : '⭐';

        // Hide game UI elements
        const gameContainer = document.getElementById('scramble-game-container');
        if (gameContainer) gameContainer.style.display = 'none';

        const feedback = document.getElementById('scramble-feedback');
        if (feedback) feedback.style.display = 'none';

        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'none';

        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) checkBtn.style.display = 'none';

        // Build the unified completion div
        const gameEl = document.getElementById('scramble-game');
        const completionDiv = document.createElement('div');
        completionDiv.className = 'game-complete';
        completionDiv.innerHTML = `
            <div class="completion-content">
                <h2><i class="fas fa-trophy"></i> משחק הושלם!</h2>
                <div class="completion-stars">${stars}</div>
                <div class="score-display">
                    <div class="score-circle">
                        <span class="score-number">${pct}%</span>
                        <span class="score-label">דיוק</span>
                    </div>
                    <div class="score-details">
                        <p><strong>נכון:</strong> ${this.correctCount}/${this.sentences.length}</p>
                        <p><strong>ניקוד:</strong> ${this.score}</p>
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
        `;

        if (gameEl) gameEl.appendChild(completionDiv);

        // Wire buttons
        completionDiv.querySelector('.restart-game-btn').addEventListener('click', () => this.playAgain());
        completionDiv.querySelector('.choose-game-btn').addEventListener('click', () => window.location.replace('index.html'));

        // Victory audio and confetti
        try { window.audioEffects?.playVictory(); } catch (e) {}
        if (pct >= 80 && typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }

        this.clearState();
    }

    /**
     * Reset and play again
     */
    playAgain() {
        // Remove completion div
        const gameEl = document.getElementById('scramble-game');
        if (gameEl) {
            const completionDiv = gameEl.querySelector('.game-complete');
            if (completionDiv) completionDiv.remove();
        }

        // Show game container again
        const gameContainer = document.getElementById('scramble-game-container');
        if (gameContainer) gameContainer.style.display = 'block';

        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;

        // Shuffle sentences for variety
        this.sentences = this.sentences.sort(() => Math.random() - 0.5);

        this.showGame();
        this.loadSentence();
    }

    /**
     * Speak a sentence using speech synthesis
     */
    async speakSentence(text) {
        if (typeof speechManager !== 'undefined') {
            await speechManager.speak(text, 'en-US');
        }
    }

    /**
     * Clean up game
     */
    cleanup() {
        const container = document.getElementById('scramble-game-container');
        if (container) container.style.display = 'none';

        this.currentSentence = null;
        this.sentences = [];
        this.currentIndex = 0;
        this.selectedWords = [];
        this.availableWords = [];
        this.isAnswerChecked = false;
    }
}

export function createSentenceScrambleGame(scoreManager, progressManager) {
    return new SentenceScrambleGame(scoreManager, progressManager);
}
