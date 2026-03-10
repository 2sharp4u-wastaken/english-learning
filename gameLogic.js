// Game Logic for English Learning Games
// Refactored to use modular game files and manager architecture

const DEBUG = false;
// eslint-disable-next-line no-console
const debugLog = (...args) => { if (DEBUG) console.log(...args); };

// Sentence themes that overlap with word categories — used to filter scramble/fill-blanks
const SENTENCE_THEMES = new Set(['animals', 'colors', 'daily', 'family', 'food', 'greetings', 'numbers', 'school']);

// Import game modules
import * as VocabularyGame from './games/vocabulary-game.js?t=1773075344';
import * as GrammarGame from './games/grammar-game.js?t=1774903002';
import * as GrammarBeginnerGame from './games/grammar-beginner-game.js';
import * as ListeningGame from './games/listening-game.js?t=1773075344';
import * as PronunciationGame from './games/pronunciation-game.js?t=1771785500';
import * as ReadingGame from './games/reading-game.js?t=1742000000';
import * as PracticeGame from './games/practice-game.js';
import * as ABCGame from './games/abc-game.js';
import * as PictureMatchGame from './games/picture-match-game.js';
import { generateABCQuestions, areAllLettersMastered, getUnmasteredLetterCount } from './data/abcData.js';
import { generateGrammarBeginnerQuestions } from './data/grammarBeginnerData.js';
import { getRandomSentences } from './data/sentences.js';

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

        // Reference to managers (initialized by app.js)
        this.scoreManager = null;
        this.progressManager = null;
        this.courseManager = null;
        this.coinManager = null;
        this.managerInitRetries = 0;

        // In-game timer: total elapsed while playing (ms). Only shown on game completion.
        this.gameElapsedMs = 0;
        this.gameSessionStartAt = null;  // When current session started (leave/resume resets)

        // Session streak tracking for morale feedback
        this.sessionCorrectStreak = 0;
        this.sessionFirstCorrect = false;
        this.moraleBoostTimer = null;

        // Apply settings (prefer window.app if ready, else read localStorage directly)
        this.applySettings(
            window.app?.settings ||
            JSON.parse(localStorage.getItem('englishLearningSettings') || 'null') ||
            this.getDefaultSettings()
        );

        this.gameData = {};
        this.lastPersistedScores = {}; // tracks what's already been saved to totalPoints per game
        this.shuffledQuestions = [];
        this.isGameActive = false;
        this.builtWord = '';
        this.currentTargetWord = '';
        this.currentQuestionAttempts = 0; // Track attempts for current question

        // Exit flow management
        this.pendingNavigation = null; // Stores pending navigation target during exit confirmation
        this.exitCallbacks = {}; // Stores callbacks for exit actions
        this.wordDisplayTimer = null; // Track word display timer

        // Grammar topic selector
        this.selectedGrammarCategory = 'all'; // Default to all topics
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
        this.onVocabularyManualAudio = VocabularyGame.onVocabularyManualAudio.bind(this);
        this.checkVocabularyAnswer = VocabularyGame.checkVocabularyAnswer.bind(this);
        this.loadGrammarQuestion = GrammarGame.loadGrammarQuestion.bind(this);
        this.checkGrammarAnswer = GrammarGame.checkGrammarAnswer.bind(this);
        this.loadGrammarBeginnerQuestion = GrammarBeginnerGame.loadGrammarBeginnerQuestion.bind(this);
        this.checkGrammarBeginnerAnswer = GrammarBeginnerGame.checkGrammarBeginnerAnswer.bind(this);
        this.loadListeningQuestion = ListeningGame.loadListeningQuestion.bind(this);
        this.showListeningHebrew = ListeningGame.showListeningHebrew.bind(this);
        this.onListeningAudioComplete = ListeningGame.onListeningAudioComplete.bind(this);
        this.checkListeningAnswer = ListeningGame.checkListeningAnswer.bind(this);
        this.loadPronunciationQuestion = PronunciationGame.loadPronunciationQuestion.bind(this);
        this.toggleRecording = PronunciationGame.toggleRecording.bind(this);
        this.processPronunciationResult = PronunciationGame.processPronunciationResult.bind(this);
        this.loadReadingQuestion = ReadingGame.loadReadingQuestion.bind(this);
        this.createLetterBank = ReadingGame.createLetterBank.bind(this);
        this.addLetterToWord = ReadingGame.addLetterToWord.bind(this);
        this.clearBuiltWord = ReadingGame.clearBuiltWord.bind(this);
        this.checkBuiltWord = ReadingGame.checkBuiltWord.bind(this);
        this.loadPracticeQuestion = PracticeGame.loadPracticeQuestion.bind(this);
        this.togglePracticeRecording = PracticeGame.togglePracticeRecording.bind(this);
        this.processPracticeResult = PracticeGame.processPracticeResult.bind(this);
        this.playNativePronunciation = PracticeGame.playNativePronunciation.bind(this);
        this.loadABCQuestion = ABCGame.loadABCQuestion.bind(this);
        this.checkABCAnswer = ABCGame.checkABCAnswer.bind(this);
        this.loadMatchCaseQuestion = ABCGame.loadMatchCaseQuestion.bind(this);
        this.loadLetterSoundQuestion = ABCGame.loadLetterSoundQuestion.bind(this);
        this.loadIdentifyCaseQuestion = ABCGame.loadIdentifyCaseQuestion.bind(this);
        this.loadSayLetterQuestion = ABCGame.loadSayLetterQuestion.bind(this);
        this.loadAlphabetOrderQuestion = ABCGame.loadAlphabetOrderQuestion.bind(this);
        this.toggleABCRecording = ABCGame.toggleABCRecording.bind(this);
        this.processABCSpeechResult = ABCGame.processABCSpeechResult.bind(this);
        this.createABCOptions = ABCGame.createABCOptions.bind(this);
        this.playABCLetterAudio = ABCGame.playABCLetterAudio.bind(this);
        this.loadWordPictureQuestion = ABCGame.loadWordPictureQuestion.bind(this);
        this.resetABCMastery = ABCGame.resetABCMastery.bind(this);
        this.loadPictureMatchQuestion = PictureMatchGame.loadPictureMatchQuestion.bind(this);
        this.checkPictureMatchAnswer = PictureMatchGame.checkPictureMatchAnswer.bind(this);

        // Initialize the game after all bindings are set up
        this.initializeGame();

        // Initialize manager references (after window.managers are set up by app.js)
        setTimeout(() => this.initializeManagers(), 100);
    }

    initializeManagers() {
        // Get manager references from window (set by app.js)
        this.scoreManager = window.scoreManager;
        this.progressManager = window.progressManager;
        this.courseManager = window.courseManager;
        this.coinManager = window.coinManager;

        if (!this.scoreManager || !this.progressManager) {
            // If no user is authenticated yet, wait for login instead of polling.
            if (typeof authService !== 'undefined' && !authService.isAuthenticated()) {
                window.addEventListener('user-logged-in', () => {
                    setTimeout(() => this.initializeManagers(), 150);
                }, { once: true });
                return;
            }
            // Auth is in progress but managers not exported yet — retry briefly.
            this.managerInitRetries = (this.managerInitRetries || 0) + 1;
            if (this.managerInitRetries > 5) {
                console.error('[GameManager] Managers failed to initialize. Check app.js initialization.');
                return;
            }
            setTimeout(() => this.initializeManagers(), 200);
            return;
        }

        debugLog('[GameManager] Managers initialized successfully');

        // One-time migration: clear any old-format saved state for games that changed format
        this.clearLegacySavedState();

        // Register all existing games with GameRegistry
        this.registerGames();

        // Initialize scores from ScoreManager
        this.initializeScores();
    }

    initializeScores() {
        // Preserve the active game's already-persisted tracking before reseeding.
        const activeGame = this.isGameActive ? this.currentGame : null;
        const savedPersisted = activeGame ? (this.lastPersistedScores[activeGame] ?? 0) : 0;

        // Seed lastPersistedScores from ScoreManager so delta tracking starts at 0
        // (scores already in ScoreManager were persisted in a prior endGame() call).
        this.lastPersistedScores = this.scoreManager.getAllScores();

        // Restore persisted tracking for the active game (it hasn't ended yet).
        if (activeGame) {
            this.lastPersistedScores[activeGame] = savedPersisted;
            this.updateScore(activeGame);
        } else {
            this.updateTotalScoreDisplay();
        }
    }

    clearLegacySavedState() {
        // Remove old-format saved states that pre-date the standard-game migration.
        // These were written by the old SentenceScrambleGame/FillBlanksGame classes
        // and have a different shuffledQuestions format that the new standard flow
        // can't resume. The validation in startGame() would catch them anyway,
        // but clearing upfront avoids the "resuming" prompt on the home screen.
        const userId = localStorage.getItem('currentUser') || 'default';
        const gamesToClear = ['scramble', 'fill-blanks', 'memory'];
        gamesToClear.forEach(gameType => {
            const key = `savedGame_${userId}_${gameType}`;
            const raw = localStorage.getItem(key);
            if (!raw) return;
            try {
                const state = JSON.parse(raw);
                // Old scramble/fill-blanks states had no 'words' on each question
                // Old memory state was never saved by GameManager
                // New memory state has { level, pairs, columns } on each question
                const isLegacy = gameType === 'memory'
                    ? !state.shuffledQuestions?.[0]?.level
                    : !Array.isArray(state.shuffledQuestions?.[0]?.words);
                if (isLegacy) {
                    localStorage.removeItem(key);
                    debugLog(`[GameManager] Cleared legacy saved state for ${gameType}`);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        });
    }

    registerGames() {
        const registry = window.gameRegistry;
        if (!registry) {
            console.warn('[GameManager] GameRegistry not available');
            return;
        }

        // Register all game types
        registry.register('vocabulary', {
            module: this,
            loadQuestion: 'loadVocabularyQuestion',
            checkAnswer: 'checkVocabularyAnswer',
            displayName: 'Vocabulary',
            displayNameHebrew: 'אוצר מילים',
            icon: '📚',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'vocabulary']
            }
        });

        registry.register('grammar', {
            module: this,
            loadQuestion: 'loadGrammarQuestion',
            checkAnswer: 'checkGrammarAnswer',
            displayName: 'Grammar',
            displayNameHebrew: 'דקדוק',
            icon: '✏️',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'grammar']
            }
        });

        registry.register('grammar-beginner', {
            module: this,
            loadQuestion: 'loadGrammarBeginnerQuestion',
            checkAnswer: 'checkGrammarBeginnerAnswer',
            displayName: 'Grammar Beginner',
            displayNameHebrew: 'דקדוק למתחילים',
            icon: '🔊',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'grammar'],
                skillLevel: 'beginner'
            }
        });

        registry.register('pronunciation', {
            module: this,
            loadQuestion: 'loadPronunciationQuestion',
            checkAnswer: 'processPronunciationResult',
            displayName: 'Pronunciation',
            displayNameHebrew: 'הגייה',
            icon: '🎤',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'speaking']
            }
        });

        registry.register('listening', {
            module: this,
            loadQuestion: 'loadListeningQuestion',
            checkAnswer: 'checkListeningAnswer',
            displayName: 'Listening',
            displayNameHebrew: 'הקשבה',
            icon: '👂',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'listening']
            }
        });

        registry.register('reading', {
            module: this,
            loadQuestion: 'loadReadingQuestion',
            checkAnswer: 'checkBuiltWord',
            displayName: 'Reading',
            displayNameHebrew: 'קריאה',
            icon: '📖',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['language', 'reading']
            }
        });

        registry.register('practice', {
            module: this,
            loadQuestion: 'loadPracticeQuestion',
            checkAnswer: 'processPracticeResult',
            displayName: 'Practice',
            displayNameHebrew: 'מצב תרגול',
            icon: '🎯',
            config: {
                questionsPerGame: 0, // Dynamic based on struggling words
                pointsPerCorrect: 10,
                categories: ['practice']
            }
        });

        registry.register('abc', {
            module: this,
            loadQuestion: 'loadABCQuestion',
            checkAnswer: 'checkABCAnswer',
            displayName: 'ABC Letters',
            displayNameHebrew: 'ABC אותיות',
            icon: '🔤',
            config: {
                questionsPerGame: 20,
                pointsPerCorrect: 10,
                categories: ['language', 'alphabet']
            }
        });

        registry.register('memory', {
            displayName: 'Memory / Matching',
            displayNameHebrew: 'משחק זיכרון',
            icon: '🃏',
            config: {
                questionsPerGame: 3,
                pointsPerCorrect: 15,
                categories: ['vocabulary']
            }
        });

        registry.register('scramble', {
            displayName: 'Sentence Scramble',
            displayNameHebrew: 'סידור משפטים',
            icon: '🔀',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 15,
                categories: ['sentences']
            }
        });

        registry.register('fill-blanks', {
            displayName: 'Fill in the Blanks',
            displayNameHebrew: 'השלם את המשפט',
            icon: '✍️',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['sentences']
            }
        });

        registry.register('word-journey', {
            displayName: 'Word Journey',
            displayNameHebrew: 'מסע המילים',
            icon: '🗺️',
            config: {
                questionsPerGame: 5,
                pointsPerCorrect: 10,
                categories: ['vocabulary']
            }
        });

        registry.register('picture-match', {
            displayName: 'Picture Match',
            displayNameHebrew: 'מילה לתמונה',
            icon: '🖼️',
            config: {
                questionsPerGame: 10,
                pointsPerCorrect: 10,
                categories: ['vocabulary']
            }
        });

        debugLog('[GameManager] All games registered with GameRegistry');
    }

    applySettings(settings) {
        this.settings = settings;
        this.totalQuestions = settings.questionsPerGame || GAME_CONFIG.MAX_QUESTIONS;
        this.audioPlaysLeft = settings.audioPlaysAllowed || GAME_CONFIG.MAX_AUDIO_PLAYS;
        this.clickRepeatCount = settings.clickRepeatCount || GAME_CONFIG.WRONG_OPTIONS_COUNT;
        this.showPictures = settings.showPictures || false;
        this.selectedCategories = settings.selectedCategories || [];
        debugLog('Settings applied:', settings);
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
            showConfetti: true
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
        if (!this.isGameActive || !this.currentGame) {
            console.warn('Cannot save: isGameActive=', this.isGameActive, 'currentGame=', this.currentGame);
            return false;
        }

        // Don't save practice mode sessions
        if (this.currentGame === 'practice') {
            debugLog('Practice mode sessions are not saved');
            return false;
        }

        // Don't save if questions haven't been loaded yet
        if (!this.shuffledQuestions || this.shuffledQuestions.length === 0) {
            debugLog('No questions loaded, nothing to save');
            return false;
        }

        const userId = localStorage.getItem('currentUser') || 'default';
        const sessionElapsed = this.gameSessionStartAt ? (Date.now() - this.gameSessionStartAt) : 0;
        const totalElapsed = (this.gameElapsedMs || 0) + sessionElapsed;
        this.gameElapsedMs = totalElapsed;
        this.gameSessionStartAt = null;

        const gameState = {
            gameType: this.currentGame,
            currentQuestionIndex: this.currentQuestionIndex,
            score: this.scoreManager.getScore(this.currentGame),
            totalQuestions: this.totalQuestions,
            timestamp: Date.now(),
            shuffledQuestions: this.shuffledQuestions,
            gameElapsedMs: totalElapsed,
            selectedCategories: [...(this.selectedCategories || [])]
        };

        // Word Journey: persist internal stage position so resume lands on the exact word
        if (this.currentGame === 'word-journey' && window.wordJourneyGame) {
            const wj = window.wordJourneyGame;
            gameState.wjTotalCorrect = wj.totalCorrect;
            gameState.wjTotalScoredQuestions = wj.totalScoredQuestions;
            // Only save mid-stage position; if stageIndex >= length the stage already completed
            if (wj.stageQuestions?.length > 0 && wj.stageIndex < wj.stageQuestions.length) {
                gameState.wjStageIndex = wj.stageIndex;
                gameState.wjStageQuestions = wj.stageQuestions;
                gameState.wjStageCorrect = wj.stageCorrect;
            }
        }

        localStorage.setItem(`savedGame_${userId}_${this.currentGame}`, JSON.stringify(gameState));
        debugLog('✅ Game state saved:', gameState);
        this.updateHomeNotification();
        return true;
    }

    loadGameState(gameType) {
        // Practice mode doesn't use save/resume
        if (gameType === 'practice') {
            return null;
        }

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
        this.updateHomeNotification();
    }

    resetCurrentGame() {
        if (!this.isGameActive || !this.currentGame) {
            console.warn('No active game to reset');
            return;
        }

        const gameType = this.currentGame;

        // Delete saved state
        this.deleteGameState(gameType);

        // Reset game state
        this.currentQuestionIndex = 0;
        this.scoreManager.resetScore(gameType);
        this.lastPersistedScores[gameType] = 0;
        this.isGameActive = false;

        // Show toast and restart
        this.showToast('המשחק אופס!');

        // Restart the game fresh
        this.switchGame(gameType);
    }

    getAllSavedGames() {
        const savedGames = [];

        // Derive game types from DOM cards — any new card added to HTML is automatically included
        document.querySelectorAll('.game-card[data-game]').forEach(card => {
            const gameType = card.dataset.game;
            const state = this.loadGameState(gameType);
            if (state) {
                savedGames.push(state);
            }
        });

        return savedGames;
    }

    updateHomeNotification() {
        const notificationDot = document.getElementById('home-notification-dot');
        if (!notificationDot) return;

        const savedGames = this.getAllSavedGames();
        if (savedGames.length > 0) {
            notificationDot.classList.add('show');
        } else {
            notificationDot.classList.remove('show');
        }
    }

    // ============================================
    // WORD MASTERY TRACKING
    // ============================================

    recordWordAttempt(word, category, isCorrect, responseTime, gameType) {
        // Lazily resolve progressManager from global in case app.js initialized it after gameLogic.js
        if (!this.progressManager && window.progressManager) {
            this.progressManager = window.progressManager;
        }

        // Track word attempt using ProgressManager
        if (!this.progressManager) {
            console.warn('Cannot record word attempt: ProgressManager not initialized');
            return;
        }

        // Use ProgressManager to track the word
        const wordStats = this.progressManager.recordWordAttempt(word, category, isCorrect, gameType, responseTime > 0 ? responseTime / 1000 : 0);

        // Persist immediately so practice data survives page navigation/reload.
        if (window.app?.userProgress) {
            window.app.userProgress.wordMastery = this.progressManager.wordMastery;
            if (window.app.saveUserProgress) {
                window.app.saveUserProgress();
            }
        }

        this.handleMoraleAnswerResult(isCorrect);

        // Check if word just became mastered
        if (wordStats && wordStats.previousMastery < 0.8 && wordStats.masteryLevel >= 0.8) {
            // Word just became mastered!
            if (window.audioEffects) {
                window.audioEffects.playLevelUp().catch(() => {});
            }
            this.showMoraleFeedback(`שלטת במילה "${word}"! 👑`, 'fa-trophy');
            if (typeof confetti !== 'undefined') {
                window.confettiManager?.celebrateMastery();
            }
        }

        // Update practice mode card since struggling words may have changed
        if (window.gamificationManager) {
            window.gamificationManager.updatePracticeModeCard();
        }

        debugLog(`Word tracked: ${word} (${category}) - ${isCorrect ? 'Correct' : 'Incorrect'} - Mastery: ${(wordStats?.masteryLevel * 100).toFixed(0)}%`);
    }

    populateResumeGames() {
        const savedGames = this.getAllSavedGames();

        // Update each game card continue button based on saved game state
        document.querySelectorAll('.game-card').forEach(card => {
            const gameType = card.dataset.game;
            const continueBtn = card.querySelector('.card-continue-btn');

            if (!continueBtn) return;

            // Check if there's a saved game for this game type
            const savedGame = savedGames.find(g => g.gameType === gameType);

            if (savedGame) {
                // Show continue button when this game has resumable progress
                continueBtn.style.display = 'inline-flex';
            } else {
                // Hide continue button when there is no saved state
                continueBtn.style.display = 'none';
            }
        });

        // Update home button notification
        this.updateHomeNotification();
    }

    resumeGame(gameStateOrType) {
        // Support both old (object) and new (string) calling styles
        let gameState;
        if (typeof gameStateOrType === 'string') {
            // Load fresh data from localStorage
            gameState = this.loadGameState(gameStateOrType);
            if (!gameState) {
                console.error('No saved game found for:', gameStateOrType);
                this.showToast('לא נמצא משחק שמור');
                return;
            }
        } else {
            // Legacy: object passed directly
            gameState = gameStateOrType;
        }

        debugLog('Resuming game:', gameState);

        // Discard saved game if selected categories have changed since it was saved.
        // New saves include selectedCategories; old saves fall back to checking the first question's category.
        if (this.selectedCategories?.length > 0 && gameState.shuffledQuestions?.length > 0) {
            let stale = false;
            if (gameState.selectedCategories) {
                const saved = [...gameState.selectedCategories].sort().join(',');
                const current = [...this.selectedCategories].sort().join(',');
                stale = saved !== current;
            } else {
                // Legacy save: check if first question's category is still selected
                const firstCat = gameState.shuffledQuestions[0]?.category;
                stale = firstCat && !this.selectedCategories.includes(firstCat);
            }
            if (stale) {
                console.warn(`[Resume] Categories changed — discarding saved ${gameState.gameType} game and starting fresh`);
                const userId = localStorage.getItem('currentUser') || 'default';
                localStorage.removeItem(`savedGame_${userId}_${gameState.gameType}`);
                this.performGameSwitch(gameState.gameType);
                return;
            }
        }

        // Set resuming flag to prevent startGame from resetting state
        this.isResuming = true;

        // Restore game state
        this.currentGame = gameState.gameType;
        this.currentQuestionIndex = gameState.currentQuestionIndex;
        this.scoreManager.setScore(gameState.gameType, gameState.score);
        // Mark as already-persisted so the resumed score isn't double-added to totalPoints
        this.lastPersistedScores[gameState.gameType] = gameState.score;
        this.shuffledQuestions = gameState.shuffledQuestions;
        this.totalQuestions = gameState.totalQuestions;
        this.gameElapsedMs = gameState.gameElapsedMs || 0;
        this.gameSessionStartAt = Date.now();
        this.isGameActive = true;

        // Word Journey: pre-load internal stage state before performGameSwitch calls loadStage
        if (gameState.gameType === 'word-journey' && window.wordJourneyGame) {
            const wj = window.wordJourneyGame;
            wj.totalCorrect = gameState.wjTotalCorrect || 0;
            wj.totalScoredQuestions = gameState.wjTotalScoredQuestions || 0;
            if (gameState.wjStageIndex !== undefined) {
                wj._resumeState = {
                    stageIndex: gameState.wjStageIndex,
                    stageQuestions: gameState.wjStageQuestions,
                    stageCorrect: gameState.wjStageCorrect || 0,
                };
            }
        }

        // Switch to the game
        this.performGameSwitch(gameState.gameType);

        // startGame() (called via performGameSwitch) already calls
        // updateScore / updateProgress / loadQuestion at the end — skip here to avoid
        // loading the question twice.


        // Show toast
        this.showToast(`ממשיך משחק ${this.getGameName(gameState.gameType)}!`);
    }

    getGameIcon(gameType) {
        return window.gameRegistry?.get(gameType)?.icon || '🎮';
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

    /** Format total game time (ms) for completion screen. Only shown when game is fully complete. */
    formatGameTime(ms) {
        if (ms == null || ms < 0) return '';
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        if (min > 0) return `${min} דקות ו־${sec} שניות`;
        return `${sec} שניות`;
    }

    // ============================================
    // EXIT FLOW MANAGEMENT
    // ============================================

    shouldShowExitConfirmation() {
        if (!this.isGameActive) return false;

        // Practice mode exits immediately without confirmation
        if (this.currentGame === 'practice') return false;

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
            const saved = this.saveGameState();
            if (saved) {
                this.showToast(`משחק ${this.getGameName(this.currentGame)} נשמר - ${this.currentQuestionIndex + 1}/${this.totalQuestions}`);
            }
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
        if (scoreEl) scoreEl.textContent = this.scoreManager.getScore(this.currentGame);
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
            let saved = false;
            if (settings.autoSaveProgress !== false) {
                saved = this.saveGameState();
            }
            modal.classList.remove('show');
            if (settings.showExitToast !== false && saved) {
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

    showMoraleFeedback(message, icon = 'fa-star') {
        this.showMoraleBoost(message, icon);
    }

    handleMoraleAnswerResult(isCorrect) {
        if (isCorrect) {
            this.sessionCorrectStreak++;

            if (!this.sessionFirstCorrect) {
                this.sessionFirstCorrect = true;
                this.showMoraleFeedback('כל הכבוד! תשובה ראשונה נכונה! ⭐', 'fa-star');
            } else if (this.sessionCorrectStreak === 3) {
                this.showMoraleFeedback('וואו! 3 תשובות נכונות ברצף! 🔥', 'fa-fire');
            } else if (this.sessionCorrectStreak === 5) {
                this.showMoraleFeedback('5 ברצף! פשוט מדהים! 👑', 'fa-crown');
            }
        } else {
            this.sessionCorrectStreak = 0;
        }
    }

    getMoraleEmoji(icon) {
        const map = {
            'fa-star': '🌟',
            'fa-fire': '🔥',
            'fa-crown': '👑',
            'fa-trophy': '🏆',
            'fa-heart': '💪'
        };
        return map[icon] || '🌟';
    }

    showMoraleBoost(message, icon = 'fa-star', duration = 2800) {
        if (!document.body) return;

        let moraleBoost = document.getElementById('morale-boost-fx');
        if (!moraleBoost) {
            moraleBoost = document.createElement('div');
            moraleBoost.id = 'morale-boost-fx';
            moraleBoost.className = 'morale-boost-fx';
            moraleBoost.innerHTML = `
                <div class="morale-boost-backdrop"></div>
                <div class="morale-boost-card">
                    <span class="morale-boost-icon"></span>
                    <span class="morale-boost-text"></span>
                </div>
            `;
            document.body.appendChild(moraleBoost);
        }

        const iconEl = moraleBoost.querySelector('.morale-boost-icon');
        const textEl = moraleBoost.querySelector('.morale-boost-text');
        if (iconEl) iconEl.textContent = this.getMoraleEmoji(icon);
        if (textEl) textEl.textContent = message;

        moraleBoost.classList.remove('show');
        void moraleBoost.offsetWidth;
        moraleBoost.classList.add('show');

        if (this.moraleBoostTimer) clearTimeout(this.moraleBoostTimer);
        this.moraleBoostTimer = setTimeout(() => {
            moraleBoost.classList.remove('show');
            this.moraleBoostTimer = null;
        }, duration);
    }

    showPracticeEmptyMessage() {
        // Show a friendly message when there are no words to practice
        // This is shown as an overlay on the practice game screen
        const gameArea = document.querySelector('#practice-game .game-board');
        if (!gameArea) return;

        // Reset practice counters to avoid showing stale data
        this.practiceWordsCount = 0;
        this.practiceWordIndex = 0;
        this.practiceCycle = 1;
        this.totalQuestions = 0;

        // Reset progress bar to 0 so it doesn't show stale fill
        const progressFill = document.getElementById('practice-progress-fill');
        if (progressFill) progressFill.style.width = '0%';

        // Hide the progress counters in the UI
        const wordCounter = document.getElementById('practice-word-counter');
        const cycleCounter = document.getElementById('practice-cycle-counter');
        if (wordCounter) wordCounter.textContent = '';
        if (cycleCounter) cycleCounter.textContent = '';

        // Remove any pre-existing empty message to prevent duplicates
        const existingMsg = gameArea.querySelector('.practice-empty-message');
        if (existingMsg) existingMsg.remove();

        // Hide normal game elements
        Array.from(gameArea.children).forEach(child => {
            child.style.display = 'none';
        });

        // Create and show the empty message
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'practice-empty-message';
        emptyMessage.innerHTML = `
            <div class="empty-content">
                <div class="empty-icon">🎉</div>
                <h2>כל הכבוד!</h2>
                <p>אין לך מילים לתרגול כרגע.</p>
                <p>המשך לשחק במשחקים האחרים, ומילים שתתקשה בהן יופיעו כאן לתרגול.</p>
                <button class="back-home-btn" onclick="gameManager.showWelcomeScreen()">
                    <i class="fas fa-home"></i> חזור לדף הבית
                </button>
            </div>
        `;
        gameArea.appendChild(emptyMessage);
    }

    clearPracticeEmptyMessage() {
        // Remove the empty-state overlay and restore the hidden game elements
        const gameArea = document.querySelector('#practice-game .game-board');
        if (!gameArea) return;
        const existingMsg = gameArea.querySelector('.practice-empty-message');
        if (existingMsg) {
            existingMsg.remove();
            // Restore visibility of all game-board children that were hidden
            Array.from(gameArea.children).forEach(child => {
                child.style.display = '';
            });
        }
    }

    // Show ABC all letters mastered congratulations screen
    showABCMasteryComplete() {
        // Hide all game screens first
        document.querySelectorAll('.game-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        // Show ABC game container
        const abcGame = document.getElementById('abc-game');
        if (abcGame) {
            abcGame.classList.add('active');
            abcGame.style.display = 'flex';
        }

        // Hide game board and progress, show completion message
        const gameBoard = abcGame?.querySelector('.game-board');
        const progressContainer = abcGame?.querySelector('.progress-container');

        if (gameBoard) gameBoard.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';

        // Create and show completion message
        let completionMessage = abcGame?.querySelector('.abc-completion-message');
        if (!completionMessage) {
            completionMessage = document.createElement('div');
            completionMessage.className = 'abc-completion-message';
            abcGame?.appendChild(completionMessage);
        }

        completionMessage.innerHTML = `
            <div class="completion-content">
                <div class="completion-icon">🎓</div>
                <h2>!מדהים</h2>
                <h3>!למדת את כל 26 האותיות</h3>
                <p>את/ה מכיר/ה עכשיו את כל האותיות הגדולות והקטנות באנגלית.</p>
                <div class="completion-buttons">
                    <button class="reset-mastery-btn-large" onclick="gameManager.resetABCMastery(); gameManager.startGame('abc');">
                        <i class="fas fa-redo"></i> התחל מחדש
                    </button>
                    <button class="back-home-btn" onclick="gameManager.showWelcomeScreen()">
                        <i class="fas fa-home"></i> חזור לדף הבית
                    </button>
                </div>
            </div>
        `;
        completionMessage.style.display = 'flex';

        // Trigger confetti
        if (this.settings?.showConfetti !== false && typeof window.confetti !== 'undefined') {
            window.confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.6 }
            });
        }
    }

    showWelcomeScreen() {
        // Hide all game screens
        document.querySelectorAll('.game-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        // Show welcome screen
        const welcome = document.getElementById('welcome-screen');
        if (welcome) {
            welcome.classList.add('active');
            welcome.style.display = 'flex';
        }

        // Update URL hash
        history.replaceState(null, null, '#');

        // Clear any in-flight confetti burst
        if (typeof window.confetti?.reset === 'function') window.confetti.reset();

        // Reset game state
        this.isGameActive = false;
        this.currentGame = null;
    }

    getGameName(gameType) {
        return window.gameRegistry?.get(gameType)?.displayNameHebrew || gameType;
    }

    initializeGame() {
        try {
            debugLog('Initializing game...');
            this.setupEventListeners();
            this.loadGameData();
            debugLog('Game data loaded:', this.gameData);
            // Populate resume games on welcome screen
            this.populateResumeGames();
            // Don't auto-start game - wait for user selection from welcome screen
            debugLog('Game manager ready, waiting for game selection');
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    }

    setupEventListeners() {
        // Tear down any previous listeners before re-registering
        if (this._eventController) this._eventController.abort();
        this._eventController = new AbortController();
        const { signal } = this._eventController;

        this._setupGameSelectorListeners(signal);
        this._setupVocabularyListeners(signal);
        this._setupGrammarListeners(signal);
        this._setupPronunciationListeners(signal);
        this._setupListeningListeners(signal);
        this._setupPictureMatchListeners(signal);
        this._setupReadingListeners(signal);
        this._setupPracticeListeners(signal);
        this._setupABCListeners(signal);
        this._setupSpaceKeyListener(signal);
        this._setupResetListeners(signal);
    }

    _setupGameSelectorListeners(signal) {
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const gameType = e.currentTarget?.dataset?.game;
                if (gameType) {
                    this.switchGame(gameType);
                } else {
                    console.warn('Game button clicked without data-game attribute:', e.currentTarget);
                }
            }, { signal });
        });
    }

    _setupVocabularyListeners(signal) {
        const vocabAudio = document.getElementById('vocab-audio');
        if (vocabAudio) {
            vocabAudio.addEventListener('click', () => {
                if (this.currentGame === 'vocabulary') {
                    this.isManualVocabPlayPending = true;
                }
                this.playCurrentQuestionAudio();
            }, { signal });
        }

        const vocabNext = document.getElementById('vocab-next');
        if (vocabNext) {
            vocabNext.addEventListener('click', () => this.loadQuestion('vocabulary'), { signal });
        }
    }

    _setupGrammarListeners(signal) {
        const grammarNext = document.getElementById('grammar-next');
        if (grammarNext) {
            grammarNext.addEventListener('click', () => this.loadQuestion('grammar'), { signal });
        }

        const grammarBeginnerNext = document.getElementById('grammar-beginner-next');
        if (grammarBeginnerNext) {
            grammarBeginnerNext.addEventListener('click', () => this.loadQuestion('grammar-beginner'), { signal });
        }
    }

    _setupPronunciationListeners(signal) {
        const listen = document.getElementById('pronunciation-listen');
        if (listen) {
            listen.addEventListener('click', () => this.playCurrentQuestionAudio(), { signal });
        }

        const recordBtn = document.getElementById('record-btn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording(), { signal });
        }

        const next = document.getElementById('pronunciation-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('pronunciation'), { signal });
        }
    }

    _setupListeningListeners(signal) {
        const audio = document.getElementById('listening-audio');
        if (audio) {
            audio.addEventListener('click', () => this.playCurrentQuestionAudio(), { signal });
        }

        const next = document.getElementById('listening-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('listening'), { signal });
        }
    }

    _setupPictureMatchListeners(signal) {
        const audio = document.getElementById('picture-match-audio');
        if (audio) {
            audio.addEventListener('click', () => this.playCurrentQuestionAudio(), { signal });
        }

        const next = document.getElementById('picture-match-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('picture-match'), { signal });
        }
    }

    _setupReadingListeners(signal) {
        const audio = document.getElementById('reading-audio');
        if (audio) {
            audio.addEventListener('click', () => this.playCurrentQuestionAudio(), { signal });
        }

        const clearWord = document.getElementById('clear-word');
        if (clearWord) {
            clearWord.addEventListener('click', () => {
                debugLog('Clear word button clicked');
                this.clearBuiltWord();
            }, { signal });
        } else {
            console.error('clear-word element not found during setup');
        }

        const checkWord = document.getElementById('check-word');
        if (checkWord) {
            checkWord.addEventListener('click', () => this.checkBuiltWord(), { signal });
        }

        const next = document.getElementById('reading-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('reading'), { signal });
        }
    }

    _setupPracticeListeners(signal) {
        const recordBtn = document.getElementById('practice-record-btn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.togglePracticeRecording(), { signal });
        }

        const listenNative = document.getElementById('practice-listen-native');
        if (listenNative) {
            listenNative.addEventListener('click', () => this.playNativePronunciation(), { signal });
        }

        const next = document.getElementById('practice-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('practice'), { signal });
        }

        const exitBtn = document.getElementById('practice-exit-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => this.showWelcomeScreen(), { signal });
        }
    }

    _setupABCListeners(signal) {
        const audioBtn = document.getElementById('abc-audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => this.playABCLetterAudio(), { signal });
        }

        const next = document.getElementById('abc-next');
        if (next) {
            next.addEventListener('click', () => this.loadQuestion('abc'), { signal });
        }

        const masteryReset = document.getElementById('abc-reset-mastery-btn');
        if (masteryReset) {
            masteryReset.addEventListener('click', () => {
                if (confirm('האם אתה בטוח שברצונך לאפס את השליטה בכל האותיות? תצטרך ללמוד אותן מחדש.')) {
                    this.resetABCMastery();
                    this.resetCurrentGame();
                }
            }, { signal });
        }
    }

    _setupSpaceKeyListener(signal) {
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Space') return;
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            if (document.activeElement?.isContentEditable) return;

            const nextBtns = document.querySelectorAll('button.next-btn:not(#memory-finish-btn)');
            for (const btn of nextBtns) {
                if (btn.offsetParent !== null && getComputedStyle(btn).display !== 'none') {
                    e.preventDefault();
                    btn.click();
                    break;
                }
            }
        }, { signal });
    }

    _setupResetListeners(signal) {
        const gameTypes = ['vocab', 'grammar', 'grammar-beginner', 'pronunciation', 'listening', 'reading', 'abc', 'scramble', 'fill-blanks', 'memory', 'word-journey', 'picture-match'];
        gameTypes.forEach(gameType => {
            const resetBtn = document.getElementById(`${gameType}-reset-btn`);
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (confirm('האם אתה בטוח שברצונך לאפס את המשחק? כל ההתקדמות תאבד.')) {
                        this.resetCurrentGame();
                    }
                }, { signal });
            }
        });
    }

    loadGameData() {
        // Check if gameData is available
        if (typeof gameData === 'undefined' || !gameData) {
            console.error('gameData is not loaded yet');
            return;
        }

        // Get difficulty setting - prefer per-user value from userProgress
        const difficulty = window.app?.userProgress?.preferredDifficulty
            || (this.settings && this.settings.difficulty ? this.settings.difficulty : 'beginner');
        debugLog(`Loading game data with difficulty: ${difficulty}`);

        // Filter vocabulary by selected categories
        const categoryFilteredVocabulary = this.selectedCategories && this.selectedCategories.length > 0
            ? gameData.vocabulary.filter(item => this.selectedCategories.includes(item.category))
            : gameData.vocabulary;

        debugLog(`[Category Filter] Selected categories:`, this.selectedCategories);
        debugLog(`[Category Filter] Filtered vocabulary to ${categoryFilteredVocabulary.length} words from categories: ${this.selectedCategories?.join(', ') || 'all'}`);

        // Apply difficulty filter on top of category filter (based on word length)
        let filteredVocabulary = categoryFilteredVocabulary;
        if (difficulty === 'beginner') {
            filteredVocabulary = categoryFilteredVocabulary.filter(item => !item.word || item.word.length <= 6);
        } else if (difficulty === 'intermediate') {
            filteredVocabulary = categoryFilteredVocabulary.filter(item => !item.word || item.word.length <= 9);
        }
        // Advanced: include all words

        // If difficulty filter left too few words, fall back to category-only (no difficulty filter).
        // Never fall back to ALL vocabulary — always respect the user's selected categories.
        if (filteredVocabulary.length < GAME_CONFIG.MIN_FILTERED_VOCABULARY) {
            debugLog(`[Category Filter] After difficulty filter only ${filteredVocabulary.length} words remain — dropping difficulty filter but keeping categories`);
            filteredVocabulary = categoryFilteredVocabulary;
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

        // Apply difficulty filter to pronunciation, listening, reading (based on word length).
        // If difficulty filter leaves too few words, fall back to category-only result.
        const applyDifficultyFilter = (pool, maxLen) => {
            const filtered = pool.filter(item => !item.word || item.word.length <= maxLen);
            return filtered.length >= GAME_CONFIG.MIN_FILTERED_VOCABULARY ? filtered : pool;
        };

        let difficultyFilteredPronunciation = filteredPronunciation;
        let difficultyFilteredListening = filteredListening;
        let difficultyFilteredReading = filteredReading;

        if (difficulty === 'beginner') {
            difficultyFilteredPronunciation = applyDifficultyFilter(filteredPronunciation, 6);
            difficultyFilteredListening = applyDifficultyFilter(filteredListening, 6);
            difficultyFilteredReading = applyDifficultyFilter(filteredReading, 6);
        } else if (difficulty === 'intermediate') {
            difficultyFilteredPronunciation = applyDifficultyFilter(filteredPronunciation, 9);
            difficultyFilteredListening = applyDifficultyFilter(filteredListening, 9);
            difficultyFilteredReading = applyDifficultyFilter(filteredReading, 9);
        }

        const filteredPictureMatch = this.selectedCategories && this.selectedCategories.length > 0
            ? (gameData['picture-match'] || []).filter(item => this.selectedCategories.includes(item.category))
            : (gameData['picture-match'] || []);

        this.gameData = {
            vocabulary: [...filteredVocabulary],
            grammar: filteredGrammar,
            pronunciation: difficultyFilteredPronunciation,
            listening: difficultyFilteredListening,
            reading: difficultyFilteredReading,
            abc: gameData.abc || [],
            'picture-match': filteredPictureMatch
        };

        debugLog('Game data loaded with filtered categories and difficulty:', {
            difficulty: difficulty,
            vocabulary: this.gameData.vocabulary.length,
            grammar: this.gameData.grammar.length,
            pronunciation: this.gameData.pronunciation.length,
            listening: this.gameData.listening.length,
            reading: this.gameData.reading.length,
            abc: this.gameData.abc.length
        });
    }

    initGrammarTopicSelector() {
        const tabsContainer = document.getElementById('grammar-topic-tabs');
        if (!tabsContainer) {
            console.warn('Grammar topic tabs container not found');
            return;
        }

        // Get categories from global grammarCategories
        const categories = window.grammarCategories || {
            'all': { name: 'הכל', icon: '📚' },
            'verb-to-be': { name: 'I am / She is', icon: '🔵' },
            'verb-to-be-negative': { name: 'I am not', icon: '🚫' },
            'verb-to-be-question': { name: 'Is she...?', icon: '❓' }
        };

        // Count questions per category
        const questionCounts = {};
        const grammarQuestions = window.gameData?.grammar || [];
        grammarQuestions.forEach(q => {
            const cat = q.category || 'other';
            questionCounts[cat] = (questionCounts[cat] || 0) + 1;
        });
        questionCounts['all'] = grammarQuestions.length;

        // Clear existing tabs
        tabsContainer.innerHTML = '';

        // Create tabs for each category
        Object.entries(categories).forEach(([key, value]) => {
            // Only show categories that have questions
            if (key !== 'all' && !questionCounts[key]) return;

            const tab = document.createElement('button');
            tab.className = 'topic-tab' + (key === this.selectedGrammarCategory ? ' active' : '');
            tab.dataset.category = key;

            const count = questionCounts[key] || 0;
            tab.innerHTML = `
                <span class="topic-icon">${value.icon}</span>
                <span class="topic-name">${value.name}</span>
                <span class="topic-count">${count}</span>
            `;

            tab.addEventListener('click', () => {
                this.selectGrammarCategory(key);
            });

            tabsContainer.appendChild(tab);
        });

        debugLog('[Grammar] Topic selector initialized with categories:', Object.keys(categories));
    }

    selectGrammarCategory(category) {
        this.selectedGrammarCategory = category;

        // Update active state on tabs
        document.querySelectorAll('.topic-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        debugLog('[Grammar] Selected category:', category);

        // If a grammar game is active, restart with new category
        if (this.currentGame === 'grammar' && this.isGameActive) {
            // Reset game with new category filter
            this.currentQuestionIndex = 0;
            this.scoreManager.resetScore('grammar');
            this.startGame('grammar');
        }
    }

    getFilteredGrammarQuestions() {
        const allQuestions = this.gameData.grammar || [];
        const selectedCategories = this.settings?.selectedCategories || this.selectedCategories || [];

        if (!selectedCategories.length) {
            return allQuestions;
        }

        const filtered = allQuestions.filter(q => selectedCategories.includes(q.category));
        return filtered.length > 0 ? filtered : allQuestions;
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

        // If already on this game and it's active, do nothing
        // Exception: allow resume to proceed even if the game appears "already active"
        // (resumeGame sets isGameActive=true + currentGame before calling performGameSwitch)
        if (!this.isResuming && this.isGameActive && gameType === this.currentGame) {
            return;
        }

        // Auto-save and show toast if switching from an active game
        if (this.isGameActive && gameType !== this.currentGame) {
            const saved = this.saveGameState();
            if (saved) {
                this.showToast('המשחק נשמר בהצלחה');
            }
        }

        // Check if there's a saved game to resume
        const savedGame = this.loadGameState(gameType);
        if (savedGame) {
            debugLog('Found saved game, auto-resuming:', savedGame);
            this.resumeGame(gameType);  // Auto-resume!
        } else {
            // No saved game, start fresh
            this.performGameSwitch(gameType);
        }
    }

    performGameSwitch(gameType) {
        // If navigating away from memory mid-flip, unflip pending cards so
        // flippedCards is empty and the DOM is clean before the next render.
        if (this.currentGame === 'memory' && gameType !== 'memory' && window.memoryGame) {
            window.memoryGame.cancelFlipInProgress();
        }

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

    refreshPracticeDataContext() {
        // Keep references/settings/data fresh so practice count and list stay in sync.
        this.progressManager = window.progressManager || this.progressManager;
        this.scoreManager = window.scoreManager || this.scoreManager;
        this.applySettings(
            window.app?.settings ||
            JSON.parse(localStorage.getItem('englishLearningSettings') || 'null') ||
            this.getDefaultSettings()
        );
        this.loadGameData();
    }

    getPracticeWords(options = {}) {
        const { refreshData = false } = options;

        if (refreshData) {
            this.refreshPracticeDataContext();
        }

        const allWords = this.gameData.vocabulary || [];

        // Single pass: look up stats once per word, then filter and sort
        const withStats = allWords.map(word => ({
            word,
            stats: this.progressManager
                ? this.progressManager.getWordStats(word.word, word.category)
                : window.app?.getWordStats(word.word, word.category)
        }));

        const strugglingWords = withStats
            .filter(({ stats }) => stats && stats.totalAttempts > 0 && stats.masteryLevel < 0.5)
            .sort((a, b) => {
                const accA = a.stats.totalAttempts > 0 ? a.stats.correctAttempts / a.stats.totalAttempts : 0;
                const accB = b.stats.totalAttempts > 0 ? b.stats.correctAttempts / b.stats.totalAttempts : 0;
                return accA - accB;
            })
            .map(({ word }) => word);

        return strugglingWords;
    }

    startGame(gameType) {
        try {
            debugLog(`Starting ${gameType} game...`);

            // Set game context for speech manager
            speechManager.setGameContext(gameType);

            // Only reset if NOT resuming a saved game
            if (!this.isResuming) {
                this.currentQuestionIndex = 0;
                this.scoreManager.resetScore(gameType);
                this.lastPersistedScores[gameType] = 0;
                this.gameElapsedMs = 0;
                this.gameSessionStartAt = null; // Reset so we get a fresh start time

            }
            // Start timing for non-practice games
            if (gameType !== 'practice') {
                // If resuming, gameSessionStartAt was set in resumeGame()
                // If fresh game, gameSessionStartAt was just set to null above
                if (!this.gameSessionStartAt) {
                    this.gameSessionStartAt = Date.now();
                }
            }
            this.isGameActive = true;

            // Special handling for practice mode
            if (gameType === 'practice') {
                // Only generate new questions if NOT resuming
                if (!this.isResuming) {
                    const practiceWords = this.getPracticeWords({ refreshData: true });
                    if (practiceWords.length === 0) {
                        // This shouldn't happen as the practice button is hidden when no words, but handle gracefully
                        this.showPracticeEmptyMessage();
                        this.isGameActive = false;
                        return;
                    }
                    // Clear any leftover empty-state overlay from a previous session
                    this.clearPracticeEmptyMessage();
                    // Store practice words in gameData and use them
                    this.gameData.practice = practiceWords;
                    // Use ALL struggling words (no limit)
                    this.shuffledQuestions = practiceWords;
                    // Practice mode: 2 cycles through all words
                    this.practiceWordsCount = practiceWords.length;
                    this.practiceCycle = 1;
                    this.practiceWordIndex = 0;
                    // Total questions = 1 cycle through all words
                    this.totalQuestions = practiceWords.length;
                    debugLog(`Practice mode: ${this.practiceWordsCount} words × 1 cycle = ${this.totalQuestions} total`, this.shuffledQuestions);
                }
            } else if (gameType === 'abc') {
                // Hide completion message if visible from previous mastery completion
                const abcGame = document.getElementById('abc-game');
                const completionMessage = abcGame?.querySelector('.abc-completion-message');
                const gameBoard = abcGame?.querySelector('.game-board');
                const progressContainer = abcGame?.querySelector('.progress-container');

                if (completionMessage) completionMessage.style.display = 'none';
                if (gameBoard) gameBoard.style.display = '';
                if (progressContainer) progressContainer.style.display = '';

                // Special handling for ABC game - regenerate questions fresh each time
                // This ensures mastery-based selection uses current mastery levels
                // ABC game uses 20 questions per session (6 types × ~3 rounds each)
                if (!this.isResuming) {
                    const freshQuestions = generateABCQuestions(20);

                    // Check if all letters are mastered
                    if (freshQuestions.length === 0) {
                        debugLog('[ABC] All letters mastered! Showing congratulations.');
                        this.showABCMasteryComplete();
                        return;
                    }

                    this.gameData.abc = freshQuestions;
                    // Don't shuffle ABC questions - they're already ordered to avoid repetition
                    this.shuffledQuestions = [...freshQuestions];
                    this.totalQuestions = Math.min(20, freshQuestions.length);
                    debugLog(`ABC game: ${this.shuffledQuestions.length} questions (ordered for variety)`, this.shuffledQuestions.slice(0, 5).map(q => `${q.word}-${q.type}`));
                }
            } else if (gameType === 'memory') {
                const validResume = this.isResuming &&
                    this.shuffledQuestions?.length === 3 &&
                    this.shuffledQuestions[this.currentQuestionIndex]?.level;
                if (!validResume) {
                    if (this.isResuming) console.warn('[Memory] Invalid saved state, starting fresh');
                    const allWords = (window.vocabularyBank || []).filter(w =>
                        !this.selectedCategories?.length || this.selectedCategories.includes(w.category)
                    );
                    this.shuffledQuestions = [
                        { level: 1, pairs: 6,  columns: 4, words: allWords },
                        { level: 2, pairs: 9,  columns: 6, words: allWords },
                        { level: 3, pairs: 12, columns: 8, words: allWords }
                    ];
                    this.totalQuestions = 3;
                    this.currentQuestionIndex = 0;
                    this.scoreManager.resetScore('memory');
                    debugLog('[Memory] 3-level game prepared');
                } else {
                    // Re-attach live vocabulary words (not saved in localStorage)
                    const allWords = (window.vocabularyBank || []).filter(w =>
                        !this.selectedCategories?.length || this.selectedCategories.includes(w.category)
                    );
                    this.shuffledQuestions = this.shuffledQuestions.map(q => ({ ...q, words: allWords }));
                    debugLog(`[Memory] Resuming at level ${this.currentQuestionIndex + 1}`);
                }
            } else if (gameType === 'scramble') {
                const validResume = this.isResuming &&
                    this.shuffledQuestions?.length > 0 &&
                    this.currentQuestionIndex < this.shuffledQuestions.length &&
                    Array.isArray(this.shuffledQuestions[this.currentQuestionIndex]?.words);
                if (!validResume) {
                    if (this.isResuming) console.warn('[Scramble] Invalid saved state, starting fresh');
                    const rawDiff = window.app?.userProgress?.preferredDifficulty || this.settings?.difficulty || 'beginner';
                    const diff = rawDiff === 'advanced' ? 'intermediate' : rawDiff;
                    const scrambleThemes = (this.selectedCategories || []).filter(c => SENTENCE_THEMES.has(c));
                    this.shuffledQuestions = getRandomSentences(10, diff, scrambleThemes.length > 0 ? scrambleThemes : null);
                    this.totalQuestions = this.shuffledQuestions.length;
                    this.currentQuestionIndex = 0;
                    this.scoreManager.resetScore('scramble');
                    debugLog(`[Scramble] ${this.totalQuestions} sentences loaded (${diff}, themes: ${scrambleThemes.join(',') || 'all'})`);
                } else {
                    debugLog(`[Scramble] Resuming at sentence ${this.currentQuestionIndex + 1}`);
                }
            } else if (gameType === 'fill-blanks') {
                const validResume = this.isResuming &&
                    this.shuffledQuestions?.length > 0 &&
                    this.currentQuestionIndex < this.shuffledQuestions.length &&
                    this.shuffledQuestions[this.currentQuestionIndex]?.blank;
                if (!validResume) {
                    if (this.isResuming) console.warn('[FillBlanks] Invalid saved state, starting fresh');
                    const rawDiff = window.app?.userProgress?.preferredDifficulty || this.settings?.difficulty || 'beginner';
                    const diff = rawDiff === 'advanced' ? 'intermediate' : rawDiff;
                    const fillThemes = (this.selectedCategories || []).filter(c => SENTENCE_THEMES.has(c));
                    this.shuffledQuestions = getRandomSentences(10, diff, fillThemes.length > 0 ? fillThemes : null);
                    this.totalQuestions = this.shuffledQuestions.length;
                    this.currentQuestionIndex = 0;
                    this.scoreManager.resetScore('fill-blanks');
                    debugLog(`[FillBlanks] ${this.totalQuestions} sentences loaded (${diff}, themes: ${fillThemes.join(',') || 'all'})`);
                } else {
                    debugLog(`[FillBlanks] Resuming at sentence ${this.currentQuestionIndex + 1}`);
                }
            } else if (gameType === 'grammar') {
                // Special handling for grammar - filter by settings categories
                const filteredGrammar = this.getFilteredGrammarQuestions();
                if (!filteredGrammar || filteredGrammar.length === 0) {
                    console.error('No grammar questions found');
                    return;
                }

                // Validate resumed state: grammar questions must have string options.
                // Guards against stale localStorage entries that contain grammar-beginner
                // object-format questions (e.g. { key, image, hebrew, isCorrect }).
                const validResume = this.isResuming &&
                    this.shuffledQuestions?.length > 0 &&
                    this.currentQuestionIndex < this.shuffledQuestions.length &&
                    typeof this.shuffledQuestions[this.currentQuestionIndex]?.options?.[0] === 'string';

                if (!validResume) {
                    if (this.isResuming) {
                        console.warn('[Grammar] Invalid saved state (stale data), starting fresh');
                        const userId = localStorage.getItem('currentUser') || 'default';
                        localStorage.removeItem(`savedGame_${userId}_grammar`);
                        this.currentQuestionIndex = 0;
                        this.scoreManager.resetScore('grammar');
                        this.gameElapsedMs = 0;
                    }
                    this.shuffledQuestions = this.smartQuestionSelection([...filteredGrammar]);
                    debugLog(`Grammar game: ${this.shuffledQuestions.length} questions`, this.shuffledQuestions.slice(0, 5));
                } else {
                    debugLog(`Resuming grammar with ${this.shuffledQuestions.length} questions at index ${this.currentQuestionIndex}`);
                }
            } else if (gameType === 'grammar-beginner') {
                // Special handling for grammar beginner - regenerate fresh questions each time
                if (!this.isResuming) {
                    const freshQuestions = generateGrammarBeginnerQuestions(10);
                    if (!freshQuestions || freshQuestions.length === 0) {
                        console.error('Failed to generate grammar beginner questions');
                        return;
                    }
                    this.gameData['grammar-beginner'] = freshQuestions;
                    this.shuffledQuestions = [...freshQuestions];
                    this.totalQuestions = freshQuestions.length;
                    debugLog(`Grammar Beginner: ${this.shuffledQuestions.length} questions generated`);
                } else {
                    debugLog(`Resuming grammar beginner with ${this.shuffledQuestions.length} questions at index ${this.currentQuestionIndex}`);
                }
            } else if (gameType === 'word-journey') {
                // Inject GameManager reference into WordJourneyGame
                if (window.wordJourneyGame) {
                    window.wordJourneyGame.setGameManager(this);
                }
                // Validate resume: saved words must have raw image field (not converted format)
                const validResume = this.isResuming &&
                    this.shuffledQuestions?.length > 0 &&
                    this.currentQuestionIndex < this.shuffledQuestions.length &&
                    this.shuffledQuestions[0]?.type === 'wj-stage' &&
                    this.shuffledQuestions[0]?.words?.[0]?.image !== undefined;
                if (!this.isResuming || !validResume) {
                    if (this.isResuming && !validResume) {
                        console.warn('[WordJourney] Invalid saved state, starting fresh');
                        const userId = localStorage.getItem('currentUser') || 'default';
                        localStorage.removeItem(`savedGame_${userId}_word-journey`);
                        this.currentQuestionIndex = 0;
                        this.scoreManager.resetScore('word-journey');
                    }
                    const words = this.getWordJourneyWords();
                    if (!words || words.length < 3) {
                        console.error('[WordJourney] Not enough words');
                        return;
                    }
                    this.shuffledQuestions = window.wordJourneyGame.buildStageDescriptors(words);
                    this.totalQuestions = this.shuffledQuestions.length;
                    this.currentQuestionIndex = 0;
                    this.scoreManager.resetScore('word-journey');
                    debugLog(`[WordJourney] ${words.length} words, ${this.totalQuestions} stages`);
                } else {
                    // Always sync totalQuestions to shuffledQuestions length to prevent cycle-back bug
                    this.totalQuestions = this.shuffledQuestions.length;
                    debugLog(`[WordJourney] Resuming at stage ${this.currentQuestionIndex + 1}`);
                }
                // Build stage bar dots (always, for both fresh start and resume)
                if (window.wordJourneyGame) {
                    window.wordJourneyGame.buildStageBar(this.shuffledQuestions);
                }
            } else {
                // Check if game data exists
                if (!this.gameData[gameType] || this.gameData[gameType].length === 0) {
                    console.error(`No data found for game type: ${gameType}`);
                    return;
                }

                // Only generate new questions if NOT resuming
                if (!this.isResuming) {
                    // Smart question selection based on mastery levels
                    this.shuffledQuestions = this.smartQuestionSelection([...this.gameData[gameType]]);
                    debugLog(`Selected ${this.shuffledQuestions.length} questions for ${gameType} using smart selection:`, this.shuffledQuestions.slice(0, 5));
                } else {
                    debugLog(`Resuming with ${this.shuffledQuestions.length} questions at index ${this.currentQuestionIndex}`);
                }
            }

            this.updateScore(gameType);
            this.updateProgress(gameType);
            this.loadQuestion(gameType);

            // Reset resuming flag after game has started
            this.isResuming = false;
        } catch (error) {
            console.error(`Error starting ${gameType} game:`, error);
            this.isResuming = false;  // Reset flag even on error
        }
    }

    saveLastSessionWordKeys(gameType) {
        if (!window.app?.userProgress) return;
        const wordKeys = (this.shuffledQuestions || []).map(q => `${q.word}_${q.category}`);
        if (!window.app.userProgress.lastSessionWordKeys) {
            window.app.userProgress.lastSessionWordKeys = {};
        }
        window.app.userProgress.lastSessionWordKeys[gameType] = wordKeys;
        window.app.saveUserProgress();
    }

    smartQuestionSelection(array) {
        // Smart question selection based on mastery levels + session rotation
        // Fresh words (not shown last session) are prioritized; recently-played fill only if needed

        const questions = [...array];
        const gameType = this.currentGame;

        // Helper: randomly pick n items from an array
        const selectRandom = (arr, n) => {
            const shuffled = [...arr].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(n, arr.length));
        };

        // --- Session rotation: split words into "fresh" and "recently played" ---
        // Words shown in the last completed session are de-prioritized so the player
        // sees a different set each time they replay.
        const lastSessionKeys = new Set(
            window.app?.userProgress?.lastSessionWordKeys?.[gameType] || []
        );
        const freshWords = lastSessionKeys.size > 0
            ? questions.filter(q => !lastSessionKeys.has(`${q.word}_${q.category}`))
            : questions;
        const recentWords = lastSessionKeys.size > 0
            ? questions.filter(q => lastSessionKeys.has(`${q.word}_${q.category}`))
            : [];

        // --- Categorize FRESH words by mastery level ---
        const categorized = {
            new: [],        // Never seen (mastery = 0)
            struggling: [], // Low mastery (0 < mastery < 0.5)
            learning: [],   // Medium mastery (0.5 <= mastery < 0.8)
            mastered: []    // High mastery (mastery >= 0.8)
        };

        freshWords.forEach(q => {
            const wordStats = this.progressManager
                ? this.progressManager.getWordStats(q.word, q.category)
                : window.app?.getWordStats(q.word, q.category);
            const mastery = wordStats?.masteryLevel || 0;
            q.masteryLevel = mastery;

            if (mastery === 0) categorized.new.push(q);
            else if (mastery < 0.5) categorized.struggling.push(q);
            else if (mastery < 0.8) categorized.learning.push(q);
            else categorized.mastered.push(q);
        });

        // Annotate recent words with mastery (used for fallback ordering below)
        recentWords.forEach(q => {
            const wordStats = this.progressManager
                ? this.progressManager.getWordStats(q.word, q.category)
                : window.app?.getWordStats(q.word, q.category);
            q.masteryLevel = wordStats?.masteryLevel || 0;
        });

        debugLog('Word distribution by mastery+recency:', {
            fresh: { new: categorized.new.length, struggling: categorized.struggling.length, learning: categorized.learning.length, mastered: categorized.mastered.length },
            recentlyPlayed: recentWords.length
        });

        const selected = [];
        const targetCount = Math.min(questions.length, 50);
        const weights = { struggling: 0.40, new: 0.30, learning: 0.20, mastered: 0.10 };

        // --- PHASE 1: Fill from fresh words using mastery weights ---
        if (freshWords.length > 0) {
            const freshTarget = Math.min(freshWords.length, targetCount);
            const counts = {
                struggling: Math.ceil(freshTarget * weights.struggling),
                new: Math.ceil(freshTarget * weights.new),
                learning: Math.ceil(freshTarget * weights.learning),
                mastered: Math.ceil(freshTarget * weights.mastered)
            };

            selected.push(...selectRandom(categorized.struggling, counts.struggling));
            selected.push(...selectRandom(categorized.new, counts.new));
            selected.push(...selectRandom(categorized.learning, counts.learning));
            selected.push(...selectRandom(categorized.mastered, counts.mastered));

            // Fill any remaining fresh slots (deduplication via key set)
            if (selected.length < freshTarget) {
                const selectedKeys = new Set(selected.map(q => `${q.word}_${q.category}`));
                const freshRemaining = freshWords.filter(q => !selectedKeys.has(`${q.word}_${q.category}`));
                selected.push(...selectRandom(freshRemaining, freshTarget - selected.length));
            }
        }

        // --- PHASE 2: If still short of target, fill from recently-played words ---
        // Sorted by mastery ascending so struggling ones still come first
        if (selected.length < targetCount && recentWords.length > 0) {
            const needed = targetCount - selected.length;
            const recentSorted = [...recentWords].sort((a, b) => a.masteryLevel - b.masteryLevel);
            selected.push(...recentSorted.slice(0, needed));
        }

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

        // Convert gameType to element prefix (vocabulary -> vocab)
        const elementPrefix = gameType === 'vocabulary' ? 'vocab' : gameType;

        const indicator = document.getElementById(`${elementPrefix}-mastery-indicator`);
        if (!indicator) return;

        // Get mastery level for current word
        const wordStats = this.progressManager
            ? this.progressManager.getWordStats(question.word, question.category)
            : window.app?.getWordStats(question.word, question.category);
        const mastery = wordStats?.masteryLevel || 0;

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
            debugLog(`Loading question ${this.currentQuestionIndex + 1} for ${gameType}`);

            if (this.currentQuestionIndex >= this.totalQuestions) {
                this.endGame(gameType);
                return;
            }

            // Special handling for practice mode 2-cycle logic
            if (gameType === 'practice') {
                // Calculate which word and cycle we're on
                this.practiceWordIndex = this.currentQuestionIndex % this.practiceWordsCount;
                this.practiceCycle = Math.floor(this.currentQuestionIndex / this.practiceWordsCount) + 1;
                debugLog(`Practice: Word ${this.practiceWordIndex + 1}/${this.practiceWordsCount}`);
            } else {
                // For other games: cycle back to start if needed
                if (this.currentQuestionIndex >= this.shuffledQuestions.length) {
                    this.currentQuestionIndex = 0;
                    debugLog('Cycling back to start of questions');
                }
            }

            // For practice, use practiceWordIndex; for others, use currentQuestionIndex
            const questionIndex = gameType === 'practice' ? this.practiceWordIndex : this.currentQuestionIndex;
            const question = this.shuffledQuestions[questionIndex];
            debugLog('Current question:', question);

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
                case 'grammar-beginner':
                    this.loadGrammarBeginnerQuestion(question);
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
                case 'practice':
                    this.loadPracticeQuestion(question);
                    break;
                case 'abc':
                    this.loadABCQuestion(question);
                    break;
                case 'memory':
                    window.memoryGame.loadQuestion(question);
                    break;
                case 'scramble':
                    window.scrambleGame.loadQuestion(question);
                    break;
                case 'fill-blanks':
                    window.fillBlanksGame.loadQuestion(question);
                    break;
                case 'word-journey':
                    window.wordJourneyGame.loadStage(question);
                    break;
                case 'picture-match':
                    this.loadPictureMatchQuestion(question);
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
            debugLog("No more audio plays left.");
            return;
        }

        // Prevent rapid clicking - wait for current audio to finish
        if (this.isPlayingAudio) {
            debugLog('📢 [AUDIO] Audio already playing, ignoring click');
            return;
        }

        const question = this.shuffledQuestions[this.currentQuestionIndex];
        if (question && speechManager.isSpeechSynthesisSupported()) {
            try {
                // Lock audio playback and disable play button
                this.isPlayingAudio = true;
                const playButton = document.getElementById(`${this.currentGame === 'vocabulary' ? 'vocab' : this.currentGame}-audio`);
                if (playButton) {
                    playButton.disabled = true;
                    playButton.style.opacity = '0.5';
                    playButton.style.cursor = 'wait';
                }
                debugLog('📢 [AUDIO] Starting audio playback, button locked');

                await speechManager.speakWord(question.word, '', this.currentGame);

                // Re-enable play button after audio completes
                if (playButton) {
                    playButton.disabled = false;
                    playButton.style.opacity = '1';
                    playButton.style.cursor = 'pointer';
                }
                this.isPlayingAudio = false;
                debugLog('📢 [AUDIO] Audio playback complete, button unlocked');

                this.audioPlaysLeft--;
                this.updateAllPlayCounters(this.currentGame);

                // Delegate post-audio logic to each game module
                if (this.currentGame === 'listening') {
                    debugLog('📢 [AUDIO] Delegating to onListeningAudioComplete');
                    this.onListeningAudioComplete();
                } else if (this.currentGame === 'vocabulary') {
                    const isManualPlay = !!this.isManualVocabPlayPending;
                    this.isManualVocabPlayPending = false;
                    if (!isManualPlay) {
                        debugLog('📢 [AUDIO] Ignoring non-manual vocabulary playback for counting');
                        return;
                    }
                    debugLog('📢 [AUDIO] Delegating to onVocabularyManualAudio');
                    this.onVocabularyManualAudio();
                }
            } catch (error) {
                console.warn('Could not play audio:', error);
                // Reset lock on error so button can be clicked again
                this.isPlayingAudio = false;
                const playButton = document.getElementById(`${this.currentGame === 'vocabulary' ? 'vocab' : this.currentGame}-audio`);
                if (playButton) {
                    playButton.disabled = false;
                    playButton.style.opacity = '1';
                    playButton.style.cursor = 'pointer';
                }
            }
        }
    }


    nextQuestion(gameType) {
        this.currentQuestionIndex++;

        // Auto-save progress after each question
        const saved = this.saveGameState();
        if (!saved) {
            console.error('Failed to auto-save after question', this.currentQuestionIndex);
        }

        // Hide the next button for this game
        const nextBtn = document.getElementById(`${gameType}-next`);
        if (nextBtn) {
            nextBtn.style.display = 'none';
        }

        this.loadQuestion(gameType);
    }

    async endGame(gameType) {
        try {
            debugLog(`Ending ${gameType} game...`);

            const gameArea = document.querySelector(`#${gameType}-game .game-board`)
                ?? document.getElementById(`${gameType}-game`);

            // Special handling for practice mode
            if (gameType === 'practice') {
                // Practice mode: session-based, no scoring, option to continue
                if (!gameArea) {
                    console.error(`Game area not found for practice`);
                    return;
                }

                // Hide all existing game elements
                const existingElements = gameArea.children;
                for (let i = 0; i < existingElements.length; i++) {
                    existingElements[i].style.display = 'none';
                }

                // Create practice session completion screen
                const completionDiv = document.createElement('div');
                completionDiv.className = 'game-complete';
                completionDiv.innerHTML = `
                    <div class="completion-content">
                        <div class="completion-icon">🎯</div>
                        <h2>סיימת את סבב התרגול!</h2>
                        <div class="practice-summary">
                            <p>תרגלת ${this.practiceWordsCount} מילים ב-2 סיבובים</p>
                            <p class="practice-encouragement">המשך לתרגל כדי לשפר את השליטה במילים!</p>
                        </div>
                        <div class="completion-actions">
                            <button class="continue-practice-btn">
                                <i class="fas fa-redo"></i> המשך לתרגל
                            </button>
                            <button class="choose-game-btn">
                                <i class="fas fa-home"></i> חזור לדף הבית
                            </button>
                        </div>
                    </div>
                `;

                gameArea.appendChild(completionDiv);

                // Update gamification card (words may have improved)
                if (window.gamificationManager) {
                    window.gamificationManager.updatePracticeModeCard();
                }

                this.isGameActive = false;

                // Add event listeners
                const continueBtn = completionDiv.querySelector('.continue-practice-btn');
                const homeBtn = completionDiv.querySelector('.choose-game-btn');

                if (continueBtn) {
                    continueBtn.addEventListener('click', () => {
                        // Restart practice with new set of struggling words
                        this.restartGame('practice');
                    });
                }

                if (homeBtn) {
                    homeBtn.addEventListener('click', () => {
                        this.showWelcomeScreen();
                    });
                }

                return; // Exit early for practice mode
            }

            // Regular game completion logic below
            // Delete saved game state FIRST so a failed endGame never leaves a stale save
            this.deleteGameState(gameType);

            // Total time: elapsed from saved sessions + current session
            const sessionElapsed = this.gameSessionStartAt ? (Date.now() - this.gameSessionStartAt) : 0;
            const totalGameTimeMs = (this.gameElapsedMs || 0) + sessionElapsed;
            this.gameElapsedMs = 0;
            this.gameSessionStartAt = null;

            // Save words shown this session so next session can de-prioritize them
            try { this.saveLastSessionWordKeys(gameType); } catch (_) {}

            // Compute score and percentage
            let maxPossibleScore, finalScore, percentage;
            if (gameType === 'word-journey' && window.wordJourneyGame) {
                const wj = window.wordJourneyGame;
                finalScore = this.scoreManager.getScore(gameType) || 0;
                const totalQ = wj.totalScoredQuestions || 1;
                const totalC = wj.totalCorrect || 0;
                percentage = Math.min(100, Math.round((totalC / totalQ) * 100));
                maxPossibleScore = Math.max(finalScore, totalQ * 10);
            } else {
                // Cap the score to prevent display bugs (e.g., 130%)
                maxPossibleScore = this.totalQuestions * 10;
                finalScore = Math.min(this.scoreManager.getScore(gameType), maxPossibleScore);
                percentage = Math.round((finalScore / maxPossibleScore) * 100);
            }

            // Save game score to history for statistics
            this.saveGameScoreToHistory(gameType, percentage);

            // Reconcile totalPoints: points are already persisted incrementally via updateScore(),
            // so only add/subtract the delta to account for the score cap applied here.
            if (window.app?.userProgress) {
                const alreadyPersisted = this.lastPersistedScores[gameType] || 0;
                const adjustment = finalScore - alreadyPersisted;
                if (adjustment !== 0) {
                    window.app.userProgress.totalPoints = Math.max(0, (window.app.userProgress.totalPoints || 0) + adjustment);
                }
                this.lastPersistedScores[gameType] = finalScore;
                window.app.saveUserProgress();
            }
            this.updateTotalScoreDisplay();

            // Award coins for game completion
            if (this.coinManager) {
                this.coinManager.awardActivityComplete();
                if (percentage === 100) {
                    this.coinManager.awardPerfectGame();
                }
            }

            // Play victory sound and show celebration
            if (window.audioEffects) {
                window.audioEffects.playVictory().catch(() => {});
            }

            // Show confetti based on performance
            if (percentage === 100 && typeof confetti !== 'undefined') {
                // Perfect game - big celebration!
                window.confettiManager?.celebratePerfectGame();
            } else if (percentage >= 80 && typeof confetti !== 'undefined') {
                // Good performance
                window.confettiManager?.celebrateAchievement();
            }

            if (percentage === 100) {
                this.showMoraleFeedback('מושלם! 100%! אתה אלוף! 👑', 'fa-trophy');
            } else if (percentage >= 80) {
                this.showMoraleFeedback('עבודה נהדרת! המשך ככה! 🌟', 'fa-star');
            } else {
                this.showMoraleFeedback('סיימת! תמשיך להתאמן! 💪', 'fa-heart');
            }

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
            const timeText = this.formatGameTime(totalGameTimeMs);
            const endGameStars = percentage >= 80 ? '⭐⭐⭐' : percentage >= 60 ? '⭐⭐' : '⭐';
            completionDiv.innerHTML = `
                <div class="completion-content">
                    <h2><i class="fas fa-trophy"></i> משחק הושלם!</h2>
                    <div class="completion-stars">${endGameStars}</div>
                    <div class="score-display">
                        <div class="score-circle">
                            <span class="score-number">${percentage}%</span>
                            <span class="score-label">דיוק</span>
                        </div>
                        <div class="score-details">
                            <p><strong>ניקוד סופי:</strong> ${finalScore}/${maxPossibleScore}</p>
                            ${timeText ? `<p class="game-time"><strong>זמן כולל:</strong> ${timeText}</p>` : ''}
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

            debugLog(`${gameType} game ended successfully`);
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
            debugLog(`Restarting ${gameType} game...`);
            const gameArea = document.querySelector(`#${gameType}-game .game-board`)
                ?? document.getElementById(`${gameType}-game`);
            
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
            
            debugLog(`${gameType} game restarted successfully`);
        } catch (error) {
            console.error(`Error restarting ${gameType} game:`, error);
        }
    }

    getWordJourneyWords() {
        const rawBank = window.vocabularyBank || [];

        if (this.currentTopicId && window.courseManager) {
            const topicData = window.courseManager.getTopic(this.currentTopicId);
            if (topicData?.topic?.words) {
                const resolved = topicData.topic.words
                    .map(w => rawBank.find(v => v.word === w))
                    .filter(Boolean);
                if (resolved.length >= 3) return resolved.slice(0, 8);
            }
        }

        // Filter vocabularyBank directly by selected categories — no word-length filter,
        // since word-journey's difficulty comes from mastery-based selection, not word length.
        const categoryFiltered = rawBank.filter(w =>
            !this.selectedCategories?.length || this.selectedCategories.includes(w.category)
        );
        if (categoryFiltered.length === 0) return [];

        const scored = categoryFiltered
            .map(w => ({
                word: w,
                mastery: this.progressManager
                    ? this.progressManager.getWordStats(w.word, w.category)?.mastery || 0
                    : 0
            }));

        // Shuffle before sorting so equal-mastery words appear in random order each run
        scored.forEach(s => { s._rnd = Math.random(); });
        scored.sort((a, b) => a.mastery !== b.mastery ? a.mastery - b.mastery : a._rnd - b._rnd);

        return scored.slice(0, 8).map(s => s.word);
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
            debugLog(`Saved score ${percentage}% to ${historyKey}`);

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

        debugLog('Microphone permission indicator updated:', permissionInfo);
    }

    /**
     * Update the header score display
     * @param {string} gameType - Type of game (vocabulary, grammar, memory, etc.)
     * @param {number} points - Points to add (optional, if null just displays current score)
     */
    updateScore(gameType, points = null) {
        try {
            const headerScoreElement = document.getElementById('current-score');
            if (!headerScoreElement) return;
            if (!this.scoreManager) return;

            // Get current game score
            const currentGameScore = this.scoreManager.getScore(gameType) || 0;

            // Get total accumulated score across all games
            const totalScore = Object.values(this.scoreManager.getAllScores()).reduce((sum, score) => sum + (score || 0), 0);

            // For practice mode, only show current progress (no points-based scoring)
            if (gameType === 'practice') {
                headerScoreElement.style.display = 'none';
                debugLog(`🏆 [SCORE] Practice mode: score hidden`);
                return;
            }

            // If points were passed, add them to the game score and update display
            if (points !== null && points !== undefined) {
                const newTotal = currentGameScore + points;
                this.scoreManager.setScore(gameType, newTotal);
                this.updateTotalScoreDisplay(); // Update total score display
                debugLog(`🏆 [SCORE] Added ${points} points to ${gameType}: ${currentGameScore} + ${points} = ${newTotal}`);
            }

            // Show the current game's live score (restore display in case practice mode hid it)
            headerScoreElement.style.display = '';
            headerScoreElement.textContent = currentGameScore;

            // Persist earned points immediately so stats/settings pages stay in sync
            if (window.app?.userProgress) {
                const prev = this.lastPersistedScores[gameType] || 0;
                const curr = this.scoreManager.getScore(gameType) || 0;
                const delta = curr - prev;
                if (delta > 0) {
                    window.app.userProgress.totalPoints = (window.app.userProgress.totalPoints || 0) + delta;
                    this.lastPersistedScores[gameType] = curr;
                    window.app.saveUserProgress();
                }
            }

            debugLog(`🏆 [SCORE] Updated ${gameType} score: ${currentGameScore}, Total: ${totalScore}`);
        } catch (error) {
            console.error(`🏆 [SCORE] Error updating score:`, error);
        }
    }

    /**
     * Update the total score display (all games combined)
     */
    updateTotalScoreDisplay() {
        const headerScoreElement = document.getElementById('current-score');
        if (!headerScoreElement) return;
        if (!this.scoreManager) return;

        // Prefer the persisted all-time total; fall back to session sum
        const persistedTotal = window.app?.userProgress?.totalPoints;
        const sessionTotal = Object.values(this.scoreManager.getAllScores()).reduce((sum, score) => sum + (score || 0), 0);
        const totalScore = (typeof persistedTotal === 'number') ? persistedTotal : sessionTotal;
        headerScoreElement.style.display = '';
        headerScoreElement.textContent = totalScore;
        debugLog(`🏆 [SCORE] Total accumulated score: ${totalScore}`);
    }

    updateProgress(gameType = this.currentGame) {
        // Memory manages its own stats display via updateStats() — skip standard update
        if (gameType === 'memory') return;

        // Use 1-based index for display so the last question reaches 100%
        // Guard against totalQuestions === 0 to avoid 100% when practice list is empty
        const progress = this.totalQuestions > 0
            ? (Math.min(this.currentQuestionIndex + 1, this.totalQuestions) / this.totalQuestions) * 100
            : 0;
        const container = document.getElementById(`${gameType}-game`);
        if (!container) return;

        // Convert gameType to element prefix (vocabulary -> vocab)
        const elementPrefix = gameType === 'vocabulary' ? 'vocab' : gameType;

        // Update progress bar fill
        const fill = document.getElementById(`${elementPrefix}-progress-fill`);
        if (fill) fill.style.width = `${progress}%`;

        // Special handling for practice mode - show word/cycle info
        if (gameType === 'practice') {
            const wordCounter = document.getElementById('practice-word-counter');
            const cycleCounter = document.getElementById('practice-cycle-counter');

            if (wordCounter) {
                wordCounter.textContent = `שאלה ${this.practiceWordIndex + 1} מתוך ${this.practiceWordsCount}`;
            }
            if (cycleCounter) {
                cycleCounter.style.display = 'none';
            }
        } else {
            // Update question counter for non-practice games
            const currentQ = document.getElementById(`${elementPrefix}-current-q`);
            const totalQ = document.getElementById(`${elementPrefix}-total-q`);
            if (currentQ) currentQ.textContent = this.currentQuestionIndex + 1;
            if (totalQ) {
                // Word-journey has exactly 5 stages; use shuffledQuestions.length to avoid stale totalQuestions
                totalQ.textContent = gameType === 'word-journey'
                    ? (this.shuffledQuestions?.length || this.totalQuestions)
                    : this.totalQuestions;
            }
        }

        // Hide next button on last question
        if (this.currentQuestionIndex === this.totalQuestions - 1) {
            const nextBtn = document.getElementById(`${elementPrefix}-next`);
            if (nextBtn) nextBtn.style.display = 'none';
        } else {
            // Show next button for other questions
            const nextBtn = document.getElementById(`${elementPrefix}-next`);
            if (nextBtn) nextBtn.style.display = '';
        }
    }
}

