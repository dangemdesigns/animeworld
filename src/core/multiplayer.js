/**
 * Single-Player Game - Main game logic
 */

// Global state
let currentUser = null;
let activityCache = [];
let heroTimers = {}; // Track active hero timers
let progressInterval = null; // Track progress update interval

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
            heroes: [], // Active heroes (max 5-8 slots)
            guildHall: [], // Stored heroes (unlimited)
            materials: {}, // Material inventory
            crafting: [], // Items being crafted
            equipment: [], // Crafted equipment
            potions: [], // Crafted potions
            unlockedZones: ['whispering_woods'], // Start with first zone
            soulEssence: 0, // For converting duplicates
            summonPity: { basic: 0, advanced: 0, elite: 0 }, // Pity counters
            activeHeroSlots: 5, // Start with 5 active slots
            lastDailyFree: 0, // Timestamp for daily free summon
            buildings: { // Haven buildings
                forge: { level: 1 },
                alchemy_lab: { level: 1 },
                workshop: { level: 1 }
            },
            statistics: { // Track player stats
                totalSummons: 0,
                legendariesSummoned: 0,
                heroesAwakened: 0,
                itemsCrafted: 0,
                potionsBrewed: 0
            }
        };
        console.log('🆕 Starting new game');
    } else {
        // Ensure new properties exist for old saves
        if (!user.materials) user.materials = {};
        if (!user.crafting) user.crafting = [];
        if (!user.equipment) user.equipment = [];
        if (!user.potions) user.potions = [];
        if (!user.unlockedZones) user.unlockedZones = ['whispering_woods'];
        if (!user.guildHall) user.guildHall = [];
        if (!user.soulEssence) user.soulEssence = 0;
        if (!user.summonPity) user.summonPity = { basic: 0, advanced: 0, elite: 0 };
        if (!user.activeHeroSlots) user.activeHeroSlots = 5;
        if (!user.lastDailyFree) user.lastDailyFree = 0;
        if (!user.buildings) user.buildings = { forge: { level: 1 }, alchemy_lab: { level: 1 }, workshop: { level: 1 } };
        if (!user.statistics) user.statistics = { totalSummons: 0, legendariesSummoned: 0, heroesAwakened: 0, itemsCrafted: 0, potionsBrewed: 0 };
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

    // Load game data FIRST before rendering UI
    await loadGameData();

    // Process offline progression
    processOfflineProgress();

    // NOW update UI after game data is loaded
    updateHeroesList(user.heroes);
    updateGuildHallList();
    updateZonesDisplay();
    updateMaterialsDisplay();
    updateBuildingsDisplay();

    // Initialize activity log
    addLocalLog('Welcome to Echoes of the Lantern!', 'info');
    addLocalLog('🎮 Playing in single-player mode', 'info');

    // Update UI displays
    updateUIDisplays();
    updateDailyCooldownDisplay();

    // Start auto-activity system
    startAutoActivitySystem();

    console.log('✅ Game initialized in single-player mode');
}

/**
 * Start auto-activity system for heroes
 */
function startAutoActivitySystem() {
    // Auto-assign activities to idle heroes every 2 seconds
    setInterval(() => {
        if (!currentUser || !currentUser.heroes) return;

        currentUser.heroes.forEach(hero => {
            // If hero is idle and has no queued activity, assign random activity
            if (!hero.current_activity && (!hero.activity_queue || hero.activity_queue.length === 0)) {
                const randomActivity = selectRandomActivityForHero(hero);
                if (randomActivity) {
                    startHeroActivity(hero, randomActivity);
                }
            }
        });
    }, 2000);

    // Update progress bars every 100ms for smooth animation
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        updateActivityProgress();
    }, 100);
}

/**
 * Select random activity for hero based on level and zone
 */
function selectRandomActivityForHero(hero) {
    if (!window.gameData || !window.gameData.activities) return null;

    const activities = window.gameData.activities.activities;
    const availableActivities = activities.filter(activity => {
        // If activity requires zone, check if hero has valid zone
        if (activity.requiresZone) {
            if (!hero.current_zone) return false;
            const zone = getZoneById(hero.current_zone);
            if (!zone || hero.level < zone.levelRequired) return false;
        }
        return true;
    });

    if (availableActivities.length === 0) return null;

    // Weighted random selection (favor zone activities over training/rest)
    const weights = availableActivities.map(a => {
        if (a.requiresZone) return 3; // 3x more likely to do zone activities
        if (a.id === 'rest') return 0.5; // Less likely to rest
        return 1;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < availableActivities.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return availableActivities[i].id;
        }
    }

    return availableActivities[0].id;
}

/**
 * Update activity progress for all heroes
 */
function updateActivityProgress() {
    if (!currentUser || !currentUser.heroes) return;

    let needsUpdate = false;
    currentUser.heroes.forEach(hero => {
        if (hero.current_activity && hero.activity_start_time) {
            const activity = getActivityById(hero.current_activity);
            if (!activity) return;

            // Calculate activity duration with personality effects (same as startHeroActivity)
            let activityDuration = activity.duration;
            const personality = getPersonalityById(hero.personality);
            if (personality && personality.effects) {
                const effects = personality.effects;

                // Activity speed bonus (faster completion)
                if (effects.activity_speed_bonus) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_bonus));
                }

                // Activity speed penalty (slower completion)
                if (effects.activity_speed_penalty) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_penalty));
                }
            }

            const elapsed = Date.now() - hero.activity_start_time;
            const progress = Math.min((elapsed / activityDuration) * 100, 100);

            // Store progress on hero object for UI
            hero.activity_progress = progress;
            needsUpdate = true;
        } else {
            hero.activity_progress = 0;
        }
    });

    if (needsUpdate) {
        updateHeroesProgressBars();
    }
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
    elements.guildHallCount = document.getElementById('guild-hall-count');
    elements.soulEssence = document.getElementById('soul-essence');
    elements.heroesList = document.getElementById('heroes-list');
    elements.guildHallList = document.getElementById('guild-hall-list');
    elements.activityLog = document.getElementById('activity-log');
    elements.zonesList = document.getElementById('zones-list');
    elements.materialsList = document.getElementById('materials-list');

    // Summon portal elements
    elements.dailyFreeBtn = document.getElementById('daily-free-btn');
    elements.basicSummonBtn = document.getElementById('basic-summon-btn');
    elements.advancedSummonBtn = document.getElementById('advanced-summon-btn');
    elements.eliteSummonBtn = document.getElementById('elite-summon-btn');
    elements.dailyCooldown = document.getElementById('daily-cooldown');
    elements.basicPity = document.getElementById('basic-pity');
    elements.advancedPity = document.getElementById('advanced-pity');
    elements.elitePity = document.getElementById('elite-pity');
}

/**
 * Setup game listeners
 */
function setupGameListeners() {
    elements.dailyFreeBtn.addEventListener('click', handleDailyFreeSummon);
    elements.basicSummonBtn.addEventListener('click', () => handleSummonHero('basic', 50));
    elements.advancedSummonBtn.addEventListener('click', () => handleSummonHero('advanced', 150));
    elements.eliteSummonBtn.addEventListener('click', () => handleSummonHero('elite', 400));
}

/**
 * Update UI displays (gold, hero count, guild hall, soul essence, pity)
 */
function updateUIDisplays() {
    elements.gold.textContent = currentUser.gold;
    elements.heroCount.textContent = currentUser.heroes.length;
    elements.guildHallCount.textContent = currentUser.guildHall.length;
    elements.soulEssence.textContent = currentUser.soulEssence;

    // Update pity counters
    elements.basicPity.textContent = currentUser.summonPity.basic || 0;
    elements.advancedPity.textContent = currentUser.summonPity.advanced || 0;
    elements.elitePity.textContent = currentUser.summonPity.elite || 0;
}

/**
 * Update daily free summon cooldown display
 */
function updateDailyCooldownDisplay() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const timeLeft = oneDay - (now - currentUser.lastDailyFree);

    if (timeLeft > 0) {
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        elements.dailyCooldown.textContent = `Next free summon in ${hoursLeft}h ${minutesLeft}m`;
        elements.dailyCooldown.style.display = 'block';
        elements.dailyFreeBtn.disabled = true;
    } else {
        elements.dailyCooldown.style.display = 'none';
        elements.dailyFreeBtn.disabled = false;
    }
}

/**
 * Handle daily free summon
 */
async function handleDailyFreeSummon() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Check if 24 hours have passed since last free summon
    if (now - currentUser.lastDailyFree < oneDay) {
        const timeLeft = oneDay - (now - currentUser.lastDailyFree);
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        alert(`Daily free summon available in ${hoursLeft}h ${minutesLeft}m`);
        return;
    }

    // Perform free summon with "daily" type (worse rates than basic)
    currentUser.lastDailyFree = now;
    await performSummon('daily', 0);
    updateDailyCooldownDisplay();
}

