/**
 * Single-Player Game - Main game logic
 */

// Global state
let currentUser = null;
let activityCache = [];
let heroTimers = {}; // Track active hero timers

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
            heroes: [],
            materials: {}, // Material inventory
            crafting: [], // Items being crafted
            unlockedZones: ['whispering_woods'] // Start with first zone
        };
        console.log('🆕 Starting new game');
    } else {
        // Ensure new properties exist for old saves
        if (!user.materials) user.materials = {};
        if (!user.crafting) user.crafting = [];
        if (!user.unlockedZones) user.unlockedZones = ['whispering_woods'];
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

    // Process offline progression
    processOfflineProgress();

    // Update zones and materials display
    updateZonesDisplay();
    updateMaterialsDisplay();

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
    elements.zonesList = document.getElementById('zones-list');
    elements.materialsList = document.getElementById('materials-list');
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
            activity_start_time: null,
            current_zone: 'whispering_woods', // Default starting zone
            activity_queue: [], // Queue of activities to auto-execute
            equipment: { // Hero equipment slots
                weapon: null,
                armor: null,
                accessory: null
            }
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
        const [classesRes, namesRes, activitiesRes, zonesRes, materialsRes, craftingRes] = await Promise.all([
            fetch('src/data/classes.json'),
            fetch('src/data/heroNames.json'),
            fetch('src/data/activities.json'),
            fetch('src/data/zones.json'),
            fetch('src/data/materials.json'),
            fetch('src/data/crafting.json')
        ]);

        window.gameData = {
            classes: await classesRes.json(),
            heroNames: await namesRes.json(),
            activities: await activitiesRes.json(),
            zones: await zonesRes.json(),
            materials: await materialsRes.json(),
            crafting: await craftingRes.json()
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
        currentUser.lastSaved = Date.now();
        const saveData = {
            user: currentUser,
            lastSaved: currentUser.lastSaved
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
        // Ensure hero has new properties (for old saves)
        if (!hero.current_zone) hero.current_zone = 'whispering_woods';
        if (!hero.activity_queue) hero.activity_queue = [];
        if (!hero.equipment) hero.equipment = { weapon: null, armor: null, accessory: null };

        const stats = hero.stats;
        const currentActivity = hero.current_activity ? getActivityById(hero.current_activity) : null;
        const currentZone = getZoneById(hero.current_zone);

        const activityText = currentActivity
            ? `${currentActivity.emoji} ${currentActivity.name}...`
            : '💤 Idle';

        // Generate zone selection dropdown
        const zoneOptions = currentUser.unlockedZones.map(zoneId => {
            const zone = getZoneById(zoneId);
            const selected = zoneId === hero.current_zone ? 'selected' : '';
            return `<option value="${zoneId}" ${selected}>${zone.emoji} ${zone.name} (Lv ${zone.levelRequired}+)</option>`;
        }).join('');

        // Generate activity buttons
        const activityButtons = window.gameData && window.gameData.activities
            ? window.gameData.activities.activities.map(activity => {
                const disabled = hero.current_activity ? 'disabled' : '';
                return `<button class="btn btn-sm" onclick="window.startActivity('${hero.id}', '${activity.id}')" ${disabled}>
                    ${activity.emoji} ${activity.name}
                </button>`;
            }).join('')
            : '';

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
                    <strong>Status:</strong> ${activityText}
                </div>
                <div class="hero-zone">
                    <label for="zone-${hero.id}"><strong>Zone:</strong></label>
                    <select id="zone-${hero.id}" onchange="window.changeHeroZone('${hero.id}', this.value)" ${hero.current_activity ? 'disabled' : ''}>
                        ${zoneOptions}
                    </select>
                </div>
                <div class="hero-actions">
                    ${activityButtons}
                </div>
            </div>
        `;
    }).join('');

    // Update stats display
    elements.gold.textContent = currentUser.gold;
    elements.heroCount.textContent = currentUser.heroes.length;
}

/**
 * Update zones display
 */
function updateZonesDisplay() {
    if (!window.gameData || !window.gameData.zones || !currentUser) {
        elements.zonesList.innerHTML = '<p class="empty-message">Loading zones...</p>';
        return;
    }

    const zones = window.gameData.zones.zones;
    const maxHeroLevel = currentUser.heroes.length > 0
        ? Math.max(...currentUser.heroes.map(h => h.level))
        : 0;

    elements.zonesList.innerHTML = zones.map(zone => {
        const isUnlocked = currentUser.unlockedZones.includes(zone.id);
        const canUnlock = maxHeroLevel >= zone.levelRequired;
        const lockClass = !isUnlocked ? 'zone-locked' : '';

        return `
            <div class="zone-card ${lockClass}">
                <h3>${zone.emoji} ${zone.name}</h3>
                <p class="zone-level">Required Level: ${zone.levelRequired}</p>
                <p class="zone-desc">${zone.description}</p>
                ${isUnlocked
                    ? `<p class="zone-materials"><strong>Materials:</strong> ${zone.materials.map(m => {
                        const mat = getMaterialById(m);
                        return mat ? mat.emoji : '';
                    }).join(' ')}</p>`
                    : `<p class="zone-locked-text">🔒 ${canUnlock ? 'Unlocked at level ' + zone.levelRequired : 'Locked'}</p>`
                }
            </div>
        `;
    }).join('');
}

/**
 * Update materials display
 */
function updateMaterialsDisplay() {
    if (!currentUser || !currentUser.materials || Object.keys(currentUser.materials).length === 0) {
        elements.materialsList.innerHTML = '<p class="empty-message">No materials yet. Send heroes to explore zones!</p>';
        return;
    }

    const materialsHTML = Object.entries(currentUser.materials)
        .filter(([_, amount]) => amount > 0)
        .map(([materialId, amount]) => {
            const material = getMaterialById(materialId);
            if (!material) return '';

            const rarityClass = `rarity-${material.rarity}`;

            return `
                <div class="material-item ${rarityClass}">
                    <span class="material-emoji">${material.emoji}</span>
                    <span class="material-name">${material.name}</span>
                    <span class="material-amount">x${amount}</span>
                </div>
            `;
        })
        .join('');

    elements.materialsList.innerHTML = materialsHTML || '<p class="empty-message">No materials yet.</p>';
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

/**
 * Process offline progression
 */
function processOfflineProgress() {
    if (!currentUser || !currentUser.lastSaved) return;

    const now = Date.now();
    const timeSinceLastSave = now - currentUser.lastSaved;
    const hoursOffline = timeSinceLastSave / (1000 * 60 * 60);

    // Cap offline progression at 12 hours
    const effectiveHours = Math.min(hoursOffline, 12);

    if (effectiveHours < 0.1) return; // Less than 6 minutes, skip

    // Process each hero's ongoing activity
    currentUser.heroes.forEach(hero => {
        if (hero.current_activity && hero.activity_start_time) {
            const activityData = getActivityById(hero.current_activity);
            if (!activityData) return;

            const activityDuration = activityData.duration;
            const timeSinceStart = now - hero.activity_start_time;

            // Calculate how many times activity completed
            const completions = Math.floor(timeSinceStart / activityDuration);

            if (completions > 0) {
                // Apply rewards (capped at reasonable amount)
                const cappedCompletions = Math.min(completions, 50);
                const goldGained = activityData.goldReward * cappedCompletions;
                const expGained = activityData.expReward * cappedCompletions;

                currentUser.gold += goldGained;
                hero.exp += expGained;

                // Check for level ups
                checkHeroLevelUp(hero);

                // Gather materials if applicable
                if (activityData.gathersMaterials && hero.current_zone) {
                    gatherMaterialsForHero(hero, activityData, cappedCompletions);
                }

                addLocalLog(
                    `⏰ While you were away: ${hero.name} completed ${activityData.emoji} ${activityData.name} ${cappedCompletions}x (+${goldGained} gold, +${expGained} exp)`,
                    'info'
                );
            }
        }
    });

    addLocalLog(`🌙 Welcome back! You were away for ${Math.floor(effectiveHours * 60)} minutes`, 'success');
    saveLocalGameState();
}

/**
 * Get activity by ID
 */
function getActivityById(activityId) {
    if (!window.gameData || !window.gameData.activities) return null;
    return window.gameData.activities.activities.find(a => a.id === activityId);
}

/**
 * Get zone by ID
 */
function getZoneById(zoneId) {
    if (!window.gameData || !window.gameData.zones) return null;
    return window.gameData.zones.zones.find(z => z.id === zoneId);
}

/**
 * Get material by ID
 */
function getMaterialById(materialId) {
    if (!window.gameData || !window.gameData.materials) return null;
    return window.gameData.materials.materials.find(m => m.id === materialId);
}

/**
 * Start hero activity
 */
function startHeroActivity(hero, activityId) {
    const activity = getActivityById(activityId);
    if (!activity) {
        console.error('Activity not found:', activityId);
        return;
    }

    // Check if activity requires a zone
    if (activity.requiresZone && !hero.current_zone) {
        addLocalLog(`❌ ${hero.name} needs to select a zone first!`, 'warning');
        return;
    }

    // Check zone level requirement
    if (activity.requiresZone) {
        const zone = getZoneById(hero.current_zone);
        if (zone && hero.level < zone.levelRequired) {
            addLocalLog(`❌ ${hero.name} is too low level for ${zone.name} (requires Lv ${zone.levelRequired})`, 'warning');
            return;
        }
    }

    // Start the activity
    hero.current_activity = activityId;
    hero.activity_start_time = Date.now();

    updateHeroesList(currentUser.heroes);
    saveLocalGameState();

    // Set timer to complete activity
    const timerId = setTimeout(() => {
        completeHeroActivity(hero);
    }, activity.duration);

    heroTimers[hero.id] = timerId;

    const zone = hero.current_zone ? getZoneById(hero.current_zone) : null;
    const zoneText = zone ? ` in ${zone.emoji} ${zone.name}` : '';
    addLocalLog(`🎯 ${hero.name} started ${activity.emoji} ${activity.name}${zoneText}`, 'info');
}

/**
 * Complete hero activity
 */
function completeHeroActivity(hero) {
    if (!hero.current_activity) return;

    const activity = getActivityById(hero.current_activity);
    if (!activity) return;

    const zone = hero.current_zone ? getZoneById(hero.current_zone) : null;

    // Calculate rewards
    let goldReward = activity.goldReward;
    let expReward = activity.expReward;

    // Apply zone multipliers
    if (zone) {
        goldReward = Math.floor(goldReward * (zone.goldMultiplier || 1));
        expReward = Math.floor(expReward * (zone.expMultiplier || 1));
    }

    // Apply rewards
    currentUser.gold += goldReward;
    hero.exp += expReward;

    // Gather materials if applicable
    let materialsGathered = [];
    if (activity.gathersMaterials && zone) {
        materialsGathered = gatherMaterialsForHero(hero, activity, 1);
    }

    // Check for level up
    const leveledUp = checkHeroLevelUp(hero);

    // Generate story text
    let storyText = '';
    if (zone && zone.stories && zone.stories.length > 0) {
        storyText = getRandomElement(zone.stories);
    }

    // Create completion message
    let message = `✅ ${hero.name} completed ${activity.emoji} ${activity.name}`;
    if (zone) message += ` in ${zone.emoji} ${zone.name}`;
    if (storyText) message += ` and ${storyText}`;
    message += ` (+${goldReward} gold, +${expReward} exp`;
    if (materialsGathered.length > 0) {
        const materialText = materialsGathered.map(m => `${m.emoji} ${m.name} x${m.amount}`).join(', ');
        message += `, +${materialText}`;
    }
    message += ')';

    addLocalLog(message, 'success');

    if (leveledUp) {
        addLocalLog(`⭐ ${hero.name} reached Level ${hero.level}!`, 'success');
        checkZoneUnlocks();
    }

    // Clear activity
    hero.current_activity = null;
    hero.activity_start_time = null;

    // Process activity queue
    if (hero.activity_queue && hero.activity_queue.length > 0) {
        const nextActivity = hero.activity_queue.shift();
        setTimeout(() => startHeroActivity(hero, nextActivity), 500);
    }

    updateHeroesList(currentUser.heroes);
    updateZonesDisplay();
    updateMaterialsDisplay();
    saveLocalGameState();
}

/**
 * Gather materials for hero
 */
function gatherMaterialsForHero(hero, activity, iterations = 1) {
    const zone = getZoneById(hero.current_zone);
    if (!zone || !zone.materials) return [];

    const materialsGathered = [];

    for (let i = 0; i < iterations; i++) {
        // Check drop rate
        if (Math.random() > (activity.materialDropRate || 0.5)) continue;

        // Select random material from zone
        const materialId = getRandomElement(zone.materials);
        const materialData = getMaterialById(materialId);
        if (!materialData) continue;

        // Add to inventory
        const amount = Math.floor(Math.random() * 3) + 1; // 1-3 materials
        addMaterial(materialId, amount);

        // Track for message
        const existing = materialsGathered.find(m => m.id === materialId);
        if (existing) {
            existing.amount += amount;
        } else {
            materialsGathered.push({
                id: materialId,
                name: materialData.name,
                emoji: materialData.emoji,
                amount: amount
            });
        }
    }

    return materialsGathered;
}

/**
 * Add material to inventory
 */
function addMaterial(materialId, amount) {
    if (!currentUser.materials[materialId]) {
        currentUser.materials[materialId] = 0;
    }
    currentUser.materials[materialId] += amount;
}

/**
 * Check hero level up
 */
function checkHeroLevelUp(hero) {
    let leveledUp = false;
    while (hero.exp >= hero.exp_to_next) {
        hero.exp -= hero.exp_to_next;
        hero.level++;
        hero.exp_to_next = Math.floor(100 * Math.pow(1.5, hero.level - 1));

        // Increase stats
        hero.stats.strength += 3;
        hero.stats.defense += 2;
        hero.stats.maxHealth += 10;
        hero.stats.health = hero.stats.maxHealth;
        hero.stats.intelligence += 2;
        hero.stats.agility += 2;
        hero.stats.wisdom += 2;
        hero.stats.luck += 1;

        leveledUp = true;
    }
    return leveledUp;
}

/**
 * Check zone unlocks based on hero levels
 */
function checkZoneUnlocks() {
    if (!window.gameData || !window.gameData.zones) return;

    const maxHeroLevel = Math.max(...currentUser.heroes.map(h => h.level), 0);

    window.gameData.zones.zones.forEach(zone => {
        if (maxHeroLevel >= zone.levelRequired && !currentUser.unlockedZones.includes(zone.id)) {
            currentUser.unlockedZones.push(zone.id);
            addLocalLog(`🗺️ New zone unlocked: ${zone.emoji} ${zone.name}!`, 'success');
        }
    });
}

/**
 * Global helper: Start activity for a hero
 */
window.startActivity = function(heroId, activityId) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) {
        console.error('Hero not found:', heroId);
        return;
    }
    startHeroActivity(hero, activityId);
};

/**
 * Global helper: Change hero's zone
 */
window.changeHeroZone = function(heroId, zoneId) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) {
        console.error('Hero not found:', heroId);
        return;
    }

    const zone = getZoneById(zoneId);
    if (!zone) {
        console.error('Zone not found:', zoneId);
        return;
    }

    // Check if zone is unlocked
    if (!currentUser.unlockedZones.includes(zoneId)) {
        addLocalLog(`❌ Zone ${zone.emoji} ${zone.name} is not unlocked yet!`, 'warning');
        return;
    }

    hero.current_zone = zoneId;
    addLocalLog(`🗺️ ${hero.name} is now exploring ${zone.emoji} ${zone.name}`, 'info');
    updateHeroesList(currentUser.heroes);
    saveLocalGameState();
};

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
