/**
 * Single-Player Game - Main game logic
 */

// Global state
let currentUser = null;
let activityCache = [];

// DOM Elements
const elements = {};

/**
 * Initialize the game
 */
async function initGame() {
    console.log('🏮 Initializing Echoes of the Lantern...');
    console.log('🎮 Starting in single-player mode (no backend required)');

    // Get DOM elements
    cacheElements();

    // Setup event listeners
    setupGameListeners();

    // Try to load saved game, or create new
    let user = loadLocalGameState();
    if (!user) {
        user = {
            id: 'guest',
            username: 'Guest Player',
            email: 'guest@local.game',
            gold: 100,
            day: 1,
            account_level: 1,
            heroes: []
        };
        console.log('🆕 Starting new game');
    } else {
        console.log('📂 Loaded saved game');
    }

    // Hide auth container, show game
    elements.authContainer.style.display = 'none';
    elements.gameContainer.style.display = 'block';

    // Initialize single-player mode
    currentUser = user;
    elements.usernameDisplay.textContent = user.username;
    elements.gold.textContent = user.gold;
    elements.day.textContent = user.day;
    elements.heroCount.textContent = user.heroes.length;

    // Update UI
    updateHeroesList(user.heroes);

    // Load game data
    await loadGameData();

    // Initialize activity log
    addLocalLog('Welcome to Echoes of the Lantern!', 'info');
    addLocalLog('🎮 Playing in single-player mode', 'info');

    console.log('✅ Game initialized in single-player mode');
}

/**
 * Cache DOM elements
 */
function cacheElements() {
    elements.authContainer = document.getElementById('auth-container');
    elements.gameContainer = document.getElementById('game-container');
    elements.usernameDisplay = document.getElementById('username-display');
    elements.gold = document.getElementById('gold');
    elements.day = document.getElementById('day');
    elements.heroCount = document.getElementById('hero-count');
    elements.heroesList = document.getElementById('heroes-list');
    elements.activityLog = document.getElementById('activity-log');
}

/**
 * Setup game listeners
 */
function setupGameListeners() {
    document.getElementById('summon-btn').addEventListener('click', handleSummonHero);
}

/**
 * Handle summon hero
 */
async function handleSummonHero() {
    const SUMMON_COST = 50;

    if (currentUser.gold < SUMMON_COST) {
        alert('Not enough gold to summon a hero!');
        return;
    }

    try {
        // Load game data if not already loaded
        if (!window.gameData) {
            await loadGameData();
        }

        // Deduct gold
        currentUser.gold -= SUMMON_COST;

        // Generate random hero
        const firstName = getRandomElement(window.gameData.heroNames.firstNames);
        const lastName = getRandomElement(window.gameData.heroNames.lastNames);
        const heroClass = getRandomElement(window.gameData.classes.classes);

        const hero = {
            id: generateId(),
            name: `${firstName} ${lastName}`,
            class: heroClass.id,
            level: 1,
            exp: 0,
            exp_to_next: 100,
            stats: {
                strength: 10 + (heroClass.bonuses.strength || 0),
                defense: 10 + (heroClass.bonuses.defense || 0),
                health: 50 + (heroClass.bonuses.health || 0),
                maxHealth: 50 + (heroClass.bonuses.health || 0),
                intelligence: 10 + (heroClass.bonuses.intelligence || 0),
                agility: 10 + (heroClass.bonuses.agility || 0),
                wisdom: 10 + (heroClass.bonuses.wisdom || 0),
                luck: 10 + (heroClass.bonuses.luck || 0),
                classEmoji: heroClass.emoji
            },
            current_activity: null,
            activity_start_time: null
        };

        // Add hero to list
        currentUser.heroes.push(hero);

        // Update UI
        elements.gold.textContent = currentUser.gold;
        elements.heroCount.textContent = currentUser.heroes.length;
        updateHeroesList(currentUser.heroes);

        // Add log entry
        addLocalLog(`✨ ${hero.stats.classEmoji} ${hero.name} the ${heroClass.name} has arrived!`, 'success');

        // Save to localStorage
        saveLocalGameState();

        console.log(`✅ Summoned ${hero.name}`);
    } catch (error) {
        console.error('Summon error:', error);
        alert('Failed to summon hero: ' + error.message);
    }
}

/**
 * Load game data from JSON files
 */
async function loadGameData() {
    try {
        const [classesRes, namesRes, activitiesRes] = await Promise.all([
            fetch('src/data/classes.json'),
            fetch('src/data/heroNames.json'),
            fetch('src/data/activities.json')
        ]);

        window.gameData = {
            classes: await classesRes.json(),
            heroNames: await namesRes.json(),
            activities: await activitiesRes.json()
        };

        console.log('✅ Game data loaded');
    } catch (error) {
        console.error('Failed to load game data:', error);
        throw error;
    }
}

/**
 * Get random element from array
 */
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save game state to localStorage
 */
function saveLocalGameState() {
    try {
        const saveData = {
            user: currentUser,
            lastSaved: Date.now()
        };
        localStorage.setItem('echoes-of-lantern-local', JSON.stringify(saveData));
    } catch (error) {
        console.error('Failed to save:', error);
    }
}

/**
 * Load game state from localStorage
 */
function loadLocalGameState() {
    try {
        const saved = localStorage.getItem('echoes-of-lantern-local');
        if (saved) {
            const data = JSON.parse(saved);
            return data.user;
        }
    } catch (error) {
        console.error('Failed to load save:', error);
    }
    return null;
}

/**
 * Add log entry (local only)
 */
function addLocalLog(message, type = 'info') {
    if (!activityCache) activityCache = [];
    activityCache.unshift({ message, type, timestamp: Date.now() });
    if (activityCache.length > 50) activityCache = activityCache.slice(0, 50);
    updateActivityFeed();
}

/**
 * Update heroes list
 */
function updateHeroesList(heroes) {
    if (!heroes || heroes.length === 0) {
        elements.heroesList.innerHTML = '<p class="empty-message">No heroes yet. Summon your first hero!</p>';
        return;
    }

    elements.heroesList.innerHTML = heroes.map(hero => {
        const stats = hero.stats;
        const activityText = hero.current_activity || '💤 Idle';

        return `
            <div class="hero-card">
                <h3>${stats.classEmoji} ${hero.name} - Lv ${hero.level}</h3>
                <div class="hero-stats">
                    <div class="hero-stat">
                        <span>⚔️ STR:</span>
                        <span>${stats.strength}</span>
                    </div>
                    <div class="hero-stat">
                        <span>🛡️ DEF:</span>
                        <span>${stats.defense}</span>
                    </div>
                    <div class="hero-stat">
                        <span>❤️ HP:</span>
                        <span>${stats.health}/${stats.maxHealth}</span>
                    </div>
                    <div class="hero-stat">
                        <span>✨ EXP:</span>
                        <span>${hero.exp}/${hero.exp_to_next}</span>
                    </div>
                </div>
                <div class="hero-activity">
                    ${activityText}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update activity feed
 */
async function updateActivityFeed() {
    displayActivities(activityCache || []);
}

/**
 * Display activities
 */
function displayActivities(activities) {
    if (!activities || activities.length === 0) {
        elements.activityLog.innerHTML = '<p class="log-entry">No activities yet...</p>';
        return;
    }

    elements.activityLog.innerHTML = activities.map(log => {
        const typeClass = log.type === 'success' ? 'success' :
                         log.type === 'warning' ? 'warning' :
                         log.type === 'danger' ? 'danger' : '';

        return `<p class="log-entry ${typeClass}">${log.message}</p>`;
    }).join('');
}

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
