/**
 * Main Server File - Echoes of the Lantern MMORPG
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database and initialize
import db, { initializeDatabase, cleanOldLogs } from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

// Import models
import { UserModel } from './models/User.js';

// Import game engine
import { GameEngine } from './utils/gameEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve frontend
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', (userId) => {
        socket.join(`user_${userId}`);
        UserModel.setOnlineStatus(userId, true);
        console.log(`✅ User ${userId} authenticated and joined room`);

        // Broadcast user count update
        io.emit('online_users_update', {
            count: UserModel.getOnlineUsers().length
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);

        // Note: We can't reliably track which user disconnected here
        // In a production app, you'd want to track socket-to-user mapping
    });

    // Handle client requesting global feed
    socket.on('request_global_feed', () => {
        import('./models/ActivityLog.js').then(({ ActivityLogModel }) => {
            const activities = ActivityLogModel.getRecent(50);
            socket.emit('global_feed_update', activities);
        });
    });
});

// Initialize game engine
const gameEngine = new GameEngine(io);
gameEngine.start();

// Periodic cleanup (every hour)
setInterval(() => {
    cleanOldLogs();
}, 3600000);

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log('');
    console.log('🏮 ====================================');
    console.log('   Echoes of the Lantern - Server');
    console.log('🏮 ====================================');
    console.log('');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🎮 Game engine: Active`);
    console.log(`🗄️ Database: SQLite (local)`);
    console.log('');
    console.log('✅ Server is ready!');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    gameEngine.stop();
    db.close();
    server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
    });
});
