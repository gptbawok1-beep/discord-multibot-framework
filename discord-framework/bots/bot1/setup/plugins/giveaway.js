/**
 * Plugin: 🎉 Giveaway
 *
 * Setup wizard plugin for configuring the Giveaway system.
 *
 * Settings:
 *   - Giveaway Manager Role (who can run !gcreate etc.)
 *   - Giveaway Channel     (default channel for giveaways)
 *   - Log Channel          (optional: log when giveaway ends)
 *   - Mention Role         (optional: role pinged when giveaway starts)
 *   - Auto Recovery ON/OFF
 *   - Auto Delete ON/OFF   (delete giveaway message after it ends)
 *
 * Required permission: Manage Guild
 *
 * Custom ID scheme (all prefixed with 'setup1:giveaway:'):
 *   set_manager_role | set_channel | set_log_channel | set_mention_role
 *   role_manager_select | ch_giveaway | ch_log | role_mention_select
 *   ch_confirm | ch_retry | role_confirm | role_retry | back_to_page
 *   toggle_auto_recovery | toggle_auto_delete
 *   clear_manager_role | clear_log_channel | clear_mention_role
 *
 * onRecover: delegates to giveaway/manager.js → recoverGiveaways()
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateTextChannel, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';
import { recoverGiveaways } from '../../features/giveaway/manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(roleId) {
  return roleId ? `<@&${roleId}>` : '`Belum diatur`';
}

function toggle(val) {
  return val ? '🟢 ON' : '🔴 OFF';
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = {
  id:                 'giveaway',
  label:              'Giveaway',
  emoji:              '🎉',
  description:        'Sistem giveaway dengan panel interaktif dan auto-recovery.',
  order:              6,
  requiredPermission: PermissionFlagsBits.ManageGuild,

  // ── Status (shown on main wizard page) ───────────────────────────────────

  getStatus(cfg) {
    const gw = cfg.giveaway ?? {};
    return {
      enabled: !!(gw.managerRoleId || gw.channelId),
      summary: gw.channelId ? channelLabel(gw.channelId) : 'Channel belum diatur',
    };
  },

  // ── Main plugin page ──────────────────────────────────────────────────────

  async buildPage(cfg) {
    const gw = cfg.giveaway ?? {};

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: '🎉  Giveaway — Pengaturan' })
      .setDescription(`Konfigurasi sistem giveaway untuk server ini.\n${DIVIDER}`)
      .addFields(
        { name: '🛡️  Manager Role',    value: roleLabel(gw.managerRoleId),         inline: true },
        { name: '📢  Giveaway Channel', value: channelLabel(gw.channelId),          inline: true },
        { name: '📋  Log Channel',      value: channelLabel(gw.logChannelId),       inline: true },
        { name: '📣  Mention Role',     value: roleLabel(gw.mentionRoleId),         inline: true },
        { name: '🔄  Auto Recovery',    value: toggle(gw.autoRecovery !== false),   inline: true },
        { name: '🗑️  Auto Delete',     value: toggle(gw.autoDelete === true),      inline: true },
      )
      .addFields({
        name: '📖  Commands',
        value: '`!gcreate` `!gend` `!greroll` `!gcancel` `!glist`\n`/giveaway create` `/giveaway end` `/giveaway reroll` `/giveaway cancel` `/giveaway list`',
        inline: false,
      })
      .setFooter({ text: 'Gunakan tombol di bawah untuk konfigurasi.' });

    // Row 1: Role settings
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:set_manager_role')
        .setLabel('Manager Role').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:clear_manager_role')
        .setLabel('Hapus Manager Role').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        .setDisabled(!gw.managerRoleId),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:set_mention_role')
        .setLabel('Mention Role').setEmoji('📣').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:clear_mention_role')
        .setLabel('Hapus Mention').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        .setDisabled(!gw.mentionRoleId),
    );

    // Row 2: Channel settings
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:set_channel')
        .setLabel('Giveaway Channel').setEmoji('📢').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:set_log_channel')
        .setLabel('Log Channel').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:clear_log_channel')
        .setLabel('Hapus Log').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        .setDisabled(!gw.logChannelId),
    );

    // Row 3: Toggles
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:toggle_auto_recovery')
        .setLabel(`Auto Recovery: ${gw.autoRecovery !== false ? 'ON' : 'OFF'}`)
        .setEmoji('🔄')
        .setStyle(gw.autoRecovery !== false ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:giveaway:toggle_auto_delete')
        .setLabel(`Auto Delete: ${gw.autoDelete ? 'ON' : 'OFF'}`)
        .setEmoji('🗑️')
        .setStyle(gw.autoDelete ? ButtonStyle.Danger : ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  // ── Interaction handler ───────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {
    const reload = () => loadGuildConfig(session.guildId);
    const gw     = cfg.giveaway ?? {};

    // ── Manager Role ────────────────────────────────────────────────────────
    if (action === 'set_manager_role') {
      session.wizardData.pendingRoleAction = 'set_manager_role';
      const page = buildCustomRoleSelectPage(
        '🛡️  Set Giveaway Manager Role',
        'Pilih role yang bisa mengelola giveaway (`!gcreate`, `!gend`, dll).\nOwner server selalu punya akses terlepas dari role ini.',
        'setup1:giveaway:role_manager_select',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'role_manager_select') {
      const roleId = interaction.values[0] ?? null;
      if (roleId) {
        await updateSection(session.guildId, 'giveaway', { managerRoleId: roleId });
      }
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'clear_manager_role') {
      await updateSection(session.guildId, 'giveaway', { managerRoleId: null });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Mention Role ────────────────────────────────────────────────────────
    if (action === 'set_mention_role') {
      session.wizardData.pendingRoleAction = 'set_mention_role';
      const page = buildCustomRoleSelectPage(
        '📣  Set Mention Role',
        'Pilih role yang akan di-mention saat giveaway baru dibuat (opsional).',
        'setup1:giveaway:role_mention_select',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'role_mention_select') {
      const roleId = interaction.values[0] ?? null;
      if (roleId) {
        await updateSection(session.guildId, 'giveaway', { mentionRoleId: roleId });
      }
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'clear_mention_role') {
      await updateSection(session.guildId, 'giveaway', { mentionRoleId: null });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Giveaway Channel ────────────────────────────────────────────────────
    if (action === 'set_channel') {
      session.wizardData.pendingChannelAction = 'set_channel';
      const page = buildChannelSelectPage(
        '📢  Set Giveaway Channel',
        'Pilih channel default untuk mengirim giveaway.\nBisa di-override per giveaway saat membuat.',
        'setup1:giveaway:ch_giveaway',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_giveaway') {
      session.wizardData.pendingChannel       = interaction.values[0];
      session.wizardData.pendingChannelAction = 'set_channel';
      const page = buildChannelPreviewPage(
        '📢  Giveaway Channel — Preview',
        'Channel ini akan digunakan sebagai default untuk giveaway baru.',
        interaction.values[0],
        'setup1:giveaway:ch_confirm',
        'setup1:giveaway:ch_retry',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Log Channel ─────────────────────────────────────────────────────────
    if (action === 'set_log_channel') {
      session.wizardData.pendingChannelAction = 'set_log_channel';
      const page = buildChannelSelectPage(
        '📋  Set Log Channel',
        'Pilih channel untuk log ketika giveaway selesai (opsional).',
        'setup1:giveaway:ch_log',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_log') {
      session.wizardData.pendingChannel       = interaction.values[0];
      session.wizardData.pendingChannelAction = 'set_log_channel';
      const page = buildChannelPreviewPage(
        '📋  Log Channel — Preview',
        'Hasil giveaway (pemenang, peserta) akan dicatat di channel ini.',
        interaction.values[0],
        'setup1:giveaway:ch_confirm',
        'setup1:giveaway:ch_retry',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Channel confirm / retry ─────────────────────────────────────────────
    if (action === 'ch_confirm') {
      const channelId   = session.wizardData.pendingChannel;
      const targetAction = session.wizardData.pendingChannelAction;

      if (channelId) {
        const validation = await validateTextChannel(interaction.guild, channelId);
        if (!validation.ok) {
          return interaction.update({
            embeds:     [buildValidationErrorEmbed([validation.reason])],
            components: [buildNavRow()],
          });
        }
        const key = targetAction === 'set_channel' ? 'channelId' : 'logChannelId';
        await updateSection(session.guildId, 'giveaway', { [key]: channelId });
      }

      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelAction;

      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_retry') {
      const targetAction = session.wizardData.pendingChannelAction;
      delete session.wizardData.pendingChannel;

      const isLog = targetAction === 'set_log_channel';
      const page  = buildChannelSelectPage(
        isLog ? '📋  Set Log Channel' : '📢  Set Giveaway Channel',
        isLog
          ? 'Pilih channel untuk log ketika giveaway selesai (opsional).'
          : 'Pilih channel default untuk mengirim giveaway.',
        isLog ? 'setup1:giveaway:ch_log' : 'setup1:giveaway:ch_giveaway',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'clear_log_channel') {
      await updateSection(session.guildId, 'giveaway', { logChannelId: null });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Toggles ─────────────────────────────────────────────────────────────
    if (action === 'toggle_auto_recovery') {
      const current = cfg.giveaway?.autoRecovery !== false;
      await updateSection(session.guildId, 'giveaway', { autoRecovery: !current });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'toggle_auto_delete') {
      const current = cfg.giveaway?.autoDelete === true;
      await updateSection(session.guildId, 'giveaway', { autoDelete: !current });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Back to page ────────────────────────────────────────────────────────
    if (action === 'back_to_page') {
      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelAction;
      delete session.wizardData.pendingRoleAction;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }
  },

  // ── Auto-recovery hook ────────────────────────────────────────────────────

  async onRecover(guild, cfg) {
    // The client is available via guild.client
    await recoverGiveaways(guild.client, guild, cfg);
  },
};

// ---------------------------------------------------------------------------
// Local helper: role select page (minValues=1, no clear option)
// ---------------------------------------------------------------------------

function buildCustomRoleSelectPage(title, description, customId, backId) {
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK ?? 0x2B2D31)
    .setTitle(title)
    .setDescription(description + `\n\n${DIVIDER}\nGunakan dropdown di bawah untuk memilih role.`);

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pilih role...')
    .setMinValues(1)
    .setMaxValues(1);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(backId)
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:cancel')
      .setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return {
    embed,
    components: [new ActionRowBuilder().addComponents(roleMenu), navRow],
  };
}

export default plugin;
