// Game Logic for English Learning Games
// Refactored to use modular game files

// Import game modules
import * as VocabularyGame from './games/vocabulary-game.js?t=1762595926';
import * as GrammarGame from './games/grammar-game.js?t=1762595926';
import * as ListeningGame from './games/listening-game.js?t=1762609545';
import * as PronunciationGame from './games/pronunciation-game.js?t=1762610965';
import * as ReadingGame from './games/reading-game.js?t=1762608590';

// Game Logic for English Learning Games

// ============================================
// GAME CONFIGURATION CONSTANTS
// ============================================
const GAME_CONFIG = {
    MAX_QUESTIONS: 10,
    MAX_AUDIO_PLAYS: 8,
    MIN_FILTERED_VOCABULARY: 20,
    WRONG_OPTIONS_COUNT: 3,
    SHUFFLE_PASSES: 3,
    FEEDBACK_DISPLAY_DURATION: 2000,
    DEFAULT_GAME: 'vocabulary',
    DEFAULT_LANGUAGE: 'he'
};

// ============================================
// GAME MANAGER CLASS
// ============================================
class GameManager {
    constructor() {
        this.currentGame = GAME_CONFIG.DEFAULT_GAME;
        this.currentLanguage = GAME_CONFIG.DEFAULT_LANGUAGE;
        this.scores = {
            vocabulary: 0,
            grammar: 0,
            pronunciation: 0,
            listening: 0,
            reading: 0
        };
        this.currentQuestionIndex = 0;

        // Load settings
        this.loadSettings();

        this.gameData = {};
        this.shuffledQuestions = [];
        this.isGameActive = false;
        this.builtWord = '';
        this.currentTargetWord = '';
        this.currentQuestionAttempts = 0; // Track attempts for current question

        // Exit flow management
        this.pendingNavigation = null; // Stores pending navigation target during exit confirmation
        this.exitCallbacks = {}; // Stores callbacks for exit actions
        this.wordDisplayTimer = null; // Track word display timer
        this.i18n = {
            en: {
                listening_great: 'Great listening!',
                listen_better: 'Listen more carefully next time',
                correct_short: 'Correct',
            },
            he: {
                listening_great: 'הקשבה מעולה!',
                listen_better: 'הקשב יותר בעירנות בפעם הבאה',
                correct_short: 'נכון',
            }
        };

        // Bind game module methods to this instance
        this.loadVocabularyQuestion = VocabularyGame.loadVocabularyQuestion.bind(this);
        this.checkVocabularyAnswer = VocabularyGame.checkVocabularyAnswer.bind(this);
        this.loadGrammarQuestion = GrammarGame.loadGrammarQuestion.bind(this);
        this.checkGrammarAnswer = GrammarGame.checkGrammarAnswer.bind(this);
        this.loadListeningQuestion = ListeningGame.loadListeningQuestion.bind(this);
        this.showListeningHebrew = ListeningGame.showListeningHebrew.bind(this);
        this.checkListeningAnswer = ListeningGame.checkListeningAnswer.bind(this);
        this.loadPronunciationQuestion = PronunciationGame.loadPronunciationQuestion.bind(this);
        this.toggleRecording = PronunciationGame.toggleRecording.bind(this);
        this.processPronunciationResult = PronunciationGame.processPronunciationResult.bind(this);
        this.loadReadingQuestion = ReadingGame.loadReadingQuestion.bind(this);
        this.createLetterBank = ReadingGame.createLetterBank.bind(this);
        this.addLetterToWord = ReadingGame.addLetterToWord.bind(this);
        this.clearBuiltWord = ReadingGame.clearBuiltWord.bind(this);
        this.checkBuiltWord = ReadingGame.checkBuiltWord.bind(this);

        // Initialize the game after all bindings are set up
        this.initializeGame();
    }

    loadSettings() {
        // Load settings from localStorage
        const saved = localStorage.getItem('englishLearningSettings');
        if (saved) {
            try {
                this.settings = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading settings:', error);
                this.settings = this.getDefaultSettings();
            }
        } else {
            this.settings = this.getDefaultSettings();
        }

        // Apply settings to game parameters
        this.totalQuestions = this.settings.questionsPerGame || GAME_CONFIG.MAX_QUESTIONS;
        this.audioPlaysLeft = this.settings.audioPlaysAllowed || GAME_CONFIG.MAX_AUDIO_PLAYS;
        this.clickRepeatCount = this.settings.clickRepeatCount || GAME_CONFIG.WRONG_OPTIONS_COUNT;
        this.showPictures = this.settings.showPictures || false;
        this.selectedCategories = this.settings.selectedCategories || [];

        console.log('Settings loaded:', this.settings);
    }

    getDefaultSettings() {
        return {
            selectedCategories: ['animals', 'colors', 'numbers', 'food', 'minecraft', 'gaming', 'roblox'],
            autoPlay: true,
            questionsPerGame: GAME_CONFIG.MAX_QUESTIONS,
            clickRepeatCount: GAME_CONFIG.WRONG_OPTIONS_COUNT,
            audioPlaysAllowed: GAME_CONFIG.MAX_AUDIO_PLAYS,
            difficulty: 'beginner',
            theme: 'classic',
            showPictures: false,
            enhancedShuffle: true,
            preventConsecutiveCategories: true,
            showConfetti: true,
            saveProgress: true
        };
    }

    enableOptionKeyboardNavigation(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.addEventListener('keydown', (ev) => {
            const keys = ['ArrowLeft', 'ArrowRight'];
            if (!keys.includes(ev.key)) return;
            const buttons = Array.from(container.querySelectorAll('.option-btn'));
            if (!buttons.length) return;
            const active = document.activeElement;
            const idx = buttons.indexOf(active);
            if (idx === -1) return;
            ev.preventDefault();
            let nextIdx = idx + (ev.key === 'ArrowRight' ? 1 : -1);
            if (nextIdx < 0) nextIdx = buttons.length - 1;
            if (nextIdx >= buttons.length) nextIdx = 0;
            buttons[nextIdx].focus();
        });
    }

