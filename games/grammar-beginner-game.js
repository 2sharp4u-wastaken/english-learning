// Grammar Beginner Game Module
// Audio-visual grammar learning for non-readers

import { questionTypes } from '../data/grammarBeginnerData.js';

const BEGINNER_TYPE_LABELS = {
    'who-says-it':    '👤 מי אמר?',
    'complete-sound': '🔊 השלם',
    'sounds-right':   '✅ נשמע נכון?',
    'match-picture':  '🖼️ התאם תמונה',
};

// Load a grammar beginner question based on its type
export async function loadGrammarBeginnerQuestion(question) {
    console.log('[GrammarBeginner] Loading question:', question.type, question);

    // Update category badge
    const categoryEl = document.getElementById('grammar-beginner-category');
    if (categoryEl) {
        categoryEl.textContent = BEGINNER_TYPE_LABELS[question.type] || question.type || '';
    }

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
                <div class="english-sentence-display">${sentenceCase(question.sentenceAudio)}</div>
                <button class="play-sentence-btn" id="play-sentence">
                    <i class="fas fa-volume-up"></i>
                    <span>השמע שוב</span>
                </button>
            </div>
            <div class="predicate-hint">
                <span class="predicate-image">${question.predicate.image}</span>
                <span class="predicate-hebrew" data-hebrew-source="${question.predicate.hebrew}">${window.getHebrew(question.predicate.hebrew)}</span>
            </div>
            <div class="subject-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="subject-option-btn" data-index="${idx}" data-key="${opt.key}">
                        <span class="subject-image">${opt.image}</span>
                        <span class="subject-hebrew" data-hebrew-source="${opt.hebrew}">${window.getHebrew(opt.hebrew)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="gb-translation" id="gb-translation" style="display:none"></div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup event listeners
    setupOptionListeners.call(this, question);

    // Setup replay button
    const playBtn = document.getElementById('play-sentence');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            speechManager.speakSentence(question.sentenceAudio);
        });
    }

    // Auto-play the sentence (use speakSentence to preserve spaces)
    await delay(300);
    speechManager.speakSentence(question.sentenceAudio);
}

// Type 2: "Complete the Sound" - See subject picture, pick am/is/are
async function renderCompleteSound(question, gameBoard) {
    async function speakContext() {
        await speechManager.speakWord(question.subjectAudio, '', 'grammar-beginner');
        await delay(500);
        speechManager.speakWord(question.predicate.word, '', 'grammar-beginner');
    }

    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="english-sentence-display">${sentenceCase(question.fullSentence)}</div>
            </div>
            <div class="sentence-builder">
                <div class="subject-display">
                    <span class="subject-image-large">${question.subjectImage}</span>
                    <span class="subject-hebrew" data-hebrew-source="${question.subjectHebrew}">${window.getHebrew(question.subjectHebrew)}</span>
                    <button class="play-sentence-btn" id="play-subject">
                        <i class="fas fa-volume-up"></i>
                        <span>השמע שוב</span>
                    </button>
                </div>
                <div class="verb-blank">___</div>
                <div class="predicate-display">
                    <span class="predicate-image-large">${question.predicate.image}</span>
                    <span class="predicate-hebrew" data-hebrew-source="${question.predicate.hebrew}">${window.getHebrew(question.predicate.hebrew)}</span>
                </div>
            </div>
            <div class="verb-options" id="grammar-beginner-options">
                ${question.options.map(opt => `
                    <div class="verb-option-group">
                        <button class="verb-play-btn" data-verb="${opt.verb}" data-action="play">
                            <i class="fas fa-volume-up"></i>
                            <span class="verb-text">${opt.verb}</span>
                        </button>
                        <button class="verb-select-btn" data-verb="${opt.verb}" data-action="select">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="gb-translation" id="gb-translation" style="display:none"></div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    const playSubjectBtn = document.getElementById('play-subject');
    if (playSubjectBtn) {
        playSubjectBtn.addEventListener('click', () => speakContext());
    }

    // Play buttons speak the verb; select buttons submit the answer
    document.querySelectorAll('#grammar-beginner-options button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.action === 'play') {
                speechManager.speakWord(btn.dataset.verb, '');
            } else {
                checkGrammarBeginnerAnswer.call(this, question, btn.dataset.verb);
            }
        });
    });

    await delay(300);
    speakContext();
}

// Type 3: "What Sounds Right?" - Pick correct vs incorrect sentence
async function renderSoundsRight(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="english-sentence-display">${sentenceCase(question.correctAnswer)}</div>
            </div>
            <div class="context-display">
                <div class="context-item">
                    <span class="subject-image-large">${question.subjectImage}</span>
                    <span class="context-hebrew" data-hebrew-source="${question.subjectHebrew}">${window.getHebrew(question.subjectHebrew)}</span>
                </div>
                <div class="context-item">
                    <span class="predicate-image-large">${question.predicateImage}</span>
                    <span class="context-hebrew" data-hebrew-source="${question.predicateHebrew}">${window.getHebrew(question.predicateHebrew)}</span>
                </div>
            </div>
            <div class="sentence-options" id="grammar-beginner-options">
                ${question.options.map((opt) => `
                    <div class="verb-option-group">
                        <button class="verb-play-btn" data-sentence="${opt.sentence}" data-action="play">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="verb-select-btn" data-sentence="${opt.sentence}" data-action="select">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="gb-translation" id="gb-translation" style="display:none"></div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Play buttons speak the sentence; select buttons submit the answer
    document.querySelectorAll('#grammar-beginner-options button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.action === 'play') {
                speechManager.speakSentence(btn.dataset.sentence);
            } else {
                checkGrammarBeginnerAnswer.call(this, question, btn.dataset.sentence);
            }
        });
    });
}

