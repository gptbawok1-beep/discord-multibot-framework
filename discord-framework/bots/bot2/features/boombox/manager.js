/**
 * Boombox — Manager
 *
 * Central orchestrator. All external code (commands, UI handlers) interacts
 * with Boombox exclusively through this module.
 *
 * Flow:
 *   request(url, userId, guildId)
 *     → validate → cache check → db check → enqueue → return URL
 */

import { validateURL, buildCacheKey } from './validator.js';
import { cacheManager }    from './cache.js';
import { db }              from './database.js';
import { queueManager }    from './queue.js';
import { analyticsManager } from './analytics.js';
import { monitoringManager } from './monitoring.js';
import { boomboxLogger }   from './logger.js';
import { cleanupManager }  from './cleanup.js';
import { startWorkers }    from './workers.js';

class BoomboxManager {
  constructor() {
    this._initialised = false;
  }

  /**
   * Boot all subsystems. Call once when Bot 2 is ready.
   */
  init() {
    if (this._initialised) return;
    startWorkers();
    cleanupManager.start();
    this._initialised = true;
    boomboxLogger.info('BoomboxManager initialised.');
    monitoringManager.update('queue',    'ok', 'Ready');
    monitoringManager.update('database', 'ok', `${db.getStats().total} records loaded`);
    monitoringManager.update('cache',    'ok', 'Empty (cold start)');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Process a URL request from a user.
   * Returns the audio URL (from cache or freshly processed).
   *
   * @param {string} url          — user-supplied URL
   * @param {string} userId       — Discord user ID
   * @param {string} [guildId]    — Discord guild ID
   * @returns {Promise<{ uploadUrl: string, title: string, platform: string, fromCache: boolean }>}
   */
  async request(url, userId, guildId = 'dm') {
    // 1. Validate
    const validation = validateURL(url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { platform, id: videoId } = validation;
    const cacheKey = buildCacheKey(platform, videoId);

    // 2. Cache check
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      db.touch(cacheKey);
      analyticsManager.incrementCacheHit();
      analyticsManager.incrementPlatform(platform);
      boomboxLogger.completed(cacheKey, cached.uploadUrl, true);
      return { uploadUrl: cached.uploadUrl, title: cached.title, platform, fromCache: true };
    }

    // 3. DB check (cache miss but DB has a valid record)
    const record = db.get(cacheKey);
    if (record && record.status === 'ok' && record.uploadUrl) {
      cacheManager.set(cacheKey, {
        uploadUrl: record.uploadUrl,
        title:     record.title,
        platform,
      });
      db.touch(cacheKey);
      analyticsManager.incrementCacheHit();
      analyticsManager.incrementPlatform(platform);
      boomboxLogger.completed(cacheKey, record.uploadUrl, true);
      return { uploadUrl: record.uploadUrl, title: record.title, platform, fromCache: true };
    }

    // 4. Enqueue for processing
    const uploadUrl = await queueManager.enqueue({
      cacheKey, platform, videoId,
      originalUrl: url, userId, guildId,
    });

    const title = db.get(cacheKey)?.title ?? '';
    return { uploadUrl, title, platform, fromCache: false };
  }

  // ── Stats & status ─────────────────────────────────────────────────────────

  getStatus() {
    return {
      initialised: this._initialised,
      queue:       queueManager.getStats(),
      cache:       cacheManager.getStats(),
      database:    db.getStats(),
      analytics:   analyticsManager.getSnapshot(),
      monitoring:  monitoringManager.getSnapshot(),
      cleanup:     cleanupManager.getStats(),
    };
  }
}

export const boomboxManager = new BoomboxManager();
