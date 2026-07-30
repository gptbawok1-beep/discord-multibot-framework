/**
 * Shared Storage Manager
 *
 * createStorageManager({ storageDir }) → { read, write, exists, list, remove }
 *
 * Generic JSON file-based key-value store. Each key maps to a single
 * <storageDir>/<key>.json file. Suitable for per-guild configs, per-user
 * data, or any other structured JSON that needs to persist across restarts.
 *
 * Both BOT 1 and BOT 2 (and any future bots) can create isolated instances
 * with their own storage directory — no code duplication needed.
 *
 * Usage:
 *   import { createStorageManager } from '../../../shared/storage/index.js';
 *
 *   const storage = createStorageManager({ storageDir: '/path/to/data' });
 *
 *   const data  = await storage.read('guild-12345');
 *   await storage.write('guild-12345', { setting: true });
 *   const keys  = await storage.list();
 *   await storage.remove('guild-12345');
 */

import { readFile, writeFile, mkdir, readdir, unlink, access } from 'fs/promises';
import { join } from 'path';

/**
 * @param {object} options
 * @param {string} options.storageDir - Absolute path to the directory where JSON files are stored
 */
export function createStorageManager({ storageDir }) {

  // ── Internal helpers ───────────────────────────────────────────────────────

  async function ensureDir() {
    await mkdir(storageDir, { recursive: true });
  }

  function keyPath(key) {
    return join(storageDir, `${key}.json`);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Read and parse a JSON file by key.
   * Throws if the key does not exist or the file is malformed.
   *
   * @param {string} key
   * @returns {Promise<object>}
   */
  async function read(key) {
    const raw = await readFile(keyPath(key), 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Serialize and write data to a JSON file by key.
   * Creates the storage directory if it doesn't exist.
   *
   * @param {string} key
   * @param {object} data
   */
  async function write(key, data) {
    await ensureDir();
    await writeFile(keyPath(key), JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Check whether a key exists in the storage directory.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async function exists(key) {
    try {
      await access(keyPath(key));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all stored keys (filenames without the .json extension).
   *
   * @returns {Promise<string[]>}
   */
  async function list() {
    try {
      await ensureDir();
      const files = await readdir(storageDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5)); // strip .json
    } catch {
      return [];
    }
  }

  /**
   * Delete a key from storage.
   * Returns true if the file was deleted, false if it didn't exist.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async function remove(key) {
    try {
      await unlink(keyPath(key));
      return true;
    } catch {
      return false;
    }
  }

  return { read, write, exists, list, remove };
}