// Global gameManager instance
let gameManager;

// Initialize game manager
function initializeGameManager() {
    debugLog('[GameLogic] initializeGameManager called, checking gameData...');

    // Check if gameManager already exists - prevent duplicate initialization!
    if (gameManager) {
        debugLog('[GameLogic] ⚠️ GameManager already exists, skipping initialization');
        return;
    }

    // Wait for gameData to be available
    if (typeof gameData === 'undefined' || !gameData) {
        debugLog('[GameLogic] Waiting for gameData to load...');
        setTimeout(initializeGameManager, 100);
        return;
    }

    try {
        debugLog('[GameLogic] gameData available:', {
            vocabulary: gameData?.vocabulary?.length,
            grammar: gameData?.grammar?.length
        });
        debugLog('[GameLogic] Creating GameManager instance...');
        gameManager = new GameManager();
        window.gameManager = gameManager; // Make globally accessible
        if (window.gamificationManager?.updatePracticeModeCard) {
            window.gamificationManager.updatePracticeModeCard();
        }
        debugLog('[GameLogic] ✅ Game manager initialized successfully');
    } catch (error) {
        console.error('[GameLogic] ❌ Error initializing game:', error);
        console.error('[GameLogic] Error stack:', error.stack);

        // Retry once after a delay (only if gameManager still doesn't exist)
        setTimeout(() => {
            if (!gameManager) {
                debugLog('[GameLogic] Retrying game manager initialization...');
                try {
                    gameManager = new GameManager();
                    window.gameManager = gameManager; // Make globally accessible
                    if (window.gamificationManager?.updatePracticeModeCard) {
                        window.gamificationManager.updatePracticeModeCard();
                    }
                    debugLog('[GameLogic] ✅ Game manager initialized on retry');
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
        debugLog('Fallback initialization triggered');
        initializeGameManager();
    }
});