    t(key) {
        const lang = this.currentLanguage === 'en' ? 'en' : 'he';
        return (this.i18n[lang] && this.i18n[lang][key]) || this.i18n.he[key] || '';
    }

    // ============================================
    // GAME STATE MANAGEMENT
    // ============================================

    saveGameState() {
        if (!this.isGameActive || !this.currentGame) return;

        const userId = localStorage.getItem('currentUser') || 'default';
        const gameState = {
            gameType: this.currentGame,
            currentQuestionIndex: this.currentQuestionIndex,
            score: this.scores[this.currentGame],
            totalQuestions: this.totalQuestions,
            timestamp: Date.now(),
            shuffledQuestions: this.shuffledQuestions
        };

        localStorage.setItem(`savedGame_${userId}_${this.currentGame}`, JSON.stringify(gameState));
        console.log('Game state saved:', gameState);
    }

    loadGameState(gameType) {
        const userId = localStorage.getItem('currentUser') || 'default';
        const saved = localStorage.getItem(`savedGame_${userId}_${gameType}`);

        if (!saved) return null;

        try {
            const gameState = JSON.parse(saved);
            // Check if state is not too old (e.g., within 24 hours)
            const ageHours = (Date.now() - gameState.timestamp) / (1000 * 60 * 60);
            if (ageHours > 24) {
                this.deleteGameState(gameType);
                return null;
            }
            return gameState;
        } catch (error) {
            console.error('Error loading game state:', error);
            return null;
        }
    }

    deleteGameState(gameType) {
        const userId = localStorage.getItem('currentUser') || 'default';
        localStorage.removeItem(`savedGame_${userId}_${gameType}`);
    }

    getAllSavedGames() {
        const userId = localStorage.getItem('currentUser') || 'default';
        const savedGames = [];
        const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading'];

        gameTypes.forEach(gameType => {
            const state = this.loadGameState(gameType);
            if (state) {
                savedGames.push(state);
            }
        });

        return savedGames;
    }

    // ============================================
    // WORD MASTERY TRACKING
    // ============================================

    recordWordAttempt(word, category, isCorrect, responseTime, gameType) {
        // Track word attempt immediately (even if game exits early)
        if (!window.app || !window.app.userProgress) {
            console.warn('Cannot record word attempt: app not initialized');
            return;
        }

        // Get existing stats or create new
        let wordStats = window.app.getWordStats(word, category);

        if (!wordStats) {
            // First time seeing this word
            wordStats = {
                word: word,
                category: category,
                totalAttempts: 0,
                correctAttempts: 0,
                incorrectAttempts: 0,
                consecutiveCorrect: 0,
                lastSeen: null,
                lastResult: null,
                masteryLevel: 0,
                gameTypeStats: {}
            };
        }

        // Update attempts
        wordStats.totalAttempts++;
        if (isCorrect) {
            wordStats.correctAttempts++;
            wordStats.consecutiveCorrect++;
        } else {
            wordStats.incorrectAttempts++;
            wordStats.consecutiveCorrect = 0;  // Reset streak on incorrect
        }

        // Update metadata
        wordStats.lastSeen = new Date().toISOString();
        wordStats.lastResult = isCorrect ? 'correct' : 'incorrect';

        // Track per game type
        if (!wordStats.gameTypeStats[gameType]) {
            wordStats.gameTypeStats[gameType] = { correct: 0, total: 0 };
        }
        wordStats.gameTypeStats[gameType].total++;
        if (isCorrect) {
            wordStats.gameTypeStats[gameType].correct++;
        }

        // Calculate mastery level
        wordStats.masteryLevel = window.app.calculateMastery(wordStats);

        // Save immediately to localStorage
        window.app.saveWordStats(word, category, wordStats);

        console.log(`Word tracked: ${word} (${category}) - ${isCorrect ? 'Correct' : 'Incorrect'} - Mastery: ${(wordStats.masteryLevel * 100).toFixed(0)}%`);
    }

    populateResumeGames() {
        const savedGames = this.getAllSavedGames();
        const resumeSection = document.getElementById('resume-games-section');
        const resumeGrid = document.getElementById('resume-games-grid');

        if (!resumeSection || !resumeGrid) return;

        if (savedGames.length === 0) {
            resumeSection.style.display = 'none';
            return;
        }

        // Clear existing cards
        resumeGrid.innerHTML = '';

        // Create resume cards
        savedGames.forEach(gameState => {
            const card = this.createResumeCard(gameState);
            resumeGrid.appendChild(card);
        });

        resumeSection.style.display = 'block';
    }

