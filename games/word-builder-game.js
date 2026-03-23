// Word Builder (בונה משפטים) Game
// Show Hebrew translation + English sentence with blank + word options
// Child taps the correct word to fill the blank
// Uses same data/sentences.js as fill-blanks but with kid-friendly visual UI

export class WordBuilderGame {
    constructor() {
        this.currentSentence = null;
        this.isAnswerSelected = false;
        console.log('[WordBuilder] Initialized');
    }

    /**
     * Render a sentence question — called by GameManager loadQuestion dispatch
     * @param {Object} question - Sentence object from sentences.js (must have .blank)
     */
    loadQuestion(question) {
        this.currentSentence = question;
        this.isAnswerSelected = false;

        const container = document.getElementById('word-builder-container');
        if (container) container.style.display = 'block';

        this.renderSentence();

        // Speak the full sentence
        if (typeof speechManager !== 'undefined') {
            speechManager.speak(question.sentence, 'en-US').catch(() => {});
        }
    }

    renderSentence() {
        const sentence = this.currentSentence;
        const words = [...sentence.words];
        const blankIndex = sentence.blank.position;
        const correctAnswer = words[blankIndex].replace(/[.,!?;:]+$/, '');

        // Hebrew hint
        const hintEl = document.getElementById('word-builder-hint');
        if (hintEl) {
            hintEl.textContent = `🇮🇱 ${window.getHebrew ? window.getHebrew(sentence.translation) : sentence.translation}`;
        }

        // Theme badge
        const themeEl = document.getElementById('word-builder-theme');
        if (themeEl) {
            const themeIcons = {
                greetings: '👋', family: '👨‍👩‍👧‍👦', animals: '🐾',
                food: '🍎', colors: '🎨', numbers: '🔢',
                school: '🏫', daily: '☀️'
            };
            const icon = themeIcons[sentence.theme] || '📖';
            themeEl.textContent = `${icon} ${sentence.theme}`;
        }

        // Sentence with blank
        const sentenceEl = document.getElementById('word-builder-sentence');
        if (sentenceEl) {
            const displayWords = words.map((w, i) => {
                if (i === blankIndex) {
                    return `<span class="wb-blank-slot" id="wb-blank-slot">____</span>`;
                }
                return `<span class="wb-word">${w}</span>`;
            });
            sentenceEl.innerHTML = displayWords.join(' ');
        }

        // Render options as big colorful buttons
        this.renderOptions(sentence.blank.options, correctAnswer);

        // Reset feedback and next button
        const feedback = document.getElementById('word-builder-feedback');
        if (feedback) { feedback.textContent = ''; feedback.style.display = 'none'; }

        const nextBtn = document.getElementById('word-builder-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    renderOptions(options, correct) {
        const container = document.getElementById('word-builder-options');
        if (!container) return;
        container.innerHTML = '';

        const colors = ['wb-option-blue', 'wb-option-green', 'wb-option-orange', 'wb-option-purple'];
        const shuffled = [...options].sort(() => Math.random() - 0.5);

        shuffled.forEach((option, i) => {
            const btn = document.createElement('button');
            btn.className = `wb-option-btn ${colors[i % colors.length]}`;
            btn.textContent = option;
            btn.dataset.answer = option;
            btn.dataset.correct = option.toLowerCase() === correct.toLowerCase() ? 'true' : 'false';
            btn.addEventListener('click', () => this.selectAnswer(option, btn));
            container.appendChild(btn);
        });
    }

    selectAnswer(answer, buttonElement) {
        if (this.isAnswerSelected) return;
        this.isAnswerSelected = true;

        const isCorrect = buttonElement.dataset.correct === 'true';

        // Morale
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        // Track word mastery for the blank word
        const blankWord = this.currentSentence.blank.options[0];
        const vocabEntry = window.vocabularyBank?.find(w => w.word.toLowerCase() === blankWord.toLowerCase());
        if (vocabEntry && window.gameManager?.recordWordAttempt) {
            window.gameManager.recordWordAttempt(vocabEntry.word, vocabEntry.category, isCorrect, 0, 'word-builder');
        }

        // Visual feedback on buttons
        buttonElement.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            document.querySelectorAll('.wb-option-btn').forEach(btn => {
                if (btn.dataset.correct === 'true') btn.classList.add('correct');
            });
        }
        document.querySelectorAll('.wb-option-btn').forEach(btn => btn.disabled = true);

        // Animate word into blank slot
        const blankSlot = document.getElementById('wb-blank-slot');
        if (blankSlot) {
            blankSlot.textContent = answer;
            blankSlot.classList.add('wb-filled', isCorrect ? 'correct' : 'incorrect');
        }

        // Feedback
        this.showFeedback(isCorrect);

        // Score and state
        window.gameManager.currentQuestionIndex++;
        window.gameManager.saveGameState();

        if (isCorrect) {
            window.scoreManager.addPoints('word-builder', 15);
            window.gameManager.updateScore('word-builder');
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}
            // Speak the full sentence
            if (typeof speechManager !== 'undefined') {
                speechManager.speak(this.currentSentence.sentence, 'en-US').catch(() => {});
            }
        } else {
            try { window.audioEffects?.playWrong(); } catch (e) {}
            // Speak the correct word
            if (typeof speechManager !== 'undefined') {
                speechManager.speak(this.currentSentence.blank.options[0], 'en-US').catch(() => {});
            }
        }

        // Show next button
        const nextBtn = document.getElementById('word-builder-next');
        if (nextBtn) nextBtn.style.display = 'block';
    }

    showFeedback(isCorrect) {
        const feedback = document.getElementById('word-builder-feedback');
        if (!feedback) return;

        if (isCorrect) {
            const messages = ['🎉 כל הכבוד!', '⭐ נכון מאוד!', '🌟 מצוין!', '👏 יפה מאוד!', '🏗️ בנית משפט!'];
            feedback.textContent = messages[Math.floor(Math.random() * messages.length)];
            feedback.className = 'feedback success';
        } else {
            feedback.textContent = `❌ התשובה הנכונה: "${this.currentSentence.blank.options[0]}"`;
            feedback.className = 'feedback error';
        }
        feedback.style.display = 'block';
    }

    cleanup() {
        const container = document.getElementById('word-builder-container');
        if (container) container.style.display = 'none';
    }
}
