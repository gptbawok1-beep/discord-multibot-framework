/**
 * Plugin: 🛡️ Moderation Settings
 *
 * Setup wizard for configuring moderation permissions and behaviour.
 *
 * Settings:
 *   - Enable / Disable
 *   - Role Moderator  (multi-role — via RoleSelectMenu)
 *   - Role Admin      (optional multi-role)
 *   - Protected Roles (cannot be moderated)
 *   - DM Notification ON/OFF
 *   - Default Reason  (via modal)
 *   - Confirmation Action ON/OFF
 *   - 📖 Command Guide
 *
 * Required permission: Manage Guild
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, buildNavRow,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an array of role IDs as a string of mentions, or a fallback. */
function roleList(ids, fallback = '`Belum diatur`') {
  if (!ids?.length) return fallback;
  return ids.map((id) => `<@&${id}>`).join(', ');
}

// ── Command Guide embed (ephemeral) ──────────────────────────────────────────

function buildCommandGuideEmbed() {
  return new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '📖 Moderation Commands' })
    .setDescription(
      [
        '**🧹 `!cc <jumlah>`**',
        'Menghapus pesan.',
        '',
        '**🔨 `!ban <user> [reason]`**',
        'Ban member.',
        '',
        '**👢 `!kick <user> [reason]`**',
        'Kick member.',
        '',
        '**🔇 `!mute <user> <durasi> [reason]`**',
        'Timeout member.',
        '',
        '**🔊 `!unmute <user>`**',
        'Menghapus timeout.',
        '',
        '**🔓 `!unban <userID> [reason]`**',
        'Membuka ban.',
        '',
        '**💤 `!afk [alasan]`**',
        'Mengaktifkan status AFK.',
        '',
        '**🧵 `!autothread <#channel> <on/off>`**',
        'Mengaktifkan atau menonaktifkan Auto Thread.',
        '',
        '**📋 `!listthread`**',
        'Melihat daftar Auto Thread.',
        DIVIDER,
        '💡 **Tips**',
        '• Reply Message didukung untuk ban, kick, mute, unmute.',
        '• `< >` = Wajib   |   `[ ]` = Opsional',
      ].join('\n')
    );
}

// ── Role Select Page builder (custom — minValues=0 to allow clearing) ────────

