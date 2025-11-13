/**
 * API Client - Handles all backend communication
 */

import { API_CONFIG } from './config.js';

const API_URL = API_CONFIG.API_URL;

export class APIClient {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.baseURL = API_URL;
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    /**
     * Clear authentication token
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            // Better error messages for common issues
            if (error.message === 'Failed to fetch') {
                if (API_CONFIG.isGitHubPages && !API_CONFIG.isConfigured) {
                    throw new Error('Backend not configured. See console for instructions.');
                } else {
                    throw new Error('Cannot connect to server. Make sure the backend is running.');
                }
            }
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(username, email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    }

    /**
     * Login user
     */
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    /**
     * Get current user
     */
    async getMe() {
        return this.request('/auth/me');
    }

    /**
     * Summon a hero
     */
    async summonHero() {
        return this.request('/game/heroes/summon', {
            method: 'POST'
        });
    }

    /**
     * Get user's heroes
     */
    async getHeroes() {
        return this.request('/game/heroes');
    }

    /**
     * Get global activity feed
     */
    async getGlobalFeed(limit = 50) {
        return this.request(`/game/feed/global?limit=${limit}`);
    }

    /**
     * Get user activity feed
     */
    async getUserFeed(limit = 50) {
        return this.request(`/game/feed/user?limit=${limit}`);
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard(type = 'level', limit = 10) {
        return this.request(`/game/leaderboard?type=${type}&limit=${limit}`);
    }

    /**
     * Get game stats
     */
    async getStats() {
        return this.request('/game/stats');
    }
}

export const api = new APIClient();