/**
 * Handle summon hero (for different summon types)
 */
async function handleSummonHero(summonType, cost) {
    await performSummon(summonType, cost);
}

/**
 * Perform summon with type and cost
 */
async function performSummon(summonType, cost) {
    if (currentUser.gold < cost) {
        alert(`Not enough gold! Need ${cost} gold for this summon.`);
        return;
    }

    try {
        // Load game data if not already loaded
        if (!window.gameData) {
            await loadGameData();
        }

        // Deduct gold
        currentUser.gold -= cost;

        // Generate hero with new anime system
        const hero = generateHero(summonType);

        // Get class and personality data for display
        const heroClass = window.gameData.classes.classes.find(c => c.id === hero.class);
        const personality = getPersonalityById(hero.personality);

        // Check if hero roster is full
        if (currentUser.heroes.length >= currentUser.activeHeroSlots) {
            // Send to Guild Hall
            currentUser.guildHall.push(hero);
            addLocalLog(`📦 Guild Hall is full! ${hero.name} sent to storage.`, 'info');
        } else {
            // Add to active roster
            currentUser.heroes.push(hero);
        }

        // Update pity counter (only for non-daily summons)
        if (summonType !== 'daily') {
            if (!currentUser.summonPity[summonType]) currentUser.summonPity[summonType] = 0;

            // Reset pity if legendary or mythical
            if (hero.rarity === 'legendary' || hero.rarity === 'mythical') {
                currentUser.summonPity[summonType] = 0;
                currentUser.statistics.legendariesSummoned++;
            } else {
                currentUser.summonPity[summonType]++;
            }
        } else if (hero.rarity === 'legendary' || hero.rarity === 'mythical') {
            // Track legendary stats even for daily summons
            currentUser.statistics.legendariesSummoned++;
        }

        // Update statistics
        currentUser.statistics.totalSummons++;

        // Update UI
        updateUIDisplays();
        updateHeroesList(currentUser.heroes);

        // Get personality dialogue
        const summonDialogue = personality ? getRandomElement(personality.dialogues.summon) : '';

        // Create rarity-appropriate summoning message
        const rarityMessages = {
            common: `✨`,
            uncommon: `⭐`,
            rare: `🌟 Rare!`,
            epic: `💫 EPIC!!`,
            legendary: `🔥 LEGENDARY!!!`,
            mythical: `⚡ MYTHICAL!!!! ⚡`
        };

        const rarityMsg = rarityMessages[hero.rarity] || '✨';

        // Add log entry with personality
        addLocalLog(
            `${rarityMsg} ${hero.stats.classEmoji} ${hero.name} the ${heroClass.name} (${hero.rarity.toUpperCase()}) has arrived!`,
            hero.rarity === 'legendary' || hero.rarity === 'mythical' ? 'success' : 'info'
        );

        if (summonDialogue) {
            addLocalLog(`${personality.emoji} "${summonDialogue}"`, 'info');
        }

        // Show perks
        const perk1 = getPerkById(hero.perks.slot1);
        const perk2 = getPerkById(hero.perks.slot2);
        if (perk1 && perk2) {
            addLocalLog(
                `🎴 Starting Perks: ${perk1.emoji} ${perk1.name}, ${perk2.emoji} ${perk2.name}`,
                'info'
            );
        }

        // Save to localStorage
        saveLocalGameState();

        console.log(`✅ Summoned ${hero.name} (${hero.rarity})`);
    } catch (error) {
        console.error('Summon error:', error);
        alert('Failed to summon hero: ' + error.message);
        // Refund gold on error
        currentUser.gold += cost;
    }
}

/**
 * Load game data from JSON files
 */
