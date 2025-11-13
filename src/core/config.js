/**
 * API Configuration
 * Change these settings based on your deployment
 */

// Automatically detect environment
const isLocalhost = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

const isGitHubPages = window.location.hostname.includes('github.io');

// API URL Configuration
export const API_CONFIG = {
    // Local development
    LOCAL_URL: 'http://localhost:8080/api',

    // Production URL (update this when you deploy your backend)
    PRODUCTION_URL: 'https://your-backend-url.com/api', // TODO: Update this!

    // Auto-select based on environment
    get API_URL() {
        if (isLocalhost) {
            return this.LOCAL_URL;
        } else {
            return this.PRODUCTION_URL;
        }
    },

    // Check if backend is configured
    get isConfigured() {
        return !this.API_URL.includes('your-backend-url.com');
    },

    // Environment info
    isLocalhost,
    isGitHubPages
};