// Type 4: "Match Picture to Sound" - Hear sentence, match to correct subject picture
async function renderMatchPicture(question, gameBoard) {
    gameBoard.innerHTML = `
        <div class="grammar-beginner-card">
            <div class="instruction-area">
                <div class="english-sentence-display">${sentenceCase(question.sentenceAudio)}</div>
                <button class="play-sentence-btn" id="play-sentence">
                    <i class="fas fa-volume-up"></i>
                    <span>השמע שוב</span>
                </button>
            </div>
            <div class="match-predicate-display">
                <span class="predicate-emoji">${question.predicate.image}</span>
                <span class="predicate-hebrew-label" data-hebrew-source="${question.predicate.hebrew}">${window.getHebrew(question.predicate.hebrew)}</span>
            </div>
            <div class="subject-options match-picture-options" id="grammar-beginner-options">
                ${question.options.map((opt, idx) => `
                    <button class="subject-option-btn" data-index="${idx}" data-key="${opt.key}">
                        <span class="subject-image">${opt.image}</span>
                        <span class="subject-hebrew" data-hebrew-source="${opt.hebrew}">${window.getHebrew(opt.hebrew)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="gb-translation" id="gb-translation" style="display:none"></div>
        </div>
        <div class="feedback" id="grammar-beginner-feedback"></div>
    `;

    // Setup event listeners
    setupOptionListeners.call(this, question);

    // Setup replay button
    const playBtn = document.getElementById('play-sentence');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            speechManager.speakSentence(question.sentenceAudio);
        });
    }

    // Auto-play the sentence
    await delay(300);
    speechManager.speakSentence(question.sentenceAudio);
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
    const isMatchPicture = question.type === questionTypes.MATCH_PICTURE;

    if (window.gameManager?.handleMoraleAnswerResult) {
        window.gameManager.handleMoraleAnswerResult(isCorrect);
    }

    // Track attempt
    this.currentQuestionAttempts++;

    // Lock/style all option buttons.
    // Play buttons (data-action="play") stay enabled for post-answer listening;
    // select buttons (and legacy single-purpose buttons) get disabled.
    const allBtns = document.querySelectorAll('#grammar-beginner-options button');
    allBtns.forEach(btn => {
        const isPlayBtn = btn.dataset.action === 'play';
        if (!isPlayBtn) btn.disabled = true;

        const key = btn.dataset.key || btn.dataset.sentence || btn.dataset.verb;
        if (key === question.correctAnswer) {
            btn.classList.add('correct');
        } else if (key === selectedAnswer && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    const feedback = document.getElementById('grammar-beginner-feedback');

    // Helper: flash Hebrew translation in sync with audio playback
    function showTranslation() {
        const translationEl = document.getElementById('gb-translation');
        if (translationEl && question.hebrewSentence) {
            window.setHebrew(translationEl, question.hebrewSentence);
            translationEl.style.display = 'block';
            // Trigger flash animation each time it's shown
            translationEl.classList.remove('gb-flash');
            void translationEl.offsetWidth; // force reflow
            translationEl.classList.add('gb-flash');
        }
    }

    const nextBtn = document.getElementById('grammar-beginner-next');

    if (isCorrect) {
        feedback.textContent = 'מעולה! 🎉';
        feedback.className = 'feedback correct';

        // Award points using scoreManager
        const points = Math.max(0, 10 - this.currentQuestionAttempts + 1);
        window.scoreManager.addPoints('grammar-beginner', points);
        this.updateScore('grammar-beginner');

        // Confetti and correct sound
        try {
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
            }
            window.audioEffects?.playCorrect();
        } catch (e) {}

        // Flash Hebrew translation, then play the full correct sentence in sync
        showTranslation();
        try {
            const sentenceText = question.fullSentence || question.sentenceAudio;
            if (sentenceText) await speechManager.speakSentence(sentenceText);
        } catch (e) {}

        // Save progress and show next button — no auto-advance
        this.currentQuestionIndex++;
        this.saveGameState();
        if (nextBtn) nextBtn.style.display = 'block';

    } else {
        feedback.textContent = 'כמעט! הנה התשובה הנכונה 🔄';
        feedback.className = 'feedback incorrect';

        try { window.audioEffects?.playWrong(); } catch (e) {}

        // Flash Hebrew translation, then play the correct sentence in sync
        showTranslation();
        try {
            const correctSentence = question.fullSentence || question.sentenceAudio;
            if (correctSentence) await speechManager.speakSentence(correctSentence);
        } catch (e) {}

        // Save progress and show next button — no auto-advance
        this.currentQuestionIndex++;
        this.saveGameState();
        if (nextBtn) nextBtn.style.display = 'block';
    }
}

// Helper: capitalize first letter of a sentence (leaves rest as-is for CSS to handle)
function sentenceCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
