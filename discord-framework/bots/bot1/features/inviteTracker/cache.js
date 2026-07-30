/**
 * Bot 1 — Invite Tracker: In-Memory Cache
 *
 * Per-guild snapshot of invite uses. Updated on:
 *   - Bot startup (onRecover via plugin.onRecover)
 *   - inviteCreate / inviteDelete events
 *   - After each guildMemberAdd detection
 *
 * Shape:  Map<guildId, Map<inviteCode, CachedInvite>>
 *
 * CachedInvite:
 *   { uses, inviterId, maxUses, temporary, expiresTimestamp }
 */

/** @type {Map<string, Map<string, object>>} */
const inviteCache = new Map();

/**
 * Overwrite the full cache for a guild with a fresh snapshot.
 *
 * @param {string}                  guildId
 * @param {Map<string, object>}     cacheMap  code → CachedInvite
 */
function setGuildCache(guildId, cacheMap) {
  inviteCache.set(guildId, cacheMap);
}

/**
 * Get the cached invite map for a guild.
 *
 * @param  {string} guildId
 * @returns {Map<string, object>|null}
 */
function getGuildCache(guildId) {
  return inviteCache.get(guildId) ?? null;
}

/**
 * Update the cached uses count for a single invite code.
 *
 * @param {string} guildId
 * @param {string} code
 * @param {number} uses
 */
function updateInviteUses(guildId, code, uses) {
  const map   = inviteCache.get(guildId);
  const entry = map?.get(code);
  if (entry) map.set(code, { ...entry, uses });
}

/**
 * Add or update a single invite in the cache (e.g. after inviteCreate).
 *
 * @param {string}                   guildId
 * @param {import('discord.js').Invite} invite
 */
function addInvite(guildId, invite) {
  if (!inviteCache.has(guildId)) inviteCache.set(guildId, new Map());
  inviteCache.get(guildId).set(invite.code, {
    uses:             invite.uses             ?? 0,
    inviterId:        invite.inviter?.id      ?? null,
    maxUses:          invite.maxUses          ?? 0,
    temporary:        invite.temporary        ?? false,
    expiresTimestamp: invite.expiresTimestamp ?? null,
  });
}

/**
 * Remove a deleted invite from the cache (e.g. after inviteDelete).
 *
 * @param {string} guildId
 * @param {string} code
 */
function removeInvite(guildId, code) {
  inviteCache.get(guildId)?.delete(code);
}

/**
 * Clear the entire cache for a guild (e.g. on guild leave).
 *
 * @param {string} guildId
 */
function clearGuildCache(guildId) {
  inviteCache.delete(guildId);
}

export {
  inviteCache,
  setGuildCache,
  getGuildCache,
  updateInviteUses,
  addInvite,
  removeInvite,
  clearGuildCache,
};
