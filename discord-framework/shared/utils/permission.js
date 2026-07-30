/**
 * Permission Checker
 *
 * Validates that a user and the bot have the required permissions
 * before a command is executed.
 */

import { PermissionsBitField } from 'discord.js';

/**
 * Check if a guild member has all required permissions.
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').PermissionResolvable[]} permissions
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkUserPermissions(member, permissions) {
  if (!permissions.length) return { ok: true, missing: [] };

  const missing = permissions.filter(
    (perm) => !member.permissions.has(PermissionsBitField.resolve(perm))
  );

  return { ok: missing.length === 0, missing };
}

/**
 * Check if the bot has all required permissions in a channel.
 * @param {import('discord.js').GuildMember} botMember
 * @param {import('discord.js').PermissionResolvable[]} permissions
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkBotPermissions(botMember, permissions) {
  if (!permissions.length) return { ok: true, missing: [] };

  const missing = permissions.filter(
    (perm) => !botMember.permissions.has(PermissionsBitField.resolve(perm))
  );

  return { ok: missing.length === 0, missing };
}

export { checkUserPermissions, checkBotPermissions };
