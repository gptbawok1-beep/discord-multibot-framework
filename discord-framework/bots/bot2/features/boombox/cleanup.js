/**
 * Boombox — Cleanup Manager
 *
 * Periodically prunes expired or long-unused cache entries.
 * Never touches the database — only the in-memory cache.
 *
 * Schedule (default): every 6 hours.
 */

import { cacheManager } from './cache.js';
import { boomboxLogger } from './logger.js';
import { monitoringManager } from './monitoring.js';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_IDLE_MS     = 7 * 24 * 60 * 60 * 1000; // 7 days

class CleanupManager {
  constructor() {
    this._timer    = null;
    this._running  = false;
    this._lastRun  = null;
    this._totalRemoved = 0;
  }

  /**
   * Start the automatic cleanup schedule.
   * @param {number} [intervalMs]
   */
  start(intervalMs = DEFAULT_INTERVAL_MS) {
    if (this._timer) return; // already running
    this._timer = setInterval(() => this._run(), intervalMs);
    if (this._timer.unref) this._timer.unref(); // don't keep process alive
    boomboxLogger.info('Cleanup scheduler started.');
    monitoringManager.update('retry', 'ok', 'Cleanup scheduler active');
  }

  /** Stop the cleanup schedule. */
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Run a cleanup pass immediately. */
  async runNow() {
    return this._run();
  }

  async _run() {
    if (this._running) return 0;
    this._running = true;
    try {
      const expired = cacheManager.prune();
      const unused  = cacheManager.pruneUnused(DEFAULT_IDLE_MS);
      const total   = expired + unused;
      this._totalRemoved += total;
      this._lastRun = Date.now();
      boomboxLogger.cleanup(total);
      return total;
    } finally {
      this._running = false;
    }
  }

  getStats() {
    return {
      running:       this._running,
      lastRun:       this._lastRun,
      totalRemoved:  this._totalRemoved,
      schedulerActive: !!this._timer,
    };
  }
}

export const cleanupManager = new CleanupManager();
