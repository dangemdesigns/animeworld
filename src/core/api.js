/**
 * API Client - Handles all backend communication
 */

const API_URL = 'http://localhost:8080/api';

export class APIClient {
    constructor() {
        this.token = localStorage.getItem('auth_token');
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

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
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
