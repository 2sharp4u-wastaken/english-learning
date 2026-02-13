// Grammar Beginner Game Module
// Audio-visual grammar learning for non-readers

import { questionTypes } from '../data/grammarBeginnerData.js';

// Load a grammar beginner question based on its type
export async function loadGrammarBeginnerQuestion(question) {
    console.log('[GrammarBeginner] Loading question:', question.type, question);

    // Clear any previous audio
    if (typeof speechManager !== 'undefined') {
        speechManager.cancelSpeech();
    }

    // Reset attempts for new question
    this.currentQuestionAttempts = 0;

    // Clear feedback
    const feedback = document.getElementById('grammar-beginner-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // Hide next button
    const nextBtn = document.getElementById('grammar-beginner-next');
    if (nextBtn) {
        nextBtn.style.display = 'none';
    }

    // Get the game board
    const gameBoard = document.querySelector('#grammar-beginner-game .game-board');
    if (!gameBoard) {
        console.error('[GrammarBeginner] Game board not found');
        return;
    }

    // Render based on question type
    switch (question.type) {
        case questionTypes.WHO_SAYS_IT:
            await renderWhoSaysIt.call(this, question, gameBoard);
            break;
        case questionTypes.COMPLETE_SOUND:
            await renderCompleteSound.call(this, question, gameBoard);
            break;
        case questionTypes.SOUNDS_RIGHT:
            await renderSoundsRight.call(this, question, gameBoard);
            break;
        case questionTypes.MATCH_PICTURE:
            await renderMatchPicture.call(this, question, gameBoard);
            break;
        default:
            console.error('[GrammarBeginner] Unknown question type:', question.type);
    }
}

// Type 1: "Who Says It?" - Hear sentence, pick the subject picture
async function renderWhoSaysIt(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="instruction-hebrew">${question.instruction}</div>
                <button class="play-sentence-btn" id="play-sentence">
                    <i class="fas fa-volume-up"></i>
                    <span>השמע שוב</span>
                </button>
            </div>
            <div class="predicate-hint">
                <span class="predicate-image">${question.predicate.image}</span>
                <span class="predicate-hebrew">${question.predicate.hebrew}</span>
            </div>
            <div class="subject-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="subject-option-btn" data-index="${idx}" data-key="${opt.key}">
                        <span class="subject-image">${opt.image}</span>
                        <span class="subject-hebrew">${opt.hebrew}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup event listeners
    setupOptionListeners.call(this, question);

    // Setup replay button
    const playBtn = document.getElementById('play-sentence');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            speechManager.speakWord(question.sentenceAudio, '', 'grammar-beginner');
        });
    }

    // Auto-play the sentence
    await delay(300);
    speechManager.speakWord(question.sentenceAudio, '', 'grammar-beginner');
}

// Type 2: "Complete the Sound" - See subject picture, pick am/is/are
async function renderCompleteSound(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="instruction-hebrew">${question.instruction}</div>
            </div>
            <div class="sentence-builder">
                <div class="subject-display">
                    <span class="subject-image-large">${question.subjectImage}</span>
                    <span class="subject-hebrew">${question.subjectHebrew}</span>
                    <button class="play-subject-btn" id="play-subject">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
                <div class="verb-blank">___</div>
                <div class="predicate-display">
                    <span class="predicate-image-large">${question.predicate.image}</span>
                    <span class="predicate-hebrew">${question.predicate.hebrew}</span>
                </div>
            </div>
            <div class="verb-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="verb-option-btn" data-index="${idx}" data-verb="${opt.verb}">
                        <i class="fas fa-volume-up"></i>
                        <span class="verb-text">${opt.verb}</span>
                    </button>
                `).join('')}
            </div>
            <div class="verb-hint">
                <span>🔊 לחץ על כפתור כדי לשמוע</span>
            </div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup play subject button
    const playSubjectBtn = document.getElementById('play-subject');
    if (playSubjectBtn) {
        playSubjectBtn.addEventListener('click', () => {
            speechManager.speakWord(question.subjectAudio, '', 'grammar-beginner');
        });
    }

    // Setup verb option buttons - click to hear, double-click or long-press to select
    const verbBtns = document.querySelectorAll('.verb-option-btn');
    verbBtns.forEach(btn => {
        let clickCount = 0;
        let clickTimer = null;

        btn.addEventListener('click', () => {
            clickCount++;
            const verb = btn.dataset.verb;

            if (clickCount === 1) {
                // First click - play audio
                speechManager.speakWord(verb, '', 'grammar-beginner');

                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 500);
            } else if (clickCount === 2) {
                // Double click - select answer
                clearTimeout(clickTimer);
                clickCount = 0;
                checkGrammarBeginnerAnswer.call(this, question, verb);
            }
        });
    });

    // Auto-play the subject
    await delay(300);
    speechManager.speakWord(question.subjectAudio, '', 'grammar-beginner');
}

// Type 3: "What Sounds Right?" - Pick correct vs incorrect sentence
async function renderSoundsRight(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="instruction-hebrew">${question.instruction}</div>
            </div>
            <div class="context-display">
                <span class="subject-image-large">${question.subjectImage}</span>
                <span class="predicate-image-large">${question.predicateImage}</span>
            </div>
            <div class="sentence-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="sentence-option-btn" data-index="${idx}" data-sentence="${opt.sentence}">
                        <i class="fas fa-volume-up"></i>
                        <span class="option-number">${idx + 1}</span>
                    </button>
                `).join('')}
            </div>
            <div class="sentence-hint">
                <span>🔊 לחץ לשמוע, לחץ שוב לבחור</span>
            </div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup sentence option buttons
    const sentenceBtns = document.querySelectorAll('.sentence-option-btn');
    sentenceBtns.forEach(btn => {
        let clickCount = 0;
        let clickTimer = null;

        btn.addEventListener('click', () => {
            clickCount++;
            const sentence = btn.dataset.sentence;

            if (clickCount === 1) {
                // First click - play audio
                speechManager.speakWord(sentence, '', 'grammar-beginner');

                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 500);
            } else if (clickCount === 2) {
                // Double click - select answer
                clearTimeout(clickTimer);
                clickCount = 0;
                checkGrammarBeginnerAnswer.call(this, question, sentence);
            }
        });
    });
}

