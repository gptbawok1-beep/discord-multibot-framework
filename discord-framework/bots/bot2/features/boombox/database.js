/**
 * Boombox — Database
 *
 * Persistent JSON-file store for processed audio records.
 * Each record represents one unique platform + video/track ID.
 *
 * Schema per record:
 *   videoId    {string}  — platform-specific ID
 *   platform   {string}  — youtube | tiktok | spotify
 *   title      {string}  — human-readable title
 *   duration   {number}  — duration in seconds (0 if unknown)
 *   uploadUrl  {string}  — hosted audio URL (SA:MP-compatible)
 *   uploadTime {number}  — Unix ms timestamp of upload
 *   status     {string}  — 'ok' | 'error' | 'processing'
 *   useCount   {number}  — how many times this record was served
 *   lastUsed   {number}  — Unix ms timestamp of last access
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR    = join(__dirname, '../../../data/boombox');
const DB_FILE   = join(DB_DIR, 'records.json');

function ensureDir() {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
}

class Database {
  constructor() {
    ensureDir();
    /** @type {Record<string, object>} key = platform:id */
    this._data = this._load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  _load() {
    try {
      return JSON.parse(readFileSync(DB_FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  _save() {
    try {
      writeFileSync(DB_FILE, JSON.stringify(this._data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Boombox][DB] Save failed:', err.message);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * @param {string} key  platform:id
   * @returns {object|null}
   */
  get(key) {
    return this._data[key] ?? null;
  }

  /**
   * Insert or update a record.
   * @param {string} key
   * @param {object} record
   */
  set(key, record) {
    this._data[key] = { ...record };
    this._save();
  }

  /**
   * Increment useCount and update lastUsed for a key.
   * @param {string} key
   */
  touch(key) {
    if (!this._data[key]) return;
    this._data[key].useCount = (this._data[key].useCount ?? 0) + 1;
    this._data[key].lastUsed = Date.now();
    this._save();
  }

  /**
   * Mark a record's status.
   * @param {string} key
   * @param {'ok'|'error'|'processing'} status
   */
  setStatus(key, status) {
    if (!this._data[key]) return;
    this._data[key].status = status;
    this._save();
  }

  /**
   * Remove a record (used by retry flow).
   * @param {string} key
   */
  delete(key) {
    delete this._data[key];
    this._save();
  }

  /** @returns {object[]} all records as array */
  getAll() {
    return Object.values(this._data);
  }

  getStats() {
    const all = this.getAll();
    return {
      total:      all.length,
      ok:         all.filter((r) => r.status === 'ok').length,
      error:      all.filter((r) => r.status === 'error').length,
      processing: all.filter((r) => r.status === 'processing').length,
    };
  }
}

export const db = new Database();