async function loadGameData() {
    try {
        const [classesRes, namesRes, activitiesRes, zonesRes, materialsRes, craftingRes, perksRes, personalitiesRes, storyEventsRes, buildingsRes] = await Promise.all([
            fetch('src/data/classes.json'),
            fetch('src/data/heroNames.json'),
            fetch('src/data/activities.json'),
            fetch('src/data/zones.json'),
            fetch('src/data/materials.json'),
            fetch('src/data/crafting.json'),
            fetch('src/data/perks.json'),
            fetch('src/data/personalities.json'),
            fetch('src/data/storyEvents.json'),
            fetch('src/data/buildings.json')
        ]);

        window.gameData = {
            classes: await classesRes.json(),
            heroNames: await namesRes.json(),
            activities: await activitiesRes.json(),
            zones: await zonesRes.json(),
            materials: await materialsRes.json(),
            crafting: await craftingRes.json(),
            perks: await perksRes.json(),
            personalities: await personalitiesRes.json(),
            storyEvents: await storyEventsRes.json(),
            buildings: await buildingsRes.json()
        };

        console.log('✅ Game data loaded (including buildings)');
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
 * Weighted random selection
 */
function weightedRandom(weights) {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [key, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return key;
    }
    return Object.keys(weights)[0];
}

/**
 * Determine hero rarity based on summon type
 */
function determineRarity(summonType = 'basic', pityCounter = 0) {
    // Pity system (doesn't apply to daily free summon)
    if (summonType !== 'daily') {
        if (pityCounter >= 50) return 'legendary'; // Super pity
        if (pityCounter >= 10) return 'rare'; // Regular pity
    }

    const weights = {
        daily: {
            common: 70,
            uncommon: 25,
            rare: 5,
            epic: 0,
            legendary: 0,
            mythical: 0
        },
        basic: {
            common: 55,
            uncommon: 35,
            rare: 10,
            epic: 0,
            legendary: 0,
            mythical: 0
        },
        advanced: {
            common: 0,
            uncommon: 60,
            rare: 30,
            epic: 9,
            legendary: 0.8,
            mythical: 0.2
        },
        elite: {
            common: 0,
            uncommon: 0,
            rare: 55,
            epic: 36,
            legendary: 8.5,
            mythical: 0.5
        }
    };

    return weightedRandom(weights[summonType] || weights.basic);
}

/**
 * Generate random perk
 */
function generateRandomPerk() {
    if (!window.gameData || !window.gameData.perks) return null;

    const perkTiers = window.gameData.perks.perkTiers;
    const tier = weightedRandom(perkTiers);
    const perksOfTier = window.gameData.perks.perks.filter(p => p.tier === tier);

    return perksOfTier.length > 0 ? getRandomElement(perksOfTier).id : null;
}

/**
 * Get perk by ID
 */
function getPerkById(perkId) {
    if (!window.gameData || !window.gameData.perks) return null;
    return window.gameData.perks.perks.find(p => p.id === perkId);
}

/**
 * Get personality by ID
 */
function getPersonalityById(personalityId) {
    if (!window.gameData || !window.gameData.personalities) return null;
    return window.gameData.personalities.personalities.find(p => p.id === personalityId);
}

/**
 * Generate hero with full anime system
 */
function generateHero(summonType = 'basic') {
    if (!window.gameData) throw new Error('Game data not loaded');

    // Basic info
    const firstName = getRandomElement(window.gameData.heroNames.firstNames);
    const lastName = getRandomElement(window.gameData.heroNames.lastNames);
    const heroClass = getRandomElement(window.gameData.classes.classes);

    // Anime features
    const rarity = determineRarity(summonType, currentUser.summonPity[summonType] || 0);
    const personality = getRandomElement(window.gameData.personalities.personalities);

    // Rarity stat multipliers
    const rarityMultipliers = {
        common: 1.0,
        uncommon: 1.2,
        rare: 1.5,
        epic: 2.0,
        legendary: 3.0,
        mythical: 5.0
    };
    const multiplier = rarityMultipliers[rarity] || 1.0;

    // Generate starting perks (2 random perks)
    const startingPerks = [
        generateRandomPerk(),
        generateRandomPerk()
    ];

    const hero = {
        id: generateId(),
        name: `${firstName} ${lastName}`,
        class: heroClass.id,
        rarity: rarity,
        personality: personality.id,
        level: 1,
        exp: 0,
        exp_to_next: 100,
        awakeningTier: 1,
        stats: {
            strength: Math.floor((10 + (heroClass.bonuses.strength || 0)) * multiplier),
            defense: Math.floor((10 + (heroClass.bonuses.defense || 0)) * multiplier),
            health: Math.floor((50 + (heroClass.bonuses.health || 0)) * multiplier),
            maxHealth: Math.floor((50 + (heroClass.bonuses.health || 0)) * multiplier),
            intelligence: Math.floor((10 + (heroClass.bonuses.intelligence || 0)) * multiplier),
            agility: Math.floor((10 + (heroClass.bonuses.agility || 0)) * multiplier),
            wisdom: Math.floor((10 + (heroClass.bonuses.wisdom || 0)) * multiplier),
            luck: Math.floor((10 + (heroClass.bonuses.luck || 0)) * multiplier),
            classEmoji: heroClass.emoji
        },
        skills: {
            crafting_level: 1,
            crafting_exp: 0,
            alchemy_level: 1,
            alchemy_exp: 0
        },
        perks: {
            slot1: startingPerks[0],
            slot2: startingPerks[1],
            slot3: null, // Unlocked at 100g
            slot4: null, // Unlocked at 300g
            slot5: null  // Unlocked at 800g
        },
        perkLocks: {
            slot1: false,
            slot2: false,
            slot3: false,
            slot4: false,
            slot5: false
        },
        perkSlotsUnlocked: 2,
        current_activity: null,
        activity_start_time: null,
        current_zone: 'whispering_woods',
        activity_queue: [],
        equipment: {
            weapon: null,
            armor: null,
            accessory: null
        }
    };

    // Apply perk effects to base stats
    applyPerkEffects(hero);

    return hero;
}

/**
 * Apply awakening bonuses AND perk effects to hero stats
 */
function applyAwakeningAndPerkEffects(hero) {
    if (!hero.perks) return;

    const heroClass = window.gameData?.classes?.classes?.find(c => c.id === hero.class);
    if (!heroClass) return;

    // Rarity multipliers
    const rarityMultipliers = {
        common: 1.0,
        uncommon: 1.2,
        rare: 1.5,
        epic: 2.0,
        legendary: 3.0,
        mythical: 5.0
    };
    const rarityMultiplier = rarityMultipliers[hero.rarity] || 1.0;

    // Awakening multipliers (1.0, 1.2, 1.4, 1.6, 1.8)
    const awakeningTier = hero.awakeningTier || 1;
    const awakeningMultiplier = 1.0 + (0.2 * (awakeningTier - 1));

    // Calculate base stats with rarity and awakening
    const totalMultiplier = rarityMultiplier * awakeningMultiplier;

    const baseStats = {
        strength: Math.floor((10 + (heroClass.bonuses.strength || 0)) * totalMultiplier),
        defense: Math.floor((10 + (heroClass.bonuses.defense || 0)) * totalMultiplier),
        health: Math.floor((50 + (heroClass.bonuses.health || 0)) * totalMultiplier),
        maxHealth: Math.floor((50 + (heroClass.bonuses.health || 0)) * totalMultiplier),
        intelligence: Math.floor((10 + (heroClass.bonuses.intelligence || 0)) * totalMultiplier),
        agility: Math.floor((10 + (heroClass.bonuses.agility || 0)) * totalMultiplier),
        wisdom: Math.floor((10 + (heroClass.bonuses.wisdom || 0)) * totalMultiplier),
        luck: Math.floor((10 + (heroClass.bonuses.luck || 0)) * totalMultiplier)
    };

    // Apply base stats first
    Object.keys(baseStats).forEach(stat => {
        hero.stats[stat] = baseStats[stat];
    });

    // Apply perk bonuses on top
    Object.values(hero.perks).forEach(perkId => {
        if (!perkId) return;
        const perk = getPerkById(perkId);
        if (!perk || !perk.effect) return;

        if (perk.effect.stat && perk.effect.stat !== 'all') {
            const statName = perk.effect.stat;
            if (baseStats[statName] !== undefined) {
                hero.stats[statName] = Math.floor(baseStats[statName] * (1 + perk.effect.value));
            }
        } else if (perk.effect.stat === 'all') {
            Object.keys(baseStats).forEach(stat => {
                hero.stats[stat] = Math.floor(baseStats[stat] * (1 + perk.effect.value));
            });
        }
    });
}

/**
 * Apply perk effects to hero stats (wrapper for backwards compatibility)
 */
function applyPerkEffects(hero) {
    applyAwakeningAndPerkEffects(hero);
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
    try {
        if (!heroes || heroes.length === 0) {
            elements.heroesList.innerHTML = '<p class="empty-message">No heroes yet. Summon your first hero!</p>';
            return;
        }

        if (!window.gameData || !window.gameData.activities || !window.gameData.zones) {
            console.error('Game data not loaded yet!');
            elements.heroesList.innerHTML = '<p class="empty-message">Loading game data...</p>';
            return;
        }

        elements.heroesList.innerHTML = heroes.map(hero => {
        // Ensure hero has new properties (for old saves)
        if (!hero.current_zone) hero.current_zone = 'whispering_woods';
        if (!hero.activity_queue) hero.activity_queue = [];
        if (!hero.equipment) hero.equipment = { weapon: null, armor: null, accessory: null };
        if (!hero.rarity) hero.rarity = 'common';
        if (!hero.personality) hero.personality = 'brave';
        if (!hero.awakeningTier) hero.awakeningTier = 1;
        if (!hero.perks) hero.perks = { slot1: null, slot2: null, slot3: null, slot4: null, slot5: null };
        if (!hero.perkSlotsUnlocked) hero.perkSlotsUnlocked = 2;
        if (!hero.skills) hero.skills = { crafting_level: 1, crafting_exp: 0, alchemy_level: 1, alchemy_exp: 0 };

        const stats = hero.stats;
        const heroClass = window.gameData.classes.classes.find(c => c.id === hero.class);
        const personality = getPersonalityById(hero.personality);
        const currentActivity = hero.current_activity ? getActivityById(hero.current_activity) : null;

        const activityText = currentActivity
            ? `${currentActivity.emoji} ${currentActivity.name}...`
            : '💤 Idle';

        // Rarity display
        const rarityStars = '⭐'.repeat(hero.awakeningTier);
        const rarityClass = `rarity-${hero.rarity}`;

        // Generate zone selection dropdown
        const zoneOptions = currentUser.unlockedZones.map(zoneId => {
            const zone = getZoneById(zoneId);
            if (!zone) return '';
            const selected = zoneId === hero.current_zone ? 'selected' : '';
            return `<option value="${zoneId}" ${selected}>${zone.emoji} ${zone.name} (Lv ${zone.levelRequired}+)</option>`;
        }).filter(opt => opt).join('');

        // Get next queued activity
        const nextQueuedActivity = hero.activity_queue && hero.activity_queue.length > 0
            ? hero.activity_queue[0]
            : null;

        // Generate perks display
        const perkUnlockCosts = [0, 0, 100, 300, 800]; // slot1 and slot2 are free
        const perksHTML = Object.keys(hero.perks).map((slotKey, index) => {
            const perkId = hero.perks[slotKey];
            const perk = getPerkById(perkId);
            const slotNum = index + 1;
            const isLocked = slotNum > hero.perkSlotsUnlocked;
            const unlockCost = perkUnlockCosts[index];

            if (isLocked) {
                return `
                    <div class="perk-slot locked">
                        <button class="btn-perk-unlock" onclick="window.unlockPerkSlot('${hero.id}', ${slotNum}, ${unlockCost})">
                            🔒 Unlock (${unlockCost}g)
                        </button>
                    </div>
                `;
            } else if (perk) {
                const isLocked = hero.perkLocks && hero.perkLocks[slotKey];
                return `
                    <div class="perk-slot perk-tier-${perk.tier} ${isLocked ? 'perk-locked' : ''}">
                        <div class="perk-info">
                            <div class="perk-name">${perk.emoji} ${perk.name}</div>
                            <div class="perk-desc">${perk.description}</div>
                        </div>
                        <div class="perk-actions">
                            <button class="btn-perk-action ${isLocked ? 'btn-unlock' : 'btn-lock'}" onclick="window.togglePerkLock('${hero.id}', '${slotKey}')">
                                ${isLocked ? '🔒' : '🔓'}
                            </button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="perk-slot empty">
                        <button class="btn-perk-reroll" onclick="window.rerollPerk('${hero.id}', '${slotKey}')">
                            🎲 Roll Perk (50g)
                        </button>
                    </div>
                `;
            }
        }).join('');

        // Generate activity buttons with progress bars
        const activityButtons = window.gameData && window.gameData.activities
            ? window.gameData.activities.activities.map(activity => {
                const isActive = hero.current_activity === activity.id;
                const isQueued = nextQueuedActivity === activity.id;
                const progress = isActive ? (hero.activity_progress || 0) : 0;

                let btnClass = 'btn btn-sm activity-btn';
                if (isActive) btnClass += ' active';
                if (isQueued) btnClass += ' queued';

                return `
                    <button class="${btnClass}"
                            onclick="window.queueActivity('${hero.id}', '${activity.id}')"
                            data-hero-id="${hero.id}"
                            data-activity-id="${activity.id}">
                        <span class="btn-content">
                            ${activity.emoji} ${activity.name}
                            ${isQueued ? ' ⭐' : ''}
                        </span>
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </button>
                `;
            }).join('')
            : '';

        return `
            <div class="hero-card ${rarityClass}" data-hero-id="${hero.id}">
                <div class="hero-header">
                    <h3>
                        ${stats.classEmoji} ${hero.name} ${rarityStars}
                        <span class="hero-level">Lv ${hero.level}</span>
                    </h3>
                    <div class="hero-meta">
                        <span class="hero-rarity">${hero.rarity.toUpperCase()}</span>
                        <span class="hero-personality">${personality ? personality.emoji : ''} ${personality ? personality.name : ''}</span>
                    </div>
                    <div class="hero-class">
                        ${heroClass ? heroClass.name : ''}
                        <button class="btn-class-reroll" onclick="window.rerollClass('${hero.id}')">
                            🔄 Change Class (100g)
                        </button>
                    </div>
                </div>

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

                <div class="hero-perks">
                    <strong>🎴 Perks:</strong>
                    <div class="perks-grid">
                        ${perksHTML}
                    </div>
                    <button class="btn btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="window.rerollAllPerks('${hero.id}')">
                        🎲 Reroll All Unlocked (${calculateRerollCost(hero)}g)
                    </button>
                </div>

                <div class="hero-activity">
                    <strong>Status:</strong> ${activityText}
                    ${nextQueuedActivity ? `<span class="next-activity">→ Next: ${getActivityById(nextQueuedActivity)?.emoji || ''}</span>` : ''}
                </div>
                <div class="hero-zone">
                    <label for="zone-${hero.id}"><strong>Zone:</strong></label>
                    <select id="zone-${hero.id}" onchange="window.changeHeroZone('${hero.id}', this.value)">
                        ${zoneOptions}
                    </select>
                </div>
                <div class="hero-actions">
                    ${activityButtons}
                </div>
                <div class="hero-awakening" style="margin-top: var(--spacing-sm); padding: var(--spacing-xs); background: rgba(255, 215, 0, 0.1); border-radius: 4px;">
                    <button class="btn btn-sm" style="width: 100%; margin-bottom: 0.25rem;" onclick="window.awakenHero('${hero.id}')">
                        ⭐ Awaken (Tier ${hero.awakeningTier}/4)
                    </button>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-bottom: 0.5rem;">
                        ${getDuplicateCount(hero.name)} duplicates available
                    </div>
                    <button class="btn btn-sm" style="width: 100%; background: var(--text-secondary);" onclick="window.moveToStorage('${hero.id}')">
                        ⬇️ Move to Storage
                    </button>
                </div>
            </div>
        `;
    }).join('');

        // Update stats display
        elements.gold.textContent = currentUser.gold;
        elements.heroCount.textContent = currentUser.heroes.length;
    } catch (error) {
        console.error('Error updating heroes list:', error);
        elements.heroesList.innerHTML = '<p class="empty-message error">Error loading heroes. Please refresh the page.</p>';
    }
}

/**
 * Update hero progress bars without full re-render
 */
function updateHeroesProgressBars() {
    if (!currentUser || !currentUser.heroes) return;

    currentUser.heroes.forEach(hero => {
        const heroCard = document.querySelector(`[data-hero-id="${hero.id}"]`);
        if (!heroCard) return;

        // Update all activity buttons
        const activityButtons = heroCard.querySelectorAll('.activity-btn');
        activityButtons.forEach(button => {
            const activityId = button.getAttribute('data-activity-id');
            const progressBar = button.querySelector('.progress-bar');

            if (hero.current_activity === activityId) {
                button.classList.add('active');
                button.classList.remove('queued');
                if (progressBar) {
                    progressBar.style.width = `${hero.activity_progress || 0}%`;
                }
            } else {
                button.classList.remove('active');
                if (progressBar) {
                    progressBar.style.width = '0%';
                }

                // Check if queued
                const isQueued = hero.activity_queue && hero.activity_queue[0] === activityId;
                if (isQueued) {
                    button.classList.add('queued');
                } else {
                    button.classList.remove('queued');
                }
            }
        });
    });
}

/**
 * Update Guild Hall list (storage heroes)
 */
function updateGuildHallList() {
    if (!currentUser || !currentUser.guildHall) {
        elements.guildHallList.innerHTML = '<p class="empty-message">No heroes in storage yet.</p>';
        return;
    }

    if (currentUser.guildHall.length === 0) {
        elements.guildHallList.innerHTML = '<p class="empty-message">No heroes in storage yet.</p>';
        return;
    }

    try {
        elements.guildHallList.innerHTML = currentUser.guildHall.map(hero => {
            const stats = hero.stats || {};
            const heroClass = window.gameData?.classes?.classes?.find(c => c.id === hero.class);
            const personality = getPersonalityById(hero.personality);

            const rarityClass = `rarity-${hero.rarity}`;
            const awakeningTier = hero.awakeningTier || 1;
            const rarityStars = '⭐'.repeat(awakeningTier);

            return `
                <div class="hero-card ${rarityClass}" data-hero-id="${hero.id}">
                    <div class="hero-header">
                        <h3>
                            ${stats.classEmoji} ${hero.name} ${rarityStars}
                            <span class="hero-level">Lv ${hero.level}</span>
                        </h3>
                        <div class="hero-meta">
                            <span class="hero-rarity">${hero.rarity.toUpperCase()}</span>
                            <span class="hero-personality">${personality ? personality.emoji : ''} ${personality ? personality.name : ''}</span>
                        </div>
                        <div class="hero-class">
                            ${heroClass ? heroClass.name : ''}
                        </div>
                    </div>

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

                    <div class="hero-actions" style="margin-top: var(--spacing-sm); display: flex; gap: var(--spacing-xs);">
                        <button class="btn btn-sm" style="flex: 1;" onclick="window.moveToActiveRoster('${hero.id}')" ${currentUser.heroes.length >= currentUser.activeHeroSlots ? 'disabled' : ''}>
                            ⬆️ Move to Active
                        </button>
                        <button class="btn btn-sm" style="flex: 1; background: var(--accent-gold);" onclick="window.convertToEssence('${hero.id}')">
                            ✨ Convert (${hero.rarity === 'legendary' ? '100' : hero.rarity === 'epic' ? '50' : hero.rarity === 'rare' ? '20' : hero.rarity === 'uncommon' ? '5' : '1'} SE)
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error updating Guild Hall list:', error);
        elements.guildHallList.innerHTML = '<p class="empty-message error">Error loading Guild Hall. Please refresh the page.</p>';
    }
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
 * Resume in-progress activities after page refresh
 */
function resumeInProgressActivities() {
    if (!currentUser || !currentUser.heroes) return;

    const now = Date.now();
    currentUser.heroes.forEach(hero => {
        if (hero.current_activity && hero.activity_start_time) {
            const activityData = getActivityById(hero.current_activity);
            if (!activityData) {
                // Clear invalid activity
                hero.current_activity = null;
                hero.activity_start_time = null;
                return;
            }

            // Calculate activity duration with personality effects
            let activityDuration = activityData.duration;
            const personality = getPersonalityById(hero.personality);
            if (personality && personality.effects) {
                const effects = personality.effects;

                // Activity speed bonus (faster completion)
                if (effects.activity_speed_bonus) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_bonus));
                }

                // Activity speed penalty (slower completion)
                if (effects.activity_speed_penalty) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_penalty));
                }
            }

            const timeSinceStart = now - hero.activity_start_time;
            const timeRemaining = activityDuration - timeSinceStart;

            if (timeRemaining > 0) {
                // Resume the activity timer
                const timerId = setTimeout(() => {
                    completeHeroActivity(hero);
                }, timeRemaining);
                heroTimers[hero.id] = timerId;
            } else {
                // Activity should be completed now
                completeHeroActivity(hero);
            }
        }
    });
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

    if (effectiveHours < 0.1) {
        // Less than 6 minutes, just resume activities without rewards
        resumeInProgressActivities();
        return;
    }

    // Process each hero's ongoing activity
    currentUser.heroes.forEach(hero => {
        if (hero.current_activity && hero.activity_start_time) {
            const activityData = getActivityById(hero.current_activity);
            if (!activityData) {
                // Clear invalid activity
                hero.current_activity = null;
                hero.activity_start_time = null;
                return;
            }

            // Calculate activity duration with personality effects
            let activityDuration = activityData.duration;
            const personality = getPersonalityById(hero.personality);
            if (personality && personality.effects) {
                const effects = personality.effects;

                // Activity speed bonus (faster completion)
                if (effects.activity_speed_bonus) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_bonus));
                }

                // Activity speed penalty (slower completion)
                if (effects.activity_speed_penalty) {
                    activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_penalty));
                }
            }

            const timeSinceStart = now - hero.activity_start_time;

            // Calculate how many times activity completed
            const completions = Math.floor(timeSinceStart / activityDuration);

            if (completions > 0) {
                // Apply rewards (capped at reasonable amount)
                const cappedCompletions = Math.min(completions, 50);
                let goldGained = activityData.goldReward * cappedCompletions;
                let expGained = activityData.expReward * cappedCompletions;

                // Apply personality effects to offline rewards
                if (personality && personality.effects) {
                    const effects = personality.effects;

                    if (effects.gold_bonus) {
                        goldGained = Math.floor(goldGained * (1 + effects.gold_bonus));
                    }
                    if (effects.gold_penalty) {
                        goldGained = Math.floor(goldGained * (1 + effects.gold_penalty));
                    }
                    if (effects.exp_bonus) {
                        expGained = Math.floor(expGained * (1 + effects.exp_bonus));
                    }
                    if (effects.exp_penalty) {
                        expGained = Math.floor(expGained * (1 + effects.exp_penalty));
                    }
                    if (effects.all_rewards_bonus) {
                        goldGained = Math.floor(goldGained * (1 + effects.all_rewards_bonus));
                        expGained = Math.floor(expGained * (1 + effects.all_rewards_bonus));
                    }
                }

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

                // Clear activity after offline completion
                hero.current_activity = null;
                hero.activity_start_time = null;
            } else {
                // Activity still in progress - calculate remaining time and resume
                const timeRemaining = activityDuration - timeSinceStart;
                if (timeRemaining > 0) {
                    // Resume the activity timer
                    const timerId = setTimeout(() => {
                        completeHeroActivity(hero);
                    }, timeRemaining);
                    heroTimers[hero.id] = timerId;
                } else {
                    // Should have completed, clear it
                    hero.current_activity = null;
                    hero.activity_start_time = null;
                }
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

    // Calculate activity duration with personality effects
    let activityDuration = activity.duration;
    const personality = getPersonalityById(hero.personality);
    if (personality && personality.effects) {
        const effects = personality.effects;

        // Activity speed bonus (faster completion)
        if (effects.activity_speed_bonus) {
            activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_bonus));
        }

        // Activity speed penalty (slower completion)
        if (effects.activity_speed_penalty) {
            activityDuration = Math.floor(activityDuration / (1 + effects.activity_speed_penalty));
        }
    }

    // Set timer to complete activity
    const timerId = setTimeout(() => {
        completeHeroActivity(hero);
    }, activityDuration);

    heroTimers[hero.id] = timerId;

    const zone = hero.current_zone ? getZoneById(hero.current_zone) : null;
    const zoneText = zone ? ` in ${zone.emoji} ${zone.name}` : '';
    addLocalLog(`🎯 ${hero.name} started ${activity.emoji} ${activity.name}${zoneText}`, 'info');

    // Add personality dialogue for activity start (reuse personality variable from above)
    if (personality && personality.dialogues && personality.dialogues.activity_start) {
        const dialogue = getRandomElement(personality.dialogues.activity_start);
        addLocalLog(`${personality.emoji} ${hero.name}: "${dialogue}"`, 'info');
    }
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

    // Apply personality effects
    const personality = getPersonalityById(hero.personality);
    if (personality && personality.effects) {
        const effects = personality.effects;

        // Gold bonus/penalty
        if (effects.gold_bonus) {
            goldReward = Math.floor(goldReward * (1 + effects.gold_bonus));
        }
        if (effects.gold_penalty) {
            goldReward = Math.floor(goldReward * (1 + effects.gold_penalty));
        }

        // Exp bonus/penalty
        if (effects.exp_bonus) {
            expReward = Math.floor(expReward * (1 + effects.exp_bonus));
        }
        if (effects.exp_penalty) {
            expReward = Math.floor(expReward * (1 + effects.exp_penalty));
        }

        // All rewards bonus (affects both gold and exp)
        if (effects.all_rewards_bonus) {
            goldReward = Math.floor(goldReward * (1 + effects.all_rewards_bonus));
            expReward = Math.floor(expReward * (1 + effects.all_rewards_bonus));
        }

        // Random variance (can increase or decrease rewards randomly)
        if (effects.random_variance) {
            const variance = (Math.random() * 2 - 1) * effects.random_variance; // -variance to +variance
            goldReward = Math.floor(goldReward * (1 + variance));
            expReward = Math.floor(expReward * (1 + variance));
        }

        // Failure chance (chance to get no rewards)
        if (effects.failure_chance && Math.random() < effects.failure_chance) {
            goldReward = 0;
            expReward = 0;
            addLocalLog(`💥 ${hero.name}'s reckless approach backfired! No rewards this time.`, 'warning');
        }
    }

    // Apply rewards
    currentUser.gold += goldReward;
    hero.exp += expReward;

    // Gather materials if applicable
    let materialsGathered = [];
    if (activity.gathersMaterials && zone) {
        materialsGathered = gatherMaterialsForHero(hero, activity, 1);
    }

    // Check for story event encounter (5% chance)
    let encounterEvent = null;
    if (zone && Math.random() < 0.05) {
        encounterEvent = triggerStoryEncounter(hero, zone);
        if (encounterEvent) {
            // Add encounter rewards
            if (encounterEvent.reward.gold) {
                goldReward += encounterEvent.reward.gold;
                currentUser.gold += encounterEvent.reward.gold;
            }
            if (encounterEvent.reward.exp) {
                expReward += encounterEvent.reward.exp;
                hero.exp += encounterEvent.reward.exp;
            }
            if (encounterEvent.reward.material) {
                addMaterial(encounterEvent.reward.material, 1);
                materialsGathered.push({
                    id: encounterEvent.reward.material,
                    name: getMaterialById(encounterEvent.reward.material)?.name || encounterEvent.reward.material,
                    emoji: getMaterialById(encounterEvent.reward.material)?.emoji || '💎',
                    amount: 1
                });
            }
        }
    }

    // Handle crafting activities
    if (activity.isCrafting) {
        const quality = calculateCraftQuality(hero, activity.requiresBuilding, activity.skillType);
        let craftedItem = null;

        if (activity.craftingType === 'potion') {
            craftedItem = generatePotion(hero, quality);
            currentUser.potions.push(craftedItem);
            currentUser.statistics.potionsBrewed++;
        } else {
            // Equipment or accessory
            craftedItem = generateEquipment(hero, quality, activity.craftingType);
            currentUser.equipment.push(craftedItem);
            currentUser.statistics.itemsCrafted++;
        }

        // Award skill exp
        awardSkillExp(hero, activity.skillType, activity.skillExpReward);

        // Log crafting success
        const qualityEmoji = {
            common: '⚪',
            uncommon: '🟢',
            rare: '🔵',
            epic: '🟣',
            legendary: '🟡'
        };

        addLocalLog(
            `${activity.emoji} ${hero.name} crafted ${qualityEmoji[quality]} ${craftedItem.name}!`,
            quality === 'legendary' || quality === 'epic' ? 'success' : 'info'
        );
    }

    // Check for level up
    const leveledUp = checkHeroLevelUp(hero);

    // Generate story text (only for non-crafting activities)
    let storyText = '';
    if (!activity.isCrafting && zone && zone.stories && zone.stories.length > 0) {
        storyText = getRandomElement(zone.stories);
    }

    // Create completion message (only for non-crafting, crafting has custom message above)
    if (!activity.isCrafting) {
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
    }

    // Display story encounter if it occurred
    if (encounterEvent) {
        const rarityEmoji = {
            common: '✨',
            uncommon: '⭐',
            rare: '🌟',
            epic: '💫',
            legendary: '🔥',
            mythical: '⚡'
        };
        addLocalLog(
            `${rarityEmoji[encounterEvent.rarity] || '✨'} ${encounterEvent.title}`,
            encounterEvent.rarity === 'legendary' || encounterEvent.rarity === 'mythical' ? 'success' : 'info'
        );
        addLocalLog(encounterEvent.story, 'info');
    }

    // Add personality dialogue for activity completion (reuse personality variable from above)
    if (personality && personality.dialogues && personality.dialogues.activity_complete) {
        const dialogue = getRandomElement(personality.dialogues.activity_complete);
        addLocalLog(`${personality.emoji} ${hero.name}: "${dialogue}"`, 'info');
    }

    if (leveledUp) {
        addLocalLog(`⭐ ${hero.name} reached Level ${hero.level}!`, 'success');

        // Add personality dialogue for level up
        if (personality && personality.dialogues && personality.dialogues.level_up) {
            const dialogue = getRandomElement(personality.dialogues.level_up);
            addLocalLog(`${personality.emoji} ${hero.name}: "${dialogue}"`, 'success');
        }

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

    // Get personality effects
    const personality = getPersonalityById(hero.personality);
    let dropRateModifier = 1.0;
    let amountModifier = 1.0;
    let rareBonusChance = 0;

    if (personality && personality.effects) {
        const effects = personality.effects;

        // Gathering bonus (increases drop rate)
        if (effects.gathering_bonus) {
            dropRateModifier += effects.gathering_bonus;
        }
        if (effects.gathering_penalty) {
            dropRateModifier += effects.gathering_penalty;
        }

        // Material drop bonus (increases drop rate)
        if (effects.material_drop_bonus) {
            dropRateModifier += effects.material_drop_bonus;
        }
        if (effects.material_drop_penalty) {
            dropRateModifier += effects.material_drop_penalty;
        }

        // Material bonus (increases amount)
        if (effects.material_bonus) {
            amountModifier += effects.material_bonus;
        }

        // Rare drop bonus (chance for extra materials)
        if (effects.rare_drop_bonus) {
            rareBonusChance = effects.rare_drop_bonus;
        }
    }

    for (let i = 0; i < iterations; i++) {
        // Check drop rate with personality modifier
        const effectiveDropRate = (activity.materialDropRate || 0.5) * dropRateModifier;
        if (Math.random() > effectiveDropRate) continue;

        // Select random material from zone
        const materialId = getRandomElement(zone.materials);
        const materialData = getMaterialById(materialId);
        if (!materialData) continue;

        // Calculate amount with personality modifier
        let amount = Math.floor(Math.random() * 3) + 1; // 1-3 materials
        amount = Math.floor(amount * amountModifier);

        // Rare drop bonus - chance for extra materials
        if (rareBonusChance > 0 && Math.random() < rareBonusChance) {
            amount += Math.floor(Math.random() * 2) + 1; // +1-2 extra materials
        }

        // Add to inventory
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
 * Global helper: Queue activity for a hero (priority system)
 */
window.queueActivity = function(heroId, activityId) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) {
        console.error('Hero not found:', heroId);
        return;
    }

    const activity = getActivityById(activityId);
    if (!activity) {
        console.error('Activity not found:', activityId);
        return;
    }

    // Initialize queue if needed
    if (!hero.activity_queue) hero.activity_queue = [];

    // If clicking current activity, do nothing (it's already running)
    if (hero.current_activity === activityId) {
        addLocalLog(`${hero.name} is already doing ${activity.emoji} ${activity.name}!`, 'info');
        return;
    }

    // If clicking queued activity, remove it from queue
    const queueIndex = hero.activity_queue.indexOf(activityId);
    if (queueIndex !== -1) {
        hero.activity_queue.splice(queueIndex, 1);
        addLocalLog(`🔄 Removed ${activity.emoji} ${activity.name} from ${hero.name}'s queue`, 'info');
        updateHeroesList(currentUser.heroes);
        saveLocalGameState();
        return;
    }

    // Add to queue (replace if queue already has something)
    hero.activity_queue = [activityId];
    addLocalLog(`⭐ ${hero.name} will do ${activity.emoji} ${activity.name} next!`, 'success');

    updateHeroesList(currentUser.heroes);
    saveLocalGameState();
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

/**
 * Calculate reroll cost based on locked perks
 */
function calculateRerollCost(hero) {
    if (!hero.perkLocks) return 50; // Base cost

    const lockedCount = Object.values(hero.perkLocks).filter(locked => locked).length;
    const baseCost = 50;
    const lockPenalty = lockedCount * 25; // +25g per locked perk

    return baseCost + lockPenalty;
}

/**
 * Global helper: Toggle perk lock
 */
window.togglePerkLock = function(heroId, slotKey) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) return;

    if (!hero.perkLocks) {
        hero.perkLocks = {
            slot1: false,
            slot2: false,
            slot3: false,
            slot4: false,
            slot5: false
        };
    }

    hero.perkLocks[slotKey] = !hero.perkLocks[slotKey];

    updateHeroesList(currentUser.heroes);
    saveLocalGameState();
};

/**
 * Global helper: Reroll all unlocked perks
 */
window.rerollAllPerks = function(heroId) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const rerollCost = calculateRerollCost(hero);

    if (currentUser.gold < rerollCost) {
        alert(`Not enough gold! Need ${rerollCost} gold to reroll all unlocked perks.`);
        return;
    }

    // Ensure perkLocks exists
    if (!hero.perkLocks) {
        hero.perkLocks = {
            slot1: false,
            slot2: false,
            slot3: false,
            slot4: false,
            slot5: false
        };
    }

    // Count how many perks will be rerolled
    let rerolledCount = 0;
    const newPerks = [];

    Object.keys(hero.perks).forEach((slotKey, index) => {
        const slotNum = index + 1;
        const isUnlocked = slotNum <= hero.perkSlotsUnlocked;
        const isLocked = hero.perkLocks[slotKey];
        const hasPerk = hero.perks[slotKey] !== null;

        if (isUnlocked && !isLocked && hasPerk) {
            // Reroll this perk
            const newPerkId = generateRandomPerk();
            hero.perks[slotKey] = newPerkId;
            rerolledCount++;
            const perk = getPerkById(newPerkId);
            if (perk) {
                newPerks.push(`${perk.emoji} ${perk.name}`);
            }
        }
    });

    if (rerolledCount === 0) {
        alert('No unlocked perks to reroll! All perks are either locked or empty.');
        return;
    }

    // Deduct cost
    currentUser.gold -= rerollCost;

    // Recalculate stats with new perks
    applyAwakeningAndPerkEffects(hero);

    addLocalLog(
        `🎲 ${hero.name} rerolled ${rerolledCount} perk(s): ${newPerks.join(', ')}`,
        'success'
    );

    updateHeroesList(currentUser.heroes);
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Global helper: Unlock perk slot
 */
window.unlockPerkSlot = function(heroId, slotNum, cost) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) return;

    if (currentUser.gold < cost) {
        alert(`Not enough gold! Need ${cost} gold to unlock this slot.`);
        return;
    }

    currentUser.gold -= cost;
    hero.perkSlotsUnlocked = slotNum;

    addLocalLog(`🔓 ${hero.name} unlocked perk slot ${slotNum}!`, 'success');
    updateHeroesList(currentUser.heroes);
    saveLocalGameState();
};

/**
 * Global helper: Reroll perk
 */
window.rerollPerk = function(heroId, slotKey) {
    const REROLL_COST = 50;
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) return;

    if (currentUser.gold < REROLL_COST) {
        alert(`Not enough gold! Need ${REROLL_COST} gold to reroll.`);
        return;
    }

    currentUser.gold -= REROLL_COST;

    // Generate new random perk
    const newPerkId = generateRandomPerk();
    const newPerk = getPerkById(newPerkId);

    hero.perks[slotKey] = newPerkId;

    // Recalculate stats with new perk
    applyPerkEffects(hero);

    if (newPerk) {
        addLocalLog(`🎲 ${hero.name} rolled ${newPerk.emoji} ${newPerk.name} (${newPerk.tier})!`, newPerk.tier === 'legendary' ? 'success' : 'info');
    }

    updateHeroesList(currentUser.heroes);
    saveLocalGameState();
};

