// Fill-in-the-Blanks Game Module
// Players choose the correct word to complete a sentence
// Uses data/sentences.js for content

import { getRandomSentences } from '../data/sentences.js';

export class FillBlanksGame {
    constructor(scoreManager, progressManager) {
        this.scoreManager = scoreManager;
        this.progressManager = progressManager;

        this.currentSentence = null;
        this.sentences = [];
        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.isAnswerSelected = false;

        console.log('[FillBlanks] Initialized');
    }

    /**
     * Start a new fill-blanks game session
     * @param {string} difficulty - 'beginner' or 'intermediate'
     * @param {string} theme - Optional theme filter
     * @param {number} count - Number of sentences per session
     */
    startGame(difficulty = 'beginner', theme = null, count = 10) {
        console.log(`[FillBlanks] Starting game: difficulty=${difficulty}, theme=${theme}`);

        // Load sentences (only those with blank structure)
        const candidates = getRandomSentences(count, difficulty, theme);

        if (candidates.length === 0) {
            console.error('[FillBlanks] No sentences found for given criteria');
            return;
        }

        this.sentences = candidates;
        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.isAnswerSelected = false;

        // Show the game
        this.showGame();
        this.loadSentence();
    }

    /**
     * Show the game container
     */
    showGame() {
        const container = document.getElementById('fill-blanks-container');
        if (container) {
            container.style.display = 'block';
        }

        const feedback = document.getElementById('fill-blanks-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback';
            feedback.style.display = 'none';
        }

        const nextBtn = document.getElementById('fill-blanks-next');
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
        this.isAnswerSelected = false;

        // Render the sentence
        this.renderSentence();

        // Update progress
        this.updateProgress();
    }

    /**
     * Render the fill-in-the-blank sentence with multiple choice options
     */
    renderSentence() {
        const sentence = this.currentSentence;

        // Build display sentence with blank
        const words = [...sentence.words];
        const blankIndex = sentence.blank.position;
        const correctAnswer = words[blankIndex];

        // Strip trailing punctuation so comparison with options works correctly
        // e.g. words array may contain "blue." but options contain "blue"
        const correctAnswerClean = correctAnswer.replace(/[.,!?;:]+$/, '');

        // Display sentence with blank
        const sentenceDisplay = document.getElementById('fill-blanks-sentence');
        if (sentenceDisplay) {
            const displayWords = words.map((w, i) => {
                if (i === blankIndex) {
                    return `<span class="fill-blank-slot">_____</span>`;
                }
                return `<span class="fill-word">${w}</span>`;
            });
            sentenceDisplay.innerHTML = displayWords.join(' ');
        }

        // Show Hebrew translation (hint)
        const hintEl = document.getElementById('fill-blanks-hint');
        if (hintEl) {
            hintEl.textContent = `🇮🇱 ${sentence.translation}`;
        }

        // Show theme with emoji
        const themeEl = document.getElementById('fill-blanks-theme');
        if (themeEl) {
            const themeIcons = {
                greetings: '👋', family: '👨‍👩‍👧‍👦', animals: '🐾',
                food: '🍎', colors: '🎨', numbers: '🔢',
                school: '🏫', daily: '☀️'
            };
            const icon = themeIcons[sentence.theme] || '📖';
            themeEl.textContent = `${icon} ${sentence.theme}`;
        }

        // Render options using the punctuation-stripped correct answer
        this.renderOptions(sentence.blank.options, correctAnswerClean);

        // Reset feedback
        const feedback = document.getElementById('fill-blanks-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.style.display = 'none';
        }

        // Hide next button
        const nextBtn = document.getElementById('fill-blanks-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Render multiple choice options
     * @param {Array} options - [correct, wrong1, wrong2] from sentence data
     * @param {string} correct - The correct answer word
     */
    renderOptions(options, correct) {
        const optionsContainer = document.getElementById('fill-blanks-options');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

        // Shuffle options (they come as [correct, wrong1, wrong2])
        const shuffled = [...options].sort(() => Math.random() - 0.5);

        shuffled.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'fill-blanks-option';
            btn.textContent = option;
            btn.dataset.answer = option;
            btn.dataset.correct = option.toLowerCase() === correct.toLowerCase() ? 'true' : 'false';
            btn.addEventListener('click', () => this.selectAnswer(option, btn));
            optionsContainer.appendChild(btn);
        });
    }

