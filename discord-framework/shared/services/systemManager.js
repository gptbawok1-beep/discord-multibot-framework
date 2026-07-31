/**
 * Shared System Manager Service
 *
 * createSystemManagerService({ loadGuildConfig, updateSection }) → service
 *
 * Core module used by all features for:
 *   - Recording errors to guild error history
 *   - Sending system log messages to a configured log channel
 *   - Building user-facing error embeds using owner-customised templates
 *   - Resolving message placeholders: {user} {feature} {error_code} {server} {time}
 *
 * Usage in any Bot 1 feature:
 *   import { systemManager } from '../../services/index.js';
 *   await systemManager.recordError(guildId, { feature, reason, code });
 *   await systemManager.sendSystemLog(client, guildId, 'Config Updated', { detail: '...' });
 *   const embed = systemManager.buildUserErrorEmbed(cfg, { feature, errorCode, user, server });
 */

import { EmbedBuilder } from 'discord.js';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_USER_MESSAGE = {
  title:       '❌ Terjadi Kesalahan',
  description: 'Fitur **{feature}** mengalami error.\nSilakan coba lagi atau hubungi admin.',
  footer:      'Error Code: {error_code} | {time}',
  color:       '#ED4245',
  emoji:       '❌',
  gif:         null,
};

// ─── System Log Event Labels ──────────────────────────────────────────────────