    createResumeCard(gameState) {
        const card = document.createElement('div');
        card.className = 'resume-card';

        const progress = ((gameState.currentQuestionIndex / gameState.totalQuestions) * 100).toFixed(0);
        const timeAgo = this.getTimeAgo(gameState.timestamp);

        card.innerHTML = `
            <div class="resume-card-header">
                <h3 class="resume-card-title">
                    ${this.getGameIcon(gameState.gameType)}
                    ${this.getGameName(gameState.gameType)}
                </h3>
                <button class="resume-card-delete" title="מחק משחק שמור">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="resume-card-progress">
                <div class="resume-progress-text">
                    התקדמות: ${gameState.currentQuestionIndex}/${gameState.totalQuestions} שאלות
                </div>
                <div class="resume-progress-bar">
                    <div class="resume-progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            <div class="resume-card-score">
                ⭐ ניקוד: ${gameState.score} נקודות
            </div>
            <div class="resume-card-time">
                🕒 ${timeAgo}
            </div>
        `;

        // Add click handler to resume game
        card.addEventListener('click', (e) => {
            // Don't resume if clicking delete button
            if (e.target.closest('.resume-card-delete')) return;
            this.resumeGame(gameState);
        });

        // Add delete handler
        const deleteBtn = card.querySelector('.resume-card-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`למחוק את משחק ${this.getGameName(gameState.gameType)}?`)) {
                this.deleteGameState(gameState.gameType);
                this.populateResumeGames(); // Refresh
            }
        });

        return card;
    }

    resumeGame(gameState) {
        console.log('Resuming game:', gameState);

        // Restore game state
        this.currentGame = gameState.gameType;
        this.currentQuestionIndex = gameState.currentQuestionIndex;
        this.scores[gameState.gameType] = gameState.score;
        this.shuffledQuestions = gameState.shuffledQuestions;
        this.totalQuestions = gameState.totalQuestions;
        this.isGameActive = true;

        // Switch to the game
        this.performGameSwitch(gameState.gameType);

        // Update score and progress UI
        this.updateScore(gameState.gameType);
        this.updateProgress(gameState.gameType);

        // Load current question
        this.loadQuestion(gameState.gameType);

        // Show toast
        this.showToast(`ממשיך משחק ${this.getGameName(gameState.gameType)}!`);
    }

    getGameIcon(gameType) {
        const icons = {
            vocabulary: '📚',
            grammar: '✏️',
            pronunciation: '🎤',
            listening: '👂',
            reading: '📖'
        };
        return icons[gameType] || '🎮';
    }

    getTimeAgo(timestamp) {
        const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
        if (minutes < 1) return 'כרגע';
        if (minutes < 60) return `לפני ${minutes} דקות`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `לפני ${hours} שעות`;
        const days = Math.floor(hours / 24);
        return `לפני ${days} ימים`;
    }

    // ============================================
    // EXIT FLOW MANAGEMENT
    // ============================================

    shouldShowExitConfirmation() {
        if (!this.isGameActive) return false;

        const settings = this.settings || {};
        const exitBehavior = settings.exitBehavior || 'hybrid';
        const threshold = settings.exitThreshold || 3;
        const currentQuestion = this.currentQuestionIndex + 1;

        switch (exitBehavior) {
            case 'confirmation':
                return true; // Always show confirmation
            case 'autosave':
                return false; // Never show confirmation, just auto-save
            case 'smart':
                // 1-3: no confirmation, 4-7: confirmation, 8+: autosave
                if (currentQuestion <= threshold) return false;
                if (currentQuestion >= 8) return false;
                return true;
            case 'hybrid':
            default:
                // 1-threshold: quick bar, threshold+: full modal
                return currentQuestion > threshold;
        }
    }

    getExitUIType() {
        if (!this.isGameActive) return 'none';

        const settings = this.settings || {};
        const exitBehavior = settings.exitBehavior || 'hybrid';
        const threshold = settings.exitThreshold || 3;
        const currentQuestion = this.currentQuestionIndex + 1;

        if (exitBehavior === 'autosave') return 'toast';
        if (exitBehavior === 'confirmation') return 'modal';

        if (exitBehavior === 'smart') {
            if (currentQuestion <= threshold) return 'none';
            if (currentQuestion >= 8) return 'toast';
            return 'modal';
        }

        // Hybrid (default)
        if (currentQuestion <= threshold) return 'bar';
        return 'modal';
    }

    showExitConfirmation(targetGame, onConfirm) {
        const uiType = this.getExitUIType();

        if (uiType === 'none') {
            // No confirmation needed, just navigate
            onConfirm();
            return;
        }

        if (uiType === 'toast') {
            // Auto-save and show toast
            this.saveGameState();
            this.showToast(`משחק ${this.getGameName(this.currentGame)} נשמר - ${this.currentQuestionIndex + 1}/${this.totalQuestions}`);
            onConfirm();
            return;
        }

        if (uiType === 'bar') {
            this.showExitBar(onConfirm);
            return;
        }

        if (uiType === 'modal') {
            this.showExitModal(targetGame, onConfirm);
            return;
        }
    }

    showExitModal(targetGame, onConfirm) {
        const modal = document.getElementById('exit-modal');
        const scoreEl = document.getElementById('exit-current-score');
        const questionEl = document.getElementById('exit-current-question');
        const totalEl = document.getElementById('exit-total-questions');
        const warningEl = document.getElementById('exit-warning-message');
        const saveBtn = document.getElementById('exit-and-save-btn');
        const continueBtn = document.getElementById('exit-continue-btn');

        if (!modal) return;

        // Update modal content
        if (scoreEl) scoreEl.textContent = this.scores[this.currentGame];
        if (questionEl) questionEl.textContent = this.currentQuestionIndex + 1;
        if (totalEl) totalEl.textContent = this.totalQuestions;

        const settings = this.settings || {};
        if (warningEl) {
            if (settings.autoSaveProgress !== false) {
                warningEl.textContent = 'הניקוד יישמר בסטטיסטיקות';
            } else {
                warningEl.textContent = '⚠️ ההתקדמות תאבד!';
                warningEl.style.color = '#ef4444';
            }
        }

        // Clean up old listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        const newContinueBtn = continueBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);

        // Add new listeners
        newSaveBtn.addEventListener('click', () => {
            if (settings.autoSaveProgress !== false) {
                this.saveGameState();
            }
            modal.classList.remove('show');
            if (settings.showExitToast !== false) {
                this.showToast('המשחק נשמר בהצלחה');
            }
            onConfirm();
        });

        newContinueBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        modal.classList.add('show');
    }

    showExitBar(onConfirm) {
        const bar = document.getElementById('exit-bar');
        const confirmBtn = document.getElementById('exit-bar-confirm');
        const cancelBtn = document.getElementById('exit-bar-cancel');

        if (!bar) return;

        // Clean up old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Add new listeners
        newConfirmBtn.addEventListener('click', () => {
            bar.classList.remove('show');
            onConfirm();
        });

        newCancelBtn.addEventListener('click', () => {
            bar.classList.remove('show');
        });

        bar.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            bar.classList.remove('show');
        }, 5000);
    }

    showToast(message, icon = 'fa-check-circle', color = null) {
        const toast = document.getElementById('toast');
        const messageEl = document.getElementById('toast-message');
        const iconEl = toast?.querySelector('i');

        if (!toast || !messageEl) return;

        messageEl.textContent = message;
        if (iconEl) {
            iconEl.className = `fas ${icon}`;
        }
        if (color) {
            toast.style.background = color;
        }

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            // Reset color
            if (color) {
                setTimeout(() => {
                    toast.style.background = '';
                }, 300);
            }
        }, 3000);
    }

    getGameName(gameType) {
        const names = {
            vocabulary: 'אוצר מילים',
            grammar: 'דקדוק',
            pronunciation: 'הגייה',
            listening: 'הקשבה',
            reading: 'קריאה'
        };
        return names[gameType] || gameType;
    }

    initializeGame() {
        try {
            console.log('Initializing game...');
            this.setupEventListeners();
            this.loadGameData();
            console.log('Game data loaded:', this.gameData);
            // Populate resume games on welcome screen
            this.populateResumeGames();
            // Don't auto-start game - wait for user selection from welcome screen
            console.log('Game manager ready, waiting for game selection');
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    }

    setupEventListeners() {
        // Game selector buttons - direct switching
        const gameBtns = document.querySelectorAll('.game-btn');
        if (gameBtns) {
            gameBtns.forEach(btn => {
                // Remove any existing listeners by replacing the button
                // This prevents duplicate listeners if setupEventListeners is called multiple times
                const clone = btn.cloneNode(true);
                btn.parentNode.replaceChild(clone, btn);

                clone.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Get gameType from the button element (e.currentTarget)
                    const gameType = e.currentTarget?.dataset?.game;
                    if (gameType) {
                        this.switchGame(gameType);
                    } else {
                        console.warn('Game button clicked without data-game attribute:', e.currentTarget);
                    }
                });
            });
        }

        // Vocabulary game events
        const vocabAudioElement = document.getElementById('vocab-audio');
        if (vocabAudioElement) {
            vocabAudioElement.addEventListener('click', () => {
                this.playCurrentQuestionAudio();
            });
        }
        
        const vocabNextElement = document.getElementById('vocab-next');
        if (vocabNextElement) {
            vocabNextElement.addEventListener('click', () => {
                this.nextQuestion('vocabulary');
            });
        }

        // Grammar game events
        const grammarNextElement = document.getElementById('grammar-next');
        if (grammarNextElement) {
            grammarNextElement.addEventListener('click', () => {
                this.nextQuestion('grammar');
            });
        }

        // Pronunciation game events
        const pronunciationListenElement = document.getElementById('pronunciation-listen');
        if (pronunciationListenElement) {
            pronunciationListenElement.addEventListener('click', () => {
                this.playCurrentQuestionAudio();
            });
        }
        
        const recordBtnElement = document.getElementById('record-btn');
        if (recordBtnElement) {
            recordBtnElement.addEventListener('click', () => {
                this.toggleRecording();
            });
        }
        
        const pronunciationNextElement = document.getElementById('pronunciation-next');
        if (pronunciationNextElement) {
            pronunciationNextElement.addEventListener('click', () => {
                this.nextQuestion('pronunciation');
            });
        }

        // Listening game events
        const listeningAudioElement = document.getElementById('listening-audio');
        if (listeningAudioElement) {
            listeningAudioElement.addEventListener('click', () => {
                this.playCurrentQuestionAudio();
            });
        }
        
        const listeningNextElement = document.getElementById('listening-next');
        if (listeningNextElement) {
            listeningNextElement.addEventListener('click', () => {
                this.nextQuestion('listening');
            });
        }

        // Reading game events
        const readingAudioElement = document.getElementById('reading-audio');
        if (readingAudioElement) {
            readingAudioElement.addEventListener('click', () => {
                this.playCurrentQuestionAudio();
            });
        }
        
        const clearWordElement = document.getElementById('clear-word');
        if (clearWordElement) {
            clearWordElement.addEventListener('click', () => {
                console.log('Clear word button clicked');
                this.clearBuiltWord();
            });
        } else {
            console.error('clear-word element not found during setup');
        }
        
        const checkWordElement = document.getElementById('check-word');
        if (checkWordElement) {
            checkWordElement.addEventListener('click', () => {
                this.checkBuiltWord();
            });
        }
        
        const readingNextElement = document.getElementById('reading-next');
        if (readingNextElement) {
            readingNextElement.addEventListener('click', () => {
                this.nextQuestion('reading');
            });
        }
    }

    loadGameData() {
        // Check if gameData is available
        if (typeof gameData === 'undefined' || !gameData) {
            console.error('gameData is not loaded yet');
            return;
        }

        // Get difficulty setting
        const difficulty = this.settings && this.settings.difficulty ? this.settings.difficulty : 'beginner';
        console.log(`Loading game data with difficulty: ${difficulty}`);

        // Filter vocabulary by selected categories
        let filteredVocabulary = gameData.vocabulary;

        if (this.selectedCategories && this.selectedCategories.length > 0) {
            filteredVocabulary = gameData.vocabulary.filter(item =>
                this.selectedCategories.includes(item.category)
            );
            console.log(`Filtered vocabulary to ${filteredVocabulary.length} words from ${this.selectedCategories.length} categories`);
        }

        // Apply difficulty filter to vocabulary (based on word length since no difficulty property)
        if (difficulty === 'beginner') {
            // Beginner: shorter words (3-5 letters)
            filteredVocabulary = filteredVocabulary.filter(item =>
                !item.word || item.word.length <= 6
            );
        } else if (difficulty === 'intermediate') {
            // Intermediate: medium words (3-8 letters)
            filteredVocabulary = filteredVocabulary.filter(item =>
                !item.word || item.word.length <= 9
            );
        }
        // Advanced: include all words

        // If filtered vocabulary is too small, use all vocabulary
        if (filteredVocabulary.length < GAME_CONFIG.MIN_FILTERED_VOCABULARY) {
            console.warn('Filtered vocabulary too small, using all vocabulary');
            filteredVocabulary = gameData.vocabulary;
        }

        // Filter grammar by difficulty (grammar questions have difficulty property)
        let filteredGrammar = [...gameData.grammar];
        if (difficulty === 'beginner') {
            filteredGrammar = filteredGrammar.filter(item =>
                !item.difficulty || item.difficulty === 'beginner'
            );
        } else if (difficulty === 'intermediate') {
            filteredGrammar = filteredGrammar.filter(item =>
                !item.difficulty ||
                item.difficulty === 'beginner' ||
                item.difficulty === 'intermediate'
            );
        }
        // Advanced: include all

        // Filter all game data by selected categories
        const filteredPronunciation = this.selectedCategories && this.selectedCategories.length > 0
            ? gameData.pronunciation.filter(item => this.selectedCategories.includes(item.category))
            : gameData.pronunciation;

        const filteredListening = this.selectedCategories && this.selectedCategories.length > 0
            ? gameData.listening.filter(item => this.selectedCategories.includes(item.category))
            : gameData.listening;

        const filteredReading = this.selectedCategories && this.selectedCategories.length > 0
            ? gameData.reading.filter(item => this.selectedCategories.includes(item.category))
            : gameData.reading;

        // Apply difficulty filter to pronunciation, listening, reading (based on word length)
        let difficultyFilteredPronunciation = filteredPronunciation;
        let difficultyFilteredListening = filteredListening;
        let difficultyFilteredReading = filteredReading;

        if (difficulty === 'beginner') {
            difficultyFilteredPronunciation = filteredPronunciation.filter(item => !item.word || item.word.length <= 6);
            difficultyFilteredListening = filteredListening.filter(item => !item.word || item.word.length <= 6);
            difficultyFilteredReading = filteredReading.filter(item => !item.word || item.word.length <= 6);
        } else if (difficulty === 'intermediate') {
            difficultyFilteredPronunciation = filteredPronunciation.filter(item => !item.word || item.word.length <= 9);
            difficultyFilteredListening = filteredListening.filter(item => !item.word || item.word.length <= 9);
            difficultyFilteredReading = filteredReading.filter(item => !item.word || item.word.length <= 9);
        }

        this.gameData = {
            vocabulary: [...filteredVocabulary],
            grammar: filteredGrammar,
            pronunciation: difficultyFilteredPronunciation,
            listening: difficultyFilteredListening,
            reading: difficultyFilteredReading
        };

        console.log('Game data loaded with filtered categories and difficulty:', {
            difficulty: difficulty,
            vocabulary: this.gameData.vocabulary.length,
            grammar: this.gameData.grammar.length,
            pronunciation: this.gameData.pronunciation.length,
            listening: this.gameData.listening.length,
            reading: this.gameData.reading.length
        });
    }

    switchGame(gameType) {
        // Validate gameType
        if (!gameType || gameType === 'undefined' || gameType === 'null') {
            console.error('switchGame called with invalid gameType:', gameType);
            return;
        }

        // Validate that the game element exists
        const gameElement = document.getElementById(`${gameType}-game`);
        if (!gameElement) {
            console.error(`Invalid game type "${gameType}" - no matching game element found`);
            return;
        }

        // Check if we need to show exit confirmation
        if (this.isGameActive && gameType !== this.currentGame) {
            const uiType = this.getExitUIType();
            if (uiType !== 'none') {
                // Show exit confirmation and wait for user response
                this.showExitConfirmation(gameType, () => {
                    // User confirmed exit, proceed with switch
                    this.performGameSwitch(gameType);
                });
                return;
            }
        }

        // No confirmation needed, switch directly
        this.performGameSwitch(gameType);
    }

    performGameSwitch(gameType) {
        // Cancel any ongoing speech from previous game
        speechManager.cancelSpeech();

        // Set new game context for speech manager
        speechManager.setGameContext(gameType);

        // Clean up any completion screens from ALL games
        document.querySelectorAll('.game-complete').forEach(completion => {
            completion.remove();
        });

        // Restore all game elements that might have been hidden
        document.querySelectorAll('.game-board').forEach(board => {
            Array.from(board.children).forEach(child => {
                if (!child.classList.contains('game-complete')) {
                    child.style.display = '';
                }
            });
        });

        // Update active game button (both sidebar and top header)
        document.querySelectorAll('.game-btn, .top-game-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll(`[data-game="${gameType}"]`).forEach(btn => {
            btn.classList.add('active');
        });

        // Hide all game contents (including welcome screen)
        document.querySelectorAll('.game-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        // Show selected game (already validated to exist)
        const gameElement = document.getElementById(`${gameType}-game`);
        gameElement.classList.add('active');
        gameElement.style.display = 'flex';

        this.currentGame = gameType;

        // Update URL hash to reflect current game (without triggering hashchange event)
        if (window.location.hash !== `#${gameType}`) {
            history.replaceState(null, null, `#${gameType}`);
        }

        this.startGame(gameType);
    }

    startGame(gameType) {
        try {
            console.log(`Starting ${gameType} game...`);

            // Set game context for speech manager
            speechManager.setGameContext(gameType);

            this.currentQuestionIndex = 0;
            this.scores[gameType] = 0;
            this.isGameActive = true;

            // Check if game data exists
            if (!this.gameData[gameType] || this.gameData[gameType].length === 0) {
                console.error(`No data found for game type: ${gameType}`);
                return;
            }

            // Smart question selection based on mastery levels
            this.shuffledQuestions = this.smartQuestionSelection([...this.gameData[gameType]]);
            console.log(`Selected ${this.shuffledQuestions.length} questions for ${gameType} using smart selection:`, this.shuffledQuestions.slice(0, 5));

            this.updateScore(gameType);
            this.updateProgress(gameType);
            this.loadQuestion(gameType);
        } catch (error) {
            console.error(`Error starting ${gameType} game:`, error);
        }
    }

    smartQuestionSelection(array) {
        // Smart question selection based on mastery levels
        // Prioritizes words that need more practice while maintaining variety

        const questions = [...array];

        // Categorize words by mastery level
        const categorized = {
            new: [],          // Never seen before (mastery = 0)
            struggling: [],   // Low mastery (0 < mastery < 0.5)
            learning: [],     // Medium mastery (0.5 <= mastery < 0.8)
            mastered: []      // High mastery (mastery >= 0.8)
        };

        questions.forEach(q => {
            const wordKey = `${q.word}_${q.category}`;
            const wordStats = window.app.getWordStats(q.word, q.category);
            const mastery = wordStats.masteryLevel || 0;

            // Store mastery level on the question object for later use
            q.masteryLevel = mastery;

            if (mastery === 0) {
                categorized.new.push(q);
            } else if (mastery < 0.5) {
                categorized.struggling.push(q);
            } else if (mastery < 0.8) {
                categorized.learning.push(q);
            } else {
                categorized.mastered.push(q);
            }
        });

        console.log('Word distribution by mastery:', {
            new: categorized.new.length,
            struggling: categorized.struggling.length,
            learning: categorized.learning.length,
            mastered: categorized.mastered.length
        });

        // Smart weighting: prioritize words that need practice
        // 40% struggling, 30% new, 20% learning, 10% mastered
        const selected = [];
        const targetCount = Math.min(questions.length, 50); // Select up to 50 questions

        const weights = {
            struggling: 0.40,
            new: 0.30,
            learning: 0.20,
            mastered: 0.10
        };

        // Calculate how many from each category
        const counts = {
            struggling: Math.ceil(targetCount * weights.struggling),
            new: Math.ceil(targetCount * weights.new),
            learning: Math.ceil(targetCount * weights.learning),
            mastered: Math.ceil(targetCount * weights.mastered)
        };

        // Helper function to randomly select N items from array
        const selectRandom = (arr, n) => {
            const shuffled = [...arr].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(n, arr.length));
        };

        // Select from each category
        selected.push(...selectRandom(categorized.struggling, counts.struggling));
        selected.push(...selectRandom(categorized.new, counts.new));
        selected.push(...selectRandom(categorized.learning, counts.learning));
        selected.push(...selectRandom(categorized.mastered, counts.mastered));

        // If we don't have enough, fill with remaining words
        if (selected.length < targetCount) {
            const remaining = questions.filter(q => !selected.includes(q));
            selected.push(...selectRandom(remaining, targetCount - selected.length));
        }

        // Now apply the improved shuffle with diversity constraints
        return this.improvedShuffle(selected);
    }

    improvedShuffle(array) {
        // Enhanced shuffling algorithm for better variety across categories and difficulty
        const shuffled = [...array];

        // Multiple shuffle passes for better randomization
        for (let pass = 0; pass < 5; pass++) {
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        }

        // Ensure category diversity - no consecutive words from same category
        for (let i = 1; i < shuffled.length - 1; i++) {
            if (shuffled[i].category && shuffled[i-1].category &&
                shuffled[i].category === shuffled[i-1].category) {
                // Find a word from different category to swap with
                for (let j = i + 1; j < shuffled.length; j++) {
                    if (shuffled[j].category && shuffled[j].category !== shuffled[i].category) {
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                        break;
                    }
                }
            }
        }

        // Ensure no consecutive similar difficulty words
        for (let i = 1; i < shuffled.length - 1; i++) {
            if (shuffled[i].difficulty === shuffled[i-1].difficulty &&
                shuffled[i].difficulty === shuffled[i+1].difficulty) {
                // Find a different difficulty word to swap with
                for (let j = i + 2; j < shuffled.length; j++) {
                    if (shuffled[j].difficulty !== shuffled[i].difficulty) {
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                        break;
                    }
                }
            }
        }

        return shuffled;
    }

    updateMasteryIndicator(gameType, question) {
        if (!question || !question.word || !question.category) return;

        const indicator = document.getElementById(`${gameType}-mastery-indicator`);
        if (!indicator) return;

        // Get mastery level for current word
        const wordStats = window.app.getWordStats(question.word, question.category);
        const mastery = wordStats.masteryLevel || 0;

        // Clear previous classes
        indicator.className = 'mastery-indicator';

        // Determine mastery level and set appropriate class and text
        let masteryClass = '';
        let masteryText = '';
        let masteryIcon = '';

        if (mastery === 0) {
            masteryClass = 'mastery-new';
            masteryText = 'חדש';
            masteryIcon = '✨';
        } else if (mastery < 0.5) {
            masteryClass = 'mastery-struggling';
            masteryText = 'נאבק';
            masteryIcon = '⚠️';
        } else if (mastery < 0.8) {
            masteryClass = 'mastery-learning';
            masteryText = 'לומד';
            masteryIcon = '📈';
        } else {
            masteryClass = 'mastery-mastered';
            masteryText = 'שליטה';
            masteryIcon = '✅';
        }

        indicator.classList.add(masteryClass);
        indicator.textContent = `${masteryIcon} ${masteryText}`;
    }

    loadQuestion(gameType) {
        this.audioPlaysLeft = GAME_CONFIG.MAX_AUDIO_PLAYS;
        this.updateAllPlayCounters(gameType);
        try {
            console.log(`Loading question ${this.currentQuestionIndex + 1} for ${gameType}`);

            if (this.currentQuestionIndex >= this.totalQuestions) {
                this.endGame(gameType);
                return;
            }

            // If we've reached the end of questions, cycle back to start
            if (this.currentQuestionIndex >= this.shuffledQuestions.length) {
                this.currentQuestionIndex = 0;
                console.log('Cycling back to start of questions');
            }

            const question = this.shuffledQuestions[this.currentQuestionIndex];
            console.log('Current question:', question);

            if (!question) {
                console.error('No question found at index:', this.currentQuestionIndex);
                return;
            }

            // Update mastery indicator
            this.updateMasteryIndicator(gameType, question);
            
            switch (gameType) {
                case 'vocabulary':
                    this.loadVocabularyQuestion(question);
                    break;
                case 'grammar':
                    this.loadGrammarQuestion(question);
                    break;
                case 'pronunciation':
                    this.loadPronunciationQuestion(question);
                    break;
                case 'listening':
                    this.loadListeningQuestion(question);
                    break;
                case 'reading':
                    this.loadReadingQuestion(question);
                    break;
                default:
                    console.error('Unknown game type:', gameType);
                    return;
            }

            this.updateProgress(gameType);
        } catch (error) {
            console.error(`Error loading question for ${gameType}:`, error);
        }
    }
    updateAllPlayCounters(gameType = this.currentGame) {
        const container = document.getElementById(`${gameType}-game`);
        if (!container) return;
        const counters = container.querySelectorAll('.plays-left');
        counters.forEach(counter => {
            counter.textContent = this.audioPlaysLeft;
        });
    }

    async playCurrentQuestionAudio() {
        if (this.audioPlaysLeft <= 0) {
            console.log("No more audio plays left.");
            return;
        }

        const question = this.shuffledQuestions[this.currentQuestionIndex];
        if (question && speechManager.isSpeechSynthesisSupported()) {
            try {
                await speechManager.speakWord(question.word, '', this.currentGame);
                this.audioPlaysLeft--;
                this.updateAllPlayCounters(this.currentGame);

                // Show Hebrew translation in listening game after audio plays
                if (this.currentGame === 'listening') {
                    this.showListeningHebrew();
                }
            } catch (error) {
                console.warn('Could not play audio:', error);
            }
        }
    }


    nextQuestion(gameType) {
        this.currentQuestionIndex++;
        this.loadQuestion(gameType);
    }

    async endGame(gameType) {
        try {
            console.log(`Ending ${gameType} game...`);
            const gameArea = document.querySelector(`#${gameType}-game .game-board`);
            const finalScore = this.scores[gameType];
            const percentage = Math.round((finalScore / (this.totalQuestions * 10)) * 100);

            // Save game score to history for statistics
            this.saveGameScoreToHistory(gameType, percentage);

            if (!gameArea) {
                console.error(`Game area not found for ${gameType}`);
                return;
            }
            
            // Hide all existing game elements instead of destroying them
            const existingElements = gameArea.children;
            for (let i = 0; i < existingElements.length; i++) {
                existingElements[i].style.display = 'none';
            }
            
            // Create completion message as a new element
            const completionDiv = document.createElement('div');
            completionDiv.className = 'game-complete';
            completionDiv.innerHTML = `
                <div class="completion-content">
                    <h2><i class="fas fa-trophy"></i> משחק הושלם!</h2>
                    <div class="score-display">
                        <div class="score-circle">
                            <span class="score-number">${percentage}%</span>
                            <span class="score-label">דיוק</span>
                        </div>
                        <div class="score-details">
                            <p><strong>ניקוד סופי:</strong> ${finalScore}/${this.totalQuestions * 10}</p>
                        </div>
                    </div>
                    <div class="completion-actions">
                        <button class="restart-game-btn" data-game="${gameType}">
                            <i class="fas fa-redo"></i> שחק שוב
                        </button>
                        <button class="choose-game-btn">
                            <i class="fas fa-home"></i> בחר משחק אחר
                        </button>
                    </div>
                </div>
            `;

            gameArea.appendChild(completionDiv);

            // Add event listeners to buttons (can't use onclick in innerHTML)
            const restartBtn = completionDiv.querySelector('.restart-game-btn');
            const chooseBtn = completionDiv.querySelector('.choose-game-btn');

            if (restartBtn) {
                restartBtn.addEventListener('click', () => {
                    this.restartGame(gameType);
                });
            }

            if (chooseBtn) {
                chooseBtn.addEventListener('click', () => {
                    window.location.replace('index.html');
                });
            }

            this.isGameActive = false;

            // Provide ENGLISH audio feedback for game completion
            try {
                const message = `You scored ${finalScore} out of ${this.totalQuestions * 10}. Accuracy: ${percentage} percent.`;
                await speechManager.speak(message);
                // NO second encouragement message
            } catch (error) {
                console.error('Error playing completion feedback:', error);
            }
            
            console.log(`${gameType} game ended successfully`);
            // Update overall app achievements/progress if available (skip in practice mode)
            try {
                const isPracticeMode = typeof SettingsManager !== 'undefined' && SettingsManager.isPracticeMode();
                if (!isPracticeMode && typeof appManager !== 'undefined' && appManager?.updateProgress) {
                    appManager.updateProgress(gameType, percentage);
                }
            } catch (e) {
                console.warn('Failed to update app progress:', e);
            }
        } catch (error) {
            console.error(`Error ending ${gameType} game:`, error);
        }
    }
    
    restartGame(gameType) {
        try {
            console.log(`Restarting ${gameType} game...`);
            const gameArea = document.querySelector(`#${gameType}-game .game-board`);
            
            if (!gameArea) {
                console.error(`Game area not found for ${gameType}`);
                return;
            }
            
            // Remove completion message
            const completionDiv = gameArea.querySelector('.game-complete');
            if (completionDiv) {
                completionDiv.remove();
            }
            
            // Show all original game elements
            const existingElements = gameArea.children;
            for (let i = 0; i < existingElements.length; i++) {
                existingElements[i].style.display = '';
            }
            
            // Start the game normally
            this.startGame(gameType);
            
            console.log(`${gameType} game restarted successfully`);
        } catch (error) {
            console.error(`Error restarting ${gameType} game:`, error);
        }
    }

    // Exit confirmation methods removed - games now switch directly

    saveGameScoreToHistory(gameType, percentage) {
        try {
            // Get current user ID
            let userId = null;

            // Try to get from authService first
            if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
                userId = authService.getCurrentUserId();
            }

            // Fallback to appManager
            if (!userId && typeof appManager !== 'undefined' && appManager.currentUser) {
                userId = appManager.currentUser;
            }

            // Fallback to localStorage
            if (!userId) {
                userId = localStorage.getItem('currentUser');
            }

            if (!userId) {
                console.warn('No user ID found, cannot save score to history');
                return;
            }

            // Create history key
            const historyKey = `${userId}_${gameType}_history`;

            // Load existing history
            let history = [];
            const saved = localStorage.getItem(historyKey);
            if (saved) {
                try {
                    history = JSON.parse(saved);
                    if (!Array.isArray(history)) {
                        history = [];
                    }
                } catch (e) {
                    console.warn('Error parsing history, starting fresh:', e);
                    history = [];
                }
            }

            // Add current score
            history.push(percentage);

            // Keep only last 50 scores to prevent unlimited growth
            if (history.length > 50) {
                history = history.slice(-50);
            }

            // Save back to localStorage
            localStorage.setItem(historyKey, JSON.stringify(history));
            console.log(`Saved score ${percentage}% to ${historyKey}`);

        } catch (error) {
            console.error('Error saving game score to history:', error);
        }
    }

    updateMicrophonePermissionIndicator() {
        if (typeof speechManager === 'undefined') {
            return;
        }

        const indicator = document.getElementById('mic-permission-indicator');
        if (!indicator) {
            return;
        }

        const permissionInfo = speechManager.getMicrophonePermissionState();

        // Update indicator text and style
        indicator.textContent = permissionInfo.message;
        indicator.className = `microphone-permission-indicator ${permissionInfo.state}`;

        console.log('Microphone permission indicator updated:', permissionInfo);
    }

    updateScore(gameType) {
        try {
            // Update the header score (unified across all games)
            const headerScoreElement = document.getElementById('current-score');

            if (headerScoreElement) {
                headerScoreElement.textContent = this.scores[gameType];
            } else {
                console.error(`Header score element not found`);
            }

            console.log(`Updated ${gameType} score to:`, this.scores[gameType]);
        } catch (error) {
            console.error(`Error updating score for ${gameType}:`, error);
        }
    }

    updateProgress(gameType = this.currentGame) {
        const progress = (this.currentQuestionIndex / this.totalQuestions) * 100;
        const container = document.getElementById(`${gameType}-game`);
        if (!container) return;

        // Update progress bar fill
        const fill = document.getElementById(`${gameType}-progress-fill`);
        if (fill) fill.style.width = `${progress}%`;

        // Update question counter
        const currentQ = document.getElementById(`${gameType}-current-q`);
        const totalQ = document.getElementById(`${gameType}-total-q`);
        if (currentQ) currentQ.textContent = this.currentQuestionIndex + 1;
        if (totalQ) totalQ.textContent = this.totalQuestions;

        // Hide next button on last question (Q10)
        if (this.currentQuestionIndex === this.totalQuestions - 1) {
            const nextBtn = document.getElementById(`${gameType}-next`);
            if (nextBtn) nextBtn.style.display = 'none';
        } else {
            // Show next button for other questions
            const nextBtn = document.getElementById(`${gameType}-next`);
            if (nextBtn) nextBtn.style.display = '';
        }
    }
}

