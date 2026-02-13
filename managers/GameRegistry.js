/**
 * GameRegistry.js
 * Central registry for all game types using factory pattern
 * Manages game configuration, instantiation, and plugin architecture
 */

export class GameRegistry {
    constructor() {
        this.games = new Map();
        this.defaultConfig = {
            questionsPerGame: 10,
            pointsPerCorrect: 10,
            pointsPerIncorrect: -2,
            minimumScore: 60,
            timeLimit: null // null = no time limit
        };
    }

    /**
     * Register a game type
     * @param {string} type - Game type identifier (e.g., 'memory', 'vocabulary')
     * @param {Object} config - Game configuration
     * @param {class} config.module - Game class/module
     * @param {string} config.loadQuestion - Method name for loading questions
     * @param {string} config.checkAnswer - Method name for checking answers
     * @param {Object} config.config - Game-specific configuration
     * @param {string} config.displayName - Human-readable name
     * @param {string} config.displayNameHebrew - Hebrew display name
     * @param {string} config.icon - Emoji or icon for this game type
     */
    register(type, config) {
        if (!type || !config.module) {
            throw new Error('Game type and module are required');
        }

        const gameConfig = {
            type,
            module: config.module,
            loadQuestion: config.loadQuestion || 'loadQuestion',
            checkAnswer: config.checkAnswer || 'checkAnswer',
            displayName: config.displayName || type,
            displayNameHebrew: config.displayNameHebrew || type,
            icon: config.icon || '🎮',
            config: {
                ...this.defaultConfig,
                ...(config.config || {})
            }
        };

        this.games.set(type, gameConfig);
        console.log(`[GameRegistry] Registered game type: ${type}`);
    }

    /**
     * Get game configuration
     * @param {string} type - Game type
     * @returns {Object|null} Game configuration
     */
    get(type) {
        return this.games.get(type) || null;
    }

    /**
     * Check if game type is registered
     * @param {string} type - Game type
     * @returns {boolean}
     */
    has(type) {
        return this.games.has(type);
    }

    /**
     * Get all registered game types
     * @returns {Array<string>}
     */
    getAllTypes() {
        return Array.from(this.games.keys());
    }

    /**
     * Get all game configurations
     * @returns {Array<Object>}
     */
    getAllGames() {
        return Array.from(this.games.values());
    }

    /**
     * Get games by category/tag
     * @param {string} category - Category to filter by
     * @returns {Array<Object>}
     */
    getByCategory(category) {
        return this.getAllGames().filter(game =>
            game.config.categories?.includes(category)
        );
    }

    /**
     * Create game instance
     * @param {string} type - Game type
     * @param {Object} gameManager - Reference to GameManager instance
     * @returns {Object|null} Game instance
     */
    createInstance(type, gameManager) {
        const config = this.get(type);
        if (!config) {
            console.error(`[GameRegistry] Game type not found: ${type}`);
            return null;
        }

        try {
            // If module is a class, instantiate it
            if (typeof config.module === 'function') {
                return new config.module(gameManager);
            }
            // If module is an object, return it directly
            return config.module;
        } catch (error) {
            console.error(`[GameRegistry] Error creating instance for ${type}:`, error);
            return null;
        }
    }

    /**
     * Update game configuration
     * @param {string} type - Game type
     * @param {Object} updates - Configuration updates
     */
    updateConfig(type, updates) {
        const game = this.games.get(type);
        if (!game) {
            console.error(`[GameRegistry] Cannot update non-existent game: ${type}`);
            return;
        }

        game.config = {
            ...game.config,
            ...updates
        };
        this.games.set(type, game);
    }

    /**
     * Unregister a game type
     * @param {string} type - Game type
     * @returns {boolean} Success
     */
    unregister(type) {
        return this.games.delete(type);
    }

    /**
     * Register multiple games at once
     * @param {Object} gamesConfig - Map of game configs
     */
    registerBatch(gamesConfig) {
        Object.entries(gamesConfig).forEach(([type, config]) => {
            this.register(type, config);
        });
    }

    /**
     * Get game statistics
     * @returns {Object} Statistics about registered games
     */
    getStats() {
        return {
            totalGames: this.games.size,
            gameTypes: this.getAllTypes(),
            gamesWithTimeLimit: this.getAllGames().filter(g => g.config.timeLimit).length,
            averageQuestionsPerGame: this.getAllGames()
                .reduce((sum, g) => sum + g.config.questionsPerGame, 0) / this.games.size
        };
    }

    /**
     * Validate game instance has required methods
     * @param {Object} instance - Game instance
     * @param {string} type - Game type
     * @returns {boolean} Is valid
     */
    validateInstance(instance, type) {
        const config = this.get(type);
        if (!config) return false;

        const requiredMethods = [config.loadQuestion, config.checkAnswer];
        return requiredMethods.every(method =>
            typeof instance[method] === 'function'
        );
    }

    /**
     * Get recommended games for a skill level
     * @param {string} level - Skill level (beginner, intermediate, advanced)
     * @returns {Array<Object>}
     */
    getBySkillLevel(level) {
        return this.getAllGames().filter(game =>
            game.config.skillLevel === level || !game.config.skillLevel
        );
    }

    /**
     * Clear all registered games (mainly for testing)
     */
    clear() {
        this.games.clear();
    }
}

// Create singleton instance
export const gameRegistry = new GameRegistry();
