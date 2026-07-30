/**
 * Shared Setup Engine — Validation Utilities
 *
 * Call these before saving any channel/role config to ensure the
 * configuration is still valid at the moment of saving.
 *
 * All functions return a { ok: boolean, reason?: string } result so
 * callers can surface a clear error message instead of crashing.
 */

import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Colors } from './ui.js';

// ---------------------------------------------------------------------------
// Channel validation
// ---------------------------------------------------------------------------

/**
 * Validate that a channel exists, is a text channel, and the bot can
 * send messages to it.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function validateTextChannel(guild, channelId) {
  if (!channelId) return { ok: false, reason: 'Channel ID kosong.' };

  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  if (!channel) return { ok: false, reason: `Channel <#${channelId}> tidak ditemukan.` };
  if (!channel.isTextBased()) return { ok: false, reason: `<#${channelId}> bukan text channel.` };

  const botMember = guild.members.me;
  if (!botMember) return { ok: true }; // can't check; allow

  const perms = channel.permissionsFor(botMember);
  if (!perms?.has(PermissionFlagsBits.SendMessages)) {
    return { ok: false, reason: `Bot tidak memiliki izin **Send Messages** di <#${channelId}>.` };
  }
  if (!perms.has(PermissionFlagsBits.ViewChannel)) {
    return { ok: false, reason: `Bot tidak bisa melihat <#${channelId}>.` };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Role validation
// ---------------------------------------------------------------------------

/**
 * Validate that a role exists and the bot's highest role is above it
 * (so the bot can actually assign it).
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function validateRole(guild, roleId) {
  if (!roleId) return { ok: false, reason: 'Role ID kosong.' };

  const role = guild.roles.cache.get(roleId)
    ?? await guild.roles.fetch(roleId).catch(() => null);

  if (!role) return { ok: false, reason: `Role <@&${roleId}> tidak ditemukan.` };
  if (role.managed) return { ok: false, reason: `<@&${roleId}> adalah bot-managed role dan tidak dapat diberikan.` };

  const botMember = guild.members.me;
  if (botMember && botMember.roles.highest.position <= role.position) {
    return {
      ok: false,
      reason: `Posisi role <@&${roleId}> lebih tinggi dari role bot. Bot tidak bisa memberikannya.`,
    };
  }

  return { ok: true };
}

/**
 * Validate multiple roles at once.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string[]} roleIds
 * @returns {Promise<{ ok: boolean, reasons: string[] }>}
 */
export async function validateRoles(guild, roleIds) {
  const results = await Promise.all(roleIds.map((id) => validateRole(guild, id)));
  const reasons = results.filter((r) => !r.ok).map((r) => r.reason);
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

/**
 * Check if a guild member has all the given permissions.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {bigint[]} permissions  - PermissionFlagsBits values
 * @returns {boolean}
 */
export function memberHasPermissions(member, permissions) {
  if (!member || !permissions?.length) return true;
  return permissions.every((p) => member.permissions.has(p));
}

// ---------------------------------------------------------------------------
// Embed helpers
// ---------------------------------------------------------------------------

/**
 * Build a validation-error embed to show the user when saving fails.
 *
 * @param {string[]} reasons
 * @returns {import('discord.js').EmbedBuilder}
 */
export function buildValidationErrorEmbed(reasons) {
  return new EmbedBuilder()
    .setColor(Colors.ERROR)
    .setTitle('❌  Validasi Gagal')
    .setDescription(
      'Konfigurasi tidak dapat disimpan karena:\n\n' +
      reasons.map((r) => `• ${r}`).join('\n') +
      '\n\nPerbaiki masalah di atas lalu coba simpan kembali.'
    );
}

/**
 * Build a permission-denied embed when a user lacks the required permission
 * to access a setup plugin page.
 *
 * @param {string} pluginLabel
 * @param {string} permissionName  - Human-readable permission name
 * @returns {import('discord.js').EmbedBuilder}
 */
export function buildPermissionDeniedEmbed(pluginLabel, permissionName) {
  return new EmbedBuilder()
    .setColor(Colors.ERROR)
    .setTitle('🔒  Akses Ditolak')
    .setDescription(
      `Kamu tidak memiliki izin untuk mengakses **${pluginLabel}**.\n\n` +
      `Izin yang dibutuhkan: \`${permissionName}\``
    );
}
