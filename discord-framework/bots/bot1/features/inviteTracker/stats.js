/**
 * Bot 1 — Invite Tracker: Stats Persistence
 *
 * Stores invite statistics per guild using the Shared Storage Manager.
 * Location: bots/bot1/data/invite-stats/<guildId>.json
 *
 * File structure:
 * {
 *   "members": {
 *     "<userId>": { total, fake, left, rejoin, bonus }
 *   },
 *   "joins": {
 *     "<memberId>": { inviterId, inviteCode, joinedAt, isRejoin }
 *   }
 * }
 *
 * Definitions:
 *   total  — people who joined via this user's invite (still counted)
 *   fake   — joined then left within 10 minutes (removed from total, counted separately)
 *   left   — joined but eventually left normally (removed from total, counted separately)
 *   rejoin — already joined before, came back (counted separately, not in total)
 *   bonus  — manual bonus invite count (reserved for future use)
 *
 * Net/effective invites = total - fake - left
 */

import { createStorageManager } from '../../../../shared/storage/index.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', '..', 'data', 'invite-stats');

const storage = createStorageManager({ storageDir: DATA_DIR });

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultMemberStats() {
  return { total: 0, fake: 0, left: 0, rejoin: 0, bonus: 0 };
}

function defaultGuildStats() {
  return { members: {}, joins: {} };
}

// ── Load / Save ───────────────────────────────────────────────────────────────

async function loadStats(guildId) {
  try {
    const raw = await storage.read(guildId);
    return {
      members: raw.members ?? {},
      joins:   raw.joins   ?? {},
    };
  } catch {
    return defaultGuildStats();
  }
}

async function saveStats(guildId, stats) {
  await storage.write(guildId, stats);
}

// ── Member stats ──────────────────────────────────────────────────────────────

/**
 * Get stats for a single member (as an inviter).
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getMemberStats(guildId, userId) {
  const stats = await loadStats(guildId);
  return { ...defaultMemberStats(), ...(stats.members[userId] ?? {}) };
}

/**
 * Get the top N inviters, sorted by net invites (total - fake - left).
 *
 * @param {string} guildId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ userId, total, fake, left, rejoin, bonus, net }>>}
 */
async function getTopInviters(guildId, limit = 10) {
  const stats = await loadStats(guildId);
  return Object.entries(stats.members)
    .map(([userId, s]) => ({
      userId,
      total:  s.total  ?? 0,
      fake:   s.fake   ?? 0,
      left:   s.left   ?? 0,
      rejoin: s.rejoin ?? 0,
      bonus:  s.bonus  ?? 0,
      net:    (s.total ?? 0) - (s.fake ?? 0) - (s.left ?? 0),
    }))
    .sort((a, b) => b.net - a.net || b.total - a.total)
    .slice(0, limit);
}

// ── Record join ───────────────────────────────────────────────────────────────

const FAKE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Record a member join and update the inviter's stats.
 *
 * @param {string}      guildId
 * @param {string}      memberId
 * @param {string|null} inviterId
 * @param {string|null} inviteCode
 * @param {boolean}     isRejoin   - true if member was previously recorded as joining
 */
async function recordJoin(guildId, memberId, inviterId, inviteCode, isRejoin) {
  const stats = await loadStats(guildId);

  // Store the join record (do not overwrite — keep first recorded join time)
  if (!stats.joins[memberId]) {
    stats.joins[memberId] = {
      inviterId,
      inviteCode,
      joinedAt:  Date.now(),
      isRejoin,
    };
  } else {
    // Update with fresh join (re-join after leaving)
    stats.joins[memberId] = {
      inviterId,
      inviteCode,
      joinedAt:  Date.now(),
      isRejoin,
    };
  }

  // Update inviter stats
  if (inviterId) {
    if (!stats.members[inviterId]) {
      stats.members[inviterId] = { ...defaultMemberStats() };
    }
    const m = stats.members[inviterId];
    if (isRejoin) {
      m.rejoin = (m.rejoin ?? 0) + 1;
    } else {
      m.total = (m.total ?? 0) + 1;
    }
  }

  await saveStats(guildId, stats);
}

// ── Record leave ──────────────────────────────────────────────────────────────

/**
 * Record a member leave and update the inviter's stats accordingly.
 * - Left within 10 min → fake (total--, fake++)
 * - Left after 10 min  → left (total--, left++)
 * - Rejoin that left   → no change to total/fake/left
 *
 * @param {string} guildId
 * @param {string} memberId
 */
async function recordLeave(guildId, memberId) {
  const stats = await loadStats(guildId);

  const joinRecord = stats.joins[memberId];
  if (!joinRecord) return; // no join record → nothing to update

  const { inviterId, joinedAt, isRejoin } = joinRecord;

  if (inviterId && stats.members[inviterId]) {
    const m           = stats.members[inviterId];
    const timeInServer = Date.now() - (joinedAt ?? 0);

    if (!isRejoin) {
      if (timeInServer < FAKE_THRESHOLD_MS) {
        // Fake: joined and left within 10 minutes
        m.total = Math.max(0, (m.total ?? 0) - 1);
        m.fake  = (m.fake ?? 0) + 1;
      } else {
        // Left normally after staying
        m.total = Math.max(0, (m.total ?? 0) - 1);
        m.left  = (m.left ?? 0) + 1;
      }
    }
    // Rejoin leavers don't affect total/fake/left
  }

  // Keep join record as history — do not delete

  await saveStats(guildId, stats);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/**
 * Reset all invite stats for a guild to zero.
 *
 * @param {string} guildId
 */
async function resetStats(guildId) {
  await saveStats(guildId, defaultGuildStats());
}

export {
  loadStats,
  saveStats,
  getMemberStats,
  getTopInviters,
  recordJoin,
  recordLeave,
  resetStats,
};
