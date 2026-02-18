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

        // Render options
        this.renderOptions(sentence.blank.options, correctAnswer);

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
                this.scoreManager.addScore(points, `Fill Blank: ${answer}`);
            }

            // Speak the full sentence
            this.speakSentence(this.currentSentence.sentence);
        } else {
            this.wrongCount++;
            // Speak the correct answer
            const correct = this.currentSentence.blank.options[0];
            this.speakSentence(correct);
        }

        // Show next button
        const nextBtn = document.getElementById('fill-blanks-next');
        if (nextBtn) nextBtn.style.display = 'inline-block';

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
        this.loadSentence();
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
        const feedback = document.getElementById('fill-blanks-feedback');
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

        // Clear sentence display and options
        const sentenceDisplay = document.getElementById('fill-blanks-sentence');
        if (sentenceDisplay) sentenceDisplay.innerHTML = '';

        const optionsContainer = document.getElementById('fill-blanks-options');
        if (optionsContainer) optionsContainer.innerHTML = '';

        // Show play again button
        const playAgainBtn = document.getElementById('fill-blanks-play-again');
        if (playAgainBtn) playAgainBtn.style.display = 'inline-block';

        const nextBtn = document.getElementById('fill-blanks-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Reset and play again
     */
    playAgain() {
        const playAgainBtn = document.getElementById('fill-blanks-play-again');
        if (playAgainBtn) playAgainBtn.style.display = 'none';

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
