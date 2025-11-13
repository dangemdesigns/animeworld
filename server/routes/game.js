/**
 * Game Routes
 */
import express from 'express';
import { gameController } from '../controllers/gameController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All game routes require authentication
router.use(verifyToken);

// Hero management
router.post('/heroes/summon', gameController.summonHero);
router.get('/heroes', gameController.getHeroes);

// Activity feeds
router.get('/feed/global', gameController.getGlobalFeed);
router.get('/feed/user', gameController.getUserFeed);

// Leaderboard
router.get('/leaderboard', gameController.getLeaderboard);

// Stats
router.get('/stats', gameController.getStats);

export default router;