// Global gameManager instance
let gameManager;

// Initialize game manager
function initializeGameManager() {
    console.log('[GameLogic] initializeGameManager called, checking gameData...');

    // Check if gameManager already exists - prevent duplicate initialization!
    if (gameManager) {
        console.log('[GameLogic] ⚠️ GameManager already exists, skipping initialization');
        return;
    }

    // Wait for gameData to be available
    if (typeof gameData === 'undefined' || !gameData) {
        console.log('[GameLogic] Waiting for gameData to load...');
        setTimeout(initializeGameManager, 100);
        return;
    }

    try {
        console.log('[GameLogic] gameData available:', {
            vocabulary: gameData?.vocabulary?.length,
            grammar: gameData?.grammar?.length
        });
        console.log('[GameLogic] Creating GameManager instance...');
        gameManager = new GameManager();
        window.gameManager = gameManager; // Make globally accessible
        console.log('[GameLogic] ✅ Game manager initialized successfully');
    } catch (error) {
        console.error('[GameLogic] ❌ Error initializing game:', error);
        console.error('[GameLogic] Error stack:', error.stack);

        // Retry once after a delay (only if gameManager still doesn't exist)
        setTimeout(() => {
            if (!gameManager) {
                console.log('[GameLogic] Retrying game manager initialization...');
                try {
                    gameManager = new GameManager();
                    window.gameManager = gameManager; // Make globally accessible
                    console.log('[GameLogic] ✅ Game manager initialized on retry');
                } catch (retryError) {
                    console.error('[GameLogic] ❌ Failed to initialize game manager on retry:', retryError);
                    console.error('[GameLogic] Retry error stack:', retryError.stack);
                }
            }
        }, 1000);
    }
}

// Try multiple initialization methods for better compatibility
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGameManager);
} else {
    // DOM is already loaded
    initializeGameManager();
}

// Fallback initialization
window.addEventListener('load', () => {
    if (!gameManager) {
        console.log('Fallback initialization triggered');
        initializeGameManager();
    }
});