/**
 * Global helper: Reroll class
 */
window.rerollClass = function(heroId) {
    const REROLL_COST = 100;
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) return;

    if (currentUser.gold < REROLL_COST) {
        alert(`Not enough gold! Need ${REROLL_COST} gold to change class.`);
        return;
    }

    const confirmChange = confirm(`Change ${hero.name}'s class? This will recalculate their stats. Cost: ${REROLL_COST} gold`);
    if (!confirmChange) return;

    currentUser.gold -= REROLL_COST;

    // Get new random class
    const oldClass = window.gameData.classes.classes.find(c => c.id === hero.class);
    const newClass = getRandomElement(window.gameData.classes.classes);

    hero.class = newClass.id;
    hero.stats.classEmoji = newClass.emoji;

    // Recalculate stats
    applyPerkEffects(hero);

    addLocalLog(`🔄 ${hero.name} changed from ${oldClass.name} to ${newClass.name}!`, 'success');
    updateHeroesList(currentUser.heroes);
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Trigger story encounter for hero in zone
 */
function triggerStoryEncounter(hero, zone) {
    if (!window.gameData || !window.gameData.storyEvents) return null;

    const encounters = window.gameData.storyEvents.encounters[zone.id];
    if (!encounters || encounters.length === 0) return null;

    // Weight encounters by rarity (rarer = less likely)
    const rarityWeights = {
        common: 50,
        uncommon: 30,
        rare: 15,
        epic: 4,
        legendary: 0.9,
        mythical: 0.1
    };

    // Filter and weight encounters
    const weightedEncounters = [];
    encounters.forEach(encounter => {
        const weight = rarityWeights[encounter.rarity] || 10;
        weightedEncounters.push({ encounter, weight });
    });

    // Select random encounter based on weights
    const totalWeight = weightedEncounters.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weightedEncounters) {
        random -= item.weight;
        if (random <= 0) {
            // Replace {hero} placeholder with hero name
            const story = item.encounter.story.replace(/{hero}/g, hero.name);
            return {
                ...item.encounter,
                story: story
            };
        }
    }

    return null;
}

