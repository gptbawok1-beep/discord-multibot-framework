/**
 * Bot 1 — Invite Tracker: Core Detection Logic
 *
 * Compares a cached invite snapshot (before join) with the current
 * Discord invite list (after join) to determine which invite was used.
 *
 * Detection heuristic:
 *   1. Find invites whose `uses` count increased since last snapshot.
 *   2. If exactly one increased by 1 — that's the used invite.
 *   3. If multiple increased — pick the one with the most uses (most active).
 *   4. If none increased — check for deleted single-use invites.
 *   5. If still no match — return null (unknown inviter).
 */

import { PermissionFlagsBits } from 'discord.js';
import { setGuildCache } from './cache.js';
import { createLogger } from '../../../../shared/logger/index.js';

const logger = createLogger('BOT1');

// ── Cache refresh ─────────────────────────────────────────────────────────────

/**
 * Fetch all guild invites from Discord and store them in the local cache.
 * Requires the bot to have MANAGE_GUILD permission.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<Map<string, object>|null>}  null if permission denied
 */
async function refreshGuildCache(guild) {
  try {
    const botMember = guild.members.me;
    if (botMember && !botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
      logger.warn(`[InviteTracker] No MANAGE_GUILD permission for guild ${guild.id} — cannot cache invites`);
      return null;
    }

    const invites   = await guild.invites.fetch();
    const cacheMap  = new Map();

    for (const [code, invite] of invites) {
      cacheMap.set(code, {
        uses:             invite.uses             ?? 0,
        inviterId:        invite.inviter?.id      ?? null,
        maxUses:          invite.maxUses          ?? 0,
        temporary:        invite.temporary        ?? false,
        expiresTimestamp: invite.expiresTimestamp ?? null,
      });
    }

    setGuildCache(guild.id, cacheMap);
    logger.debug(`[InviteTracker] Cache refreshed for guild ${guild.id}: ${cacheMap.size} invite(s)`);
    return cacheMap;
  } catch (err) {
    logger.warn(`[InviteTracker] Cannot fetch invites for guild ${guild.id}: ${err.message}`);
    return null;
  }
}

// ── Invite detection ──────────────────────────────────────────────────────────

/**
 * Detect which invite was used when a member joined.
 * Compares the old cache snapshot with freshly-fetched Discord invite data.
 * Also refreshes the cache with the latest data after detection.
 *
 * @param {import('discord.js').Guild}  guild
 * @param {Map<string, object>|null}    oldCache  - Snapshot taken before the join
 * @returns {Promise<{ code: string, inviterId: string|null }|null>}
 */
async function detectInviter(guild, oldCache) {
  if (!oldCache || oldCache.size === 0) {
    // No cached snapshot — try to refresh and give up gracefully
    await refreshGuildCache(guild);
    return null;
  }

  // Fetch the current invite list from Discord
  let freshInvites;
  try {
    freshInvites = await guild.invites.fetch();
  } catch (err) {
    logger.warn(`[InviteTracker] Cannot fetch invites post-join for guild ${guild.id}: ${err.message}`);
    return null;
  }

  // Build fresh cache map and persist it
  const newCacheMap = new Map();
  for (const [code, invite] of freshInvites) {
    newCacheMap.set(code, {
      uses:             invite.uses             ?? 0,
      inviterId:        invite.inviter?.id      ?? null,
      maxUses:          invite.maxUses          ?? 0,
      temporary:        invite.temporary        ?? false,
      expiresTimestamp: invite.expiresTimestamp ?? null,
    });
  }
  setGuildCache(guild.id, newCacheMap);

  // ── Step 1: Find invites whose uses increased ───────────────────────────────
  const candidates = [];

  for (const [code, fresh] of newCacheMap) {
    const cached  = oldCache.get(code);
    const oldUses = cached?.uses ?? 0;
    if (fresh.uses > oldUses) {
      candidates.push({
        code,
        inviterId: fresh.inviterId,
        uses:      fresh.uses,
        delta:     fresh.uses - oldUses,
      });
    }
  }

  if (candidates.length > 0) {
    // Prefer candidates with delta === 1 (exactly one new use)
    const exact = candidates.filter((c) => c.delta === 1);
    const pool  = exact.length > 0 ? exact : candidates;
    // Among them, pick the one with the highest current use count
    pool.sort((a, b) => b.uses - a.uses);
    const best = pool[0];
    logger.debug(`[InviteTracker] Detected invite: code=${best.code} inviter=${best.inviterId}`);
    return { code: best.code, inviterId: best.inviterId };
  }

  // ── Step 2: Check for deleted single-use invites ──────────────────────────
  for (const [code, cached] of oldCache) {
    if (!newCacheMap.has(code)) {
      // Invite disappeared — was it a single-use (maxUses=1, used=0 → used up)?
      const wasLastUse =
        (cached.maxUses === 1  && cached.uses === 0) ||
        (cached.maxUses > 0   && cached.uses === cached.maxUses - 1);

      if (wasLastUse) {
        logger.debug(`[InviteTracker] Detected deleted single-use invite: code=${code} inviter=${cached.inviterId}`);
        return { code, inviterId: cached.inviterId };
      }
    }
  }

  logger.debug(`[InviteTracker] Could not detect invite for guild ${guild.id} — no use change found`);
  return null;
}

export { refreshGuildCache, detectInviter };
