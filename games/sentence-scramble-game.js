// Sentence Scramble Game Module
// Players tap words to arrange them into correct sentences
// Uses data/sentences.js for content

export class SentenceScrambleGame {
    constructor() {
        this.currentSentence = null;
        this.selectedWords = [];    // Words placed in answer zone
        this.availableWords = [];   // Words still in the word bank
        this.isAnswerChecked = false;

        // Drag state
        this._dragSrcIndex = null;
        this._dragMoved = false;
        this._touchSrcIndex = null;
        this._touchDestIndex = null;
        this._touchMoved = false;

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

        this.speakSentence(word);
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
        this.speakSentence(word);
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
     * Render the answer zone with selected words (draggable for reordering)
     */
    renderAnswerZone() {
        const answerZone = document.getElementById('scramble-answer-zone');
        if (!answerZone) return;

        answerZone.innerHTML = '';

        if (this.selectedWords.length === 0) {
            answerZone.innerHTML = '<div class="answer-placeholder">הקלק על מילה כדי להוסיף אותה</div>';
            this._updatePlayBtn();
            return;
        }

        this._updatePlayBtn();

        this.selectedWords.forEach((item, index) => {
            const wordChip = document.createElement('button');
            wordChip.className = 'scramble-answer-chip';
            wordChip.textContent = item.word;
            wordChip.title = 'לחץ להסרה';
            wordChip.draggable = true;
            wordChip.dataset.index = index;

            wordChip.addEventListener('click', () => {
                if (!this._dragMoved) this.deselectWord(item.word, index);
            });

            this._setupDrag(wordChip, index, answerZone);
            this._setupTouch(wordChip, index, answerZone);
            answerZone.appendChild(wordChip);
        });
    }

    _setupDrag(chip, index, answerZone) {
        chip.addEventListener('dragstart', (e) => {
            this._dragSrcIndex = index;
            this._dragMoved = false;
            chip.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        chip.addEventListener('dragend', () => {
            chip.classList.remove('dragging');
            answerZone.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            setTimeout(() => { this._dragMoved = false; }, 0);
        });

        chip.addEventListener('dragover', (e) => {
            e.preventDefault();
            this._dragMoved = true;
            e.dataTransfer.dropEffect = 'move';
            answerZone.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            if (index !== this._dragSrcIndex) chip.classList.add('drag-over');
        });

        chip.addEventListener('drop', (e) => {
            e.preventDefault();
            const src = this._dragSrcIndex;
            const dest = index;
            if (src !== null && src !== dest) {
                const [moved] = this.selectedWords.splice(src, 1);
                this.selectedWords.splice(dest, 0, moved);
                this.renderAnswerZone();
            }
        });
    }

    _setupTouch(chip, index, answerZone) {
        let ghost = null;
        let startX, startY;

        chip.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            this._touchSrcIndex = index;
            this._touchDestIndex = null;
            this._touchMoved = false;
        }, { passive: true });

        chip.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            if (!this._touchMoved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                this._touchMoved = true;
                ghost = chip.cloneNode(true);
                const rect = chip.getBoundingClientRect();
                ghost.style.cssText = `position:fixed;opacity:0.8;pointer-events:none;z-index:9999;` +
                    `width:${rect.width}px;height:${rect.height}px;border-radius:8px;transition:none;`;
                document.body.appendChild(ghost);
                chip.style.opacity = '0.3';
            }

            if (ghost) {
                e.preventDefault();
                const rect = ghost.getBoundingClientRect();
                ghost.style.left = (t.clientX - rect.width / 2) + 'px';
                ghost.style.top = (t.clientY - rect.height / 2) + 'px';
                answerZone.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
                const el = document.elementFromPoint(t.clientX, t.clientY);
                if (el?.classList.contains('scramble-answer-chip') && el !== chip) {
                    el.classList.add('drag-over');
                    this._touchDestIndex = parseInt(el.dataset.index);
                } else {
                    this._touchDestIndex = null;
                }
            }
        }, { passive: false });

        chip.addEventListener('touchend', () => {
            if (ghost) {
                ghost.remove();
                ghost = null;
                chip.style.opacity = '';
            }
            answerZone.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            if (this._touchMoved && this._touchDestIndex !== null && this._touchDestIndex !== this._touchSrcIndex) {
                const src = this._touchSrcIndex;
                const dest = this._touchDestIndex;
                const [moved] = this.selectedWords.splice(src, 1);
                this.selectedWords.splice(dest, 0, moved);
                this._touchDestIndex = null;
                this.renderAnswerZone();
            }
            this._touchMoved = false;
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

        // Track vocabulary words from this sentence in the practice queue
        this.currentSentence.words.forEach(w => {
            const cleanWord = w.replace(/[.,!?;:]+$/, '');
            const vocabEntry = window.vocabularyBank?.find(vw => vw.word.toLowerCase() === cleanWord.toLowerCase());
            if (vocabEntry && window.gameManager?.recordWordAttempt) {
                window.gameManager.recordWordAttempt(vocabEntry.word, vocabEntry.category, isCorrect, 0, 'scramble');
            }
        });

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
            window.scoreManager.addPoints('scramble', 10);
            window.gameManager.updateScore('scramble');
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
                    const chip = document.createElement('button');
                    chip.className = 'scramble-answer-chip reveal-correct';
                    chip.textContent = word;
                    chip.addEventListener('click', () => this.speakSentence(word));
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
     * Play the words currently in the answer zone as a sentence
     */
    playCurrentWords() {
        if (this.selectedWords.length === 0) return;
        const text = this.selectedWords.map(item => item.word).join(' ');
        this.speakSentence(text);
    }

    _updatePlayBtn() {
        const btn = document.getElementById('scramble-play-btn');
        if (btn) btn.disabled = this.selectedWords.length === 0;
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
