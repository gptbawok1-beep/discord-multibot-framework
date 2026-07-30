/**
 * Bot 1 — Take Role: Runtime Panel Interaction Handler
 *
 * Handles live interactions from users clicking buttons or selecting from
 * the dropdown on a published Take Role panel.
 *
 * Custom ID scheme:
 *   Button   : tr1:{panelId}:btn:{roleId}
 *   Dropdown : tr1:{panelId}:sel
 *
 * Called from bots/bot1/events/interactionCreate.js for any interaction
 * whose customId starts with 'tr1:'.
 */

import { PermissionFlagsBits } from 'discord.js';
import { loadGuildConfig } from '../../setup/config.js';
import { createLogger } from '../../../../shared/logger/index.js';

const logger = createLogger('BOT1');

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Route a Take Role panel interaction.
 *
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @returns {Promise<boolean>}  true if handled
 */
export async function handlePanelInteraction(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('tr1:')) return false;

  // Parse: tr1:{panelId}:{type}[:{roleId}]
  const parts   = customId.split(':');
  const panelId = parts[1];
  const type    = parts[2];   // 'btn' | 'sel'
  const roleId  = parts[3];  // only for 'btn'

  const guild  = interaction.guild;
  const member = interaction.member;

  if (!guild || !member) {
    await interaction.reply({ content: '❌ Command ini hanya bisa digunakan di server.', ephemeral: true });
    return true;
  }

  try {
    // Load config to find the panel
    const cfg   = await loadGuildConfig(guild.id);
    const panel = (cfg.takeRole?.panels ?? []).find((p) => p.id === panelId);

    if (!panel) {
      await interaction.reply({
        content: '❌ Panel ini tidak lagi aktif. Hubungi admin server.',
        ephemeral: true,
      });
      return true;
    }

    if (!cfg.takeRole?.enabled) {
      await interaction.reply({
        content: '❌ Fitur Take Role sedang dinonaktifkan.',
        ephemeral: true,
      });
      return true;
    }

    if (type === 'btn' && roleId) {
      await handleButtonClick(interaction, member, panel, roleId, guild);
    } else if (type === 'sel') {
      await handleDropdownSelect(interaction, member, panel, guild);
    } else {
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[TakeRole:Handler] Interaction error (panelId=${panelId}): ${err.message}`);
    try {
      const msg = { content: '❌ Terjadi kesalahan. Silakan coba lagi.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch { /* suppress secondary errors */ }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Button handler
// ---------------------------------------------------------------------------

async function handleButtonClick(interaction, member, panel, roleId, guild) {
  // Check bot has Manage Roles
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      content: '❌ Bot tidak memiliki izin **Manage Roles**. Hubungi admin server.',
      ephemeral: true,
    });
  }

  // Fetch the role
  const role = guild.roles.cache.get(roleId)
    ?? await guild.roles.fetch(roleId).catch(() => null);

  if (!role) {
    return interaction.reply({ content: '❌ Role tidak ditemukan. Mungkin sudah dihapus.', ephemeral: true });
  }

  // Check bot can assign this role (position check)
  if (botMember.roles.highest.position <= role.position) {
    return interaction.reply({
      content: `❌ Posisi role **${role.name}** lebih tinggi dari role bot. Bot tidak bisa memberikannya.`,
      ephemeral: true,
    });
  }

  const hasRole = member.roles.cache.has(roleId);

  if (panel.toggle) {
    // Toggle: click adds, click again removes
    if (hasRole) {
      await member.roles.remove(role, 'TakeRole: user toggled off');
      logger.info(`[TakeRole] Toggled OFF ${role.name} for ${member.user?.tag} in guild ${guild.id}`);
      return interaction.reply({
        content: `✅ Role **${role.name}** telah dihapus dari akunmu.`,
        ephemeral: true,
      });
    } else {
      await member.roles.add(role, 'TakeRole: user toggled on');
      logger.info(`[TakeRole] Toggled ON ${role.name} for ${member.user?.tag} in guild ${guild.id}`);
      return interaction.reply({
        content: `✅ Role **${role.name}** berhasil ditambahkan.`,
        ephemeral: true,
      });
    }
  } else {
    // Non-toggle: only add role
    if (hasRole) {
      return interaction.reply({
        content: `ℹ️ Kamu sudah memiliki role **${role.name}**.`,
        ephemeral: true,
      });
    }
    await member.roles.add(role, 'TakeRole: user took role');
    logger.info(`[TakeRole] Added role ${role.name} to ${member.user?.tag} in guild ${guild.id}`);
    return interaction.reply({
      content: `✅ Role **${role.name}** berhasil ditambahkan.`,
      ephemeral: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Dropdown handler
// ---------------------------------------------------------------------------

async function handleDropdownSelect(interaction, member, panel, guild) {
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      content: '❌ Bot tidak memiliki izin **Manage Roles**. Hubungi admin server.',
      ephemeral: true,
    });
  }

  const selectedIds = interaction.values;
  const added   = [];
  const skipped = [];
  const failed  = [];

  for (const rid of selectedIds) {
    try {
      const role = guild.roles.cache.get(rid)
        ?? await guild.roles.fetch(rid).catch(() => null);

      if (!role) {
        failed.push(`Role \`${rid}\` tidak ditemukan.`);
        continue;
      }

      if (botMember.roles.highest.position <= role.position) {
        failed.push(`Posisi **${role.name}** lebih tinggi dari bot.`);
        continue;
      }

      if (member.roles.cache.has(rid)) {
        skipped.push(role.name);
        continue;
      }

      await member.roles.add(role, 'TakeRole: dropdown selected');
      added.push(role.name);
    } catch (err) {
      failed.push(`Error pada role \`${rid}\`: ${err.message}`);
    }
  }

  logger.info(
    `[TakeRole] Dropdown: added=[${added.join(', ')}] skipped=[${skipped.join(', ')}] ` +
    `failed=[${failed.join(', ')}] for ${member.user?.tag} in guild ${guild.id}`
  );

  const lines = [];
  if (added.length > 0)   lines.push(`✅ Ditambahkan: ${added.map((n) => `**${n}**`).join(', ')}`);
  if (skipped.length > 0) lines.push(`ℹ️ Sudah dimiliki: ${skipped.map((n) => `**${n}**`).join(', ')}`);
  if (failed.length > 0)  lines.push(`❌ Gagal: ${failed.join(', ')}`);
  if (lines.length === 0)  lines.push('ℹ️ Tidak ada perubahan.');

  return interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
