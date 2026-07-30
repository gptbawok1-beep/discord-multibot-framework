/**
 * Shared Setup Engine — Config Manager Factory
 *
 * createConfigManager({ dataDir, makeDefault, configVersion })
 *
 * Returns a full config management API:
 *   loadGuildConfig   — load (+ migrate) guild config from disk
 *   saveGuildConfig   — persist full config
 *   updateSection     — merge-update a single section and save
 *   resetGuildConfig  — backup current config then reset to defaults
 *   backupGuildConfig — manually create a timestamped backup
 *   listBackups       — list available backups for a guild
 *   restoreBackup     — restore a specific backup by ID
 *   defaultConfig     — return a fresh default config object
 *
 * Each guild's config is stored as:
 *   <dataDir>/<guildId>.json
 *
 * Backups are stored as:
 *   <dataDir>/backups/<guildId>/<timestamp>.json
 */

import { readFile, writeFile, readdir, mkdir, rename } from 'fs/promises';
import { join } from 'path';
import { migrate, CURRENT_VERSION } from './migration.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * @param {object}   options
 * @param {string}   options.dataDir       - Absolute path to the guilds data directory
 * @param {Function} options.makeDefault   - () => object — returns a fresh default config
 * @param {number}   [options.configVersion=1] - Current config schema version
 */
export function createConfigManager({ dataDir, makeDefault, configVersion = CURRENT_VERSION }) {

  // ── Path helpers ──────────────────────────────────────────────────────────

  const backupsDir = join(dataDir, 'backups');

  async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
  }

  function configPath(guildId) {
    return join(dataDir, `${guildId}.json`);
  }

  function backupDir(guildId) {
    return join(backupsDir, guildId);
  }

  function backupPath(guildId, id) {
    return join(backupDir(guildId), `${id}.json`);
  }

  // ── Deep-merge helpers ────────────────────────────────────────────────────

  /**
   * Deep-merge defaults with saved data so newly added keys always exist.
   * Arrays and null values in `source` always overwrite `target`.
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

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return a fresh default config object (with configVersion stamped).
   * @returns {object}
   */
  function defaultConfig() {
    return { ...makeDefault(), configVersion };
  }

  /**
   * Load guild config. Creates and returns a default if the file doesn't exist.
   * Automatically migrates older schemas and deep-merges with defaults so
   * newly added keys always appear even without a full reset.
   *
   * @param {string} guildId
   * @returns {Promise<object>}
   */
  async function loadGuildConfig(guildId) {
    await ensureDir(dataDir);
    try {
      const raw = await readFile(configPath(guildId), 'utf-8');
      const parsed = JSON.parse(raw);
      const migrated = migrate(parsed); // apply any schema migrations
      return deepMerge(defaultConfig(), migrated);
    } catch {
      // File not found or parse error — return defaults
      return defaultConfig();
    }
  }

  /**
   * Persist the full guild config to disk.
   * Always stamps the current configVersion before writing.
   *
   * @param {string} guildId
   * @param {object} config
   */
  async function saveGuildConfig(guildId, config) {
    await ensureDir(dataDir);
    const stamped = { ...config, configVersion };
    await writeFile(configPath(guildId), JSON.stringify(stamped, null, 2), 'utf-8');
  }

  /**
   * Update a single section in the guild config and save.
   *
   * @param {string} guildId
   * @param {string} section  - top-level key in the config (e.g. 'welcome')
   * @param {object} data     - partial object to merge into the section
   * @returns {Promise<object>} updated full config
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
   * Create a timestamped backup of the current guild config.
   * Returns the backup ID (timestamp string).
   *
   * @param {string} guildId
   * @returns {Promise<string>} backup ID
   */
  async function backupGuildConfig(guildId) {
    await ensureDir(backupDir(guildId));

    let currentConfig;
    try {
      const raw = await readFile(configPath(guildId), 'utf-8');
      currentConfig = JSON.parse(raw);
    } catch {
      return null; // nothing to back up
    }

    const id = Date.now().toString();
    const meta = { _backupId: id, _backupDate: new Date().toISOString() };
    await writeFile(
      backupPath(guildId, id),
      JSON.stringify({ ...currentConfig, ...meta }, null, 2),
      'utf-8',
    );
    return id;
  }

  /**
   * List available backups for a guild (most recent first).
   *
   * @param {string} guildId
   * @returns {Promise<Array<{ id: string, date: string }>>}
   */
  async function listBackups(guildId) {
    try {
      await ensureDir(backupDir(guildId));
      const files = await readdir(backupDir(guildId));
      const backups = await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map(async (f) => {
            const id = f.replace('.json', '');
            try {
              const raw = await readFile(backupPath(guildId, id), 'utf-8');
              const data = JSON.parse(raw);
              return { id, date: data._backupDate ?? new Date(parseInt(id)).toISOString() };
            } catch {
              return { id, date: 'unknown' };
            }
          })
      );
      return backups.sort((a, b) => b.id.localeCompare(a.id));
    } catch {
      return [];
    }
  }

  /**
   * Restore a specific backup by ID and overwrite the active config.
   *
   * @param {string} guildId
   * @param {string} backupId
   * @returns {Promise<object>} restored config
   */
  async function restoreBackup(guildId, backupId) {
    const raw = await readFile(backupPath(guildId, backupId), 'utf-8');
    const data = JSON.parse(raw);

    // Strip backup metadata before restoring
    const { _backupId, _backupDate, ...config } = data;

    await ensureDir(dataDir);
    await writeFile(configPath(guildId), JSON.stringify(config, null, 2), 'utf-8');

    return loadGuildConfig(guildId);
  }

  /**
   * Reset guild config to defaults, creating an automatic backup first.
   * Returns the new default config.
   *
   * @param {string} guildId
   * @returns {Promise<{ config: object, backupId: string|null }>}
   */
  async function resetGuildConfig(guildId) {
    const backupId = await backupGuildConfig(guildId);
    const config = defaultConfig();
    await saveGuildConfig(guildId, config);
    return { config, backupId };
  }

  // ── Return public API ────────────────────────────────────────────────────

  return {
    defaultConfig,
    loadGuildConfig,
    saveGuildConfig,
    updateSection,
    backupGuildConfig,
    listBackups,
    restoreBackup,
    resetGuildConfig,
  };
}
