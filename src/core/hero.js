/**
 * hero.js - Hero Management
 * Simple hero creation and management
 */

import { gameState, generateId, addLog, addGold } from './gameState.js';

/**
 * Create a new hero
 */
export function createHero() {
    // Get random name
    const firstName = getRandomElement(gameState.data.heroNames.firstNames);
    const lastName = getRandomElement(gameState.data.heroNames.lastNames);

    // Get random class
    const heroClass = getRandomElement(gameState.data.classes.classes);

    // Create hero object
    const hero = {
        id: generateId(),
        name: `${firstName} ${lastName}`,
        class: heroClass.id,
        classEmoji: heroClass.emoji,
        level: 1,
        exp: 0,
        expToNext: 100,

        // Base stats (with class bonuses)
        stats: {
            strength: 10 + (heroClass.bonuses.strength || 0),
            defense: 10 + (heroClass.bonuses.defense || 0),
            health: 50 + (heroClass.bonuses.health || 0),
            maxHealth: 50 + (heroClass.bonuses.health || 0),
            intelligence: 10 + (heroClass.bonuses.intelligence || 0),
            agility: 10 + (heroClass.bonuses.agility || 0),
            wisdom: 10 + (heroClass.bonuses.wisdom || 0),
            luck: 10 + (heroClass.bonuses.luck || 0)
        },

        // Current activity
        activity: null,
        activityStartTime: null
    };

    return hero;
}

/**
 * Add hero to game state
 */
export function addHero(hero) {
    gameState.heroes.push(hero);
    addLog(`${hero.classEmoji} ${hero.name} the ${getClassName(hero.class)} has arrived!`, 'success');
}

/**
 * Start hero activity
 */
export function startHeroActivity(hero) {
    // Don't start if already active
    if (hero.activity) return;

    // Get random activity
    const activity = getRandomElement(gameState.data.activities.activities);

    hero.activity = activity.id;
    hero.activityStartTime = Date.now();

    addLog(`${hero.name} started ${activity.name} ${activity.emoji}`);
}

/**
 * Complete hero activity
 */
export function completeHeroActivity(hero) {
    if (!hero.activity) return;

    const activity = gameState.data.activities.activities.find(a => a.id === hero.activity);
    if (!activity) {
        hero.activity = null;
        hero.activityStartTime = null;
        return;
    }

    // Award gold and exp
    addGold(activity.goldReward);
    addExpToHero(hero, activity.expReward);

    addLog(`${hero.name} completed ${activity.name}! +${activity.goldReward} gold, +${activity.expReward} exp`, 'success');

    // Reset activity
    hero.activity = null;
    hero.activityStartTime = null;
}

/**
 * Add experience to hero
 */
export function addExpToHero(hero, amount) {
    hero.exp += amount;

    // Check for level up
    while (hero.exp >= hero.expToNext) {
        hero.exp -= hero.expToNext;
        hero.level++;
        hero.expToNext = Math.floor(hero.expToNext * 1.5);

        // Increase stats on level up
        hero.stats.strength += 2;
        hero.stats.defense += 2;
        hero.stats.maxHealth += 10;
        hero.stats.health = hero.stats.maxHealth;
        hero.stats.intelligence += 1;
        hero.stats.agility += 1;

        addLog(`🎉 ${hero.name} reached level ${hero.level}!`, 'success');
    }
}

/**
 * Get class name from ID
 */
export function getClassName(classId) {
    const heroClass = gameState.data.classes.classes.find(c => c.id === classId);
    return heroClass ? heroClass.name : 'Unknown';
}

/**
 * Get random element from array
 */
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}
