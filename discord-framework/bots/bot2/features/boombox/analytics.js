/**
 * Boombox — Analytics (Placeholder)
 *
 * Tracks usage counters in memory.
 * Phase 2: persist to database and expose via /bawok → Boombox dashboard.
 */

class AnalyticsManager {
  constructor() {
    this._reset();
  }

  _reset() {
    this.downloads    = 0; // Total successful conversions
    this.cacheHits    = 0; // Requests served from cache
    this.cacheMisses  = 0; // Requests that required full processing
    this.queueCount   = 0; // Total jobs ever enqueued
    this.retryCount   = 0; // Total !requlang invocations
    this.platformUsage = {
      youtube: 0,
      tiktok:  0,
      spotify: 0,
    };
  }

  // ── Increment helpers ──────────────────────────────────────────────────────

  incrementDownloads()           { this.downloads++; }
  incrementCacheHit()            { this.cacheHits++; }
  incrementCacheMiss()           { this.cacheMisses++; }
  incrementQueue()               { this.queueCount++; }
  incrementRetry()               { this.retryCount++; }

  /** @param {'youtube'|'tiktok'|'spotify'} platform */
  incrementPlatform(platform) {
    if (platform in this.platformUsage) this.platformUsage[platform]++;
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  /**
   * Return a plain snapshot of current counters.
   * @returns {object}
   */
  getSnapshot() {
    return {
      downloads:     this.downloads,
      cacheHits:     this.cacheHits,
      cacheMisses:   this.cacheMisses,
      queueCount:    this.queueCount,
      retryCount:    this.retryCount,
      platformUsage: { ...this.platformUsage },
      cacheHitRate:  this.cacheHits + this.cacheMisses > 0
        ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }
}

export const analyticsManager = new AnalyticsManager();
