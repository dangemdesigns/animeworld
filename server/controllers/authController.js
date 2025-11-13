/**
 * Authentication Controller
 */
import { UserModel } from '../models/User.js';
import { ActivityLogModel } from '../models/ActivityLog.js';
import { generateToken } from '../middleware/auth.js';

export const authController = {
    /**
     * Register new user
     */
    register(req, res) {
        try {
            const { username, email, password } = req.body;

            // Validation
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            // Check if user already exists
            if (UserModel.findByEmail(email)) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            if (UserModel.findByUsername(username)) {
                return res.status(400).json({ error: 'Username already taken' });
            }

            // Create user
            const userId = UserModel.create(username, email, password);
            const token = generateToken(userId, username);

            // Log registration
            ActivityLogModel.add(
                'user_join',
                `🎉 ${username} has joined the haven!`,
                userId
            );

            res.json({
                success: true,
                token,
                user: {
                    id: userId,
                    username,
                    email
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    },

    /**
     * Login user
     */
    login(req, res) {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' });
            }

            // Find user
            const user = UserModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Verify password
            if (!UserModel.verifyPassword(password, user.password_hash)) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Calculate offline progress
            const offlineProgress = UserModel.calculateOfflineProgress(user.id, user.last_login);

            // Update gold if offline progress
            if (offlineProgress.goldEarned > 0) {
                UserModel.updateGold(user.id, offlineProgress.goldEarned);
            }

            // Update last login
            UserModel.updateLastLogin(user.id);

            // Generate token
            const token = generateToken(user.id, user.username);

            // Get updated user data
            const userData = UserModel.getUserWithHeroes(user.id);

            res.json({
                success: true,
                token,
                user: {
                    id: userData.id,
                    username: userData.username,
                    email: userData.email,
                    gold: userData.gold + offlineProgress.goldEarned,
                    day: userData.day,
                    account_level: userData.account_level,
                    heroes: userData.heroes
                },
                offlineProgress: offlineProgress.goldEarned > 0 ? {
                    hoursAway: Math.floor(offlineProgress.cappedHours * 10) / 10,
                    goldEarned: offlineProgress.goldEarned
                } : null
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    },

    /**
     * Get current user info
     */
    me(req, res) {
        try {
            const userData = UserModel.getUserWithHeroes(req.user.userId);

            if (!userData) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                success: true,
                user: {
                    id: userData.id,
                    username: userData.username,
                    email: userData.email,
                    gold: userData.gold,
                    day: userData.day,
                    account_level: userData.account_level,
                    heroes: userData.heroes
                }
            });
        } catch (error) {
            console.error('Me error:', error);
            res.status(500).json({ error: 'Failed to get user data' });
        }
    }
};
