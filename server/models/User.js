/**
 * User Model - Database operations for users
 */
import db from '../config/database.js';
import bcrypt from 'bcryptjs';

export const UserModel = {
    /**
     * Create a new user
     */
    create(username, email, password) {
        const passwordHash = bcrypt.hashSync(password, 10);
        const now = Date.now();

        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, last_login, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(username, email, passwordHash, now, now);
        return result.lastInsertRowid;
    },

    /**
     * Find user by email
     */
    findByEmail(email) {
        const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
        return stmt.get(email);
    },

    /**
     * Find user by username
     */
    findByUsername(username) {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    },

    /**
     * Find user by ID
     */
    findById(id) {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    },

    /**
     * Verify password
     */
    verifyPassword(password, hash) {
        return bcrypt.compareSync(password, hash);
    },

    /**
     * Update last login time
     */
    updateLastLogin(userId) {
        const stmt = db.prepare('UPDATE users SET last_login = ?, is_online = 1 WHERE id = ?');
        stmt.run(Date.now(), userId);
    },

    /**
     * Set user online status
     */
    setOnlineStatus(userId, isOnline) {
        const stmt = db.prepare('UPDATE users SET is_online = ? WHERE id = ?');
        stmt.run(isOnline ? 1 : 0, userId);
    },

    /**
     * Update user gold
     */
    updateGold(userId, amount) {
        const stmt = db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?');
        stmt.run(amount, userId);
    },

    /**
     * Get user with heroes
     */
    getUserWithHeroes(userId) {
        const user = this.findById(userId);
        if (!user) return null;

        const heroes = db.prepare('SELECT * FROM heroes WHERE user_id = ? AND is_active = 1').all(userId);

        return {
            ...user,
            heroes: heroes.map(h => ({
                ...h,
                stats: JSON.parse(h.stats)
            }))
        };
    },

    /**
     * Get all online users
     */
    getOnlineUsers() {
        const stmt = db.prepare('SELECT id, username, account_level, is_online FROM users WHERE is_online = 1');
        return stmt.all();
    },

    /**
     * Calculate offline progress
     */
    calculateOfflineProgress(userId, lastLogin) {
        const now = Date.now();
        const offlineTime = now - lastLogin;
        const offlineHours = offlineTime / (1000 * 60 * 60);

        // Cap offline progress at 12 hours to prevent abuse
        const cappedHours = Math.min(offlineHours, 12);

        // Calculate gold earned (10 gold per hour)
        const goldEarned = Math.floor(cappedHours * 10);

        return {
            timeAway: offlineTime,
            hoursAway: offlineHours,
            cappedHours,
            goldEarned
        };
    }
};