    /**
     * Handle answer selection
     */
    selectAnswer(answer, buttonElement) {
        if (this.isAnswerSelected) return;

        this.isAnswerSelected = true;

        const isCorrect = buttonElement.dataset.correct === 'true';
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        // Mark selected button
        buttonElement.classList.add(isCorrect ? 'correct' : 'incorrect');

        // Show correct answer if wrong
        if (!isCorrect) {
            const allBtns = document.querySelectorAll('.fill-blanks-option');
            allBtns.forEach(btn => {
                if (btn.dataset.correct === 'true') {
                    btn.classList.add('correct');
                }
            });
        }

        // Disable all options
        document.querySelectorAll('.fill-blanks-option').forEach(btn => {
            btn.disabled = true;
        });

        // Update the blank in the sentence display
        this.revealAnswer(answer, isCorrect);

        // Show feedback
        this.showFeedback(isCorrect);

        // Update score
        if (isCorrect) {
            this.correctCount++;
            const points = 10;
            this.score += points;
            if (this.scoreManager) {
                this.scoreManager.addPoints('fill-blanks', points);
            }

            // Confetti and correct sound
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}

            // Speak the full sentence then show Next button — no auto-advance
            this.speakSentence(this.currentSentence.sentence);
            const nextBtn = document.getElementById('fill-blanks-next');
            if (nextBtn) nextBtn.style.display = 'block';
        } else {
            this.wrongCount++;
            // Wrong answer sound
            try { window.audioEffects?.playWrong(); } catch (e) {}
            // Speak the correct answer
            const correct = this.currentSentence.blank.options[0];
            this.speakSentence(correct);

            // Show next button for manual advance on wrong answer
            const nextBtn = document.getElementById('fill-blanks-next');
            if (nextBtn) nextBtn.style.display = 'block';
        }

        this.updateProgress();
    }

    /**
     * Reveal the answer in the sentence display
     */
    revealAnswer(answer, isCorrect) {
        const blankSlot = document.querySelector('.fill-blank-slot');
        if (blankSlot) {
            blankSlot.textContent = answer;
            blankSlot.className = `fill-blank-slot revealed ${isCorrect ? 'correct' : 'incorrect'}`;
        }
    }

    /**
     * Show feedback message
     */
    showFeedback(isCorrect) {
        const feedback = document.getElementById('fill-blanks-feedback');
        if (!feedback) return;

        if (isCorrect) {
            const messages = ['🎉 כל הכבוד!', '⭐ נכון מאוד!', '🌟 מצוין!', '👏 יפה מאוד!'];
            const msg = messages[Math.floor(Math.random() * messages.length)];
            feedback.textContent = msg;
            feedback.className = 'feedback success';
        } else {
            const correctAnswer = this.currentSentence.blank.options[0];
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
            gameType: 'fill-blanks',
            currentQuestionIndex: this.currentIndex,
            score: this.score,
            totalQuestions: this.sentences.length,
            timestamp: Date.now(),
            shuffledQuestions: this.sentences,
            gameElapsedMs: 0
        };
        localStorage.setItem(`savedGame_${userId}_fill-blanks`, JSON.stringify(state));
        if (window.gameManager) window.gameManager.updateHomeNotification();
    }

    /**
     * Remove saved state (game finished or restarted)
     */
    clearState() {
        const userId = localStorage.getItem('currentUser') || 'default';
        localStorage.removeItem(`savedGame_${userId}_fill-blanks`);
        if (window.gameManager) window.gameManager.updateHomeNotification();
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const currentEl = document.getElementById('fill-blanks-current-q');
        const totalEl = document.getElementById('fill-blanks-total-q');
        const scoreEl = document.getElementById('fill-blanks-score');
        const progressFill = document.getElementById('fill-blanks-progress-fill');

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
        const gameContainer = document.getElementById('fill-blanks-container');
        if (gameContainer) gameContainer.style.display = 'none';

        const feedback = document.getElementById('fill-blanks-feedback');
        if (feedback) feedback.style.display = 'none';

        const nextBtn = document.getElementById('fill-blanks-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Build the unified completion div
        const gameEl = document.getElementById('fill-blanks-game');
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
        const gameEl = document.getElementById('fill-blanks-game');
        if (gameEl) {
            const completionDiv = gameEl.querySelector('.game-complete');
            if (completionDiv) completionDiv.remove();
        }

        // Show game container again
        const gameContainer = document.getElementById('fill-blanks-container');
        if (gameContainer) gameContainer.style.display = 'block';

        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;

        // Shuffle for variety
        this.sentences = this.sentences.sort(() => Math.random() - 0.5);

        this.showGame();
        this.loadSentence();
    }

    /**
     * Speak text using speech synthesis
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
        const container = document.getElementById('fill-blanks-container');
        if (container) container.style.display = 'none';

        this.currentSentence = null;
        this.sentences = [];
        this.currentIndex = 0;
        this.isAnswerSelected = false;
    }
}

export function createFillBlanksGame(scoreManager, progressManager) {
    return new FillBlanksGame(scoreManager, progressManager);
}
