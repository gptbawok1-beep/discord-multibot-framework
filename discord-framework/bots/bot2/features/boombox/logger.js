/**
 * Boombox — Logger
 *
 * Structured log entries for all Boombox operations.
 * Prefixes every message with [Boombox] and the event type.
 */

import { createLogger } from '../../../../shared/logger/index.js';

const _log = createLogger('BOT2');
const TAG  = '[Boombox]';

export const boomboxLogger = Object.freeze({
  /**
   * @param {string} cacheKey  - platform:id
   * @param {string} userId
   */
  processing(cacheKey, userId) {
    _log.info(`${TAG} [Processing] ${cacheKey} — requested by ${userId}`);
  },

  /**
   * @param {string} cacheKey
   * @param {string} uploadUrl
   * @param {boolean} fromCache
   */
  completed(cacheKey, uploadUrl, fromCache = false) {
    const src = fromCache ? 'cache' : 'fresh';
    _log.success(`${TAG} [Completed] ${cacheKey} → ${uploadUrl} (${src})`);
  },

  /**
   * @param {string} cacheKey
   * @param {string} reason
   */
  failed(cacheKey, reason) {
    _log.error(`${TAG} [Failed] ${cacheKey} — ${reason}`);
  },

  /**
   * @param {string} cacheKey
   * @param {number} attempt
   */
  retry(cacheKey, attempt) {
    _log.warn(`${TAG} [Retry] ${cacheKey} — attempt #${attempt}`);
  },

  /**
   * @param {number} removed
   */
  cleanup(removed) {
    _log.info(`${TAG} [Cleanup] Removed ${removed} expired cache entries.`);
  },

  /**
   * General info message.
   * @param {string} msg
   */
  info(msg) {
    _log.info(`${TAG} ${msg}`);
  },

  /**
   * General error message.
   * @param {string} msg
   */
  error(msg) {
    _log.error(`${TAG} ${msg}`);
  },
});
