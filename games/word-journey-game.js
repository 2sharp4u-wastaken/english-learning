// Word Journey Game — multi-stage scaffolded vocabulary learning game
import { renderPicture } from '../utils/imageRenderer.js';

const STAGE_META = {
    'discover':     { icon: '👀', label: 'גילוי' },
    'listen-match': { icon: '👂', label: 'הקשבה' },
    'spell-tiles':  { icon: '✏️', label: 'כתיבה' },
    'say-word':     { icon: '🎤', label: 'דיבור' },
    'recall':       { icon: '🧠', label: 'זיכרון' },
};

// Scoring per stage (for reference and display):
// discover     → unscored (pure learning)
// listen-match → +10 per correct answer
// spell-tiles  → +10 per correct answer
// say-word     → +10 per correct answer
// recall       → +5 per matched pair

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

export class WordJourneyGame {
    constructor() {
        this.gm = null;
        this.words = [];
        this.stageId = null;
        this.stageIndex = 0;
        this.stageQuestions = [];
        this.stageCorrect = 0;
        this.totalCorrect = 0;
        this.totalScoredQuestions = 0;
        this.spellAnswer = [];
        this.spellTileUsed = {};
        // Recall state
        this.recallCards = [];
        this.recallFlipped = [];
        this.recallFlipLock = false;
        this.recallMatchedCount = 0;
        this.recallMoves = 0;
        // Say-word state
        this._wjRecordingProcessing = false;
        console.log('[WordJourney] Initialized');
    }

    setGameManager(gm) {
        this.gm = gm;
    }

    buildStageDescriptors(words) {
        this.words = words;
        return [
            { type: 'wj-stage', stageId: 'discover',     words },
            { type: 'wj-stage', stageId: 'listen-match', words },
            { type: 'wj-stage', stageId: 'spell-tiles',  words },
            { type: 'wj-stage', stageId: 'say-word',     words },
            { type: 'wj-stage', stageId: 'recall',       words },
        ];
    }

    loadStage(descriptor) {
        this.stageId = descriptor.stageId;
        if (this._resumeState) {
            this.stageIndex = this._resumeState.stageIndex;
            this.stageQuestions = this._resumeState.stageQuestions;
            this.stageCorrect = this._resumeState.stageCorrect;
            this._resumeState = null;
        } else {
            this.stageIndex = 0;
            this.stageCorrect = 0;
            this.stageQuestions = this.buildStageQuestions(descriptor.stageId, descriptor.words);
        }
        this.updateJourneyHeader(descriptor.words);
        this.updateStageBar(descriptor.stageId);
        this.renderStageFeedbackClear();
        this.loadCurrentStageItem();
    }

    updateJourneyHeader(words) {
        const batchSizeEl = document.getElementById('word-journey-batch-size');
        if (batchSizeEl) {
            batchSizeEl.textContent = Array.isArray(words) ? words.length : 0;
        }

        const totalStagesEl = document.getElementById('word-journey-total-q');
        if (totalStagesEl) {
            totalStagesEl.textContent = this.gm?.shuffledQuestions?.length || Object.keys(STAGE_META).length;
        }
    }

    buildStageQuestions(stageId, words) {
        switch (stageId) {
            case 'discover':
                return this.shuffleArray(words).map(w => ({ type: 'discover', ...w }));
            case 'listen-match':
                return this.shuffleArray(words).map(w => ({
                    type: 'listen-match',
                    ...w,
                    options: this.buildOptions(w, words)
                }));
            case 'spell-tiles':
                return this.shuffleArray(words)
                    .map(w => ({
                        type: 'spell-tiles',
                        ...w,
                        tiles: this.buildSpellTiles(w.word)
                    }));
            case 'say-word':
                return this.shuffleArray(words).map(w => ({ type: 'say-word', ...w }));
            case 'recall':
                return [{ type: 'recall', words }];
            default:
                return [];
        }
    }

    loadCurrentStageItem() {
        if (this.stageIndex >= this.stageQuestions.length) {
            this.completeStage();
            return;
        }
        const q = this.stageQuestions[this.stageIndex];
        switch (q.type) {
            case 'discover':     return this.renderDiscover(q);
            case 'listen-match': return this.renderListenMatch(q);
            case 'spell-tiles':  return this.renderSpellTiles(q);
            case 'say-word':     return this.renderSayWord(q);
            case 'recall':       return this.renderRecall(q);
        }
    }

    completeStage() {
        const stageTotal = this.getScoredStageTotal();
        const stageScore = this.stageId === 'discover'
            ? null
            : { correct: this.stageCorrect, total: stageTotal };

        if (stageScore) {
            this.totalCorrect += stageScore.correct;
            this.totalScoredQuestions += stageScore.total;
        }

        if (this.gm?.progressManager && Array.isArray(this.words) && this.words.length > 0) {
            this.gm.progressManager.recordJourneyStageCompletion(this.words, this.stageId);
            if (window.app?.userProgress) {
                window.app.userProgress.wordJourneyProgress = this.gm.progressManager.getWordJourneyProgress();
                window.app.saveUserProgress?.();
            }
        }

        document.querySelectorAll('.wj-journey-step').forEach(step => {
            if (step.dataset.stage === this.stageId) step.classList.replace('active', 'completed');
        });

        // Show brief score summary before advancing to next stage
        if (stageScore) {
            const area = document.getElementById('wj-stage-area');
            if (area) {
                const pct = stageScore.total > 0 ? Math.round((stageScore.correct / stageScore.total) * 100) : 0;
                area.innerHTML = `
                    <div class="wj-stage-complete-banner">
                        <div class="wj-stage-complete-icon">${STAGE_META[this.stageId]?.icon || '✓'}</div>
                        <div class="wj-stage-complete-score">${stageScore.correct} / ${stageScore.total}</div>
                        <div class="wj-stage-complete-label">תשובות נכונות</div>
                        <div class="wj-stage-complete-pct">${pct}%</div>
                    </div>
                `;
                const nextBtn = document.getElementById('wj-next');
                if (nextBtn) nextBtn.style.display = 'none';
                setTimeout(() => this._advanceToNextStage(), 1400);
                return;
            }
        }

        this._advanceToNextStage();
    }

