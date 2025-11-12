/**
 * game.js - Main Game Controller
 * Handles game loop, UI updates, and user interactions
 */

import { gameState, initializeGameState, saveGameState, resetGameState, addLog, addGold } from './gameState.js';
import { createHero, addHero, startHeroActivity, completeHeroActivity, getClassName } from './hero.js';

// DOM Elements
let elements = {};

// Game loop interval
let gameLoopInterval = null;

/**
 * Initialize the game
 */
async function initGame() {
    console.log('🏮 Initializing Echoes of the Lantern...');

    // Get DOM elements
    elements = {
        gold: document.getElementById('gold'),
        day: document.getElementById('day'),
        heroCount: document.getElementById('hero-count'),
        heroesList: document.getElementById('heroes-list'),
        activityLog: document.getElementById('activity-log'),
        summonBtn: document.getElementById('summon-btn'),
        saveBtn: document.getElementById('save-btn'),
        loadBtn: document.getElementById('load-btn'),
        resetBtn: document.getElementById('reset-btn')
    };

    // Load game data
    await loadGameData();

    // Initialize or load game state
    const loaded = initializeGameState();
    if (loaded) {
        addLog('Game loaded successfully!', 'success');
    } else {
        addLog('Welcome to Echoes of the Lantern!', 'info');
    }

    // Setup event listeners
    setupEventListeners();

    // Start game loop
    startGameLoop();

    // Initial UI update
    updateUI();

    console.log('✅ Game initialized successfully!');
}

/**
 * Load game data from JSON files
 */
async function loadGameData() {
    try {
        // Load classes
        const classesResponse = await fetch('src/data/classes.json');
        gameState.data.classes = await classesResponse.json();

        // Load hero names
        const namesResponse = await fetch('src/data/heroNames.json');
        gameState.data.heroNames = await namesResponse.json();

        // Load activities
        const activitiesResponse = await fetch('src/data/activities.json');
        gameState.data.activities = await activitiesResponse.json();

        console.log('✅ Game data loaded');
    } catch (error) {
        console.error('❌ Failed to load game data:', error);
        alert('Failed to load game data. Please refresh the page.');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    elements.summonBtn.addEventListener('click', handleSummonHero);
    elements.saveBtn.addEventListener('click', handleSaveGame);
    elements.loadBtn.addEventListener('click', handleLoadGame);
    elements.resetBtn.addEventListener('click', handleResetGame);
}

/**
 * Handle summon hero button
 */
function handleSummonHero() {
    const cost = 50;

    if (gameState.gold < cost) {
        addLog('Not enough gold to summon a hero!', 'warning');
        return;
    }

    // Deduct gold
    addGold(-cost);

    // Create and add hero
    const hero = createHero();
    addHero(hero);

    // Start their first activity
    setTimeout(() => {
        startHeroActivity(hero);
    }, 1000);

    updateUI();
}

/**
 * Handle save game
 */
function handleSaveGame() {
    const success = saveGameState();
    if (success) {
        addLog('💾 Game saved successfully!', 'success');
    } else {
        addLog('❌ Failed to save game', 'danger');
    }
    updateUI();
}

/**
 * Handle load game
 */
function handleLoadGame() {
    if (confirm('Load saved game? Current progress will be lost.')) {
        location.reload();
    }
}

/**
 * Handle reset game
 */
function handleResetGame() {
    if (confirm('Reset game? All progress will be lost!')) {
        resetGameState();
        location.reload();
    }
}

/**
 * Start game loop
 */
function startGameLoop() {
    // Main game loop - runs every 100ms
    gameLoopInterval = setInterval(() => {
        updateHeroActivities();
        updateUI();
    }, 100);

    // Day progression - every 60 seconds
    setInterval(() => {
        gameState.day++;
        addLog(`🌅 Day ${gameState.day} begins`, 'info');
        updateUI();
    }, 60000);

    // Auto-save every 30 seconds
    setInterval(() => {
        saveGameState();
    }, 30000);
}

/**
 * Update hero activities
 */
function updateHeroActivities() {
    const now = Date.now();

    gameState.heroes.forEach(hero => {
        if (hero.activity && hero.activityStartTime) {
            // Get activity data
            const activity = gameState.data.activities.activities.find(a => a.id === hero.activity);
            if (!activity) return;

            // Check if activity is complete
            const elapsed = now - hero.activityStartTime;
            if (elapsed >= activity.duration) {
                completeHeroActivity(hero);

                // Start new activity after a short delay
                setTimeout(() => {
                    startHeroActivity(hero);
                }, 2000);
            }
        } else if (!hero.activity) {
            // If hero has no activity, start one
            startHeroActivity(hero);
        }
    });
}

/**
 * Update UI
 */
function updateUI() {
    // Update haven stats
    elements.gold.textContent = gameState.gold;
    elements.day.textContent = gameState.day;
    elements.heroCount.textContent = gameState.heroes.length;

    // Update summon button
    elements.summonBtn.disabled = gameState.gold < 50;

    // Update heroes list
    updateHeroesList();

    // Update activity log
    updateActivityLog();
}

/**
 * Update heroes list
 */
function updateHeroesList() {
    if (gameState.heroes.length === 0) {
        elements.heroesList.innerHTML = '<p class="empty-message">No heroes yet. Summon your first hero!</p>';
        return;
    }

    elements.heroesList.innerHTML = gameState.heroes.map(hero => {
        const activity = hero.activity
            ? gameState.data.activities.activities.find(a => a.id === hero.activity)
            : null;

        const progress = activity && hero.activityStartTime
            ? Math.min(100, ((Date.now() - hero.activityStartTime) / activity.duration) * 100)
            : 0;

        return `
            <div class="hero-card">
                <h3>${hero.classEmoji} ${hero.name} - Lv ${hero.level}</h3>
                <div class="hero-stats">
                    <div class="hero-stat">
                        <span>⚔️ STR:</span>
                        <span>${hero.stats.strength}</span>
                    </div>
                    <div class="hero-stat">
                        <span>🛡️ DEF:</span>
                        <span>${hero.stats.defense}</span>
                    </div>
                    <div class="hero-stat">
                        <span>❤️ HP:</span>
                        <span>${hero.stats.health}/${hero.stats.maxHealth}</span>
                    </div>
                    <div class="hero-stat">
                        <span>✨ EXP:</span>
                        <span>${hero.exp}/${hero.expToNext}</span>
                    </div>
                </div>
                <div class="hero-activity">
                    ${activity ? `${activity.emoji} ${activity.name} - ${Math.floor(progress)}%` : '💤 Idle'}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update activity log
 */
function updateActivityLog() {
    if (gameState.activityLog.length === 0) {
        elements.activityLog.innerHTML = '<p class="log-entry">Welcome to Echoes of the Lantern!</p>';
        return;
    }

    elements.activityLog.innerHTML = gameState.activityLog.slice(0, 20).map(log => {
        return `<p class="log-entry ${log.type}">${log.message}</p>`;
    }).join('');
}

// Initialize game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
