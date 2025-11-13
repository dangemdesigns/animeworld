/**
 * Hero Model - Database operations for heroes
 */
import db from '../config/database.js';

export const HeroModel = {
    /**
     * Create a new hero
     */
    create(userId, name, heroClass, classEmoji, stats) {
        const now = Date.now();
        const stmt = db.prepare(`
            INSERT INTO heroes (
                user_id, name, class, stats, created_at
            ) VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            userId,
            name,
            heroClass,
            JSON.stringify({ ...stats, classEmoji }),
            now
        );

        return result.lastInsertRowid;
    },

    /**
     * Get hero by ID
     */
    findById(heroId) {
        const stmt = db.prepare('SELECT * FROM heroes WHERE id = ?');
        const hero = stmt.get(heroId);
        if (hero) {
            hero.stats = JSON.parse(hero.stats);
        }
        return hero;
    },

    /**
     * Get all heroes for a user
     */
    findByUser(userId) {
        const stmt = db.prepare('SELECT * FROM heroes WHERE user_id = ? AND is_active = 1');
        const heroes = stmt.all(userId);
        return heroes.map(h => ({
            ...h,
            stats: JSON.parse(h.stats)
        }));
    },

    /**
     * Update hero activity
     */
    updateActivity(heroId, activity, startTime) {
        const stmt = db.prepare(`
            UPDATE heroes
            SET current_activity = ?, activity_start_time = ?
            WHERE id = ?
        `);
        stmt.run(activity, startTime, heroId);
    },

    /**
     * Complete hero activity
     */
    completeActivity(heroId, expGained) {
        const stmt = db.prepare(`
            UPDATE heroes
            SET exp = exp + ?,
                total_activities_completed = total_activities_completed + 1,
                current_activity = NULL,
                activity_start_time = NULL
            WHERE id = ?
        `);
        stmt.run(expGained, heroId);

        // Check for level up
        const hero = this.findById(heroId);
        return this.checkLevelUp(hero);
    },

    /**
     * Check and process level up
     */
    checkLevelUp(hero) {
        let levelsGained = 0;
        let currentExp = hero.exp;
        let currentLevel = hero.level;
        let expToNext = hero.exp_to_next;

        while (currentExp >= expToNext) {
            currentExp -= expToNext;
            currentLevel++;
            expToNext = Math.floor(expToNext * 1.5);
            levelsGained++;

            // Increase stats
            const stats = hero.stats;
            stats.strength += 2;
            stats.defense += 2;
            stats.maxHealth += 10;
            stats.health = stats.maxHealth;
            stats.intelligence += 1;
            stats.agility += 1;

            // Update hero in database
            const stmt = db.prepare(`
                UPDATE heroes
                SET level = ?,
                    exp = ?,
                    exp_to_next = ?,
                    stats = ?
                WHERE id = ?
            `);
            stmt.run(currentLevel, currentExp, expToNext, JSON.stringify(stats), hero.id);
        }

        if (levelsGained > 0) {
            return {
                leveledUp: true,
                newLevel: currentLevel,
                levelsGained
            };
        }

        return { leveledUp: false };
    },

    /**
     * Get all active heroes (for global activity)
     */
    getAllActiveHeroes() {
        const stmt = db.prepare(`
            SELECT h.*, u.username
            FROM heroes h
            JOIN users u ON h.user_id = u.id
            WHERE h.is_active = 1
            ORDER BY h.level DESC
            LIMIT 100
        `);
        const heroes = stmt.all();
        return heroes.map(h => ({
            ...h,
            stats: JSON.parse(h.stats)
        }));
    },

    /**
     * Get leaderboard
     */
    getLeaderboard(type = 'level', limit = 10) {
        let orderBy = 'level DESC';
        if (type === 'activities') {
            orderBy = 'total_activities_completed DESC';
        }

        const stmt = db.prepare(`
            SELECT h.*, u.username
            FROM heroes h
            JOIN users u ON h.user_id = u.id
            WHERE h.is_active = 1
            ORDER BY ${orderBy}
            LIMIT ?
        `);
        const heroes = stmt.all(limit);
        return heroes.map(h => ({
            ...h,
            stats: JSON.parse(h.stats)
        }));
    }
};