function buildRoleSelectPageCustom(title, description, customId, backId, maxValues = 10) {
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle(title)
    .setDescription(
      description +
      `\n\n${DIVIDER}\nGunakan dropdown untuk memilih role.\n` +
      '> Pilih **0 role** untuk menghapus semua role yang sudah diatur.',
    );

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pilih role...')
    .setMinValues(0)
    .setMaxValues(maxValues);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(backId)
      .setLabel('Back')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:cancel')
      .setLabel('Cancel')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger),
  );

  return {
    embed,
    components: [new ActionRowBuilder().addComponents(roleMenu), navRow],
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const plugin = {
  id:                 'moderation',
  label:              'Moderation Settings',
  emoji:              '🛡️',
  description:        'Konfigurasi moderasi, role, dan perilaku command mod.',
  order:              6,
  requiredPermission: PermissionFlagsBits.ManageGuild,

  getStatus(cfg) {
    const mod = cfg.moderation ?? {};
    return {
      enabled: mod.enabled ?? false,
      summary: mod.moderatorRoles?.length
        ? `${mod.moderatorRoles.length} Mod Role`
        : 'Mod Role belum diatur',
    };
  },

  async buildPage(cfg) {
    const mod = cfg.moderation ?? {};

    const embed = new EmbedBuilder()
      .setColor(mod.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '🛡️  Moderation Settings' })
      .setDescription(`Konfigurasi sistem moderasi server.\n${DIVIDER}`)
      .addFields(
        { name: '📊 Status',            value: statusDot(mod.enabled ?? false),                  inline: true },
        { name: '📬 DM Notifikasi',     value: (mod.dmNotification ?? true) ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: '✅ Konfirmasi Aksi',   value: (mod.confirmationAction ?? false) ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: '🛡️ Role Moderator',   value: roleList(mod.moderatorRoles),                       inline: false },
        { name: '👑 Role Admin',        value: roleList(mod.adminRoles, '`Tidak diatur`'),         inline: true },
        { name: '🔒 Role Dilindungi',   value: roleList(mod.protectedRoles, '`Tidak ada`'),        inline: true },
        { name: '📝 Default Reason',   value: `\`${mod.defaultReason ?? 'Tidak ada alasan.'}\``,  inline: false },
      )
      .setFooter({ text: 'Gunakan tombol di bawah untuk konfigurasi.' });

    // Row 1: Enable / Disable
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:moderation:enable')
        .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
        .setDisabled(mod.enabled ?? false),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:disable')
        .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
        .setDisabled(!(mod.enabled ?? false)),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:command_guide')
        .setLabel('Command Guide').setEmoji('📖').setStyle(ButtonStyle.Secondary),
    );

    // Row 2: Role settings
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:moderation:set_mod_roles')
        .setLabel('Mod Roles').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:set_admin_roles')
        .setLabel('Admin Roles').setEmoji('👑').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:set_protected_roles')
        .setLabel('Protected Roles').setEmoji('🔒').setStyle(ButtonStyle.Primary),
    );

    // Row 3: Toggles + Default Reason
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:moderation:dm_on')
        .setLabel('DM ON').setEmoji('📬').setStyle(ButtonStyle.Success)
        .setDisabled(mod.dmNotification ?? true),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:dm_off')
        .setLabel('DM OFF').setEmoji('🔕').setStyle(ButtonStyle.Secondary)
        .setDisabled(!(mod.dmNotification ?? true)),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:confirm_on')
        .setLabel('Konfirmasi ON').setEmoji('✅').setStyle(ButtonStyle.Success)
        .setDisabled(mod.confirmationAction ?? false),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:confirm_off')
        .setLabel('Konfirmasi OFF').setEmoji('❌').setStyle(ButtonStyle.Secondary)
        .setDisabled(!(mod.confirmationAction ?? false)),
      new ButtonBuilder()
        .setCustomId('setup1:moderation:set_reason')
        .setLabel('Default Reason').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const mod = cfg.moderation ?? {};

    // ── Enable / Disable ─────────────────────────────────────────────────────
    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'moderation', { enabled: action === 'enable' });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Command Guide (ephemeral reply) ──────────────────────────────────────
    if (action === 'command_guide') {
      return interaction.reply({ embeds: [buildCommandGuideEmbed()], ephemeral: true });
    }

    // ── DM toggles ───────────────────────────────────────────────────────────
    if (action === 'dm_on' || action === 'dm_off') {
      await updateSection(session.guildId, 'moderation', { dmNotification: action === 'dm_on' });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Confirmation toggles ─────────────────────────────────────────────────
    if (action === 'confirm_on' || action === 'confirm_off') {
      await updateSection(session.guildId, 'moderation', { confirmationAction: action === 'confirm_on' });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Role select pages ─────────────────────────────────────────────────────
    if (action === 'set_mod_roles') {
      const page = buildRoleSelectPageCustom(
        '🛡️  Set Role Moderator',
        'Pilih role yang diperbolehkan menggunakan command moderasi.\nPilih **0 role** untuk menghapus semua.',
        'setup1:moderation:mod_roles_select',
        'setup1:moderation:back_to_page',
        10,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'set_admin_roles') {
      const page = buildRoleSelectPageCustom(
        '👑  Set Role Admin',
        'Pilih role admin (opsional — level di atas moderator).\nPilih **0 role** untuk menghapus semua.',
        'setup1:moderation:admin_roles_select',
        'setup1:moderation:back_to_page',
        10,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'set_protected_roles') {
      const page = buildRoleSelectPageCustom(
        '🔒  Set Role Dilindungi',
        'Pilih role yang tidak boleh dimoderasi.\nPilih **0 role** untuk menghapus semua.',
        'setup1:moderation:protected_roles_select',
        'setup1:moderation:back_to_page',
        10,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Role select menu submissions ──────────────────────────────────────────
    if (action === 'mod_roles_select') {
      await updateSection(session.guildId, 'moderation', {
        moderatorRoles: interaction.values,
      });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'admin_roles_select') {
      await updateSection(session.guildId, 'moderation', {
        adminRoles: interaction.values,
      });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'protected_roles_select') {
      await updateSection(session.guildId, 'moderation', {
        protectedRoles: interaction.values,
      });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Default Reason modal ──────────────────────────────────────────────────
    if (action === 'set_reason') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:moderation:reason')
        .setTitle('Set Default Reason');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Alasan Default')
            .setStyle(TextInputStyle.Short)
            .setValue(mod.defaultReason ?? 'Tidak ada alasan.')
            .setMaxLength(200)
            .setRequired(true),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Back to page ──────────────────────────────────────────────────────────
    if (action === 'back_to_page') {
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }
  },

  async handleModal(interaction, session, cfg, field) {
    if (field === 'reason') {
      const reason = interaction.fields.getTextInputValue('reason').trim();
      await updateSection(session.guildId, 'moderation', { defaultReason: reason });
    }
    await interaction.reply({ content: '✅  Moderation Settings disimpan.', ephemeral: true });
  },
};

export default plugin;
