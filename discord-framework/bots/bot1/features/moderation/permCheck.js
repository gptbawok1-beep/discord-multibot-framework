/**
 * Bot 1 — Moderation Permission Checker
 *
 * Centralised checks for moderation commands.
 * Uses the guild config to determine who is allowed.
 */

import { loadGuildConfig } from '../../setup/config.js';

/**
 * Check whether a message author is allowed to run moderation commands.
 *
 * @param {import('discord.js').Message} message
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function checkModPermission(message) {
  const guild = message.guild;
  if (!guild) return { ok: false, reason: 'Command ini hanya bisa digunakan di server.' };

  // Server owner always allowed
  if (message.author.id === guild.ownerId) return { ok: true };

  let cfg;
  try {
    cfg = await loadGuildConfig(guild.id);
  } catch {
    return { ok: false, reason: '❌ Tidak bisa memuat konfigurasi server.' };
  }

  const modRoles = cfg.moderation?.moderatorRoles ?? [];

  if (modRoles.length === 0) {
    return {
      ok:     false,
      reason: '❌ Tidak ada izin. Hanya **Owner Server** yang dapat menggunakan command moderasi karena belum ada **Role Moderator** yang diatur.\n> Gunakan `/setup bot1` → **Moderation Settings** untuk mengatur role moderator.',
    };
  }

  const member = message.member;
  if (!member) return { ok: false, reason: '❌ Data member tidak ditemukan.' };

  const hasRole = modRoles.some((roleId) => member.roles.cache.has(roleId));
  if (!hasRole) {
    return {
      ok:     false,
      reason: '❌ Kamu tidak memiliki **Role Moderator** yang diperlukan untuk menggunakan command ini.',
    };
  }

  return { ok: true };
}

/**
 * Check whether a target member is protected (cannot be moderated).
 *
 * @param {import('discord.js').GuildMember} targetMember
 * @param {object} cfg  - guild config
 * @returns {boolean}
 */
export function isProtectedMember(targetMember, cfg) {
  if (!targetMember) return false;
  const protectedRoles = cfg.moderation?.protectedRoles ?? [];
  if (protectedRoles.length === 0) return false;
  return protectedRoles.some((roleId) => targetMember.roles.cache.has(roleId));
}

/**
 * Check role hierarchy between bot and target.
 *
 * @param {import('discord.js').GuildMember} botMember
 * @param {import('discord.js').GuildMember} targetMember
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkBotHierarchy(botMember, targetMember) {
  if (!botMember || !targetMember) return { ok: true };
  if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
    return {
      ok:     false,
      reason: '❌ Role bot lebih rendah dari role target. Bot tidak bisa melakukan aksi ini.',
    };
  }
  return { ok: true };
}

/**
 * Check role hierarchy between moderator and target.
 *
 * @param {import('discord.js').GuildMember} modMember
 * @param {import('discord.js').GuildMember} targetMember
 * @param {string} guildOwnerId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkModHierarchy(modMember, targetMember, guildOwnerId) {
  // Owner has no hierarchy restriction
  if (modMember.id === guildOwnerId) return { ok: true };
  if (!modMember || !targetMember) return { ok: true };
  if (modMember.roles.highest.position <= targetMember.roles.highest.position) {
    return {
      ok:     false,
      reason: '❌ Role target lebih tinggi atau setara dengan role kamu. Kamu tidak bisa melakukan aksi ini.',
    };
  }
  return { ok: true };
}

/**
 * Resolve the target user from a message (supports Reply, Mention, and User ID).
 * Returns { user, member } or { error }.
 *
 * @param {import('discord.js').Message} message
 * @param {string[]} args  - parsed command args
 * @returns {Promise<{ user?: import('discord.js').User, member?: import('discord.js').GuildMember|null, error?: string }>}
 */
export async function resolveTarget(message, args) {
  let user = null;

  // 1. Reply
  if (message.reference?.messageId) {
    try {
      const ref = await message.fetchReference();
      user = ref.author;
    } catch {
      // fallthrough
    }
  }

  // 2. Mention
  if (!user && message.mentions.users.size > 0) {
    user = message.mentions.users.first();
  }

  // 3. User ID in args
  if (!user && args[0] && /^\d{17,20}$/.test(args[0])) {
    try {
      user = await message.client.users.fetch(args[0]);
    } catch {
      return { error: `❌ Pengguna dengan ID \`${args[0]}\` tidak ditemukan.` };
    }
  }

  if (!user) return { error: null }; // No target — let caller handle

  let member = null;
  if (message.guild) {
    member = message.guild.members.cache.get(user.id)
      ?? await message.guild.members.fetch(user.id).catch(() => null);
  }

  return { user, member };
}

/**
 * Parse duration string like "10m", "1h", "2d", "1w" into milliseconds.
 * Returns null if invalid or exceeds Discord's 28-day timeout limit.
 *
 * @param {string} str
 * @returns {number|null}
 */
export function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (value <= 0) return null;
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const ms = value * multipliers[unit];
  const MAX_MS = 28 * 24 * 60 * 60 * 1_000; // 28 days
  if (ms > MAX_MS) return null;
  if (ms < 1_000) return null;
  return ms;
}

/**
 * Format milliseconds into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (days > 0)    return `${days} hari`;
  if (hours > 0)   return `${hours} jam`;
  if (minutes > 0) return `${minutes} menit`;
  return `${seconds} detik`;
}
