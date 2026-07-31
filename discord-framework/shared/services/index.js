/**
 * Shared Services
 *
 * This module is the entry point for all shared services.
 * Add service modules here as the framework grows.
 *
 * Example services to add in the future:
 *   - DatabaseService  (database connection pool)
 *   - CacheService     (in-memory or Redis caching)
 *   - ApiService       (external HTTP client)
 */

// Export shared service factories here as they are added.
export { createSystemManagerService } from './systemManager.js';
