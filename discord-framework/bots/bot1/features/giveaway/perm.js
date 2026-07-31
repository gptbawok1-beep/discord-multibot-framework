/**
 * Giveaway — Permission Utilities
 *
 * Permission check for giveaway management commands.
 * Only the following can manage giveaways:
 *   1. Server Owner
 *   2. A member with the Giveaway Manager Role (set via /setup bot1 → 🎉 Giveaway)
 *
 * Administrator permission is NOT used as the primary check, per project spec.
 */

/**
 * Check if a guild member is allowed to manage giveaways.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {object} cfg  - Guild config (from loadGuildConfig)
 * @param {string} guildOwnerId
 * @returns {boolean}
 */
export function canManageGiveaway(member, cfg, guildOwnerId) {
  if (!member) return false;
  // Server owner always has access
  if (member.id === guildOwnerId) return true;
  // Giveaway Manager Role (configured via Setup Wizard)
  const managerRoleId = cfg?.giveaway?.managerRoleId;
  if (managerRoleId && member.roles.cache.has(managerRoleId)) return true;
  return false;
}

/**
 * Build a human-readable permission denied message for giveaway commands.
 * @returns {string}
 */
export function permissionDeniedMessage() {
  return '❌  Kamu tidak memiliki izin untuk mengelola giveaway.\n\nHanya **Owner Server** atau member dengan **Giveaway Manager Role** yang bisa menggunakan perintah ini.\n\n> Atur Giveaway Manager Role melalui `/setup bot1` → 🎉 Giveaway.';
}
