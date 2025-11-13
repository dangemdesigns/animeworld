/**
 * Multiplayer Client - Main game logic with real-time multiplayer
 */
import { api } from './api.js';
import { API_CONFIG } from './config.js';

// Global state
let socket = null;
let currentUser = null;
let currentFeedTab = 'global';
let activityCache = [];

// DOM Elements
const elements = {};

/**
 * Initialize the game
 */
async function initGame() {
    console.log('🏮 Initializing Echoes of the Lantern...');

    // Skip authentication - load game directly for single-player mode
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

    // Initialize single-player mode (no socket connection)
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
 * Show backend error message
 */
function showBackendError() {
    document.getElementById('auth-container').innerHTML = `
        <div class="auth-box" style="max-width: 600px;">
            <h1>🏮 Echoes of the Lantern</h1>
            <p class="subtitle">Passive MMORPG</p>

            <div style="margin-top: 2rem; text-align: left; background: #FFF3CD; padding: 1.5rem; border-radius: 8px; border: 2px solid #FFC107;">
                <h3 style="margin-top: 0; color: #856404;">⚠️ Backend Server Required</h3>
                <p style="color: #856404; margin-bottom: 1rem;">This is a multiplayer game that requires a backend server to run.</p>

                <div style="background: white; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                    <h4 style="margin-top: 0;">🖥️ Option 1: Run Locally (Recommended)</h4>
                    <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
                        <li>Clone this repository to your computer</li>
                        <li>Open terminal in the project folder</li>
                        <li>Run: <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px;">cd server && npm install</code></li>
                        <li>Run: <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px;">npm start</code></li>
                        <li>Open: <strong>http://localhost:8080</strong></li>
                    </ol>
                </div>

                <div style="background: white; padding: 1rem; border-radius: 6px;">
                    <h4 style="margin-top: 0;">☁️ Option 2: Deploy Backend Online</h4>
                    <p style="margin: 0.5rem 0; font-size: 0.9rem;">To use GitHub Pages with this game:</p>
                    <ol style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.9rem;">
                        <li>Deploy the <code>/server</code> folder to Railway, Render, or Heroku</li>
                        <li>Update <code>PRODUCTION_URL</code> in <code>src/core/config.js</code></li>
                        <li>Push changes to GitHub</li>
                    </ol>
                </div>
            </div>

            <a href="https://github.com/${window.location.pathname.split('/')[1]}/animeworld"
               class="btn btn-primary"
               style="margin-top: 1.5rem; display: inline-block; text-decoration: none;">
                📂 View on GitHub
            </a>
        </div>
    `;
}

/**
 * Cache DOM elements
 */
function cacheElements() {
    elements.authContainer = document.getElementById('auth-container');
    elements.gameContainer = document.getElementById('game-container');
    elements.loginForm = document.getElementById('login-form');
    elements.registerForm = document.getElementById('register-form');
    elements.authMessage = document.getElementById('auth-message');

    // Auth inputs
    elements.loginEmail = document.getElementById('login-email');
    elements.loginPassword = document.getElementById('login-password');
    elements.registerUsername = document.getElementById('register-username');
    elements.registerEmail = document.getElementById('register-email');
    elements.registerPassword = document.getElementById('register-password');

    // Game UI
    elements.usernameDisplay = document.getElementById('username-display');
    elements.onlineCount = document.getElementById('online-count');
    elements.gold = document.getElementById('gold');
    elements.day = document.getElementById('day');
    elements.heroCount = document.getElementById('hero-count');
    elements.heroesList = document.getElementById('heroes-list');
    elements.activityLog = document.getElementById('activity-log');
    elements.offlineProgress = document.getElementById('offline-progress');
    elements.totalActivities = document.getElementById('total-activities');
    elements.recentActivities = document.getElementById('recent-activities');
}

/**
 * Setup authentication listeners
 */
function setupAuthListeners() {
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        elements.loginForm.style.display = 'none';
        elements.registerForm.style.display = 'block';
        elements.authMessage.textContent = '';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        elements.registerForm.style.display = 'none';
        elements.loginForm.style.display = 'block';
        elements.authMessage.textContent = '';
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('admin-bypass-btn').addEventListener('click', handleAdminBypass);

    // Enter key support
    elements.loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    elements.registerPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

/**
 * Setup game listeners
 */
function setupGameListeners() {
    document.getElementById('summon-btn').addEventListener('click', handleSummonHero);

    // Feed tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFeedTab = btn.dataset.tab;
            updateActivityFeed();
        });
    });
}

/**
 * Handle login
 */
async function handleLogin() {
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;

    if (!email || !password) {
        showAuthMessage('Please enter email and password', 'error');
        return;
    }

    try {
        const result = await api.login(email, password);
        if (result.success) {
            api.setToken(result.token);
            await onLoginSuccess(result.user, result.token, result.offlineProgress);
        }
    } catch (error) {
        showAuthMessage(error.message || 'Login failed', 'error');
    }
}

/**
 * Handle register
 */
