/**
 * Activity Log Model - Global activity tracking
 */
import db from '../config/database.js';

export const ActivityLogModel = {
    /**
     * Add activity log entry
     */
    add(type, message, userId = null, heroId = null, data = null) {
        const stmt = db.prepare(`
            INSERT INTO activity_log (timestamp, type, message, user_id, hero_id, data)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            Date.now(),
            type,
            message,
            userId,
            heroId,
            data ? JSON.stringify(data) : null
        );
    },

    /**
     * Get recent global activities
     */
    getRecent(limit = 50) {
        const stmt = db.prepare(`
            SELECT a.*, u.username, h.name as hero_name
            FROM activity_log a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN heroes h ON a.hero_id = h.id
            ORDER BY a.timestamp DESC
            LIMIT ?
        `);

        const logs = stmt.all(limit);
        return logs.map(log => ({
            ...log,
            data: log.data ? JSON.parse(log.data) : null
        }));
    },

    /**
     * Get activities for specific user
     */
    getByUser(userId, limit = 50) {
        const stmt = db.prepare(`
            SELECT a.*, h.name as hero_name
            FROM activity_log a
            LEFT JOIN heroes h ON a.hero_id = h.id
            WHERE a.user_id = ?
            ORDER BY a.timestamp DESC
            LIMIT ?
        `);

        const logs = stmt.all(userId, limit);
        return logs.map(log => ({
            ...log,
            data: log.data ? JSON.parse(log.data) : null
        }));
    },

    /**
     * Get statistics
     */
    getStats() {
        const totalActivities = db.prepare('SELECT COUNT(*) as count FROM activity_log').get();
        const recentHour = db.prepare(
            'SELECT COUNT(*) as count FROM activity_log WHERE timestamp > ?'
        ).get(Date.now() - 3600000);

        return {
            total: totalActivities.count,
            lastHour: recentHour.count
        };
    }
};
