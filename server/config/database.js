/**
 * Database Configuration - SQLite for local development
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create database connection
const db = new Database(join(__dirname, '../echoes-of-lantern.db'), {
    verbose: console.log
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database tables
 */
export function initializeDatabase() {
    console.log('🗄️ Initializing database...');

    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            gold INTEGER DEFAULT 100,
            day INTEGER DEFAULT 1,
            account_level INTEGER DEFAULT 1,
            account_exp INTEGER DEFAULT 0,
            last_login INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            is_online INTEGER DEFAULT 0
        )
    `);

    // Heroes table
    db.exec(`
        CREATE TABLE IF NOT EXISTS heroes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            exp INTEGER DEFAULT 0,
            exp_to_next INTEGER DEFAULT 100,
            stats TEXT NOT NULL,
            current_activity TEXT,
            activity_start_time INTEGER,
            total_activities_completed INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Global activity log
    db.exec(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            user_id INTEGER,
            hero_id INTEGER,
            data TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (hero_id) REFERENCES heroes(id) ON DELETE CASCADE
        )
    `);

    // Create index for faster queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_heroes_user ON heroes(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online)`);

    // Global boss events
    db.exec(`
        CREATE TABLE IF NOT EXISTS global_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            boss_name TEXT,
            boss_health INTEGER,
            boss_max_health INTEGER,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT DEFAULT 'active',
            participants_count INTEGER DEFAULT 0,
            rewards TEXT,
            created_at INTEGER NOT NULL
        )
    `);

    // Event participants
    db.exec(`
        CREATE TABLE IF NOT EXISTS event_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            hero_id INTEGER NOT NULL,
            damage_dealt INTEGER DEFAULT 0,
            joined_at INTEGER NOT NULL,
            FOREIGN KEY (event_id) REFERENCES global_events(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (hero_id) REFERENCES heroes(id) ON DELETE CASCADE,
            UNIQUE(event_id, hero_id)
        )
    `);

    console.log('✅ Database initialized successfully');
}

/**
 * Clean old activity logs (keep last 1000 entries)
 */
export function cleanOldLogs() {
    const result = db.prepare(`
        DELETE FROM activity_log
        WHERE id NOT IN (
            SELECT id FROM activity_log
            ORDER BY timestamp DESC
            LIMIT 1000
        )
    `).run();

    if (result.changes > 0) {
        console.log(`🧹 Cleaned ${result.changes} old activity logs`);
    }
}

export default db;