// Type 4: "Match Picture to Sound" - Hear sentence, match to correct subject picture
async function renderMatchPicture(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="instruction-hebrew">${question.instruction}</div>
                <button class="play-sentence-btn" id="play-sentence">
                    <i class="fas fa-volume-up"></i>
                    <span>השמע שוב</span>
                </button>
            </div>
            <div class="subject-options match-picture-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="subject-option-btn" data-index="${idx}" data-key="${opt.key}">
                        <span class="subject-image">${opt.image}</span>
                        <span class="predicate-image-small">${opt.predicateImage}</span>
                        <span class="subject-hebrew">${opt.hebrew}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup event listeners
    setupOptionListeners.call(this, question);

    // Setup replay button
    const playBtn = document.getElementById('play-sentence');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            speechManager.speakWord(question.sentenceAudio, '', 'grammar-beginner');
        });
    }

    // Auto-play the sentence
    await delay(300);
    speechManager.speakWord(question.sentenceAudio, '', 'grammar-beginner');
}

// Setup click listeners for simple option selection
function setupOptionListeners(question) {
    const options = document.querySelectorAll('#grammar-beginner-options button');
    options.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key || btn.dataset.sentence || btn.dataset.verb;
            checkGrammarBeginnerAnswer.call(this, question, key);
        });
    });
}

// Check the answer for grammar beginner questions
export async function checkGrammarBeginnerAnswer(question, selectedAnswer) {
    const isCorrect = selectedAnswer === question.correctAnswer;

    // Track attempt
    this.currentQuestionAttempts++;

    // Disable all options
    const options = document.querySelectorAll('#grammar-beginner-options button');
    options.forEach(btn => {
        btn.disabled = true;
        const key = btn.dataset.key || btn.dataset.sentence || btn.dataset.verb;
        if (key === question.correctAnswer) {
            btn.classList.add('correct');
        } else if (key === selectedAnswer && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    // Show feedback
    const feedback = document.getElementById('grammar-beginner-feedback');

    if (isCorrect) {
        feedback.textContent = 'מעולה! 🎉';
        feedback.className = 'feedback correct';

        // Award points
        const points = Math.max(0, 10 - this.currentQuestionAttempts + 1);
        this.scores['grammar-beginner'] = (this.scores['grammar-beginner'] || 0) + points;
        this.updateScore('grammar-beginner');

        // Play success audio
        try {
            await speechManager.speak('Great!');
            // Play the full correct sentence
            if (question.fullSentence) {
                await speechManager.speakWord(question.fullSentence, '', 'grammar-beginner');
            } else if (question.sentenceAudio) {
                await speechManager.speakWord(question.sentenceAudio, '', 'grammar-beginner');
            }
        } catch (e) {
            console.error('Error playing feedback audio:', e);
        }

        // Confetti
        try {
            const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
            if (settings?.showConfetti && typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 80,
                    spread: 60,
                    origin: { y: 0.7 }
                });
            }
        } catch (e) {}

        // Save progress and auto-advance
        this.currentQuestionIndex++;
        this.saveGameState();

        setTimeout(() => {
            this.loadQuestion('grammar-beginner');
        }, 2000);

    } else {
        feedback.textContent = 'נסה שוב! 🔄';
        feedback.className = 'feedback incorrect';

        // Play the correct sentence so they learn
        try {
            await speechManager.speak('Try again');
        } catch (e) {}

        // Re-enable options for retry (except the wrong one just clicked)
        setTimeout(() => {
            options.forEach(btn => {
                const key = btn.dataset.key || btn.dataset.sentence || btn.dataset.verb;
                if (key !== selectedAnswer) {
                    btn.disabled = false;
                }
                btn.classList.remove('incorrect');
            });
            feedback.textContent = '';
            feedback.className = 'feedback';
        }, 1500);
    }
}

// Helper: delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
