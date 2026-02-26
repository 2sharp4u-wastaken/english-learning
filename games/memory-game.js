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

        console.log('[MemoryGame] Initialized');
    }

    /**
     * Load a level question (called by GameManager via loadQuestion dispatch)
     * @param {Object} question - { level, pairs, columns, words }
     */
    loadQuestion(question) {
        this.removeCompletionScreen();
        this.hideFeedback();

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
        this.awaitingFinish = false;
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.runningScore = 0;
        this.cardFlipCount = {};

        this.createCardPairs();
        this.renderGameBoard();
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

        this.cards = this.cards.sort(() => Math.random() - 0.5);
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

        grid.innerHTML = '';

        const cardsCount = this.cards.length;
        const columnsByCards = Math.max(4, Math.ceil(cardsCount / 3));
        const columns = Math.max(this.currentGridColumns || 4, columnsByCards);
        grid.style.gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
        grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

        this.cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            grid.appendChild(cardElement);
        });

        container.style.display = 'block';
    }

    /**
     * Create a single card element
     */
    createCardElement(card, index) {
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
            // Translation cards: text-only (Hebrew)
            cardFront.textContent = safeContent;
            cardFront.classList.add('memory-card-translation');
            cardFront.style.fontSize = safeContent.length > 10 ? '0.95em' : '1.1em';
        }

        const cardBack = document.createElement('div');
        cardBack.className = 'memory-card-back';
        cardBack.innerHTML = '<div class="card-pattern">?</div>';

        cardInner.appendChild(cardBack);
        cardInner.appendChild(cardFront);
        cardDiv.appendChild(cardInner);

        cardDiv.addEventListener('click', () => this.handleCardClick(index));

        return cardDiv;
    }

    /**
     * Handle card click
     */
    async handleCardClick(index) {
        const card = this.cards[index];
        if (!card) return;

        // Allow replaying pronunciation on already matched cards.
        if (card.isMatched) {
            this.playRevealAudio(card);
            return;
        }

        if (this.isProcessing) return;
        if (card.isFlipped) return;

        this.flipCard(index, true);
        this.cardFlipCount[index] = (this.cardFlipCount[index] || 0) + 1;
        this.playFlipSound();
        this.playRevealAudio(card);
        this.flippedCards.push(index);

        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            this.moves++;
            this.updateStats();

            // Safety: force-release the lock after 2s if processing got stuck.
            // Also visually unflip any non-matched cards so they aren't permanently stuck face-up.
            const safetyFlipped = [...this.flippedCards];
            setTimeout(() => {
                if (this.isProcessing) {
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

        const cardElement = document.querySelector(`[data-index="${index}"]`);
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

        this.cards[index1].isMatched = true;
        this.cards[index2].isMatched = true;

        const cardElement1 = document.querySelector(`[data-index="${index1}"]`);
        const cardElement2 = document.querySelector(`[data-index="${index2}"]`);

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
            this.flipCard(index1, false);
            this.flipCard(index2, false);
            this.flippedCards = [];
            this.isProcessing = false;
        }, 1000);
    }

    /**
     * Handle level completion — show brief summary then advance via GameManager
     */
    handleGameComplete() {
        const levelConfig = this.levelConfigs[this.currentLevelIndex];
        const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const metrics = this.calculateLevelPerformance(this.moves, timeElapsed, levelConfig);
        const levelCoins = this.awardLevelRewards(metrics, levelConfig);

        const personalBestInfo = this.updatePersonalBest(levelConfig, metrics, timeElapsed);

        console.log(`[MemoryGame] Level ${levelConfig.level} complete. Score: ${metrics.score}, stars: ${metrics.stars}`);

        if (window.gameManager) {
            window.gameManager.scores['memory'] += metrics.score;
        }

        this.hideBoardForSummary();

        const isLastLevel = this.currentLevelIndex >= this.levelConfigs.length - 1;
        const starLine = this.renderStars(metrics.stars);
        const headingHtml = isLastLevel
            ? `<i class="fas fa-trophy"></i> משחק הושלם!`
            : `<i class="fas fa-arrow-up"></i> רמה ${levelConfig.level} הושלמה!`;

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
                        ${personalBestInfo?.best
                            ? `<p class="memory-personal-best-line">
                                שיא אישי: ${personalBestInfo.best.score ?? metrics.score} נק׳
                                · ${personalBestInfo.best.timeSeconds ?? timeElapsed} שניות
                                · ${personalBestInfo.best.moves ?? this.moves} מהלכים
                               </p>`
                            : ''
                        }
                        ${personalBestInfo?.isNewBest ? `<p class="memory-personal-best">🏆 שיא אישי! חדש לרמה זו</p>` : ''}
                    </div>
                </div>
            </div>
        `);

        if (metrics.stars === 3 && typeof confetti === 'function') {
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
                if (window.gamificationManager?.updateGameCardProgress) {
                    window.gamificationManager.updateGameCardProgress('memory');
                }
            } catch (e) {
                console.warn('[MemoryGame] Failed to update global progress for memory:', e);
            }
        }

        // Auto-advance after showing stars (GameManager drives the next level or endGame)
        setTimeout(() => {
            completionDiv.remove();
            if (window.gameManager) {
                window.gameManager.currentQuestionIndex++;
                window.gameManager.saveGameState();
                window.gameManager.loadQuestion('memory');
            }
        }, 2500);
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
                const cardElement = document.querySelector(`[data-index="${index}"]`);
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
        const cardEl = document.querySelector(`[data-index="${cardIndex}"]`);
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
    cleanup() {
        const container = document.getElementById('memory-game-container');
        if (container) container.style.display = 'none';

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.moves = 0;
        this.isProcessing = false;
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
