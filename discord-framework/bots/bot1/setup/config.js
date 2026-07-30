/**
 * Bot 1 — Guild Config Manager
 *
 * Stores per-guild configuration as JSON files in bots/bot1/data/guilds/.
 * Each section maps to a Setup Wizard plugin.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'guilds');

// ---------------------------------------------------------------------------
// Default config shape — all sections start disabled / unconfigured
// ---------------------------------------------------------------------------

/** @returns {GuildConfig} */
function defaultConfig() {
  return {
    server: {
      prefix: '!',
      language: 'id',
      timezone: 'Asia/Jakarta',
    },
    welcome: {
      enabled: false,
      channelId: null,
      embed: { title: 'Selamat Datang, {user}!', description: '', color: '#5865F2' },
      gif: null,
      image: null,
    },
    takeRole: {
      enabled: false,
      panels: [],
      // panel shape:
      // { id, channelId, messageId, mode: 'dropdown'|'button',
      //   placeholder, maxRoles: 1, single: true, toggle: false,
      //   roles: [{ roleId, name, emoji, description }] }
    },
    invite: {
      enabled: false,
      channelId: null,
      logsChannelId: null,
      leaderboardChannelId: null,
    },
    logs: {
      enabled: false,
      channels: {
        member: null,
        role: null,
        invite: null,
        channel: null,
        moderation: null,
        welcome: null,
        error: null,
      },
    },
    channelManager: {
      backups: [],
    },
    backup: {
      enabled: false,
      backups: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function configPath(guildId) {
  return join(DATA_DIR, `${guildId}.json`);
}

/**
 * Deep-merge defaults with saved data so newly added keys always exist.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load guild config (creates default if not found).
 * @param {string} guildId
 * @returns {Promise<GuildConfig>}
 */
async function loadGuildConfig(guildId) {
  await ensureDir();
  try {
    const raw = await readFile(configPath(guildId), 'utf-8');
    return deepMerge(defaultConfig(), JSON.parse(raw));
  } catch {
    return defaultConfig();
  }
}

/**
 * Persist the full guild config to disk.
 * @param {string} guildId
 * @param {GuildConfig} config
 */
async function saveGuildConfig(guildId, config) {
  await ensureDir();
  await writeFile(configPath(guildId), JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Update a single section in the guild config.
 * @param {string} guildId
 * @param {string} section   - key in GuildConfig (e.g. 'welcome')
 * @param {object} data      - partial object to merge into the section
 * @returns {Promise<GuildConfig>} updated full config
 */
async function updateSection(guildId, section, data) {
  const config = await loadGuildConfig(guildId);
  config[section] = Array.isArray(config[section])
    ? data
    : { ...config[section], ...data };
  await saveGuildConfig(guildId, config);
  return config;
}

/**
 * Reset guild config to defaults.
 * @param {string} guildId
 * @returns {Promise<GuildConfig>}
 */
async function resetGuildConfig(guildId) {
  const config = defaultConfig();
  await saveGuildConfig(guildId, config);
  return config;
}

export { loadGuildConfig, saveGuildConfig, updateSection, resetGuildConfig, defaultConfig };
