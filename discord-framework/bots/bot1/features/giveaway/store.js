/**
 * Giveaway — Persistent Storage
 *
 * Stores all giveaway data in bots/bot1/data/giveaways/<guildId>.json
 * so giveaways survive restarts, re-deploys, and updates.
 *
 * Each file is a flat object: { [messageId]: GiveawayRecord }
 *
 * GiveawayRecord shape:
 * {
 *   id:             string   (Discord message ID)
 *   guildId:        string
 *   channelId:      string
 *   hostId:         string
 *   prize:          string
 *   winnerCount:    number
 *   endsAt:         number   (Unix ms timestamp)
 *   participants:   string[] (user IDs)
 *   requiredRoleId: string|null
 *   mentionRoleId:  string|null
 *   status:         'active' | 'ended' | 'cancelled'
 *   winners:        string[]
 *   createdAt:      number
 * }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '../../data/giveaways');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(guildId) {
  return join(DATA_DIR, `${guildId}.json`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all giveaways for a guild.
 * @param {string} guildId
 * @returns {{ [messageId: string]: object }}
 */
export function loadGiveaways(guildId) {
  ensureDir();
  const fp = filePath(guildId);
  if (!existsSync(fp)) return {};
  try {
    return JSON.parse(readFileSync(fp, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Persist the full giveaway map for a guild.
 * @param {string} guildId
 * @param {{ [messageId: string]: object }} data
 */
export function saveGiveaways(guildId, data) {
  ensureDir();
  writeFileSync(filePath(guildId), JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Get a single giveaway record.
 * @param {string} guildId
 * @param {string} messageId
 * @returns {object|null}
 */
export function getGiveaway(guildId, messageId) {
  return loadGiveaways(guildId)[messageId] ?? null;
}

/**
 * Insert or update a giveaway record.
 * @param {string} guildId
 * @param {string} messageId
 * @param {object} giveaway
 */
export function setGiveaway(guildId, messageId, giveaway) {
  const all = loadGiveaways(guildId);
  all[messageId] = giveaway;
  saveGiveaways(guildId, all);
}

/**
 * Remove a giveaway record permanently.
 * @param {string} guildId
 * @param {string} messageId
 */
export function deleteGiveaway(guildId, messageId) {
  const all = loadGiveaways(guildId);
  delete all[messageId];
  saveGiveaways(guildId, all);
}

/**
 * List all giveaways for a guild.
 * @param {string} guildId
 * @returns {object[]}
 */
export function listGiveaways(guildId) {
  return Object.values(loadGiveaways(guildId));
}
