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

        // Shuffle the words for the word bank
        this.availableWords = [...this.currentSentence.words].sort(() => Math.random() - 0.5);

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

        // Reset check button
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.style.display = 'inline-block';
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

        // Enable check button if at least one word
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.disabled = this.selectedWords.length === 0;
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

        // Disable check button if empty
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.disabled = this.selectedWords.length === 0;
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
        const correctAnswer = this.currentSentence.words.join(' ');
        const isCorrect = playerAnswer.toLowerCase() === correctAnswer.toLowerCase();

        // Disable check button
        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) checkBtn.style.display = 'none';

        // Show feedback
        this.showFeedback(isCorrect, correctAnswer);

        // Update score
        if (isCorrect) {
            this.correctCount++;
            const points = 15;
            this.score += points;
            if (this.scoreManager) {
                this.scoreManager.addScore(points, `Scramble: ${playerAnswer}`);
            }
        } else {
            this.wrongCount++;
        }

        // Speak the correct sentence
        this.speakSentence(this.currentSentence.sentence);

        // Highlight answer zone
        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) {
            answerZone.querySelectorAll('.scramble-answer-chip').forEach(chip => {
                chip.classList.add(isCorrect ? 'correct' : 'incorrect');
            });
        }

        // Show next button
        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'inline-block';

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
     * Move to next sentence
     */
    nextSentence() {
        this.currentIndex++;
        this.loadSentence();
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
        const feedback = document.getElementById('scramble-feedback');
        if (feedback) {
            const pct = Math.round((this.correctCount / this.sentences.length) * 100);
            let stars = '⭐';
            if (pct >= 80) stars = '⭐⭐⭐';
            else if (pct >= 60) stars = '⭐⭐';

            feedback.innerHTML = `
                <div class="game-complete-message">
                    <div style="font-size: 2em;">${stars}</div>
                    <div>סיימת! ${this.correctCount}/${this.sentences.length} נכון</div>
                    <div>${pct}% הצלחה</div>
                    <div>ניקוד: ${this.score}</div>
                </div>
            `;
            feedback.className = 'feedback success';
            feedback.style.display = 'block';
        }

        // Hide word bank and answer zone
        const wordBank = document.getElementById('scramble-word-bank');
        if (wordBank) wordBank.innerHTML = '';

        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) answerZone.innerHTML = '';

        // Show play again button
        const playAgainBtn = document.getElementById('scramble-play-again');
        if (playAgainBtn) playAgainBtn.style.display = 'inline-block';

        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Reset and play again
     */
    playAgain() {
        const playAgainBtn = document.getElementById('scramble-play-again');
        if (playAgainBtn) playAgainBtn.style.display = 'none';

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