    _advanceToNextStage() {
        this.gm.currentQuestionIndex++;
        this.gm.saveGameState();
        this.gm.updateProgress('word-journey');
        this.gm.loadQuestion('word-journey');
    }

    getScoredStageTotal() {
        if (this.stageId === 'recall') {
            return Array.isArray(this.words) ? this.words.length : 0;
        }
        return this.stageQuestions.length;
    }

    // ── Progress bar helper ──────────────────────────────────────────────────
    _stageProgressHtml() {
        if (this.stageId === 'recall') return '';
        const total = this.stageQuestions.length;
        if (total <= 1) return '';
        const done = this.stageIndex;
        const pct = Math.round((done / total) * 100);
        return `
            <div class="wj-stage-progress-shell">
                <button class="reset-game-btn wj-stage-reset-btn" id="word-journey-reset-btn" title="אפס משחק">אפס משחק</button>
                <div class="wj-stage-progress-wrap">
                    <div class="wj-stage-progress-label">פריט ${done + 1} מתוך ${total}</div>
                    <div class="wj-stage-progress-bar">
                        <div class="wj-stage-progress-fill" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ── DISCOVER stage ───────────────────────────────────────────────────────
    renderDiscover(q) {
        const area = document.getElementById('wj-stage-area');
        if (!area) return;

        area.innerHTML = `
            ${this._stageProgressHtml()}
            <div class="wj-discover-card">
                <div class="wj-discover-emoji"></div>
                <div class="wj-word-stack">
                    <div class="wj-discover-word">${q.word}</div>
                    <div class="wj-discover-translation" data-hebrew-source="${q.hebrew}">${window.getHebrew(q.hebrew)}</div>
                </div>
            </div>
        `;
        renderPicture(area.querySelector('.wj-discover-emoji'), { picture: q.image, imageUrl: q.imageUrl, word: q.word, category: q.category });

        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) {
            nextBtn.style.display = 'block';
            nextBtn.disabled = true;
            nextBtn.onclick = () => this.advanceDiscover();
        }

        // Enable Next only after audio finishes AND at least 1.5s have passed
        const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
        document.getElementById('word-journey-reset-btn')?.addEventListener('click', () => {
            this.gm.resetCurrentGame();
        });
        let speechPromise;
        if (typeof speechManager !== 'undefined') {
            const hebrewOn = this.gm?.settings?.hebrewVocalization !== false;
            if (hebrewOn && q.hebrew) {
                speechPromise = speechManager.speakWordWithTranslation(q.word, q.hebrew, { gameContext: 'word-journey' }).catch(() => {});
            } else {
                speechPromise = speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
            }
        } else {
            speechPromise = Promise.resolve();
        }
        Promise.all([minDelay, speechPromise]).then(() => {
            if (nextBtn) nextBtn.disabled = false;
        });
    }

    advanceDiscover() {
        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) { nextBtn.style.display = 'none'; nextBtn.disabled = false; }
        this.stageIndex++;
        this.loadCurrentStageItem();
    }

    // ── LISTEN & MATCH stage (listening-game look) ───────────────────────────
    renderListenMatch(q) {
        const area = document.getElementById('wj-stage-area');
        if (!area) return;

        this._lmPlaysLeft = 3;

        area.innerHTML = `
            ${this._stageProgressHtml()}
            <div class="wj-stage-card">
                <div class="wj-stage-layout-vertical">
                    <div class="controls-row">
                        <button class="play-audio" id="wj-audio-replay" aria-label="השמע מילה">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <span class="plays-remaining">השמעות נותרו: <span id="wj-lm-plays-left" class="plays-left">${this._lmPlaysLeft}</span></span>
                    </div>
                </div>
            </div>
            <div class="options-grid wj-picture-options" id="wj-lm-options"></div>
        `;

        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Build picture option buttons (disabled until audio plays)
        const grid = document.getElementById('wj-lm-options');
        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn wj-picture-option listening-option-hidden';
            btn.setAttribute('aria-label', opt.word);
            btn.disabled = true;
            const imgSpan = document.createElement('span');
            imgSpan.className = 'wj-picture-option-img';
            renderPicture(imgSpan, { picture: opt.image, imageUrl: opt.imageUrl, word: opt.word, category: opt.category });
            btn.appendChild(imgSpan);
            btn.addEventListener('click', () => this.checkListenMatch(i, q));
            grid.appendChild(btn);
        });

        // Replay button
        document.getElementById('word-journey-reset-btn')?.addEventListener('click', () => {
            this.gm.resetCurrentGame();
        });
        document.getElementById('wj-audio-replay').addEventListener('click', () => {
            if (this._lmPlaysLeft <= 0) return;
            this._lmPlaysLeft--;
            const playsEl = document.getElementById('wj-lm-plays-left');
            if (playsEl) playsEl.textContent = this._lmPlaysLeft;
            if (typeof speechManager !== 'undefined') {
                speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
            }
        });

        // Auto-play then reveal options
        const enableOptions = () => {
            grid.querySelectorAll('.option-btn').forEach(b => {
                b.classList.remove('listening-option-hidden');
                b.disabled = false;
            });
            this._lmPlaysLeft--;
            const playsEl = document.getElementById('wj-lm-plays-left');
            if (playsEl) playsEl.textContent = Math.max(0, this._lmPlaysLeft);
        };

        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(q.word, '', 'word-journey')
                .then(enableOptions).catch(enableOptions);
        } else {
            enableOptions();
        }
    }

    checkListenMatch(selectedIdx, q) {
        const correctIdx = q.options.findIndex(o => o.word === q.word);
        const isCorrect = selectedIdx === correctIdx;
        const buttons = document.querySelectorAll('#wj-lm-options .option-btn');
        buttons.forEach(b => b.disabled = true);
        buttons[selectedIdx]?.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect && buttons[correctIdx]) buttons[correctIdx].classList.add('correct');

        const feedback = document.getElementById('wj-feedback');
        if (feedback) {
            const fbData = getFeedback('word-journey', isCorrect ? 'correct' : 'incorrect');
            feedback.textContent = fbData.text;
            feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
            if (fbData.audio && typeof speechManager !== 'undefined') {
                speechManager.speak(fbData.audio).catch(() => {});
            }
        }

        if (isCorrect) {
            this.stageCorrect++;
            window.scoreManager.addPoints('word-journey', 10);
            this.gm.updateScore('word-journey');
            this.triggerConfetti();
            setTimeout(() => {
                this.clearFeedback();
                this.stageIndex++;
                this.loadCurrentStageItem();
            }, 1400);
        } else {
            const nextBtn = document.getElementById('wj-next');
            if (nextBtn) {
                nextBtn.style.display = 'block';
                nextBtn.onclick = () => {
                    nextBtn.style.display = 'none';
                    this.clearFeedback();
                    this.stageIndex++;
                    this.loadCurrentStageItem();
                };
            }
        }

        this.gm.recordWordAttempt(q.word, q.category, isCorrect, 0, 'word-journey');
    }

    // ── SPELL TILES stage (reading-game look + בדוק/נקה + letter sounds) ────
    renderSpellTiles(q) {
        this.spellAnswer = [];
        this.spellTileUsed = {};
        this.spellWrongCount = 0;
        this._spellPlaysLeft = 3;

        const area = document.getElementById('wj-stage-area');
        if (!area) return;

        const slotsHtml = q.word.split('').map((_, i) =>
            `<div class="wj-slot" data-slot="${i}"></div>`
        ).join('');

        const tilesHtml = q.tiles.map((letter, i) =>
            `<button class="letter-btn wj-letter-tile" data-tile="${i}" data-letter="${letter}">${letter.toLowerCase()}</button>`
        ).join('');

        area.innerHTML = `
            ${this._stageProgressHtml()}
            <div class="wj-spell-card">
                <div class="wj-spell-layout-vertical">
                    <div class="picture-container">
                        <div class="word-picture" id="wj-spell-img"></div>
                    </div>
                    <div class="wj-word-stack">
                        <div class="target-word wj-stage-word" id="wj-spell-word">${q.word}</div>
                        <div class="hebrew-translation" data-hebrew-source="${q.hebrew}">${window.getHebrew(q.hebrew)}</div>
                    </div>
                    <div class="controls-row">
                        <button class="play-audio" id="wj-spell-audio" aria-label="השמע מילה">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <span class="plays-remaining">השמעות נותרו: <span id="wj-spell-plays-left" class="plays-left">${this._spellPlaysLeft}</span></span>
                    </div>
                    <div class="built-word wj-built-word" id="wj-answer-slots">${slotsHtml}</div>
                </div>
            </div>
            <div class="letter-bank wj-letter-bank-wrap" id="wj-letter-bank">${tilesHtml}</div>
            <div class="action-buttons">
                <button class="game-btn clear-btn" id="wj-spell-clear">נקה</button>
                <button class="game-btn check-btn" id="wj-spell-check" disabled>בדוק</button>
            </div>
        `;

        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Render image (real photo or emoji fallback)
        renderPicture(document.getElementById('wj-spell-img'), { picture: q.image, imageUrl: q.imageUrl, word: q.word, category: q.category });

        // Hide English word after 2.5s
        setTimeout(() => {
            const wordEl = document.getElementById('wj-spell-word');
            if (wordEl) {
                wordEl.style.visibility = 'hidden';
                wordEl.style.opacity = '0';
                wordEl.style.transition = 'opacity 0.5s';
            }
        }, 2500);

        // Auto-play
        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
        }

        // Audio replay
        document.getElementById('word-journey-reset-btn')?.addEventListener('click', () => {
            this.gm.resetCurrentGame();
        });
        document.getElementById('wj-spell-audio').addEventListener('click', () => {
            if (this._spellPlaysLeft <= 0) return;
            this._spellPlaysLeft--;
            const playsEl = document.getElementById('wj-spell-plays-left');
            if (playsEl) playsEl.textContent = this._spellPlaysLeft;
            if (typeof speechManager !== 'undefined') {
                speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
            }
        });

        // Letter tile clicks
        area.querySelectorAll('.wj-letter-tile').forEach(tile => {
            tile.addEventListener('click', () => this.onSpellTileClick(tile, q));
        });

        // Slot click to remove last letter
        area.querySelectorAll('.wj-slot').forEach(slot => {
            slot.addEventListener('click', () => this.onSpellSlotClick(slot));
        });

        // Check + Clear buttons
        document.getElementById('wj-spell-check').addEventListener('click', () => this.checkSpellTiles(q));
        document.getElementById('wj-spell-clear').addEventListener('click', () => this.clearSpellTiles());
    }

    onSpellTileClick(tile, q) {
        const tileIdx = parseInt(tile.dataset.tile);
        if (this.spellTileUsed[tileIdx]) return;
        if (this.spellAnswer.length >= q.word.length) return;

        const letter = tile.dataset.letter;
        const slotIdx = this.spellAnswer.length;

        this.spellAnswer.push({ tileIdx, letter });
        this.spellTileUsed[tileIdx] = true;
        tile.classList.add('used');

        // Speak the letter — use lowercase so TTS says "k" not "Capital K"
        if (typeof speechManager !== 'undefined') {
            speechManager.speak(letter.toLowerCase()).catch(() => {});
        }

        const slots = document.querySelectorAll('#wj-answer-slots .wj-slot');
        if (slots[slotIdx]) {
            slots[slotIdx].textContent = letter.toLowerCase();
            slots[slotIdx].classList.add('filled');
        }

        // Enable check button
        const checkBtn = document.getElementById('wj-spell-check');
        if (checkBtn) checkBtn.disabled = false;
    }

    onSpellSlotClick(slot) {
        if (this.spellAnswer.length === 0) return;
        const slotIdx = parseInt(slot.dataset.slot);
        if (slotIdx !== this.spellAnswer.length - 1) return;

        const removed = this.spellAnswer.pop();
        this.spellTileUsed[removed.tileIdx] = false;

        const tile = document.querySelector(`.wj-letter-tile[data-tile="${removed.tileIdx}"]`);
        if (tile) tile.classList.remove('used');

        slot.textContent = '';
        slot.classList.remove('filled');

        const checkBtn = document.getElementById('wj-spell-check');
        if (checkBtn) checkBtn.disabled = this.spellAnswer.length === 0;
    }

    clearSpellTiles() {
        this.spellAnswer = [];
        this.spellTileUsed = {};

        document.querySelectorAll('.wj-letter-tile').forEach(t => t.classList.remove('used'));
        document.querySelectorAll('#wj-answer-slots .wj-slot').forEach(s => {
            s.textContent = '';
            s.classList.remove('filled', 'correct-anim', 'wrong-anim');
        });

        const checkBtn = document.getElementById('wj-spell-check');
        if (checkBtn) checkBtn.disabled = true;

        this.clearFeedback();
    }

    checkSpellTiles(q) {
        const answer = this.spellAnswer.map(s => s.letter).join('').toLowerCase();
        const isCorrect = answer === q.word.toLowerCase();

        const slotsContainer = document.getElementById('wj-answer-slots');
        const slots = slotsContainer?.querySelectorAll('.wj-slot') || [];
        const feedback = document.getElementById('wj-feedback');

        // Disable buttons during feedback
        const checkBtn = document.getElementById('wj-spell-check');
        const clearBtn = document.getElementById('wj-spell-clear');
        if (checkBtn) checkBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;

        if (isCorrect) {
            slots.forEach(s => s.classList.add('correct-anim'));
            this.stageCorrect++;
            window.scoreManager.addPoints('word-journey', 10);
            this.gm.updateScore('word-journey');
            this.triggerConfetti();

            if (feedback) {
                const fbData = getFeedback('word-journey', 'correct');
                feedback.textContent = fbData.text;
                feedback.className = 'feedback correct';
            }

            this.gm.recordWordAttempt(q.word, q.category, true, 0, 'word-journey');

            setTimeout(() => {
                if (clearBtn) clearBtn.disabled = false;
                this.clearFeedback();
                this.stageIndex++;
                this.loadCurrentStageItem();
            }, 1200);
        } else {
            this.spellWrongCount = (this.spellWrongCount || 0) + 1;

            if (slotsContainer) slotsContainer.classList.add('shake');
            slots.forEach(s => s.classList.add('wrong-anim'));

            this.gm.recordWordAttempt(q.word, q.category, false, 0, 'word-journey');

            if (this.spellWrongCount >= 2) {
                // After 2 wrong attempts — show the correct answer and advance
                if (feedback) {
                    feedback.textContent = `${q.word} :התשובה הנכונה`;
                    feedback.className = 'feedback incorrect';
                }

                setTimeout(() => {
                    if (slotsContainer) slotsContainer.classList.remove('shake');
                    slots.forEach(s => s.classList.remove('wrong-anim'));
                    // Auto-fill correct answer
                    const letters = q.word.split('');
                    slots.forEach((s, i) => {
                        s.textContent = letters[i] || '';
                        s.classList.add('filled', 'correct-anim');
                    });
                }, 600);

                setTimeout(() => {
                    this.clearFeedback();
                    this.stageIndex++;
                    this.loadCurrentStageItem();
                }, 2200);
            } else {
                if (feedback) {
                    const fbData = getFeedback('word-journey', 'incorrect');
                    feedback.textContent = fbData.text;
                    feedback.className = 'feedback incorrect';
                }

                setTimeout(() => {
                    if (slotsContainer) slotsContainer.classList.remove('shake');
                    slots.forEach(s => s.classList.remove('wrong-anim'));
                    if (clearBtn) clearBtn.disabled = false;
                    this.clearFeedback();
                }, 600);
            }
        }
    }

    // ── SAY WORD stage (pronunciation-game look) ─────────────────────────────
    renderSayWord(q) {
        const area = document.getElementById('wj-stage-area');
        if (!area) return;
        this._wjRecordingProcessing = false;
        this._sayPlaysLeft = 3;

        area.innerHTML = `
            ${this._stageProgressHtml()}
            <div class="wj-say-card">
                <div class="pronunciation-layout-vertical">
                    <div class="picture-container">
                        <div class="word-picture" id="wj-say-img"></div>
                    </div>
                    <div class="wj-word-stack">
                        <div class="target-word wj-stage-word">${q.word}</div>
                        <div class="hebrew-translation" data-hebrew-source="${q.hebrew}">${window.getHebrew(q.hebrew)}</div>
                    </div>
                    <div class="controls-row">
                        <button class="record-btn-icon" id="wj-record-btn" aria-label="הקלט את ההגייה שלך">
                            <i class="fas fa-microphone"></i>
                        </button>
                        <button class="play-audio" id="wj-say-listen" aria-label="השמע מילה">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <span class="plays-remaining">השמעות נותרו: <span id="wj-say-plays-left" class="plays-left">${this._sayPlaysLeft}</span></span>
                    </div>
                    <div class="comparison-area" id="wj-comparison-area" style="display:none">
                        <div class="comparison-row">
                            <div class="comparison-column">
                                <span class="comparison-label">המילה:</span>
                                <span class="comparison-word target" id="wj-comparison-target">${q.word}</span>
                            </div>
                            <div class="comparison-column">
                                <span class="comparison-label">אמרת:</span>
                                <span class="comparison-word user" id="wj-comparison-user"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Render image (real photo or emoji fallback)
        renderPicture(document.getElementById('wj-say-img'), { picture: q.image, imageUrl: q.imageUrl, word: q.word, category: q.category });

        // Auto-play
        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
        }

