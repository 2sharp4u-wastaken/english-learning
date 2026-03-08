// Memory/Matching Game Module
// Classic card-matching game for vocabulary practice

export class MemoryGame {
    constructor() {
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.moves = 0;
        this.startTime = null;
        this.isProcessing = false;
        this.processingToken = 0;
        this.gameWords = [];
        this.sourceWords = [];
        this.awaitingFinish = false;
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.runningScore = 0;
        this.cardFlipCount = {};
        this.levelConfigs = [
            // speedThresholdSeconds: time limit for earning a 4th "speed star"
            { level: 1, pairs: 6, columns: 4, speedThresholdSeconds: 45 },
            { level: 2, pairs: 9, columns: 6, speedThresholdSeconds: 75 },
            { level: 3, pairs: 12, columns: 8, speedThresholdSeconds: 110 }
        ];
        this.currentLevelIndex = 0;
        this.currentGridColumns = 4;
        this._boardGeneration = 0; // incremented each render; used to detect stale listeners

        console.log('[MemoryGame] Initialized');
    }

    /**
     * Load a level question (called by GameManager via loadQuestion dispatch)
     * @param {Object} question - { level, pairs, columns, words }
     */
    loadQuestion(question) {
        this.removeCompletionScreen();
        this.hideFeedback();

        // ── Flip-on-load diagnostic ────────────────────────────────────────────
        {
            const container = document.getElementById('memory-game-container');
            const containerDisplay = container ? getComputedStyle(container).display : 'MISSING';
            const grid = document.getElementById('memory-grid');
            const orphanFlipped = grid ? grid.querySelectorAll('.memory-card.flipped').length : 'MISSING';
            console.log('[MemoryGame:DIAG] loadQuestion called', {
                level: question?.level,
                wordCount: Array.isArray(question?.words) ? question.words.length : 0,
                containerDisplay,
                orphanFlippedCards: orphanFlipped,
                isProcessing: this.isProcessing,
                flippedCards: [...this.flippedCards],
                docReadyState: document.readyState,
            });
            // EXPANDED — flippedCards as string so it never gets collapsed in DevTools
            console.log('[MemoryGame:DIAG] loadQuestion flippedCards (raw):', JSON.stringify(this.flippedCards), '| isProcessing:', this.isProcessing, '| cards.length:', this.cards.length);
        }
        // ──────────────────────────────────────────────────────────────────────

        // Normalize and filter words from the question
        this.sourceWords = (Array.isArray(question.words) ? question.words : [])
            .map((wordObj, index) => this.normalizeWordObject(wordObj, index))
            .filter(wordObj => wordObj && wordObj.word && wordObj.word !== '—');

        if (this.sourceWords.length === 0) {
            const feedback = document.getElementById('memory-feedback');
            if (feedback) {
                feedback.textContent = 'אין כרגע מילים תקינות למשחק הזיכרון';
                feedback.className = 'feedback';
                feedback.style.display = 'block';
            }
            return;
        }

        this.startLevel(question.level - 1);
    }

    startLevel(levelIndex) {
        const levelConfig = this.levelConfigs[levelIndex];
        if (!levelConfig) {
            console.error(`[MemoryGame] Invalid level index: ${levelIndex}`);
            return;
        }

        this.currentLevelIndex = levelIndex;
        this.currentGridColumns = levelConfig.columns;

        const pairsToUse = Math.min(levelConfig.pairs, Math.floor(this.sourceWords.length));

        // Daily Challenge: deterministic word selection seeded by current date + level.
        // This makes scores comparable across kids on the same day.
        const seed = this.getDailySeed(levelIndex);
        this.gameWords = this.seededSelectPairs(this.sourceWords, pairsToUse, seed);

        this.totalPairs = this.gameWords.length;
        if (this.totalPairs === 0) return;

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.startTime = Date.now();
        this.isProcessing = false;
        this.processingToken = 0;
        this.awaitingFinish = false;
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.runningScore = 0;
        this.cardFlipCount = {};

        this.createCardPairs();
        this.renderGameBoard();
        // Block clicks for 400ms after render to absorb ghost clicks.
        // Mobile browsers synthesize a click ~300ms after touchend; if the board
        // appears under the user's finger (e.g. while navigating between games),
        // that synthetic click would silently add a card to flippedCards.
        this._boardLockedUntil = Date.now() + 400;
        this.updateStats();
        this.setFinishButtonVisible(false);
        this.playGameStartSound();
    }

