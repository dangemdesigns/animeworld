/**
 * Game Engine - Handles automatic hero activities
 */
import { HeroModel } from '../models/Hero.js';
import { UserModel } from '../models/User.js';
import { ActivityLogModel } from '../models/ActivityLog.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load game data
let gameData = {};
try {
    const dataPath = path.join(__dirname, '../../src/data');
    gameData.activities = JSON.parse(fs.readFileSync(path.join(dataPath, 'activities.json'), 'utf8'));
} catch (error) {
    console.error('Failed to load game data:', error);
}

export class GameEngine {
    constructor(io) {
        this.io = io;
        this.tickInterval = null;
        this.tickRate = 1000; // 1 second
    }

    /**
     * Start the game engine
     */
    start() {
        console.log('🎮 Starting game engine...');

        this.tickInterval = setInterval(() => {
            this.tick();
        }, this.tickRate);

        console.log('✅ Game engine started');
    }

    /**
     * Stop the game engine
     */
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            console.log('⏸️ Game engine stopped');
        }
    }

    /**
     * Main game tick - runs every second
     */
    tick() {
        try {
            // Process all active heroes
            const heroes = HeroModel.getAllActiveHeroes();

            heroes.forEach(hero => {
                this.processHero(hero);
            });
        } catch (error) {
            console.error('Game tick error:', error);
        }
    }

    /**
     * Process individual hero
     */
    processHero(hero) {
        const now = Date.now();

        // If hero has no activity, start one
        if (!hero.current_activity || !hero.activity_start_time) {
            this.startHeroActivity(hero);
            return;
        }

        // Check if activity is complete
        const activity = gameData.activities.activities.find(a => a.id === hero.current_activity);
        if (!activity) return;

        const elapsed = now - hero.activity_start_time;
        if (elapsed >= activity.duration) {
            this.completeHeroActivity(hero, activity);
        }
    }

    /**
     * Start a hero activity
     */
    startHeroActivity(hero) {
        // Choose random activity
        const activities = gameData.activities.activities;
        const activity = activities[Math.floor(Math.random() * activities.length)];

        HeroModel.updateActivity(hero.id, activity.id, Date.now());

        // Log activity start
        ActivityLogModel.add(
            'activity_start',
            `${activity.emoji} ${hero.username}'s hero ${hero.name} started ${activity.name}`,
            hero.user_id,
            hero.id,
            { activity: activity.id }
        );

        // Broadcast to all clients
        this.io.emit('hero_activity_start', {
            heroId: hero.id,
            heroName: hero.name,
            username: hero.username,
            activity: activity.name,
            emoji: activity.emoji
        });
    }

    /**
     * Complete a hero activity
     */
    completeHeroActivity(hero, activity) {
        // Complete activity and add exp
        const result = HeroModel.completeActivity(hero.id, activity.expReward);

        // Add gold to user
        UserModel.updateGold(hero.user_id, activity.goldReward);

        // Create log message
        let message = `✅ ${hero.username}'s hero ${hero.name} completed ${activity.name}! +${activity.goldReward} gold, +${activity.expReward} exp`;

        if (result.leveledUp) {
            message += ` 🎉 Level up! Now level ${result.newLevel}!`;
        }

        // Log completion
        ActivityLogModel.add(
            result.leveledUp ? 'level_up' : 'activity_complete',
            message,
            hero.user_id,
            hero.id,
            {
                activity: activity.id,
                goldReward: activity.goldReward,
                expReward: activity.expReward,
                leveledUp: result.leveledUp,
                newLevel: result.newLevel
            }
        );

        // Broadcast to all clients
        this.io.emit('hero_activity_complete', {
            heroId: hero.id,
            heroName: hero.name,
            username: hero.username,
            activity: activity.name,
            goldReward: activity.goldReward,
            expReward: activity.expReward,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel
        });

        // Broadcast updated user data to the specific user
        const userData = UserModel.getUserWithHeroes(hero.user_id);
        this.io.to(`user_${hero.user_id}`).emit('user_data_update', userData);

        // Start next activity after a short delay
        setTimeout(() => {
            const updatedHero = HeroModel.findById(hero.id);
            if (updatedHero) {
                this.startHeroActivity({ ...updatedHero, username: hero.username });
            }
        }, 2000);
    }
}
