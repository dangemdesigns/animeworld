/**
 * gameState.js - Core Game State Management
 * Simple and stable state management
 */

export const gameState = {
    version: '1.0.0',

    // Haven resources
    gold: 100,
    day: 1,

    // Heroes array
    heroes: [],

    // Activity log
    activityLog: [],

    // Game data (loaded from JSON)
    data: {
        classes: [],
        heroNames: null,
        activities: []
    }
};

/**
 * Initialize game state
 */
export function initializeGameState() {
    // Load from localStorage if exists
    const saved = localStorage.getItem('echoes-of-lantern-save');
    if (saved) {
        try {
            const savedData = JSON.parse(saved);
            Object.assign(gameState, savedData);
            return true;
        } catch (error) {
            console.error('Failed to load save:', error);
            return false;
        }
    }
    return false;
}

/**
 * Save game state
 */
export function saveGameState() {
    try {
        const saveData = {
            version: gameState.version,
            gold: gameState.gold,
            day: gameState.day,
            heroes: gameState.heroes,
            activityLog: gameState.activityLog.slice(-50) // Keep last 50 logs
        };
        localStorage.setItem('echoes-of-lantern-save', JSON.stringify(saveData));
        return true;
    } catch (error) {
        console.error('Failed to save:', error);
        return false;
    }
}

/**
 * Reset game state
 */
export function resetGameState() {
    gameState.gold = 100;
    gameState.day = 1;
    gameState.heroes = [];
    gameState.activityLog = [];
    localStorage.removeItem('echoes-of-lantern-save');
}

/**
 * Add log entry
 */
export function addLog(message, type = 'info') {
    const entry = {
        message,
        type,
        timestamp: Date.now()
    };
    gameState.activityLog.unshift(entry);

    // Keep only last 100 logs
    if (gameState.activityLog.length > 100) {
        gameState.activityLog = gameState.activityLog.slice(0, 100);
    }
}

/**
 * Add gold
 */
export function addGold(amount) {
    gameState.gold += amount;
    if (gameState.gold < 0) gameState.gold = 0;
}

/**
 * Generate unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