async function handleRegister() {
    const username = elements.registerUsername.value.trim();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value;

    if (!username || !email || !password) {
        showAuthMessage('Please fill all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const result = await api.register(username, email, password);
        if (result.success) {
            api.setToken(result.token);
            await onLoginSuccess(result.user, result.token);
        }
    } catch (error) {
        showAuthMessage(error.message || 'Registration failed', 'error');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    api.clearToken();
    if (socket) {
        socket.disconnect();
    }
    currentUser = null;
    elements.gameContainer.style.display = 'none';
    elements.authContainer.style.display = 'flex';
    elements.loginEmail.value = '';
    elements.loginPassword.value = '';
}

/**
 * Handle admin bypass (development only)
 */
async function handleAdminBypass() {
    const testEmail = 'admin@test.com';
    const testPassword = 'admin123';

    showAuthMessage('🔧 Admin bypass: Auto-logging in...', 'info');

    try {
        // Try to login first
        let result = await api.login(testEmail, testPassword);

        if (result.success) {
            api.setToken(result.token);
            await onLoginSuccess(result.user, result.token, result.offlineProgress);
            return;
        }
    } catch (error) {
        // If login fails, try to register
        console.log('Test user not found, creating...');
        try {
            const registerResult = await api.register('AdminTest', testEmail, testPassword);
            if (registerResult.success) {
                api.setToken(registerResult.token);
                await onLoginSuccess(registerResult.user, registerResult.token);
            }
        } catch (registerError) {
            showAuthMessage('Admin bypass failed: ' + registerError.message, 'error');
        }
    }
}

/**
 * Show auth message
 */
function showAuthMessage(message, type = 'info') {
    elements.authMessage.textContent = message;
    elements.authMessage.className = `auth-message ${type}`;
}

/**
 * Show auth screen
 */
function showAuthScreen() {
    elements.authContainer.style.display = 'flex';
    elements.gameContainer.style.display = 'none';
}

/**
 * On login success
 */
async function onLoginSuccess(user, token, offlineProgress = null) {
    currentUser = user;

    // Hide auth, show game
    elements.authContainer.style.display = 'none';
    elements.gameContainer.style.display = 'block';

    // Update UI with user data
    elements.usernameDisplay.textContent = user.username;
    elements.gold.textContent = user.gold;
    elements.day.textContent = user.day;
    elements.heroCount.textContent = user.heroes.length;

    // Show offline progress if any
    if (offlineProgress && offlineProgress.goldEarned > 0) {
        elements.offlineProgress.innerHTML = `
            <p>💤 While you were away for ${offlineProgress.hoursAway} hours, your heroes earned <strong>${offlineProgress.goldEarned} gold</strong>!</p>
        `;
        elements.offlineProgress.style.display = 'block';
        setTimeout(() => {
            elements.offlineProgress.style.display = 'none';
        }, 8000);
    }

    // Connect to Socket.io
    connectSocket(user.id);

    // Load game data
    await loadGameData();

    // Update UI
    updateHeroesList(user.heroes);
    updateActivityFeed();
    updateStats();
}

/**
 * Connect to Socket.io
 */
function connectSocket(userId) {
    // Get base URL without /api suffix
    const socketURL = API_CONFIG.API_URL.replace('/api', '');
    socket = io(socketURL);

    socket.on('connect', () => {
        console.log('✅ Connected to server');
        socket.emit('authenticate', userId);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });

    // Listen for hero activity updates
    socket.on('hero_activity_start', (data) => {
        console.log('Hero started activity:', data);
        updateActivityFeed();
    });

    socket.on('hero_activity_complete', (data) => {
        console.log('Hero completed activity:', data);
        updateActivityFeed();

        // If it's our hero, update our gold
        if (data.username === currentUser.username) {
            currentUser.gold += data.goldReward;
            elements.gold.textContent = currentUser.gold;
        }
    });

    socket.on('user_data_update', (userData) => {
        // Update our user data
        if (userData.id === currentUser.id) {
            currentUser = userData;
            updateHeroesList(userData.heroes);
            elements.gold.textContent = userData.gold;
        }
    });

    socket.on('online_users_update', (data) => {
        elements.onlineCount.textContent = data.count;
    });

    socket.on('global_feed_update', (activities) => {
        activityCache = activities;
        if (currentFeedTab === 'global') {
            displayActivities(activities);
        }
    });
}

/**
 * Load game data
 */
async function loadGameData() {
    try {
        await updateActivityFeed();
        await updateStats();
    } catch (error) {
        console.error('Failed to load game data:', error);
    }
}

/**
 * Handle summon hero (Single-player mode)
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
 * Update activity feed (Single-player mode)
 */
async function updateActivityFeed() {
    // Use local activity cache
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
        const typeClass = log.type === 'level_up' ? 'success' :
                         log.type === 'hero_summon' ? 'success' :
                         log.type === 'user_join' ? 'info' : '';

        return `<p class="log-entry ${typeClass}">${log.message}</p>`;
    }).join('');
}

/**
 * Update stats
 */
async function updateStats() {
    try {
        const result = await api.getStats();
        if (result.success) {
            elements.totalActivities.textContent = result.stats.totalActivities;
            elements.recentActivities.textContent = result.stats.recentActivities;
            elements.onlineCount.textContent = result.stats.onlineUsers;
        }
    } catch (error) {
        console.error('Failed to update stats:', error);
    }
}

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Periodic updates
setInterval(() => {
    if (currentUser) {
        updateActivityFeed();
        updateStats();
    }
}, 5000); // Update every 5 seconds