const LOG_EVENTS = {
  'Bot Start':             { emoji: '🟢', color: '#57F287' },
  'Bot Restart':           { emoji: '🔄', color: '#FEE75C' },
  'Bot Shutdown':          { emoji: '🔴', color: '#ED4245' },
  'Backup Created':        { emoji: '💾', color: '#5865F2' },
  'Backup Restored':       { emoji: '♻️', color: '#5865F2' },
  'Configuration Updated': { emoji: '⚙️', color: '#5865F2' },
  'API Offline':           { emoji: '📡', color: '#ED4245' },
  'API Online':            { emoji: '📡', color: '#57F287' },
  'Error':                 { emoji: '🚨', color: '#ED4245' },
  'Retry Failed':          { emoji: '⚠️', color: '#FEE75C' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Replace {placeholder} tokens in a string.
 * @param {string} template
 * @param {Record<string, string>} vars
 */
function resolvePlaceholders(template, vars = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Generate a short random error code like ERR-A3F2. */
function generateErrorCode() {
  return 'ERR-' + Math.random().toString(36).toUpperCase().slice(2, 6);
}

/** Format a Date to Indonesian locale string. */
function fmtTime(date = new Date()) {
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Check if two dates are on the same calendar day. */
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {Function} options.loadGuildConfig   - (guildId) => Promise<config>
 * @param {Function} options.updateSection     - (guildId, section, data) => Promise<void>
 */
export function createSystemManagerService({ loadGuildConfig, updateSection }) {

  // ── Record Error ────────────────────────────────────────────────────────────

  /**
   * Record an error to the guild's error history.
   *
   * @param {string} guildId
   * @param {object} info
   * @param {string} info.feature       - Feature / command name
   * @param {string} [info.reason]      - Human-readable reason
   * @param {string} [info.code]        - Custom error code (auto-generated if omitted)
   * @param {string} [info.suggestion]  - Suggested fix
   * @param {boolean} [info.retried]    - Whether a retry was attempted
   * @param {boolean} [info.retryOk]    - Whether the retry succeeded
   * @returns {Promise<string>} The error code used
   */
  async function recordError(guildId, { feature, reason = 'Unknown', code, suggestion = '', retried = false, retryOk = false } = {}) {
    try {
      const cfg       = await loadGuildConfig(guildId);
      const errorCode = code || generateErrorCode();
      const entry     = {
        code:        errorCode,
        feature:     feature ?? 'Unknown',
        time:        new Date().toISOString(),
        reason,
        suggestion,
        retryStatus: retried ? (retryOk ? 'Retry berhasil' : 'Retry gagal') : 'Tidak di-retry',
      };

      // Keep last 50 errors
      const history = Array.isArray(cfg.systemManager?.errorHistory)
        ? cfg.systemManager.errorHistory
        : [];
      const updated = [entry, ...history].slice(0, 50);
      await updateSection(guildId, 'systemManager', { errorHistory: updated });
      return errorCode;
    } catch {
      return code || generateErrorCode();
    }
  }

  // ── Build User Error Embed ──────────────────────────────────────────────────

  /**
   * Build a user-facing error embed using the guild's configured template.
   *
   * @param {object} cfg         - Guild config (from loadGuildConfig)
   * @param {object} vars        - Placeholder values
   * @param {string} [vars.user]       - User mention
   * @param {string} [vars.feature]    - Feature name
   * @param {string} [vars.error_code] - Error code
   * @param {string} [vars.server]     - Server name
   * @param {string} [vars.time]       - Formatted time
   * @returns {EmbedBuilder}
   */
  function buildUserErrorEmbed(cfg, vars = {}) {
    const um  = cfg?.systemManager?.errorSystem?.userMessage ?? DEFAULT_USER_MESSAGE;
    const now = fmtTime();
    const resolved = {
      user:       vars.user       ?? 'User',
      feature:    vars.feature    ?? 'Unknown',
      error_code: vars.error_code ?? generateErrorCode(),
      server:     vars.server     ?? 'Server',
      time:       vars.time       ?? now,
    };

    const embed = new EmbedBuilder()
      .setColor(um.color ?? DEFAULT_USER_MESSAGE.color)
      .setTitle(resolvePlaceholders(um.title || DEFAULT_USER_MESSAGE.title, resolved))
      .setDescription(resolvePlaceholders(um.description || DEFAULT_USER_MESSAGE.description, resolved));

    if (um.footer) {
      embed.setFooter({ text: resolvePlaceholders(um.footer, resolved) });
    }
    if (um.gif) {
      embed.setImage(um.gif);
    }

    return embed;
  }

  // ── Send System Log ─────────────────────────────────────────────────────────

  /**
   * Send a system log event to the guild's configured log channel.
   *
   * @param {import('discord.js').Client} client
   * @param {string} guildId
   * @param {string} eventType     - One of the LOG_EVENTS keys
   * @param {object} [details]     - Additional detail fields { key: value }
   */
  async function sendSystemLog(client, guildId, eventType, details = {}) {
    try {
      const cfg = await loadGuildConfig(guildId);
      const sm  = cfg?.systemManager;
      if (!sm?.systemLogs?.enabled || !sm?.systemLogs?.channelId) return;

      const channel = await client.channels.fetch(sm.systemLogs.channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const meta  = LOG_EVENTS[eventType] ?? { emoji: '📋', color: '#5865F2' };
      const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `${meta.emoji} ${eventType}` })
        .setTimestamp();

      if (Object.keys(details).length > 0) {
        embed.addFields(
          Object.entries(details).map(([name, value]) => ({
            name,
            value: String(value).slice(0, 1024),
            inline: true,
          }))
        );
      }

      await channel.send({ embeds: [embed] }).catch(() => null);
    } catch {
      // Never crash the caller over a log failure
    }
  }

  // ── Count Today's Errors ────────────────────────────────────────────────────

  /**
   * Count errors recorded today for a guild.
   * @param {object} cfg - Guild config
   * @returns {number}
   */
  function countTodayErrors(cfg) {
    const history = cfg?.systemManager?.errorHistory ?? [];
    const today   = new Date();
    return history.filter((e) => isSameDay(new Date(e.time), today)).length;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    recordError,
    buildUserErrorEmbed,
    sendSystemLog,
    resolvePlaceholders,
    countTodayErrors,
    generateErrorCode,
    fmtTime,
    LOG_EVENTS,
    DEFAULT_USER_MESSAGE,
  };
}
