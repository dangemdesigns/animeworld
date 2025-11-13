/**
 * Game Controller - Hero management and activities
 */
import { UserModel } from '../models/User.js';
import { HeroModel } from '../models/Hero.js';
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
    gameData.classes = JSON.parse(fs.readFileSync(path.join(dataPath, 'classes.json'), 'utf8'));
    gameData.heroNames = JSON.parse(fs.readFileSync(path.join(dataPath, 'heroNames.json'), 'utf8'));
    gameData.activities = JSON.parse(fs.readFileSync(path.join(dataPath, 'activities.json'), 'utf8'));
} catch (error) {
    console.error('Failed to load game data:', error);
}

export const gameController = {
    /**
     * Summon a new hero
     */
    summonHero(req, res) {
        try {
            const userId = req.user.userId;
            const SUMMON_COST = 50;

            // Get user
            const user = UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check gold
            if (user.gold < SUMMON_COST) {
                return res.status(400).json({ error: 'Not enough gold' });
            }

            // Deduct gold
            UserModel.updateGold(userId, -SUMMON_COST);

            // Generate hero
            const firstName = gameData.heroNames.firstNames[Math.floor(Math.random() * gameData.heroNames.firstNames.length)];
            const lastName = gameData.heroNames.lastNames[Math.floor(Math.random() * gameData.heroNames.lastNames.length)];
            const heroClass = gameData.classes.classes[Math.floor(Math.random() * gameData.classes.classes.length)];

            const stats = {
                strength: 10 + (heroClass.bonuses.strength || 0),
                defense: 10 + (heroClass.bonuses.defense || 0),
                health: 50 + (heroClass.bonuses.health || 0),
                maxHealth: 50 + (heroClass.bonuses.health || 0),
                intelligence: 10 + (heroClass.bonuses.intelligence || 0),
                agility: 10 + (heroClass.bonuses.agility || 0),
                wisdom: 10 + (heroClass.bonuses.wisdom || 0),
                luck: 10 + (heroClass.bonuses.luck || 0),
                classEmoji: heroClass.emoji
            };

            const heroName = `${firstName} ${lastName}`;
            const heroId = HeroModel.create(userId, heroName, heroClass.id, heroClass.emoji, stats);

            // Log to global feed
            ActivityLogModel.add(
                'hero_summon',
                `✨ ${user.username} summoned ${heroClass.emoji} ${heroName} the ${heroClass.name}!`,
                userId,
                heroId
            );

            // Get the created hero
            const hero = HeroModel.findById(heroId);

            res.json({
                success: true,
                hero,
                newGold: user.gold - SUMMON_COST
            });
        } catch (error) {
            console.error('Summon hero error:', error);
            res.status(500).json({ error: 'Failed to summon hero' });
        }
    },

    /**
     * Get user's heroes
     */
    getHeroes(req, res) {
        try {
            const userId = req.user.userId;
            const heroes = HeroModel.findByUser(userId);

            res.json({
                success: true,
                heroes
            });
        } catch (error) {
            console.error('Get heroes error:', error);
            res.status(500).json({ error: 'Failed to get heroes' });
        }
    },

    /**
     * Get global activity feed
     */
    getGlobalFeed(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const activities = ActivityLogModel.getRecent(limit);

            res.json({
                success: true,
                activities
            });
        } catch (error) {
            console.error('Get feed error:', error);
            res.status(500).json({ error: 'Failed to get activity feed' });
        }
    },

    /**
     * Get user activity feed
     */
    getUserFeed(req, res) {
        try {
            const userId = req.user.userId;
            const limit = parseInt(req.query.limit) || 50;
            const activities = ActivityLogModel.getByUser(userId, limit);

            res.json({
                success: true,
                activities
            });
        } catch (error) {
            console.error('Get user feed error:', error);
            res.status(500).json({ error: 'Failed to get activity feed' });
        }
    },

    /**
     * Get leaderboard
     */
    getLeaderboard(req, res) {
        try {
            const type = req.query.type || 'level';
            const limit = parseInt(req.query.limit) || 10;

            const leaderboard = HeroModel.getLeaderboard(type, limit);

            res.json({
                success: true,
                leaderboard
            });
        } catch (error) {
            console.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard' });
        }
    },

    /**
     * Get game stats
     */
    getStats(req, res) {
        try {
            const activityStats = ActivityLogModel.getStats();
            const onlineUsers = UserModel.getOnlineUsers();

            res.json({
                success: true,
                stats: {
                    onlineUsers: onlineUsers.length,
                    totalActivities: activityStats.total,
                    recentActivities: activityStats.lastHour
                }
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({ error: 'Failed to get stats' });
        }
    }
};