    /**
     * Create pairs of cards (word card + translation card)
     */
    createCardPairs() {
        this.cards = [];

        this.gameWords.forEach((wordObj, index) => {
            this.cards.push({
                id: `word-${index}`,
                pairId: index,
                type: 'word',
                content: wordObj.word,
                wordObj: wordObj,
                isFlipped: false,
                isMatched: false
            });

            this.cards.push({
                id: `translation-${index}`,
                pairId: index,
                type: 'translation',
                content: wordObj.translation,
                wordObj: wordObj,
                isFlipped: false,
                isMatched: false
            });
        });

        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /**
     * Render the game board with cards
     */
    renderGameBoard() {
        const container = document.getElementById('memory-game-container');
        const grid = document.getElementById('memory-grid');

        if (!container || !grid) {
            console.error('[MemoryGame] Required elements not found');
            return;
        }

        // ── Flip-on-load diagnostic ────────────────────────────────────────────
        const containerPrevDisplay = container.style.display;
        const containerComputedDisplay = getComputedStyle(container).display;
        const gridPrevChildCount = grid.children.length;
        const t0 = performance.now();

        console.log('[MemoryGame:DIAG] renderGameBoard called', {
            docReadyState: document.readyState,
            containerStyleDisplay: containerPrevDisplay,
            containerComputedDisplay,
            gridPrevChildCount,
            timestamp: t0.toFixed(1),
        });

        // Check whether a .flipped class is somehow already on grid children
        const preFlippedCount = grid.querySelectorAll('.memory-card.flipped').length;
        if (preFlippedCount > 0) {
            console.warn(`[MemoryGame:DIAG] ${preFlippedCount} card(s) already had .flipped BEFORE renderGameBoard cleared the grid`);
        }
        // ──────────────────────────────────────────────────────────────────────

        // Bump generation so any stale click listeners from the old board
        // are silently ignored instead of mutating the new board's state.
        this._boardGeneration++;
        const thisBoardGeneration = this._boardGeneration;
        console.log('[MemoryGame:DIAG] renderGameBoard generation:', thisBoardGeneration);

        grid.innerHTML = '';

        const cardsCount = this.cards.length;
        const columnsByCards = Math.max(4, Math.ceil(cardsCount / 3));
        const columns = Math.max(this.currentGridColumns || 4, columnsByCards);
        grid.style.gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
        grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

        this.cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index, thisBoardGeneration);
            grid.appendChild(cardElement);
        });

        container.style.display = 'block';

        // ── Post-render flip check (runs on next two frames) ──────────────────
        // If any card shows as .flipped immediately after render (before any click),
        // that's the bug. Also check computed transform to catch CSS-only flips.
        requestAnimationFrame(() => {
            const flippedAfterFrame1 = grid.querySelectorAll('.memory-card.flipped');
            if (flippedAfterFrame1.length > 0) {
                console.warn(`[MemoryGame:DIAG] Frame 1: ${flippedAfterFrame1.length} card(s) are .flipped without user interaction`, {
                    indices: Array.from(flippedAfterFrame1).map(el => el.dataset.index)
                });
            }

            requestAnimationFrame(() => {
                const flippedAfterFrame2 = grid.querySelectorAll('.memory-card.flipped');
                const t1 = performance.now();
                const firstCardInner = grid.querySelector('.memory-card-inner');
                const computedTransform = firstCardInner ? getComputedStyle(firstCardInner).transform : 'N/A';
                const hasTransition = firstCardInner
                    ? getComputedStyle(firstCardInner).transition
                    : 'N/A';

                console.log('[MemoryGame:DIAG] Frame 2 state', {
                    flippedCardCount: flippedAfterFrame2.length,
                    flippedIndices: Array.from(flippedAfterFrame2).map(el => el.dataset.index),
                    firstCardComputedTransform: computedTransform,
                    firstCardTransition: hasTransition,
                    renderMs: (t1 - t0).toFixed(1),
                    containerVisible: getComputedStyle(container).display !== 'none',
                });

                if (flippedAfterFrame2.length > 0) {
                    console.error('[MemoryGame:DIAG] BUG CONFIRMED: cards are visually flipped at render time. See above for computed style clues.');
                }
            });
        });
        // ──────────────────────────────────────────────────────────────────────
    }

    /**
     * Create a single card element
     */
    createCardElement(card, index, boardGeneration) {
        // ── Flip-on-load diagnostic ────────────────────────────────────────────
        if (card.isFlipped || card.isMatched) {
            console.warn(`[MemoryGame:DIAG] createCardElement: card[${index}] has unexpected state at render time`, {
                id: card.id, isFlipped: card.isFlipped, isMatched: card.isMatched
            });
        }
        // ──────────────────────────────────────────────────────────────────────

        const cardDiv = document.createElement('div');
        cardDiv.className = 'memory-card';
        cardDiv.dataset.index = index;

        const cardInner = document.createElement('div');
        cardInner.className = 'memory-card-inner';

        const cardFront = document.createElement('div');
        cardFront.className = 'memory-card-front';

        const safeContent = String(card.content || '—');

        if (card.type === 'word') {
            // Word cards: show emoji/icon (if any) above the English word
            const visual = card.wordObj?.visual;
            if (visual) {
                const emojiSpan = document.createElement('div');
                emojiSpan.className = 'memory-card-image';
                emojiSpan.textContent = visual;
                cardFront.appendChild(emojiSpan);
            }

            const wordSpan = document.createElement('div');
            wordSpan.className = 'memory-card-word';
            wordSpan.textContent = safeContent;
            cardFront.appendChild(wordSpan);
        } else {
            // Translation cards: emoji/icon (if any) above the Hebrew word
            cardFront.classList.add('memory-card-translation');
            const visual = card.wordObj?.visual;
            if (visual) {
                const emojiSpan = document.createElement('div');
                emojiSpan.className = 'memory-card-image';
                emojiSpan.textContent = visual;
                cardFront.appendChild(emojiSpan);
            }
            const wordSpan = document.createElement('div');
            wordSpan.className = 'memory-card-word';
            wordSpan.textContent = safeContent;
            wordSpan.style.fontSize = safeContent.length > 10 ? '0.95em' : '1.1em';
            cardFront.appendChild(wordSpan);
        }

        const cardBack = document.createElement('div');
        cardBack.className = 'memory-card-back';
        cardBack.innerHTML = '<div class="card-pattern">?</div>';

        cardInner.appendChild(cardBack);
        cardInner.appendChild(cardFront);
        cardDiv.appendChild(cardInner);

        cardDiv.addEventListener('click', () => {
            // Guard: if a newer board has been rendered since this element was created,
            // this is a stale listener — ignore it entirely to prevent phantom flips.
            if (boardGeneration !== undefined && boardGeneration !== this._boardGeneration) {
                console.warn('[MemoryGame:DIAG] STALE LISTENER BLOCKED — generation mismatch', {
                    listenerGeneration: boardGeneration,
                    currentGeneration: this._boardGeneration,
                    index,
                });
                return;
            }
            this.handleCardClick(index);
        });

        return cardDiv;
    }

    /**
     * Handle card click - plays word audio on any card click
     */
    async handleCardClick(index) {
        const card = this.cards[index];

        // ── Click diagnostic ───────────────────────────────────────────────────
        console.log('[MemoryGame:DIAG] handleCardClick', {
            index,
            cardExists: !!card,
            isProcessing: this.isProcessing,
            cardIsFlipped: card?.isFlipped,
            cardIsMatched: card?.isMatched,
            flippedCards_BEFORE_push: JSON.stringify(this.flippedCards),
        });
        // Only warn if the first card of a pair somehow appeared without being clicked
        // (i.e. this is neither the legitimate 2nd card of a pair, nor a re-click on a flipped/matched card)
        if (this.flippedCards.length > 0 && !card?.isFlipped && !card?.isMatched && !this.isProcessing) {
            console.warn('[MemoryGame:DIAG] REAL PHANTOM — flippedCards has entry before this first-card click:', JSON.stringify(this.flippedCards));
        }
        // ──────────────────────────────────────────────────────────────────────

        if (!card) return;

        // Ghost-click guard: ignore clicks fired within 400ms of board render.
        // These are synthetic clicks from mobile touch events on the navigation tap.
        if (this._boardLockedUntil && Date.now() < this._boardLockedUntil) {
            const msRemaining = this._boardLockedUntil - Date.now();
            console.log('[MemoryGame:DIAG] Ghost click blocked — board locked for', msRemaining, 'ms more', { index });
            return;
        }

        // Allow replaying pronunciation on already matched cards.
        if (card.isMatched) {
            this.playRevealAudio(card);
            return;
        }

        if (this.isProcessing) return;

        // Play word audio on ANY card click (before flipping) - for hearing pronunciation
        if (card?.wordObj) {
            await this.playRevealAudio(card);
        }

        if (card.isFlipped) return;

        this.flipCard(index, true);
        this.cardFlipCount[index] = (this.cardFlipCount[index] || 0) + 1;
        this.playFlipSound();
        // Remove audio call after flip - it was already played above
        this.flippedCards.push(index);

        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            // Increment token so any previous safety timeout from an earlier pair
            // does not interfere with this one.
            const token = ++this.processingToken;
            this.moves++;
            this.updateStats();

            // Safety: force-release the lock after 2s if THIS processing event got stuck.
            // Guard with token to avoid clobbering a subsequent pair's processing state.
            const safetyFlipped = [...this.flippedCards];
            const safetyToken = token;
            setTimeout(() => {
                // ── Safety-timer diagnostic ────────────────────────────────────
                const tokenMismatch = this.processingToken !== safetyToken;
                console.log('[MemoryGame:DIAG] safety timeout fired', {
                    safetyToken,
                    currentToken: this.processingToken,
                    tokenMismatch,
                    isProcessing: this.isProcessing,
                    safetyFlipped: JSON.stringify(safetyFlipped),
                    currentFlippedCards: JSON.stringify(this.flippedCards),
                    currentCards_length: this.cards.length,
                });
                // ──────────────────────────────────────────────────────────────
                if (this.isProcessing && this.processingToken === safetyToken) {
                    console.warn('[MemoryGame] Force-releasing stuck isProcessing lock');
                    safetyFlipped.forEach(i => {
                        if (this.cards[i] && !this.cards[i].isMatched) {
                            this.flipCard(i, false);
                        }
                    });
                    this.isProcessing = false;
                    this.flippedCards = [];
                }
            }, 2000);

            setTimeout(() => {
                this.checkForMatch();
            }, 800);
        }
    }

    /**
     * Flip a card
     */
    flipCard(index, flipped) {
        const card = this.cards[index];
        card.isFlipped = flipped;

        const grid = document.getElementById('memory-grid');
        const cardElement = grid?.querySelector(`[data-index="${index}"]`);
        if (cardElement) {
            cardElement.classList.toggle('flipped', flipped);
        }
    }

    /**
     * Check if flipped cards match
     */
    async checkForMatch() {
        const [index1, index2] = this.flippedCards;
        const card1 = this.cards[index1];
        const card2 = this.cards[index2];

        // ── checkForMatch diagnostic ───────────────────────────────────────────
        console.log('[MemoryGame:DIAG] checkForMatch', {
            flippedCards: JSON.stringify(this.flippedCards),
            index1, index2,
            card1: card1 ? { id: card1.id, pairId: card1.pairId, isFlipped: card1.isFlipped, isMatched: card1.isMatched } : 'MISSING',
            card2: card2 ? { id: card2.id, pairId: card2.pairId, isFlipped: card2.isFlipped, isMatched: card2.isMatched } : 'MISSING',
            card1_flipCount: this.cardFlipCount[index1],
            card2_flipCount: this.cardFlipCount[index2],
        });
        // ──────────────────────────────────────────────────────────────────────

        // Guard: stale check fired after flippedCards was already cleared by a safety timeout.
        if (!card1 || !card2) {
            console.warn('[MemoryGame] checkForMatch: flippedCards already cleared, skipping');
            this.isProcessing = false;
            this.flippedCards = [];
            return;
        }

        if (card1.pairId === card2.pairId) {
            this.handleMatch(index1, index2, card1);
        } else {
            this.handleMismatch(index1, index2);
        }
    }

    /**
     * Handle successful match
     */
    async handleMatch(index1, index2, card) {
        console.log('[MemoryGame] Match found!', card.wordObj.word);

        const isFirstTry = this.cardFlipCount[index1] === 1 && this.cardFlipCount[index2] === 1;
        this.currentCombo++;
        this.maxCombo = Math.max(this.maxCombo, this.currentCombo);
        const basePoints = 10;
        const comboBonus = this.currentCombo >= 2 ? 5 * this.currentCombo : 0;
        const firstTryBonus = isFirstTry ? 10 : 0;
        const pointsEarned = basePoints + comboBonus + firstTryBonus;
        this.runningScore += pointsEarned;

        // Sync live score to header
        if (window.gameManager) {
            window.scoreManager.setScore('memory', this.runningScore);
            window.gameManager.updateScore('memory');
        }

        this.cards[index1].isMatched = true;
        this.cards[index2].isMatched = true;

        const grid = document.getElementById('memory-grid');
        const cardElement1 = grid?.querySelector(`[data-index="${index1}"]`);
        const cardElement2 = grid?.querySelector(`[data-index="${index2}"]`);

        if (cardElement1) cardElement1.classList.add('matched');
        if (cardElement2) cardElement2.classList.add('matched');
        const matchedPairId = card?.pairId ?? this.cards[index1]?.pairId ?? 0;
        this.applyMatchedPairGradient(cardElement1, matchedPairId);
        this.applyMatchedPairGradient(cardElement2, matchedPairId);

        this.matchedPairs++;
        this.flippedCards = [];
        // Release lock before awaiting speech — prevents permanent board lock if speech hangs
        this.isProcessing = false;
        this.updateStats();

        this.playMatchSound();
        this.showMatchFeedback(index1, pointsEarned, isFirstTry, this.currentCombo);

        if (window.gameManager?.recordWordAttempt) {
            window.gameManager.recordWordAttempt(card.wordObj.word, card.wordObj.category, true, 0, 'memory');
        }
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(true);
        }

        if (this.matchedPairs === this.totalPairs) {
            this.awaitingFinish = true;
            this.setFinishButtonVisible(true);
        }
    }

    /**
     * Handle mismatch
     */
    handleMismatch(index1, index2) {
        this.currentCombo = 0;

        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(false);
        }

        // Record each word-type card as an incorrect attempt so it can appear in practice mode
        if (window.gameManager?.recordWordAttempt) {
            [this.cards[index1], this.cards[index2]].forEach(c => {
                if (c?.type === 'word' && c.wordObj?.word && c.wordObj?.category) {
                    window.gameManager.recordWordAttempt(c.wordObj.word, c.wordObj.category, false, 0, 'memory');
                }
            });
        }

        this.playMismatchSound();

        setTimeout(() => {
            // ── Stale-timer diagnostic ─────────────────────────────────────────
            const card1StillExists = !!this.cards[index1];
            const card2StillExists = !!this.cards[index2];
            const isStale = !card1StillExists || !card2StillExists ||
                this.cards[index1]?.isMatched || this.cards[index2]?.isMatched;
            if (isStale) {
                console.warn('[MemoryGame:DIAG] handleMismatch timeout fired but board was reset! Stale timer.', {
                    index1, index2,
                    card1StillExists, card2StillExists,
                    card1Matched: this.cards[index1]?.isMatched,
                    card2Matched: this.cards[index2]?.isMatched,
                    currentFlippedCards: JSON.stringify(this.flippedCards),
                    currentCards_length: this.cards.length,
                });
            } else {
                console.log('[MemoryGame:DIAG] handleMismatch timeout fired (clean)', { index1, index2 });
            }
            // ──────────────────────────────────────────────────────────────────
            this.flipCard(index1, false);
            this.flipCard(index2, false);
            this.flippedCards = [];
            this.isProcessing = false;
        }, 1000);
    }

    /**
     * Handle level completion — show full summary screen and wait for user action
     */
    handleGameComplete() {
        const levelConfig = this.levelConfigs[this.currentLevelIndex];
        const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const metrics = this.calculateLevelPerformance(this.moves, timeElapsed, levelConfig);
        const levelCoins = this.awardLevelRewards(metrics, levelConfig);

        const personalBestInfo = this.updatePersonalBest(levelConfig, metrics, timeElapsed);

        console.log(`[MemoryGame] Level ${levelConfig.level} complete. Score: ${metrics.score}, stars: ${metrics.stars}`);

        if (window.gameManager) {
            window.scoreManager.addPoints('memory', metrics.score);
        }
        const totalScore = window.scoreManager?.getScore('memory') ?? metrics.score;

        this.hideBoardForSummary();

        const isLastLevel = this.currentLevelIndex >= this.levelConfigs.length - 1;
        const starLine = this.renderStars(metrics.stars);
        const headingHtml = isLastLevel
            ? `<i class="fas fa-trophy"></i> משחק הושלם!`
            : `<i class="fas fa-arrow-up"></i> רמה ${levelConfig.level} הושלמה!`;

        const levelKey = String(levelConfig.level);
        const pbTableHtml = this.buildPersonalBestTable(levelKey);

        const actionButtonsHtml = isLastLevel
            ? `<button class="restart-game-btn memory-completion-restart">
                   <i class="fas fa-redo"></i> שחק שוב
               </button>
               <button class="choose-game-btn memory-completion-home">
                   <i class="fas fa-home"></i> בחר משחק אחר
               </button>`
            : `<button class="restart-game-btn memory-completion-advance">
                   <i class="fas fa-arrow-left"></i> רמה ${levelConfig.level + 1}
               </button>
               <button class="choose-game-btn memory-completion-home">
                   <i class="fas fa-home"></i> בחר משחק אחר
               </button>`;

        const completionDiv = this.buildSummaryCard(`
            <div class="completion-content">
                <h2>${headingHtml}</h2>
                <div class="completion-stars">${starLine}</div>
                <div class="score-display">
                    <div class="score-circle">
                        <span class="score-number">${metrics.score}</span>
                        <span class="score-label">ניקוד</span>
                    </div>
                    <div class="score-details">
                        <p>${this.moves} מהלכים · ${timeElapsed} שניות</p>
                        ${metrics.maxCombo >= 2 ? `<p>🔥 קומבו מקסימלי: ×${metrics.maxCombo}</p>` : ''}
                        <p>תגמול: +${levelCoins} מטבעות</p>
                        ${isLastLevel
                            ? `<p class="memory-total-score">סה״כ: ${totalScore} נק׳</p>`
                            : `<p>ניקוד צבור: ${totalScore} נק׳</p>`}
                        ${personalBestInfo?.isNewBest ? `<p class="memory-personal-best">🏆 שיא אישי חדש!</p>` : ''}
                    </div>
                </div>
                ${pbTableHtml}
                <div class="completion-actions">
                    ${actionButtonsHtml}
                </div>
            </div>
        `);

        if (metrics.stars >= 3 && typeof confetti === 'function') {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
        }

        this.playLevelCompleteSound(isLastLevel, metrics.stars);

        // When the 3-level run is finished, treat it as a completed "memory game"
        // so it participates in global stats, best scores, and history like other games.
        if (isLastLevel) {
            try {
                const totalScore = window.gameManager?.scores?.memory ?? metrics.score;
                if (window.app?.updateProgress) {
                    window.app.updateProgress('memory', totalScore);
                }
                if (window.gameManager?.saveGameScoreToHistory) {
                    window.gameManager.saveGameScoreToHistory('memory', totalScore);
                }
                // Reconcile totalPoints: points are already persisted incrementally via updateScore(),
                // so only add the remaining delta (handles the edge case where scores differ).
                if (window.app?.userProgress && window.gameManager) {
                    const alreadyPersisted = window.gameManager.lastPersistedScores?.['memory'] || 0;
                    const adjustment = totalScore - alreadyPersisted;
                    if (adjustment !== 0) {
                        window.app.userProgress.totalPoints = Math.max(0, (window.app.userProgress.totalPoints || 0) + adjustment);
                    }
                    if (window.gameManager.lastPersistedScores) {
                        window.gameManager.lastPersistedScores['memory'] = totalScore;
                    }
                    window.app.saveUserProgress();
                }
                window.gameManager?.updateTotalScoreDisplay();
                if (window.gamificationManager?.updateGameCardProgress) {
                    window.gamificationManager.updateGameCardProgress('memory');
                }
            } catch (e) {
                console.warn('[MemoryGame] Failed to update global progress for memory:', e);
            }
        }

        // Wire up action buttons — user drives the transition
        const advanceBtn = completionDiv.querySelector('.memory-completion-advance');
        const restartBtn = completionDiv.querySelector('.memory-completion-restart');
        const homeBtn = completionDiv.querySelector('.memory-completion-home');

        if (advanceBtn) {
            advanceBtn.addEventListener('click', () => {
                completionDiv.remove();
                if (window.gameManager) {
                    window.gameManager.currentQuestionIndex++;
                    window.gameManager.saveGameState();
                    window.gameManager.loadQuestion('memory');
                }
            });
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                completionDiv.remove();
                if (window.gameManager) {
                    window.gameManager.restartGame('memory');
                }
            });
        }

        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.replace('index.html');
            });
        }
    }

    /**
     * Build the personal-best table for all levels, highlighting currentLevelKey.
     * Mirrors the "שיאים במשחק הזיכרון" table in stats.js.
     */
    buildPersonalBestTable(currentLevelKey) {
        const allBests = this.loadAllPersonalBests();
        const levelCount = this.levelConfigs.length;
        let rows = '';

        for (let i = 1; i <= levelCount; i++) {
            const key = String(i);
            const rec = allBests[key];
            const isCurrent = key === currentLevelKey;
            const rowClass = isCurrent ? ' class="memory-pb-current"' : '';

            if (rec) {
                rows += `
                    <tr${rowClass}>
                        <td>${i}</td>
                        <td class="pb-score">${rec.score ?? 0}</td>
                        <td>${rec.timeSeconds != null ? rec.timeSeconds + ' שנ׳' : '—'}</td>
                        <td>${rec.moves ?? '—'}</td>
                        <td>${this.renderStars(rec.stars ?? 0)}</td>
                    </tr>
                `;
            } else {
                rows += `
                    <tr${rowClass}>
                        <td>${i}</td>
                        <td colspan="4" class="pb-not-played">טרם שוחקה</td>
                    </tr>
                `;
            }
        }

        return `
            <div class="memory-pb-section">
                <h3><i class="fas fa-trophy"></i> שיאים אישיים</h3>
                <table class="memory-pb-table">
                    <thead>
                        <tr>
                            <th>רמה</th>
                            <th>ניקוד</th>
                            <th>זמן</th>
                            <th>מהלכים</th>
                            <th>כוכבים</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Calculate level performance based on moves, time, and difficulty.
     */
    calculateLevelPerformance(moves, timeSeconds, levelConfig) {
        const mistakes = Math.max(0, moves - this.totalPairs);
        const accuracy = this.totalPairs > 0
            ? Math.min(1, this.totalPairs / Math.max(moves, this.totalPairs))
            : 0;
        // Generous thresholds for kids — completion always earns at least 1 star
        let starCount = mistakes <= Math.ceil(this.totalPairs * 0.3) ? 3
            : mistakes <= Math.ceil(this.totalPairs * 0.6) ? 2
            : 1;

        // Speed Stars: 4th bonus star for finishing under time threshold.
        // Only award if the child already earned at least 2 stars by accuracy.
        const speedThreshold = levelConfig?.speedThresholdSeconds;
        if (speedThreshold && timeSeconds <= speedThreshold && starCount >= 2) {
            starCount = Math.max(starCount, 4);
        }

        return { score: this.runningScore, accuracy, mistakes, stars: starCount, maxCombo: this.maxCombo };
    }

    awardLevelRewards(metrics, levelConfig) {
        let coins = levelConfig.level * 5;      // 5 / 10 / 15 base per level
        coins += this.totalPairs * 2;           // 2 coins per pair found (always rewarding)
        if (metrics.stars >= 3) coins += 15;    // 3 or 4 stars share the same coin bonus
        else if (metrics.stars === 2) coins += 8;
        else coins += 3;                        // completion always earns something
        if (metrics.maxCombo >= 3) coins += 5; // combo bonus (independent condition)

        if (window.coinManager?.awardCoins) {
            window.coinManager.awardCoins(coins, `memory level ${levelConfig.level}`);
        }

        return coins;
    }

    /**
     * Update game stats display
     */
    updateStats() {
        this.reconcileCompletionState();

        const movesEl = document.getElementById('memory-moves');
        const pairsEl = document.getElementById('memory-pairs');
        const progressFillEl = document.getElementById('memory-progress-fill');
        const levelEl = document.getElementById('memory-level');

        if (movesEl) movesEl.textContent = this.moves;
        if (pairsEl) pairsEl.textContent = `${this.matchedPairs} מתוך ${this.totalPairs}`;
        if (levelEl) levelEl.textContent = `${this.currentLevelIndex + 1}/${this.levelConfigs.length}`;

        if (progressFillEl) {
            const progress = this.totalPairs > 0 ? (this.matchedPairs / this.totalPairs) * 100 : 0;
            progressFillEl.style.width = `${progress}%`;
        }
    }

    reconcileCompletionState() {
        if (!Array.isArray(this.cards) || this.cards.length === 0) return;

        // Keep counter synced to card state, even if a previous async step was interrupted.
        const matchedPairsFromState = Math.floor(this.cards.filter(card => card.isMatched).length / 2);
        if (matchedPairsFromState > this.matchedPairs) {
            this.matchedPairs = matchedPairsFromState;
        }

        // Recovery path: if every card is face-up but one pair did not get counted,
        // treat remaining face-up cards as matched so the level can finish.
        const canRecover = !this.isProcessing && this.flippedCards.length === 0;
        const allCardsFaceUp = this.cards.every(card => card.isMatched || card.isFlipped);
        if (canRecover && allCardsFaceUp && this.matchedPairs < this.totalPairs) {
            this.cards.forEach((card, index) => {
                if (card.isMatched) return;
                card.isMatched = true;
                const grid = document.getElementById('memory-grid');
                const cardElement = grid?.querySelector(`[data-index="${index}"]`);
                if (cardElement) {
                    cardElement.classList.add('matched');
                    this.applyMatchedPairGradient(cardElement, card.pairId ?? 0);
                }
            });
            this.matchedPairs = this.totalPairs;
            console.warn('[MemoryGame] Recovered stale match state at end of level');
        }

        if (this.matchedPairs === this.totalPairs) {
            this.awaitingFinish = true;
            this.setFinishButtonVisible(true);
        }
    }

    hideBoardForSummary() {
        const gameContainer = document.getElementById('memory-game-container');
        if (gameContainer) gameContainer.style.display = 'none';
        this.setFinishButtonVisible(false);
        this.hideFeedback();
    }

    buildSummaryCard(innerHtml) {
        this.removeCompletionScreen();
        const gameEl = document.getElementById('memory-game');
        const completionDiv = document.createElement('div');
        completionDiv.className = 'game-complete';
        completionDiv.innerHTML = innerHtml;
        if (gameEl) gameEl.appendChild(completionDiv);
        return completionDiv;
    }

    removeCompletionScreen() {
        const gameEl = document.getElementById('memory-game');
        const completionDiv = gameEl?.querySelector('.game-complete');
        if (completionDiv) completionDiv.remove();
    }

    hideFeedback() {
        const feedback = document.getElementById('memory-feedback');
        if (feedback) feedback.style.display = 'none';
    }

    renderStars(count) {
        const clamped = Math.max(1, Math.min(4, Math.floor(count || 0)));
        return '⭐'.repeat(clamped);
    }

    // ── Daily Challenge helpers ────────────────────────────────────────────────

    getDailySeed(levelIndex) {
        try {
            const today = new Date();
            const key = [
                today.getFullYear(),
                today.getMonth() + 1,
                today.getDate(),
                'L',
                (levelIndex ?? 0) + 1
            ].join('-');

            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
            }
            return hash || 1;
        } catch {
            // Fallback: non-deterministic seed
            return Math.floor(Math.random() * 0xffffffff) || 1;
        }
    }

    seededRandom(seed) {
        let x = seed || 1;
        return () => {
            // xorshift32
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            return (x >>> 0) / 0xffffffff;
        };
    }

    seededSelectPairs(sourceWords, count, seed) {
        const pool = Array.isArray(sourceWords) ? [...sourceWords] : [];
        const rand = this.seededRandom(seed);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }
        return pool.slice(0, Math.max(0, count || 0));
    }

    // ── Personal Best (per-level, per-user) ───────────────────────────────────

    getCurrentUserIdForStats() {
        try {
            if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
                const id = authService.getCurrentUserId();
                if (id) return id;
            }
        } catch {
            // ignore
        }
        const legacy = localStorage.getItem('currentUser');
        return legacy || 'default';
    }

    getPersonalBestStorageKey() {
        const userId = this.getCurrentUserIdForStats();
        return `memoryBest_${userId}`;
    }

    loadAllPersonalBests() {
        try {
            const raw = localStorage.getItem(this.getPersonalBestStorageKey());
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    saveAllPersonalBests(all) {
        try {
            localStorage.setItem(this.getPersonalBestStorageKey(), JSON.stringify(all || {}));
        } catch {
            // If storage fails, just skip silently — game should never crash.
        }
    }

    isBetterResult(prev, next) {
        if (!prev) return true;
        if (!next) return false;
        if (next.score > prev.score) return true;
        if (next.score < prev.score) return false;
        if (typeof next.timeSeconds === 'number' && typeof prev.timeSeconds === 'number') {
            if (next.timeSeconds < prev.timeSeconds) return true;
            if (next.timeSeconds > prev.timeSeconds) return false;
        }
        if (typeof next.moves === 'number' && typeof prev.moves === 'number') {
            if (next.moves < prev.moves) return true;
            if (next.moves > prev.moves) return false;
        }
        return false;
    }

    updatePersonalBest(levelConfig, metrics, timeSeconds) {
        if (!levelConfig || !metrics) return null;

        const levelKey = String(levelConfig.level || (this.currentLevelIndex + 1));
        const all = this.loadAllPersonalBests();
        const prev = all[levelKey] || null;

        const currentRecord = {
            score: metrics.score || 0,
            timeSeconds: typeof timeSeconds === 'number' ? timeSeconds : null,
            moves: this.moves,
            stars: metrics.stars || 0,
            maxCombo: metrics.maxCombo || 0,
            date: new Date().toISOString().slice(0, 10)
        };

        const isNewBest = this.isBetterResult(prev, currentRecord);
        if (isNewBest) {
            all[levelKey] = currentRecord;
            this.saveAllPersonalBests(all);
        }

        return { isNewBest, previous: prev, best: isNewBest ? currentRecord : prev };
    }

    setFinishButtonVisible(visible) {
        const finishBtn = document.getElementById('memory-finish-btn');
        if (!finishBtn) return;

        if (!finishBtn.dataset.bound) {
            finishBtn.addEventListener('click', () => {
                if (!this.awaitingFinish) return;
                this.awaitingFinish = false;
                this.handleGameComplete();
            });
            finishBtn.dataset.bound = 'true';
        }

        finishBtn.style.display = visible ? 'inline-flex' : 'none';
    }

    showMatchFeedback(cardIndex, points, isFirstTry, combo) {
        const cardEl = document.getElementById('memory-grid')?.querySelector(`[data-index="${cardIndex}"]`);
        if (!cardEl) return;

        const popup = document.createElement('div');
        popup.className = 'match-score-popup';

        if (combo >= 3) popup.textContent = `🔥 ×${combo} קומבו! +${points}`;
        else if (combo === 2) popup.textContent = `⚡ קומבו! +${points}`;
        else if (isFirstTry) popup.textContent = `🎯 ראשון! +${points}`;
        else popup.textContent = `+${points}`;

        const rect = cardEl.getBoundingClientRect();
        popup.style.left = `${rect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top + window.scrollY - 8}px`;
        document.body.appendChild(popup);

        requestAnimationFrame(() => {
            setTimeout(() => popup.classList.add('fade-out'), 500);
        });
        setTimeout(() => popup.remove(), 1100);
    }

    applyMatchedPairGradient(cardElement, pairId) {
        if (!cardElement) return;
        const front = cardElement.querySelector('.memory-card-front');
        if (!front) return;

        const palette = [
            ['#11998e', '#38ef7d'],
            ['#3b82f6', '#22d3ee'],
            ['#8b5cf6', '#ec4899'],
            ['#f59e0b', '#f97316'],
            ['#ef4444', '#f43f5e'],
            ['#14b8a6', '#84cc16'],
            ['#6366f1', '#06b6d4'],
            ['#a855f7', '#f43f5e']
        ];

        const [start, end] = palette[Math.abs(pairId) % palette.length];
        front.style.setProperty('--match-grad-start', start);
        front.style.setProperty('--match-grad-end', end);
    }

    /**
     * Speak a word using speech synthesis
     */
    async speakWord(word) {
        if (typeof speechManager !== 'undefined') {
            await speechManager.speakWord(word, '', 'memory', true);
        }
    }

    /**
     * Normalize a raw word object into memory-safe fields.
     */
    normalizeWordObject(wordObj, index) {
        if (!wordObj || typeof wordObj !== 'object') return null;

        const normalizedWord = this.normalizeText(
            wordObj.word || wordObj.english || wordObj.term || wordObj.label || wordObj.text
        );

        const normalizedTranslation = this.normalizeText(
            wordObj.translation || wordObj.hebrew || wordObj.meaning || wordObj.native
        );

        const normalizedVisual = this.normalizeText(
            wordObj.image || wordObj.picture || wordObj.icon || wordObj.emoji
        );

        const safeWord = normalizedWord || `Word ${index + 1}`;
        const safeTranslation = normalizedTranslation || safeWord;

        // Preserve a separate visual field for emoji/icon usage on cards
        return { ...wordObj, word: safeWord, translation: safeTranslation, visual: normalizedVisual };
    }

    normalizeText(value) {
        if (typeof value !== 'string') return '';
        return value.trim();
    }

    playRevealAudio(card) {
        if (!card?.wordObj) return;

        // ── Audio diagnostic ───────────────────────────────────────────────────
        console.log('[MemoryGame:DIAG] playRevealAudio', {
            word: card.wordObj.word,
            cardIsFlipped: card.isFlipped,
            cardIsMatched: card.isMatched,
            flippedCards: JSON.stringify(this.flippedCards),
        });
        // ──────────────────────────────────────────────────────────────────────

        // Always speak the English word — Hebrew TTS is unreliable across devices
        // and would speak garbled output (raw Unicode bytes) when no Hebrew voice is installed.
        const englishWord = card.wordObj.word;
        this.speakWord(englishWord).catch(error => {
            console.warn('[MemoryGame] Reveal audio failed, continuing text-only mode:', error);
        });
    }

    async speakHebrewWord(word) {
        if (!word) return;
        if (typeof speechManager !== 'undefined' && typeof speechManager.speakHebrew === 'function') {
            await speechManager.speakHebrew(word, { allowOverlap: true });
        }
    }

    // ── Audio helpers ──────────────────────────────────────────────────────────

    getAudioContext() {
        if (window.audioEffects?.audioContext) return window.audioEffects.audioContext;
        if (!this._audioCtx) {
            try {
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                return null;
            }
        }
        return this._audioCtx;
    }

    async resumeAudioContext(ctx) {
        if (ctx?.state === 'suspended') await ctx.resume();
    }

    /**
     * Play a sequence of notes through a shared AudioContext.
     * @param {Array<{freq, start, duration, volume, type}>} notes
     */
    playNotes(notes) {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        this.resumeAudioContext(ctx).then(() => {
            const now = ctx.currentTime;
            notes.forEach(({ freq, start = 0, duration = 0.25, volume = 0.18, type = 'sine' }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = type;
                const t = now + start;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(volume, t + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
                osc.start(t);
                osc.stop(t + duration + 0.05);
            });
        }).catch(() => {});
    }

    /**
     * Inspiring ascending fanfare played when a level starts.
     * C5 → E5 → G5 → C6, warm sine wave.
     */
    playGameStartSound() {
        // Staggered C major arpeggio, each note slightly overlapping for warmth
        this.playNotes([
            { freq: 523.25, start: 0.0,  duration: 0.35, volume: 0.14 },  // C5
            { freq: 659.25, start: 0.18, duration: 0.35, volume: 0.16 },  // E5
            { freq: 783.99, start: 0.36, duration: 0.35, volume: 0.16 },  // G5
            { freq: 1046.50, start: 0.54, duration: 0.55, volume: 0.18 }, // C6 (held)
        ]);
    }

    /**
     * Crisp card-flip click: a very short pitched tap.
     */
    playFlipSound() {
        if (window.audioEffects?.playClick) {
            window.audioEffects.playClick();
        } else {
            this.playNotes([{ freq: 700, start: 0, duration: 0.06, volume: 0.1, type: 'sine' }]);
        }
    }

    /**
     * Happy match celebration: C5-E5-G5-C6 arpeggio (joyful, kids-friendly).
     */
    playMatchSound() {
        if (window.audioEffects?.playCorrect) {
            window.audioEffects.playCorrect();
        } else {
            this.playNotes([
                { freq: 523.25, start: 0.0,  duration: 0.22, volume: 0.18 }, // C5
                { freq: 659.25, start: 0.1,  duration: 0.22, volume: 0.18 }, // E5
                { freq: 783.99, start: 0.2,  duration: 0.22, volume: 0.18 }, // G5
            ]);
        }
    }

    /**
     * Gentle "try again" sound for mismatches — soft, encouraging, not harsh.
     * A quiet descending wobble using triangle wave (kids-safe).
     */
    playMismatchSound() {
        this.playNotes([
            { freq: 440, start: 0.0,  duration: 0.18, volume: 0.10, type: 'triangle' }, // A4
            { freq: 370, start: 0.15, duration: 0.22, volume: 0.09, type: 'triangle' }, // F#4
        ]);
    }

    /**
     * Level complete sound — triumphant 5-note rising fanfare.
     * For the final level (game win) plays a richer full victory.
     * @param {boolean} isLastLevel
     * @param {number} stars - 1|2|3
     */
    playLevelCompleteSound(isLastLevel, stars) {
        if (isLastLevel) {
            // Full victory: use the existing victory fanfare if available
            if (window.audioEffects?.playVictory) {
                window.audioEffects.playVictory();
            } else {
                // Epic G major fanfare: G4-C5-E5-G5-C6
                this.playNotes([
                    { freq: 392.00, start: 0.0,  duration: 0.25, volume: 0.20, type: 'square' }, // G4
                    { freq: 523.25, start: 0.2,  duration: 0.25, volume: 0.20, type: 'square' }, // C5
                    { freq: 659.25, start: 0.4,  duration: 0.25, volume: 0.20, type: 'square' }, // E5
                    { freq: 783.99, start: 0.6,  duration: 0.35, volume: 0.20, type: 'square' }, // G5
                    { freq: 1046.50, start: 0.85, duration: 0.6, volume: 0.22, type: 'square' }, // C6
                ]);
            }
        } else {
            // Level up: rising melody with a hopeful feel
            if (window.audioEffects?.playLevelUp) {
                window.audioEffects.playLevelUp();
            } else {
                this.playNotes([
                    { freq: 523.25, start: 0.0,  duration: 0.2,  volume: 0.17 }, // C5
                    { freq: 659.25, start: 0.18, duration: 0.2,  volume: 0.17 }, // E5
                    { freq: 783.99, start: 0.36, duration: 0.35, volume: 0.19 }, // G5 (held)
                ]);
            }
        }
    }

    /**
     * Clean up and hide game
     */
    /**
     * Cancel any in-progress flip when the user navigates away mid-game.
     * Unflips the pending card(s) so the DOM and data model stay in sync,
     * preventing the "phantom flipped card" bug on the next resume.
     */
    cancelFlipInProgress() {
        if (this.flippedCards.length === 0) return;
        console.log('[MemoryGame] cancelFlipInProgress — unflipping', this.flippedCards);
        this.flippedCards.forEach(index => {
            if (this.cards[index] && !this.cards[index].isMatched) {
                this.flipCard(index, false);
            }
        });
        this.flippedCards = [];
        this.isProcessing = false;
        this._boardLockedUntil = 0;
    }

    cleanup() {
        const container = document.getElementById('memory-game-container');
        if (container) container.style.display = 'none';

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.moves = 0;
        this.isProcessing = false;
        this.processingToken = 0;
        this.gameWords = [];
        this.sourceWords = [];
        this.awaitingFinish = false;
        this.currentLevelIndex = 0;
        this.currentGridColumns = 4;
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.runningScore = 0;
        this.cardFlipCount = {};
        this.setFinishButtonVisible(false);
        this.removeCompletionScreen();
        this.hideFeedback();
    }
}
