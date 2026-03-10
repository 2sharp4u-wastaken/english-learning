// Fill-in-the-Blanks Game Module
// Players choose the correct word to complete a sentence
// Uses data/sentences.js for content

export class FillBlanksGame {
    constructor() {
        this.currentSentence = null;
        this.isAnswerSelected = false;

        console.log('[FillBlanks] Initialized');
    }

    /**
     * Load a sentence question (called by GameManager via loadQuestion dispatch)
     * @param {Object} question - Sentence object from sentences.js (must have .blank)
     */
    loadQuestion(question) {
        this.currentSentence = question;
        this.isAnswerSelected = false;

        // Show container
        const container = document.getElementById('fill-blanks-container');
        if (container) container.style.display = 'block';

        this.renderSentence();
    }

    /**
     * Render the fill-in-the-blank sentence with multiple choice options
     */
    renderSentence() {
        const sentence = this.currentSentence;
        const words = [...sentence.words];
        const blankIndex = sentence.blank.position;
        const correctAnswer = words[blankIndex];

        // Strip trailing punctuation so comparison with options works correctly
        const correctAnswerClean = correctAnswer.replace(/[.,!?;:]+$/, '');

        const sentenceDisplay = document.getElementById('fill-blanks-sentence');
        if (sentenceDisplay) {
            const displayWords = words.map((w, i) => {
                if (i === blankIndex) return `<span class="fill-blank-slot">_____</span>`;
                return `<span class="fill-word">${w}</span>`;
            });
            sentenceDisplay.innerHTML = displayWords.join(' ');
        }

        const hintEl = document.getElementById('fill-blanks-hint');
        if (hintEl) {
            hintEl.dataset.hebrewHint = sentence.translation;
            hintEl.textContent = `🇮🇱 ${window.getHebrew(sentence.translation)}`;
        }

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

        this.renderOptions(sentence.blank.options, correctAnswerClean);

        const feedback = document.getElementById('fill-blanks-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.style.display = 'none';
        }

        const nextBtn = document.getElementById('fill-blanks-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Render multiple choice options
     * @param {Array} options - [correct, wrong1, wrong2] from sentence data
     * @param {string} correct - The correct answer word (punctuation stripped)
     */
    renderOptions(options, correct) {
        const optionsContainer = document.getElementById('fill-blanks-options');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

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

        // Track the blank word in the vocabulary practice queue if it exists in the word bank
        const blankWord = this.currentSentence.blank.options[0];
        const vocabEntry = window.vocabularyBank?.find(w => w.word.toLowerCase() === blankWord.toLowerCase());
        if (vocabEntry && window.gameManager?.recordWordAttempt) {
            window.gameManager.recordWordAttempt(vocabEntry.word, vocabEntry.category, isCorrect, 0, 'fill-blanks');
        }

        buttonElement.classList.add(isCorrect ? 'correct' : 'incorrect');

        if (!isCorrect) {
            document.querySelectorAll('.fill-blanks-option').forEach(btn => {
                if (btn.dataset.correct === 'true') btn.classList.add('correct');
            });
        }

        document.querySelectorAll('.fill-blanks-option').forEach(btn => btn.disabled = true);

        this.revealAnswer(answer, isCorrect);
        this.showFeedback(isCorrect);

        // Increment index and save immediately (same pattern as grammar game)
        window.gameManager.currentQuestionIndex++;
        window.gameManager.saveGameState();

        if (isCorrect) {
            window.scoreManager.addPoints('fill-blanks', 10);
            window.gameManager.updateScore('fill-blanks');
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}
            this.speakSentence(this.currentSentence.sentence);
        } else {
            try { window.audioEffects?.playWrong(); } catch (e) {}
            this.speakSentence(this.currentSentence.blank.options[0]);
        }

        document.getElementById('fill-blanks-next').style.display = 'block';
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
            feedback.textContent = messages[Math.floor(Math.random() * messages.length)];
            feedback.className = 'feedback success';
        } else {
            feedback.textContent = `❌ התשובה הנכונה: "${this.currentSentence.blank.options[0]}"`;
            feedback.className = 'feedback error';
        }

        feedback.style.display = 'block';
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
     * Clean up game UI
     */
    cleanup() {
        const container = document.getElementById('fill-blanks-container');
        if (container) container.style.display = 'none';

        this.currentSentence = null;
        this.isAnswerSelected = false;
    }
}
