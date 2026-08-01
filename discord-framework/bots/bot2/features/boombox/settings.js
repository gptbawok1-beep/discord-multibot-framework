/**
 * Boombox — Settings (Placeholder)
 *
 * Per-guild configuration for the Boombox module.
 * Phase 2: persist via shared/setup config system, expose through /bawok UI.
 *
 * Channel Mode:
 *   'combined'  — all results posted in one channel
 *   'separate'  — each platform gets its own channel
 *
 * Per-platform channel overrides (null = use combined channel):
 *   youtubeChannelId, tiktokChannelId, spotifyChannelId
 *   logsChannelId, errorsChannelId
 */

/** @typedef {'combined'|'separate'} ChannelMode */

/**
 * Default settings applied when a guild has no saved config.
 */
const DEFAULTS = Object.freeze({
  channelMode:        'combined',
  combinedChannelId:  null,
  youtubeChannelId:   null,
  tiktokChannelId:    null,
  spotifyChannelId:   null,
  logsChannelId:      null,
  errorsChannelId:    null,
  maxQueuePerUser:    3,      // max concurrent jobs per user
  maxWorkers:         3,      // global worker pool size
  cacheTtlHours:      24,     // cache TTL in hours
});

class SettingsManager {
  constructor() {
    /** @type {Map<string, object>} guildId → settings */
    this._guilds = new Map();
  }

  /**
   * Get settings for a guild (falls back to defaults).
   * @param {string} guildId
   * @returns {typeof DEFAULTS}
   */
  get(guildId) {
    return { ...DEFAULTS, ...(this._guilds.get(guildId) ?? {}) };
  }

  /**
   * Partially update settings for a guild.
   * @param {string} guildId
   * @param {Partial<typeof DEFAULTS>} patch
   */
  update(guildId, patch) {
    const current = this._guilds.get(guildId) ?? {};
    this._guilds.set(guildId, { ...current, ...patch });
  }

  /**
   * Reset a guild's settings to defaults.
   * @param {string} guildId
   */
  reset(guildId) {
    this._guilds.delete(guildId);
  }

  /** Expose defaults for UI display. */
  getDefaults() {
    return { ...DEFAULTS };
  }
}

export const settingsManager = new SettingsManager();
