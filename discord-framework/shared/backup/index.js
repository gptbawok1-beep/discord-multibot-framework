/**
 * Shared Backup Manager
 *
 * createBackupManager({ backupsDir }) → { backup, list, restore }
 *
 * Generic timestamped backup system for any JSON-serializable data.
 * Backups are stored as:
 *   <backupsDir>/<key>/<timestamp>.json
 *
 * Both BOT 1 and BOT 2 (and any future bots) can create isolated instances
 * with their own backup directory — no code duplication needed.
 *
 * Usage:
 *   import { createBackupManager } from '../../../shared/backup/index.js';
 *
 *   const backupManager = createBackupManager({ backupsDir: '/path/to/backups' });
 *
 *   const backupId = await backupManager.backup('guild-12345', guildConfig);
 *   const backups  = await backupManager.list('guild-12345');
 *   const restored = await backupManager.restore('guild-12345', backupId);
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * @param {object} options
 * @param {string} options.backupsDir - Absolute path to the root backup directory
 */
export function createBackupManager({ backupsDir }) {

  // ── Internal helpers ───────────────────────────────────────────────────────

  function keyDir(key) {
    return join(backupsDir, key);
  }

  function backupFilePath(key, id) {
    return join(keyDir(key), `${id}.json`);
  }

  async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Create a timestamped backup of the given data under the given key.
   * Returns the backup ID (a timestamp string).
   *
   * @param {string} key    - e.g. a guild ID
   * @param {object} data   - the data to back up
   * @returns {Promise<string>} backup ID
   */
  async function backup(key, data) {
    await ensureDir(keyDir(key));

    const id   = Date.now().toString();
    const meta = { _backupId: id, _backupDate: new Date().toISOString() };

    await writeFile(
      backupFilePath(key, id),
      JSON.stringify({ ...data, ...meta }, null, 2),
      'utf-8',
    );

    return id;
  }

  /**
   * List all available backups for a key (most recent first).
   *
   * @param {string} key
   * @returns {Promise<Array<{ id: string, date: string }>>}
   */
  async function list(key) {
    try {
      await ensureDir(keyDir(key));
      const files = await readdir(keyDir(key));

      const entries = await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map(async (f) => {
            const id = f.slice(0, -5); // strip .json
            try {
              const raw    = await readFile(backupFilePath(key, id), 'utf-8');
              const parsed = JSON.parse(raw);
              return {
                id,
                date: parsed._backupDate ?? new Date(parseInt(id, 10)).toISOString(),
              };
            } catch {
              return { id, date: 'unknown' };
            }
          })
      );

      return entries.sort((a, b) => b.id.localeCompare(a.id));
    } catch {
      return [];
    }
  }

  /**
   * Restore a backup by ID. Returns the stored data with backup metadata
   * fields (_backupId, _backupDate) stripped out.
   *
   * @param {string} key
   * @param {string} backupId
   * @returns {Promise<object>} restored data (without backup metadata)
   */
  async function restore(key, backupId) {
    const raw  = await readFile(backupFilePath(key, backupId), 'utf-8');
    const data = JSON.parse(raw);

    // Strip backup metadata before returning
    const { _backupId, _backupDate, ...clean } = data;
    return clean;
  }

  return { backup, list, restore };
}
