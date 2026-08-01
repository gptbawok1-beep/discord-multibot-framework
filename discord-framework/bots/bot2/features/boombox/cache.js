/**
 * Boombox — Cache Manager
 *
 * In-memory cache keyed by `platform:videoId`.
 * Entries expire after a configurable TTL (default 24 h).
 * Phase 2: optionally back with Redis or persistent file store.
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class CacheManager {
  constructor() {
    /** @type {Map<string, { uploadUrl: string, title: string, platform: string, cachedAt: number, expiresAt: number, hits: number }>} */
    this._store = new Map();
  }

  // ── Core ops ───────────────────────────────────────────────────────────────

  /**
   * Retrieve a cached entry. Returns null if missing or expired.
   * @param {string} key  platform:id
   * @returns {{ uploadUrl: string, title: string, platform: string, cachedAt: number, hits: number }|null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    entry.hits++;
    return entry;
  }

  /**
   * Store a result in cache.
   * @param {string} key
   * @param {{ uploadUrl: string, title: string, platform: string }} data
   * @param {number} [ttlMs]
   */
  set(key, data, ttlMs = DEFAULT_TTL_MS) {
    const now = Date.now();
    this._store.set(key, {
      uploadUrl: data.uploadUrl,
      title:     data.title ?? '',
      platform:  data.platform,
      cachedAt:  now,
      expiresAt: now + ttlMs,
      hits:      0,
    });
  }

  /**
   * Remove a specific entry (used by retry flow).
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this._store.delete(key);
  }

  /**
   * Check existence without recording a hit.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { this._store.delete(key); return false; }
    return true;
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  /**
   * Remove all expired entries. Called by CleanupManager on schedule.
   * @returns {number} count of removed entries
   */
  prune() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) { this._store.delete(key); removed++; }
    }
    return removed;
  }

  /** Remove entries that haven't been used in the given window. */
  pruneUnused(maxIdleMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxIdleMs;
    let removed = 0;
    for (const [key, entry] of this._store) {
      if (entry.cachedAt < cutoff && entry.hits === 0) {
        this._store.delete(key); removed++;
      }
    }
    return removed;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats() {
    const total   = this._store.size;
    const expired = [...this._store.values()].filter((e) => Date.now() > e.expiresAt).length;
    return { total, expired, active: total - expired };
  }
}

export const cacheManager = new CacheManager();