        // Listen button
        document.getElementById('word-journey-reset-btn')?.addEventListener('click', () => {
            this.gm.resetCurrentGame();
        });
        document.getElementById('wj-say-listen').addEventListener('click', () => {
            if (this._sayPlaysLeft <= 0) return;
            this._sayPlaysLeft--;
            const playsEl = document.getElementById('wj-say-plays-left');
            if (playsEl) playsEl.textContent = this._sayPlaysLeft;
            if (typeof speechManager !== 'undefined') {
                speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
            }
        });

        document.getElementById('wj-record-btn').addEventListener('click', () => {
            this.toggleWJRecording(q);
        });
    }

    async toggleWJRecording(q) {
        if (this._wjRecordingProcessing) return;

        const recordBtn = document.getElementById('wj-record-btn');
        const feedback = document.getElementById('wj-feedback');
        if (!recordBtn) return;

        if (typeof speechManager === 'undefined' || !speechManager.startRecording) {
            if (feedback) {
                feedback.textContent = 'הקלטה לא זמינה בדפדפן זה';
                feedback.className = 'feedback incorrect';
            }
            return;
        }

        if (speechManager.isRecording) {
            try { await speechManager.stopRecording(); } catch (_) {}
            recordBtn.classList.remove('recording');
            this._wjRecordingProcessing = false;
            return;
        }

        try {
            this._wjRecordingProcessing = true;
            recordBtn.classList.add('recording');

            // Gray out listen button during recording
            const listenBtn = document.getElementById('wj-say-listen');
            if (listenBtn) { listenBtn.disabled = true; listenBtn.style.opacity = '0.4'; }

            if (feedback) {
                feedback.textContent = 'מקשיב...';
                feedback.className = 'feedback';
            }

            const result = await speechManager.startRecording();
            recordBtn.classList.remove('recording');

            if (listenBtn) { listenBtn.disabled = false; listenBtn.style.opacity = ''; }

            this._processWJSpeechResult(result, q);
        } catch (error) {
            recordBtn.classList.remove('recording');
            const listenBtn = document.getElementById('wj-say-listen');
            if (listenBtn) { listenBtn.disabled = false; listenBtn.style.opacity = ''; }

            if (error.message === 'RECORDING_CANCELLED') {
                if (feedback) { feedback.textContent = ''; feedback.className = 'feedback'; }
            } else {
                if (feedback) {
                    feedback.textContent = 'שגיאה בהקלטה, נסה שוב';
                    feedback.className = 'feedback incorrect';
                }
            }
        } finally {
            this._wjRecordingProcessing = false;
        }
    }

    _processWJSpeechResult(result, q) {
        const transcript = (result.transcript || '').toLowerCase().trim();
        const expected = q.word.toLowerCase();
        const feedback = document.getElementById('wj-feedback');

        const isCorrect = transcript.includes(expected) ||
                          expected.includes(transcript) ||
                          (transcript.length > 0 && levenshteinDistance(transcript, expected) <= 2);

        // Show comparison area
        const comparisonArea = document.getElementById('wj-comparison-area');
        const userEl = document.getElementById('wj-comparison-user');
        if (comparisonArea) comparisonArea.style.display = 'block';
        if (userEl) {
            userEl.textContent = result.transcript || '(לא זוהה)';
            userEl.classList.remove('match', 'mismatch');
            userEl.classList.add(isCorrect ? 'match' : 'mismatch');
        }

        // Disable record button
        const recordBtn = document.getElementById('wj-record-btn');
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
        }

        this.gm.recordWordAttempt(q.word, q.category, isCorrect, 0, 'word-journey');

        if (isCorrect) {
            this.stageCorrect++;
            window.scoreManager.addPoints('word-journey', 10);
            this.gm.updateScore('word-journey');
            this.triggerConfetti();

            if (feedback) {
                const fbData = getFeedback('word-journey', 'correct');
                feedback.textContent = fbData.text;
                feedback.className = 'feedback correct';
            }

            setTimeout(() => {
                this.clearFeedback();
                this.stageIndex++;
                this.loadCurrentStageItem();
            }, 1400);
        } else {
            if (feedback) {
                feedback.textContent = `המילה היא: ${q.word}`;
                feedback.className = 'feedback incorrect';
            }
            if (typeof speechManager !== 'undefined') {
                speechManager.speakWord(q.word, '', 'word-journey').catch(() => {});
            }
            const nextBtn = document.getElementById('wj-next');
            if (nextBtn) {
                nextBtn.style.display = 'block';
                nextBtn.onclick = () => {
                    nextBtn.style.display = 'none';
                    this.clearFeedback();
                    this.stageIndex++;
                    this.loadCurrentStageItem();
                };
            }
        }
    }

    // ── RECALL stage (memory-game look) ─────────────────────────────────────
    renderRecall(q) {
        const { words } = q;
        const area = document.getElementById('wj-stage-area');
        if (!area) return;

        this.recallCards = [];
        this.recallFlipped = [];
        this.recallFlipLock = false;
        this.recallMatchedCount = 0;
        this.recallMoves = 0;
        this._recallPairIndex = {};

        // Build pairs: word card (image + english) + translation card (image + hebrew)
        words.forEach((w, i) => {
            this._recallPairIndex[w.word] = i;
            this.recallCards.push({
                id: `w-${i}`, type: 'word',
                content: w.word, image: w.image, imageUrl: w.imageUrl,
                wordKey: w.word, category: w.category, flipped: false, matched: false
            });
            this.recallCards.push({
                id: `img-${i}`, type: 'translation',
                content: w.hebrew, image: w.image, imageUrl: w.imageUrl,
                wordKey: w.word, category: w.category, flipped: false, matched: false
            });
        });
        this.recallCards = this.shuffleArray(this.recallCards);
        document.getElementById('word-journey-reset-btn')?.addEventListener('click', () => {
            this.gm.resetCurrentGame();
        });

        const totalPairs = words.length;
        const cols = totalPairs <= 4 ? 4 : (totalPairs <= 6 ? 4 : 4);

        area.innerHTML = `
            <div class="wj-recall-header">
                <span class="memory-stat-item">מהלכים: <span id="wj-recall-moves">0</span></span>
                <span class="memory-stat-separator">|</span>
                <span class="memory-stat-item">זוגות: <span id="wj-recall-pairs">0</span> מתוך ${totalPairs}</span>
            </div>
            <div class="memory-grid wj-recall-grid" id="wj-recall-grid"
                 style="grid-template-columns: repeat(${cols}, minmax(0, 1fr))"></div>
        `;

        const nextBtn = document.getElementById('wj-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Board lock for ghost-click protection (same pattern as standalone memory game)
        this._recallBoardLockedUntil = Date.now() + 400;

        const grid = document.getElementById('wj-recall-grid');
        this.recallCards.forEach(card => grid.appendChild(this._buildRecallCardEl(card)));
    }

    _buildRecallCardEl(card) {
        const el = document.createElement('div');
        el.className = 'memory-card';
        el.dataset.cardId = card.id;

        const inner = document.createElement('div');
        inner.className = 'memory-card-inner';

        const back = document.createElement('div');
        back.className = 'memory-card-back';
        back.innerHTML = '<div class="card-pattern">?</div>';

        const front = document.createElement('div');
        front.className = 'memory-card-front';
        if (card.type === 'translation') front.classList.add('memory-card-translation');

        // Image on front
        const imgEl = document.createElement('div');
        imgEl.className = 'memory-card-image';
        renderPicture(imgEl, { picture: card.image, imageUrl: card.imageUrl, word: card.wordKey, category: card.category });
        front.appendChild(imgEl);

        const textEl = document.createElement('div');
        textEl.className = 'memory-card-word';
        textEl.textContent = card.content;
        if (card.content && card.content.length > 10) textEl.style.fontSize = '0.9em';
        front.appendChild(textEl);

        inner.appendChild(back);
        inner.appendChild(front);
        el.appendChild(inner);

        el.addEventListener('click', () => this._onRecallCardClick(card, el));
        return el;
    }

    _onRecallCardClick(card, el) {
        // Ghost-click guard
        if (this._recallBoardLockedUntil && Date.now() < this._recallBoardLockedUntil) return;

        if (card.matched) {
            // Allow replaying audio on matched cards
            if (typeof speechManager !== 'undefined') {
                speechManager.speakWord(card.wordKey, '', 'word-journey').catch(() => {});
            }
            return;
        }

        if (this.recallFlipLock) return;
        if (card.flipped) return;
        if (this.recallFlipped.length >= 2) return;

        // Play audio on flip
        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(card.wordKey, '', 'word-journey').catch(() => {});
        }

        card.flipped = true;
        el.classList.add('flipped');
        this.recallFlipped.push({ card, el });

        if (this.recallFlipped.length === 2) {
            this.recallFlipLock = true;
            this.recallMoves++;
            const movesEl = document.getElementById('wj-recall-moves');
            if (movesEl) movesEl.textContent = this.recallMoves;
            setTimeout(() => this._checkRecallPair(), 800);
        }
    }

    _checkRecallPair() {
        const [a, b] = this.recallFlipped;
        const isMatch = a.card.wordKey === b.card.wordKey && a.card.type !== b.card.type;

        if (isMatch) {
            a.card.matched = true;
            b.card.matched = true;
            a.el.classList.add('matched');
            b.el.classList.add('matched');
            const pairIdx = this._recallPairIndex?.[a.card.wordKey] ?? 0;
            this._applyRecallPairGradient(a.el, pairIdx);
            this._applyRecallPairGradient(b.el, pairIdx);

            this.stageCorrect++;
            window.scoreManager.addPoints('word-journey', 5);
            this.gm.updateScore('word-journey');
            this.triggerConfetti();

            // Play match sound
            if (typeof speechManager !== 'undefined') {
                const fbData = getFeedback('word-journey', 'correct');
                if (fbData?.audio) {
                    speechManager.speak(fbData.audio).catch(() => {});
                }
            }

            this.recallMatchedCount++;
            this.stageCorrect++;
            const pairsEl = document.getElementById('wj-recall-pairs');
            if (pairsEl) pairsEl.textContent = this.recallMatchedCount;

            const totalPairs = this.recallCards.length / 2;
            if (this.recallMatchedCount >= totalPairs) {
                const feedback = document.getElementById('wj-feedback');
                if (feedback) {
                    feedback.textContent = 'כל הזוגות נמצאו!';
                    feedback.className = 'feedback correct';
                }
                setTimeout(() => {
                    this.clearFeedback();
                    this.stageIndex++;
                    this.loadCurrentStageItem();
                }, 1500);
            }
        } else {
            setTimeout(() => {
                a.card.flipped = false;
                b.card.flipped = false;
                a.el.classList.remove('flipped');
                b.el.classList.remove('flipped');
            }, 500);
        }

        this.recallFlipped = [];
        this.recallFlipLock = false;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _applyRecallPairGradient(cardEl, pairId) {
        const front = cardEl.querySelector('.memory-card-front');
        if (!front) return;
        const palette = [
            ['#11998e', '#38ef7d'],
            ['#3b82f6', '#22d3ee'],
            ['#8b5cf6', '#ec4899'],
            ['#f59e0b', '#f97316'],
            ['#ef4444', '#f43f5e'],
            ['#14b8a6', '#84cc16'],
            ['#6366f1', '#06b6d4'],
            ['#a855f7', '#f43f5e'],
        ];
        const [start, end] = palette[Math.abs(pairId) % palette.length];
        front.style.setProperty('--match-grad-start', start);
        front.style.setProperty('--match-grad-end', end);
    }

    buildOptions(targetWord, allWords) {
        const bank = window.vocabularyBank || allWords;
        const masteryKey = `${targetWord.word}_${targetWord.category}`;
        const wordMastery = window.app?.userProgress?.wordMastery || {};
        const masteryLevel = wordMastery[masteryKey]?.masteryLevel || 0;

        let distractorObjs = [];
        if (window.selectDistractors) {
            const distractorWords = window.selectDistractors(targetWord.word, masteryLevel, bank);
            distractorObjs = distractorWords
                .map(w => bank.find(b => b.word.toLowerCase() === w.toLowerCase()))
                .filter(Boolean);
        }

        // Pad with journey words if phonetic selection came up short
        if (distractorObjs.length < 3) {
            const used = new Set([targetWord.word, ...distractorObjs.map(d => d.word)]);
            const fromJourney = allWords
                .filter(w => !used.has(w.word))
                .sort(() => Math.random() - 0.5)
                .slice(0, 3 - distractorObjs.length);
            distractorObjs.push(...fromJourney);
        }

        return [targetWord, ...distractorObjs.slice(0, 3)].sort(() => Math.random() - 0.5);
    }

    buildSpellTiles(word) {
        const letters = word.toLowerCase().split('');
        const letterSet = new Set(letters);
        const distCount = word.length <= 5 ? 2 : 3;
        const distractors = 'etaoinshrdlucmfwypgbvkjxqz'.split('')
            .filter(l => !letterSet.has(l))
            .sort(() => Math.random() - 0.5)
            .slice(0, distCount);
        return [...letters, ...distractors].sort(() => Math.random() - 0.5);
    }

    shuffleArray(arr) {
        return [...arr].sort(() => Math.random() - 0.5);
    }

    updateStageBar(activeStageId) {
        const bar = document.getElementById('wj-stage-bar');
        if (!bar) return;
        bar.querySelectorAll('.wj-journey-step').forEach(step => {
            step.classList.remove('active');
            if (step.dataset.stage === activeStageId) step.classList.add('active');
        });
    }

    buildStageBar(stageDescriptors) {
        const bar = document.getElementById('wj-stage-bar');
        if (!bar) return;
        bar.innerHTML = stageDescriptors.map((s, i) => {
            const meta = STAGE_META[s.stageId] || { icon: '•', label: s.stageId };
            return `
                <div class="wj-journey-step ${i === 0 ? 'active' : ''}"
                     data-stage="${s.stageId}">
                    <div class="wj-step-icon">${meta.icon}</div>
                    <div class="wj-step-label">${meta.label}</div>
                </div>
                ${i < stageDescriptors.length - 1 ? '<div class="wj-step-arrow">←</div>' : ''}
            `;
        }).join('');
    }

    renderStageFeedbackClear() {
        const fb = document.getElementById('wj-feedback');
        if (fb) { fb.textContent = ''; fb.className = 'feedback'; }
    }

    clearFeedback() { this.renderStageFeedbackClear(); }

    triggerConfetti() {
        try {
            const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
            if (settings?.showConfetti && typeof confetti !== 'undefined') {
                confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
            }
        } catch (_) {}
    }

    // ── Celebration screen (Phase 2) ─────────────────────────────────────────
    /**
     * Show the Word Journey completion celebration instead of the generic endGame screen.
     * Called by gameLogic.js → endGame() when gameType === 'word-journey'.
     *
     * @param {Object} gm            GameManager instance
     * @param {Element} gameArea     The game area element to render into
     * @param {Array}  words         Word objects shown in this journey
     * @param {number} percentage    Accuracy 0-100
     * @param {number} coinsEarned   Coins awarded for this run
     * @param {number} learnedCount  Total learned words across all journeys
     * @param {Object|null} recommendation  Next recommended action descriptor
     */
    showCelebration(gm, gameArea, words, percentage, coinsEarned, learnedCount, recommendation = null) {
        const passed = percentage >= 60;
        const stars = percentage >= 80 ? '⭐⭐⭐' : percentage >= 60 ? '⭐⭐' : '⭐';
        const showRecommendation = recommendation && recommendation.destination !== 'word-journey';
        const isReplay = !!gm._wjReplayMode;
        const hasLearnedWords = learnedCount >= 3;

        const wordCards = words.map(w => {
            const hebrewText = window.getHebrew?.(w.hebrew) || w.hebrew || w.translation || '';
            return `
                <div class="wj-celeb-word-card">
                    <span class="wj-celeb-word-en">${w.word}</span>
                    <span class="wj-celeb-word-sep">—</span>
                    <span class="wj-celeb-word-he">${hebrewText}</span>
                    ${passed ? '<span class="wj-celeb-word-badge">⭐</span>' : ''}
                </div>`;
        }).join('');

        const celebDiv = document.createElement('div');
        celebDiv.className = 'game-complete wj-celebration';
        celebDiv.innerHTML = `
            <div class="completion-content">
                <div class="wj-celeb-top-emoji">🎉</div>
                <h2>${isReplay ? 'תרגול מילים הושלם!' : 'מסע מילים הושלם!'}</h2>
                ${isReplay ? '<p class="wj-replay-badge">🔄 מצב תרגול — חצי מטבעות</p>' : ''}
                <div class="completion-stars">${stars}</div>

                <div class="wj-celeb-stats">
                    <div class="wj-celeb-stat">
                        <span class="wj-celeb-stat-num">${percentage}%</span>
                        <span class="wj-celeb-stat-label">דיוק</span>
                    </div>
                    ${passed ? `
                    <div class="wj-celeb-stat wj-celeb-stat-gold">
                        <span class="wj-celeb-stat-num">${words.length}</span>
                        <span class="wj-celeb-stat-label">מילים נלמדו</span>
                    </div>
                    <div class="wj-celeb-stat">
                        <span class="wj-celeb-stat-num">${learnedCount}</span>
                        <span class="wj-celeb-stat-label">סה"כ במאגר</span>
                    </div>
                    ` : ''}
                    <div class="wj-celeb-stat">
                        <span class="wj-celeb-stat-num"><span data-coins-earned-number>+0</span>🪙</span>
                        <span class="wj-celeb-stat-label">מטבעות</span>
                    </div>
                </div>

                ${!passed ? `<p class="wj-celeb-encourage">נסה שוב — צריך 60% כדי ללמוד את המילים!</p>` : ''}

                <div class="wj-celeb-words">${wordCards}</div>

                <div class="completion-actions">
                    <button class="restart-game-btn wj-more-words-btn">
                        <i class="fas fa-arrow-left"></i> התחל מסע מילים נוסף
                    </button>
                    ${hasLearnedWords ? `
                    <button class="choose-game-btn wj-practice-btn">
                        <i class="fas fa-redo"></i> תרגול מילים שנלמדו
                    </button>` : ''}
                    ${showRecommendation ? `
                    <button class="next-recommended-btn wj-next-recommended-btn">
                        <i class="fas fa-forward"></i> ${recommendation.label}
                    </button>` : ''}
                    <button class="choose-game-btn wj-hub-btn">
                        <i class="fas fa-home"></i> חזור לבית
                    </button>
                </div>
            </div>
        `;

        gameArea.appendChild(celebDiv);
        document.querySelector('.game-area')?.scrollTo({ top: 0, behavior: 'instant' });

        celebDiv.querySelector('.wj-more-words-btn').addEventListener('click', () => {
            gm._wjReplayMode = false;
            celebDiv.remove();
            for (const child of gameArea.children) child.style.display = '';
            gm.startGame('word-journey');
        });

        celebDiv.querySelector('.wj-practice-btn')?.addEventListener('click', () => {
            gm._wjReplayMode = true;
            celebDiv.remove();
            for (const child of gameArea.children) child.style.display = '';
            gm.startGame('word-journey');
        });

        celebDiv.querySelector('.wj-hub-btn').addEventListener('click', () => {
            gm._wjReplayMode = false;
            gm.showWelcomeScreen();
        });

        celebDiv.querySelector('.wj-next-recommended-btn')?.addEventListener('click', () => {
            gm._wjReplayMode = false;
            recommendation?.action?.();
        });

        gm.animateCompletionCoins?.(celebDiv, coinsEarned);

        // Big confetti burst for the full journey completion
        try {
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 140, spread: 80, origin: { y: 0.5 } });
            }
        } catch (_) {}
    }
}
