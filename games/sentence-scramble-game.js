// Sentence Scramble Game Module
// Players tap words to arrange them into correct sentences
// Uses data/sentences.js for content

export class SentenceScrambleGame {
    constructor() {
        this.currentSentence = null;
        this.selectedWords = [];    // Words placed in answer zone
        this.availableWords = [];   // Words still in the word bank
        this.isAnswerChecked = false;

        console.log('[SentenceScramble] Initialized');
    }

    /**
     * Load a sentence question (called by GameManager via loadQuestion dispatch)
     * @param {Object} question - Sentence object from sentences.js
     */
    loadQuestion(question) {
        this.currentSentence = question;
        this.isAnswerChecked = false;
        this.selectedWords = [];

        // Show container
        const container = document.getElementById('scramble-game-container');
        if (container) container.style.display = 'block';

        // Shuffle the words for the word bank (strip trailing punctuation for display)
        this.availableWords = [...question.words]
            .map(w => w.replace(/[.,!?;:]+$/, ''))
            .sort(() => Math.random() - 0.5);

        this.renderSentence();
        this.updateHintDisplay();
    }

    /**
     * Render the sentence scramble UI
     */
    renderSentence() {
        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) {
            answerZone.innerHTML = '<div class="answer-placeholder">הקלק על מילה כדי להוסיף אותה</div>';
        }

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

        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.style.display = 'none';
        }

        const nextBtn = document.getElementById('scramble-next');
        if (nextBtn) nextBtn.style.display = 'none';

        const feedback = document.getElementById('scramble-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.style.display = 'none';
        }
    }

    /**
     * Update the Hebrew hint and theme display
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

        buttonElement.classList.add('used');
        buttonElement.disabled = true;
        this.selectedWords.push({ word, originalIndex });
        this.renderAnswerZone();

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

        const wordBank = document.getElementById('scramble-word-bank');
        if (wordBank) {
            const buttons = wordBank.querySelectorAll('.scramble-word-btn');
            buttons.forEach(btn => {
                if (btn.textContent === word && btn.disabled) {
                    btn.classList.remove('used');
                    btn.disabled = false;
                    return;
                }
            });
        }

        this.selectedWords.splice(selectedIndex, 1);
        this.renderAnswerZone();

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
     * Check the player's answer — called by the check button
     */
    checkAnswer() {
        if (this.isAnswerChecked) return;
        if (this.selectedWords.length === 0) return;

        this.isAnswerChecked = true;

        const playerAnswer = this.selectedWords.map(item => item.word).join(' ');
        const correctAnswer = this.currentSentence.words
            .map(w => w.replace(/[.,!?;:]+$/, '')).join(' ');
        const isCorrect = playerAnswer.toLowerCase() === correctAnswer.toLowerCase();

        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        const checkBtn = document.getElementById('scramble-check');
        if (checkBtn) checkBtn.style.display = 'none';

        const answerZone = document.getElementById('scramble-answer-zone');
        if (answerZone) {
            answerZone.querySelectorAll('.scramble-answer-chip').forEach(chip => {
                chip.classList.add(isCorrect ? 'correct' : 'incorrect');
            });
        }

        this.showFeedback(isCorrect, correctAnswer);

        // Increment index and save immediately (same pattern as grammar game)
        window.gameManager.currentQuestionIndex++;
        window.gameManager.saveGameState();

        if (isCorrect) {
            window.gameManager.scores['scramble'] += 15;
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}
            this.speakSentence(this.currentSentence.sentence);
            document.getElementById('scramble-next').style.display = 'block';
        } else {
            try { window.audioEffects?.playWrong(); } catch (e) {}
            this.speakSentence(this.currentSentence.sentence);
            this.animateCorrectOrder();
        }
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
        const wordDelay = 180;
        const animDuration = 420;

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

            const totalTime = (correctWords.length - 1) * wordDelay + animDuration;
            setTimeout(() => {
                document.getElementById('scramble-next').style.display = 'block';
            }, totalTime);
        }, 500);
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
     * Clean up game UI
     */
    cleanup() {
        const container = document.getElementById('scramble-game-container');
        if (container) container.style.display = 'none';

        this.currentSentence = null;
        this.selectedWords = [];
        this.availableWords = [];
        this.isAnswerChecked = false;
    }
}