/**
 * Global helper: Move hero from Guild Hall to active roster
 */
window.moveToActiveRoster = function(heroId) {
    const heroIndex = currentUser.guildHall.findIndex(h => h.id === heroId);
    if (heroIndex === -1) {
        alert('Hero not found in Guild Hall!');
        return;
    }

    if (currentUser.heroes.length >= currentUser.activeHeroSlots) {
        alert(`Active roster is full! (${currentUser.activeHeroSlots} slots)`);
        return;
    }

    const hero = currentUser.guildHall.splice(heroIndex, 1)[0];
    currentUser.heroes.push(hero);

    addLocalLog(`⬆️ ${hero.name} moved to active roster!`, 'success');
    updateHeroesList(currentUser.heroes);
    updateGuildHallList();
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Global helper: Move hero from active roster to Guild Hall
 */
window.moveToStorage = function(heroId) {
    const heroIndex = currentUser.heroes.findIndex(h => h.id === heroId);
    if (heroIndex === -1) {
        alert('Hero not found in active roster!');
        return;
    }

    const hero = currentUser.heroes[heroIndex];

    // Check if hero has active activity
    if (hero.current_activity) {
        alert(`${hero.name} is currently doing an activity! Wait for them to finish first.`);
        return;
    }

    currentUser.heroes.splice(heroIndex, 1);
    currentUser.guildHall.push(hero);

    addLocalLog(`⬇️ ${hero.name} moved to Guild Hall storage!`, 'info');
    updateHeroesList(currentUser.heroes);
    updateGuildHallList();
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Global helper: Convert hero to Soul Essence
 */
window.convertToEssence = function(heroId) {
    const heroIndex = currentUser.guildHall.findIndex(h => h.id === heroId);
    if (heroIndex === -1) {
        alert('Hero not found in Guild Hall!');
        return;
    }

    const hero = currentUser.guildHall[heroIndex];

    // Calculate Soul Essence based on rarity
    const essenceValues = {
        common: 1,
        uncommon: 5,
        rare: 20,
        epic: 50,
        legendary: 100,
        mythical: 500
    };
    const essenceGain = essenceValues[hero.rarity] || 1;

    const confirm = window.confirm(
        `Convert ${hero.name} (${hero.rarity.toUpperCase()}) to Soul Essence?\n\n` +
        `You will receive: ${essenceGain} Soul Essence\n\n` +
        `This action cannot be undone!`
    );

    if (!confirm) return;

    currentUser.guildHall.splice(heroIndex, 1);
    currentUser.soulEssence += essenceGain;

    addLocalLog(`✨ Converted ${hero.name} to ${essenceGain} Soul Essence!`, 'success');
    updateGuildHallList();
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Helper: Get count of duplicates in Guild Hall
 */
function getDuplicateCount(heroName) {
    return currentUser.guildHall.filter(h => h.name === heroName).length;
}

/**
 * Global helper: Awaken hero using duplicates
 */
window.awakenHero = function(heroId) {
    const hero = currentUser.heroes.find(h => h.id === heroId);
    if (!hero) {
        alert('Hero not found!');
        return;
    }

    // Check if already max awakening
    if (hero.awakeningTier >= 4) {
        alert(`${hero.name} is already at max awakening tier!`);
        return;
    }

    // Find duplicates in Guild Hall
    const duplicates = currentUser.guildHall.filter(h => h.name === hero.name);

    // Determine duplicates needed based on current tier
    const duplicatesNeeded = hero.awakeningTier; // Tier 1→2 needs 1, Tier 2→3 needs 2, Tier 3→4 needs 3

    if (duplicates.length < duplicatesNeeded) {
        alert(`Need ${duplicatesNeeded} duplicate(s) of ${hero.name} to awaken to Tier ${hero.awakeningTier + 1}. You have ${duplicates.length}.`);
        return;
    }

    // Confirm awakening
    const confirm = window.confirm(
        `Awaken ${hero.name} to Tier ${hero.awakeningTier + 1}?\n\n` +
        `Cost: ${duplicatesNeeded} duplicate(s)\n` +
        `Bonus: +${20 * hero.awakeningTier}% to all stats\n` +
        (hero.awakeningTier === 2 ? 'Unlock: Perk Slot 3\n' : '') +
        (hero.awakeningTier === 3 ? 'Unlock: Perk Slot 4\n' : '')
    );

    if (!confirm) return;

    // Consume duplicates from Guild Hall
    for (let i = 0; i < duplicatesNeeded; i++) {
        const duplicateIndex = currentUser.guildHall.findIndex(h => h.name === hero.name);
        if (duplicateIndex !== -1) {
            currentUser.guildHall.splice(duplicateIndex, 1);
        }
    }

    // Increase awakening tier
    hero.awakeningTier++;

    // Unlock perk slots based on tier
    if (hero.awakeningTier === 3 && hero.perkSlotsUnlocked < 3) {
        hero.perkSlotsUnlocked = 3;
        addLocalLog(`🔓 ${hero.name} unlocked Perk Slot 3 through awakening!`, 'success');
    }
    if (hero.awakeningTier === 4 && hero.perkSlotsUnlocked < 4) {
        hero.perkSlotsUnlocked = 4;
        addLocalLog(`🔓 ${hero.name} unlocked Perk Slot 4 through awakening!`, 'success');
    }

    // Recalculate stats with awakening bonus
    applyAwakeningAndPerkEffects(hero);

    // Update statistics
    currentUser.statistics.heroesAwakened++;

    addLocalLog(
        `⭐ ${hero.name} awakened to Tier ${hero.awakeningTier}! All stats increased by ${20 * (hero.awakeningTier - 1)}%!`,
        'success'
    );

    updateHeroesList(currentUser.heroes);
    updateUIDisplays();
    saveLocalGameState();
};

/**
 * Calculate craft quality based on building level, skill, and personality
 */
function calculateCraftQuality(hero, buildingId, craftType) {
    const building = currentUser.buildings[buildingId];
    if (!building) return 'common';

    const buildingLevel = building.level;
    const skillLevel = craftType === 'alchemy'
        ? hero.skills.alchemy_level
        : hero.skills.crafting_level;

    // Base success chance from building (10% per level)
    const baseChance = buildingLevel * 10;

    // Skill bonus (5% per level)
    const skillBonus = skillLevel * 5;

    // Personality bonus
    let personalityBonus = 0;
    const personality = getPersonalityById(hero.personality);
    if (personality && personality.effects) {
        if (personality.effects.craft_quality_bonus) {
            personalityBonus = personality.effects.craft_quality_bonus * 100; // Convert to percentage
        }
    }

    const totalChance = baseChance + skillBonus + personalityBonus;
    const roll = Math.random() * 100;

    // Quality tiers based on total chance
    if (roll < Math.min(totalChance * 0.05, 10)) return 'legendary';   // Up to 10% at max
    if (roll < Math.min(totalChance * 0.15, 25)) return 'epic';        // Up to 25% at max
    if (roll < Math.min(totalChance * 0.35, 45)) return 'rare';        // Up to 45% at max
    if (roll < Math.min(totalChance * 0.60, 70)) return 'uncommon';    // Up to 70% at max
    return 'common';
}

/**
 * Generate crafted equipment
 */
function generateEquipment(hero, quality, craftType) {
    const rarityMultipliers = {
        common: 1.0,
        uncommon: 1.3,
        rare: 1.7,
        epic: 2.2,
        legendary: 3.0
    };
    const multiplier = rarityMultipliers[quality] || 1.0;

    // Determine equipment type
    let type, name, emoji, statBonuses;

    if (craftType === 'accessory') {
        const accessories = ['Ring', 'Amulet', 'Talisman', 'Charm'];
        const accessoryType = getRandomElement(accessories);
        type = 'accessory';
        name = `${quality.charAt(0).toUpperCase() + quality.slice(1)} ${accessoryType}`;
        emoji = accessoryType === 'Ring' ? '💍' : accessoryType === 'Amulet' ? '📿' : '🔮';

        // Accessories give mixed stats
        statBonuses = {
            luck: Math.floor((5 + Math.random() * 5) * multiplier),
            wisdom: Math.floor((3 + Math.random() * 4) * multiplier)
        };
    } else {
        // Weapons and armor
        const isWeapon = Math.random() < 0.5;
        if (isWeapon) {
            const weapons = ['Sword', 'Axe', 'Spear', 'Dagger', 'Bow'];
            type = 'weapon';
            name = `${quality.charAt(0).toUpperCase() + quality.slice(1)} ${getRandomElement(weapons)}`;
            emoji = '⚔️';
            statBonuses = {
                strength: Math.floor((8 + Math.random() * 7) * multiplier),
                agility: Math.floor((4 + Math.random() * 4) * multiplier)
            };
        } else {
            const armors = ['Helm', 'Chestplate', 'Gauntlets', 'Boots', 'Shield'];
            type = 'armor';
            name = `${quality.charAt(0).toUpperCase() + quality.slice(1)} ${getRandomElement(armors)}`;
            emoji = '🛡️';
            statBonuses = {
                defense: Math.floor((8 + Math.random() * 7) * multiplier),
                health: Math.floor((15 + Math.random() * 10) * multiplier)
            };
        }
    }

    return {
        id: generateId(),
        type: type,
        name: name,
        quality: quality,
        emoji: emoji,
        stats: statBonuses,
        craftedBy: hero.id,
        craftedAt: Date.now()
    };
}

/**
 * Generate crafted potion
 */
function generatePotion(hero, quality) {
    const rarityMultipliers = {
        common: 1.0,
        uncommon: 1.5,
        rare: 2.0,
        epic: 3.0,
        legendary: 5.0
    };
    const multiplier = rarityMultipliers[quality] || 1.0;

    const potionTypes = [
        { id: 'health', name: 'Health Potion', emoji: '❤️', effect: 'heal' },
        { id: 'mana', name: 'Mana Potion', emoji: '💙', effect: 'restore_mana' },
        { id: 'strength', name: 'Strength Elixir', emoji: '💪', effect: 'boost_strength' },
        { id: 'experience', name: 'Experience Tonic', emoji: '✨', effect: 'bonus_exp' }
    ];

    const potionType = getRandomElement(potionTypes);
    const effectValue = Math.floor((20 + Math.random() * 30) * multiplier);

    return {
        id: generateId(),
        type: 'potion',
        potionType: potionType.id,
        name: `${quality.charAt(0).toUpperCase() + quality.slice(1)} ${potionType.name}`,
        quality: quality,
        emoji: potionType.emoji,
        effect: { [potionType.effect]: effectValue },
        quantity: 1,
        craftedBy: hero.id,
        craftedAt: Date.now()
    };
}

/**
 * Award skill exp and check for level-up
 */
function awardSkillExp(hero, skillType, amount) {
    if (!hero.skills) {
        hero.skills = {
            crafting_level: 1,
            crafting_exp: 0,
            alchemy_level: 1,
            alchemy_exp: 0
        };
    }

    const levelKey = `${skillType}_level`;
    const expKey = `${skillType}_exp`;

    hero.skills[expKey] += amount;

    // Check for level up (100 exp per level, increases by 50 each level)
    const expNeeded = 100 + (hero.skills[levelKey] - 1) * 50;

    if (hero.skills[expKey] >= expNeeded) {
        hero.skills[expKey] -= expNeeded;
        hero.skills[levelKey]++;

        const skillName = skillType === 'alchemy' ? 'Alchemy' : 'Crafting';
        addLocalLog(
            `⭐ ${hero.name}'s ${skillName} skill increased to Level ${hero.skills[levelKey]}!`,
            'success'
        );
    }
}

/**
 * Get building data by ID
 */
function getBuildingById(buildingId) {
    if (!window.gameData || !window.gameData.buildings) return null;
    return window.gameData.buildings.buildings.find(b => b.id === buildingId);
}

/**
 * Update buildings display
 */
function updateBuildingsDisplay() {
    const buildingsList = document.getElementById('buildings-list');
    if (!buildingsList || !window.gameData || !window.gameData.buildings) return;

    buildingsList.innerHTML = window.gameData.buildings.buildings.map(building => {
        const currentLevel = currentUser.buildings[building.id]?.level || 1;
        const isMaxLevel = currentLevel >= building.maxLevel;
        const nextLevel = currentLevel + 1;
        const upgradeCost = building.upgradeCosts[nextLevel] || {};

        // Check if can afford upgrade
        let canAfford = true;
        let costHTML = '';
        if (!isMaxLevel) {
            const costs = Object.entries(upgradeCost).map(([mat, amount]) => {
                const material = getMaterialById(mat);
                const owned = currentUser.materials[mat] || 0;
                const hasEnough = owned >= amount;
                if (!hasEnough) canAfford = false;

                const colorClass = hasEnough ? 'cost-ok' : 'cost-needed';
                return `<span class="${colorClass}">${material?.emoji || '📦'} ${amount} (${owned})</span>`;
            }).join(', ');
            costHTML = costs || 'Max Level';
        }

        return `
            <div class="building-card">
                <div class="building-header">
                    <h3>${building.emoji} ${building.name}</h3>
                    <span class="building-level">Level ${currentLevel}/${building.maxLevel}</span>
                </div>
                <p class="building-desc">${building.description}</p>

                <div class="building-benefits">
                    <strong>Current Benefits:</strong>
                    <p class="benefit-text">✨ ${building.benefits[currentLevel - 1]}</p>
                    ${!isMaxLevel ? `
                        <strong style="margin-top: 0.5rem; display: block;">Next Level:</strong>
                        <p class="benefit-text benefit-next">🌟 ${building.benefits[currentLevel]}</p>
                    ` : '<p class="benefit-text" style="color: var(--accent-gold);">⭐ MAX LEVEL REACHED!</p>'}
                </div>

                ${!isMaxLevel ? `
                    <div class="building-cost">
                        <strong>Upgrade Cost:</strong>
                        <div class="cost-list">${costHTML}</div>
                    </div>
                    <button class="btn btn-upgrade"
                            onclick="window.upgradeBuilding('${building.id}')"
                            ${!canAfford ? 'disabled' : ''}>
                        ⬆️ Upgrade to Level ${nextLevel}
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Global helper: Upgrade building
 */
window.upgradeBuilding = function(buildingId) {
    const buildingData = getBuildingById(buildingId);
    if (!buildingData) {
        alert('Building not found!');
        return;
    }

    const currentLevel = currentUser.buildings[buildingId]?.level || 1;

    if (currentLevel >= buildingData.maxLevel) {
        alert(`${buildingData.name} is already at max level!`);
        return;
    }

    const nextLevel = currentLevel + 1;
    const upgradeCost = buildingData.upgradeCosts[nextLevel];

    // Check if can afford
    for (const [materialId, amount] of Object.entries(upgradeCost)) {
        const owned = currentUser.materials[materialId] || 0;
        if (owned < amount) {
            const material = getMaterialById(materialId);
            alert(`Not enough ${material?.name || materialId}! Need ${amount}, have ${owned}.`);
            return;
        }
    }

    // Confirm upgrade
    const costText = Object.entries(upgradeCost).map(([mat, amount]) => {
        const material = getMaterialById(mat);
        return `${material?.emoji || '📦'} ${material?.name || mat} x${amount}`;
    }).join(', ');

    const confirm = window.confirm(
        `Upgrade ${buildingData.emoji} ${buildingData.name} to Level ${nextLevel}?\n\n` +
        `Cost: ${costText}\n\n` +
        `Benefit: ${buildingData.benefits[nextLevel - 1]}`
    );

    if (!confirm) return;

    // Deduct materials
    for (const [materialId, amount] of Object.entries(upgradeCost)) {
        currentUser.materials[materialId] -= amount;
        if (currentUser.materials[materialId] <= 0) {
            delete currentUser.materials[materialId];
        }
    }

    // Upgrade building
    currentUser.buildings[buildingId].level = nextLevel;

    addLocalLog(
        `🏗️ Upgraded ${buildingData.emoji} ${buildingData.name} to Level ${nextLevel}!`,
        'success'
    );

    // Update displays
    updateBuildingsDisplay();
    updateMaterialsDisplay();
    saveLocalGameState();
};

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
