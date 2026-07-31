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
 *   menu
 *   role_manager_select | ch_giveaway | ch_log | role_mention_select
 *   ch_confirm | ch_retry | role_confirm | role_retry | back_to_page
 *   toggle_auto_recovery | toggle_auto_delete
 *   clear_manager_role | clear_log_channel | clear_mention_role
 *   create_gw | gw_dur | gw_win | gw_ch_select
 *   gw_role_mention | gw_skip_mention
 *   gw_role_required | gw_skip_required
 *   gw_preview | gw_confirm | gw_cancel
 *   gw_back_to_dur | gw_back_to_win | gw_back_to_ch | gw_back_to_mention
 *   help
 *
 * Modal ID scheme (prefix 'setup1:modal:giveaway:'):
 *   gw_prize
 *
 * onRecover: delegates to giveaway/manager.js → recoverGiveaways()
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateTextChannel, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';
import { recoverGiveaways, createGiveaway, parseDuration, formatDuration } from '../../features/giveaway/manager.js';

// ---------------------------------------------------------------------------
// Draft helpers (wizard session state)
// ---------------------------------------------------------------------------

const GW_DRAFT = 'gwWizardDraft';
const getDraft  = (s) => s.wizardData[GW_DRAFT] ?? {};
const setDraft  = (s, d) => { s.wizardData[GW_DRAFT] = { ...getDraft(s), ...d }; };
const clearDraft = (s) => { delete s.wizardData[GW_DRAFT]; };

// ---------------------------------------------------------------------------
// Display helpers
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
      .setAuthor({ name: '🎉  Giveaway Settings' })
      .setDescription(`Konfigurasi Giveaway untuk server ini.\n${DIVIDER}`)
      .addFields(
        { name: '👤  Manager Role',    value: roleLabel(gw.managerRoleId),         inline: true },
        { name: '📢  Giveaway Channel', value: channelLabel(gw.channelId),          inline: true },
        { name: '📋  Log Channel',      value: channelLabel(gw.logChannelId),       inline: true },
        { name: '📣  Mention Role',     value: roleLabel(gw.mentionRoleId),         inline: true },
        { name: '🔄  Auto Recovery',    value: toggle(gw.autoRecovery !== false),   inline: true },
        { name: '🗑️  Auto Delete',      value: toggle(gw.autoDelete === true),      inline: true },
      )
      .setFooter({ text: 'Gunakan menu di bawah untuk melakukan konfigurasi.' });

    // Build dynamic dropdown options
    const menuOptions = [
      {
        label:       '🛡️ Manager Role',
        value:       'set_manager_role',
        description: 'Atur role yang bisa mengelola giveaway',
      },
      {
        label:       '📢 Giveaway Channel',
        value:       'set_channel',
        description: 'Atur channel default untuk giveaway',
      },
      {
        label:       '📋 Log Channel',
        value:       'set_log_channel',
        description: 'Atur channel log hasil giveaway',
      },
      {
        label:       '📣 Mention Role',
        value:       'set_mention_role',
        description: 'Atur role yang di-mention saat giveaway dimulai',
      },
      {
        label:       `🔄 Auto Recovery — ${gw.autoRecovery !== false ? 'ON' : 'OFF'}`,
        value:       'toggle_auto_recovery',
        description: 'Timer giveaway dipulihkan otomatis setelah bot restart',
      },
      {
        label:       `🗑️ Auto Delete — ${gw.autoDelete ? 'ON' : 'OFF'}`,
        value:       'toggle_auto_delete',
        description: 'Hapus pesan giveaway otomatis setelah selesai',
      },
      {
        label:       '➕ Buat Giveaway',
        value:       'create_gw',
        description: 'Buat giveaway baru langsung dari sini',
      },
      {
        label:       '📖 Bantuan Giveaway',
        value:       'help',
        description: 'Lihat penjelasan singkat sistem Giveaway',
      },
    ];

    // Append clear options only when values are set
    if (gw.managerRoleId) {
      menuOptions.push({
        label:       '❌ Hapus Manager Role',
        value:       'clear_manager_role',
        description: 'Hapus konfigurasi Manager Role',
      });
    }
    if (gw.logChannelId) {
      menuOptions.push({
        label:       '❌ Hapus Log Channel',
        value:       'clear_log_channel',
        description: 'Hapus konfigurasi Log Channel',
      });
    }
    if (gw.mentionRoleId) {
      menuOptions.push({
        label:       '❌ Hapus Mention Role',
        value:       'clear_mention_role',
        description: 'Hapus konfigurasi Mention Role',
      });
    }

    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('setup1:giveaway:menu')
      .setPlaceholder('⚙️ Pilih pengaturan Giveaway...')
      .addOptions(menuOptions);

    const menuRow = new ActionRowBuilder().addComponents(dropdown);

    return { embed, components: [menuRow, buildNavRow()] };
  },

  // ── Interaction handler ───────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {
    const reload = () => loadGuildConfig(session.guildId);
    const gw     = cfg.giveaway ?? {};

    // ── Dropdown dispatcher ──────────────────────────────────────────────────
    if (action === 'menu') {
      const sub = interaction.values[0];
      return plugin.handleInteraction(interaction, session, cfg, sub);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SETTINGS
    // ────────────────────────────────────────────────────────────────────────

    // ── Manager Role ─────────────────────────────────────────────────────────
    if (action === 'set_manager_role') {
      const page = buildRoleSelectPage(
        '🛡️  Set Giveaway Manager Role',
        'Pilih role yang bisa mengelola giveaway (`!gcreate`, `!gend`, dll).\nOwner server selalu punya akses terlepas dari role ini.',
        'setup1:giveaway:role_manager_select',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'role_manager_select') {
      const roleId = interaction.values[0] ?? null;
      if (roleId) await updateSection(session.guildId, 'giveaway', { managerRoleId: roleId });
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

    // ── Mention Role ──────────────────────────────────────────────────────────
    if (action === 'set_mention_role') {
      const page = buildRoleSelectPage(
        '📣  Set Mention Role',
        'Pilih role yang akan di-mention saat giveaway baru dibuat (opsional).',
        'setup1:giveaway:role_mention_select',
        'setup1:giveaway:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'role_mention_select') {
      const roleId = interaction.values[0] ?? null;
      if (roleId) await updateSection(session.guildId, 'giveaway', { mentionRoleId: roleId });
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

    // ── Giveaway Channel ──────────────────────────────────────────────────────
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

    // ── Log Channel ───────────────────────────────────────────────────────────
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

    // ── Channel confirm / retry ───────────────────────────────────────────────
    if (action === 'ch_confirm') {
      const channelId    = session.wizardData.pendingChannel;
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

    // ── Toggles ───────────────────────────────────────────────────────────────
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

    // ── Back to page ──────────────────────────────────────────────────────────
    if (action === 'back_to_page') {
      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelAction;
      delete session.wizardData.pendingRoleAction;
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ────────────────────────────────────────────────────────────────────────
    // HELP
    // ────────────────────────────────────────────────────────────────────────

    if (action === 'help') {
      const embed = new EmbedBuilder()
        .setColor(Colors.INFO ?? 0x5865F2)
        .setAuthor({ name: '📖  Bantuan Giveaway' })
        .setDescription(
          `Sistem giveaway interaktif dengan panel Join/Peserta/Info.\n${DIVIDER}`
        )
        .addFields(
          {
            name: '📌  Cara Membuat Giveaway',
            value:
              'Pilih **➕ Buat Giveaway** dari menu ini, atau gunakan:\n' +
              '`!gcreate <durasi> <pemenang> <hadiah>`\n' +
              '`/giveaway create`',
            inline: false,
          },
          {
            name: '⏹️  Mengakhiri Giveaway',
            value: '`!gend <messageId>`  atau  `/giveaway end`',
            inline: true,
          },
          {
            name: '🔄  Reroll Pemenang',
            value: '`!greroll <messageId>`  atau  `/giveaway reroll`',
            inline: true,
          },
          {
            name: '❌  Batalkan Giveaway',
            value: '`!gcancel <messageId>`  atau  `/giveaway cancel`',
            inline: true,
          },
          {
            name: '📋  Daftar Giveaway',
            value: '`!glist`  atau  `/giveaway list`',
            inline: true,
          },
          {
            name: '🔒  Siapa yang Bisa Mengelola?',
            value: 'Owner server & user yang punya **Manager Role** yang sudah dikonfigurasi.',
            inline: false,
          },
          {
            name: '⏱️  Format Durasi',
            value: '`10m` `30m` `1h` `2h` `6h` `12h` `1d` `2d` `7d`',
            inline: false,
          },
        )
        .setFooter({ text: 'Kembali ke pengaturan dengan tombol Back.' });

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:giveaway:back_to_page')
          .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup1:nav:home')
          .setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // ────────────────────────────────────────────────────────────────────────
    // CREATE GIVEAWAY WIZARD
    // ────────────────────────────────────────────────────────────────────────

    if (action === 'create_gw') {
      clearDraft(session);
      const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');

      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:giveaway:gw_prize')
        .setTitle('🎉 Buat Giveaway — Langkah 1/4');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('prize')
            .setLabel('Hadiah')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Contoh: Nitro 1 Bulan, Steam Gift Card, dll.')
            .setMaxLength(200)
            .setRequired(true),
        ),
      );

      return interaction.showModal(modal);
    }

    // ── Step 2: Duration select (after modal submit, routed from handleModal) ─
    if (action === 'gw_step_dur') {
      return showDurationStep(interaction, session);
    }

    // ── Step 3: Winner count (after duration selected) ─────────────────────
    if (action === 'gw_dur') {
      const val = interaction.values[0];

      // Custom duration — open modal for free-text input
      if (val === '__custom__') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('setup1:modal:giveaway:gw_dur_custom')
          .setTitle('⏱️ Custom Durasi Giveaway');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('custom_duration')
              .setLabel('Durasi (angka + m/h/d)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Contoh: 45m · 90m · 3h · 5d  (min 1m, maks 7d)')
              .setMaxLength(10)
              .setRequired(true),
          ),
        );
        return interaction.showModal(modal);
      }

      const ms = parseDuration(val);
      if (!ms) {
        return interaction.update({
          embeds: [buildErrorEmbed('Durasi tidak valid. Silakan pilih ulang.')],
          components: [buildWizardCancelRow()],
        });
      }
      setDraft(session, { durationMs: ms, durationLabel: val });
      return showWinnerStep(interaction, session);
    }

    // ── Step 4: Channel select (after winner count selected) ────────────────
    if (action === 'gw_win') {
      const count = parseInt(interaction.values[0], 10);
      setDraft(session, { winnerCount: count });
      return showChannelStep(interaction, session, cfg);
    }

    // ── Step 5: Mention Role — optional (after channel selected) ───────────
    if (action === 'gw_ch_select') {
      const channelId = interaction.values[0];
      const validation = await validateTextChannel(interaction.guild, channelId);
      if (!validation.ok) {
        return interaction.update({
          embeds:     [buildValidationErrorEmbed([validation.reason])],
          components: [buildWizardBackRow('gw_back_to_ch')],
        });
      }
      setDraft(session, { channelId });
      return showMentionRoleStep(interaction, session, cfg);
    }

    // ── Step 6: Required Role — optional (after mention role chosen/skipped) ─
    if (action === 'gw_role_mention') {
      const roleId = interaction.values[0] ?? null;
      setDraft(session, { mentionRoleId: roleId });
      return showRequiredRoleStep(interaction, session);
    }

    if (action === 'gw_skip_mention') {
      setDraft(session, { mentionRoleId: null });
      return showRequiredRoleStep(interaction, session);
    }

    // ── Step 7: Preview (after required role chosen/skipped) ────────────────
    if (action === 'gw_role_required') {
      const roleId = interaction.values[0] ?? null;
      setDraft(session, { requiredRoleId: roleId });
      return showWizardPreview(interaction, session);
    }

    if (action === 'gw_skip_required') {
      setDraft(session, { requiredRoleId: null });
      return showWizardPreview(interaction, session);
    }

    if (action === 'gw_preview') {
      return showWizardPreview(interaction, session);
    }

    // ── Back navigation inside wizard ───────────────────────────────────────
    if (action === 'gw_back_to_dur') {
      return showDurationStep(interaction, session);
    }

    if (action === 'gw_back_to_win') {
      return showWinnerStep(interaction, session);
    }

    if (action === 'gw_back_to_ch') {
      return showChannelStep(interaction, session, cfg);
    }

    if (action === 'gw_back_to_mention') {
      return showMentionRoleStep(interaction, session, cfg);
    }

    // ── Step 8: Publish ──────────────────────────────────────────────────────
    if (action === 'gw_confirm') {
      const draft = getDraft(session);

      if (!draft.prize || !draft.durationMs || !draft.channelId) {
        return interaction.update({
          embeds: [buildErrorEmbed('Data wizard tidak lengkap. Mulai ulang dari menu.')],
          components: [buildWizardCancelRow()],
        });
      }

      // Defer update to avoid timeout on createGiveaway
      await interaction.deferUpdate();

      try {
        await createGiveaway(interaction.client, {
          guildId:       session.guildId,
          channelId:     draft.channelId,
          hostId:        interaction.user.id,
          prize:         draft.prize,
          durationMs:    draft.durationMs,
          winnerCount:   draft.winnerCount ?? 1,
          requiredRoleId: draft.requiredRoleId ?? null,
          mentionRoleId:  draft.mentionRoleId  ?? null,
        });

        clearDraft(session);

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS ?? 0x57F287)
          .setTitle('🎉  Giveaway Berhasil Dibuat!')
          .setDescription(
            `**${draft.prize}** telah dipublikasikan ke ${channelLabel(draft.channelId)}.\n${DIVIDER}` +
            `\n🏆 Pemenang: **${draft.winnerCount ?? 1}** orang` +
            `\n⏱️ Durasi: **${formatDuration(draft.durationMs)}**` +
            (draft.mentionRoleId  ? `\n📣 Mention: <@&${draft.mentionRoleId}>` : '') +
            (draft.requiredRoleId ? `\n🔒 Role wajib: <@&${draft.requiredRoleId}>` : '')
          )
          .setFooter({ text: 'Gunakan !gend / !gcancel untuk mengelola giveaway.' });

        const doneRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('setup1:giveaway:back_to_page')
            .setLabel('Kembali ke Pengaturan').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('setup1:nav:home')
            .setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
        );

        return interaction.editReply({ embeds: [embed], components: [doneRow] });
      } catch (err) {
        const errEmbed = buildErrorEmbed(`Gagal membuat giveaway: ${err.message}`);
        return interaction.editReply({
          embeds:     [errEmbed],
          components: [buildWizardCancelRow()],
        });
      }
    }

    // ── Cancel wizard ─────────────────────────────────────────────────────────
    if (action === 'gw_cancel') {
      clearDraft(session);
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }
  },

  // ── Modal handler ─────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {
    // Step 1 result: prize entered
    if (field === 'gw_prize') {
      const prize = interaction.fields.getTextInputValue('prize').trim();
      if (!prize) {
        return interaction.reply({ content: '❌ Hadiah tidak boleh kosong.', ephemeral: true });
      }
      setDraft(session, { prize });
      return showDurationStep(interaction, session);
    }

    // Step 2b result: custom duration entered
    if (field === 'gw_dur_custom') {
      const raw = interaction.fields.getTextInputValue('custom_duration').trim();
      const ms  = parseDuration(raw);
      if (!ms) {
        return interaction.reply({
          content:
            `❌ Durasi \`${raw}\` tidak valid.\n\n` +
            `Format: angka + \`m\` (menit), \`h\` (jam), atau \`d\` (hari).\n` +
            `Contoh: \`45m\` · \`90m\` · \`3h\` · \`5d\`\n` +
            `Min: **1 menit** · Maks: **7 hari**`,
          ephemeral: true,
        });
      }
      setDraft(session, { durationMs: ms, durationLabel: raw });
      return showWinnerStep(interaction, session);
    }
  },

  // ── Auto-recovery hook ────────────────────────────────────────────────────

  async onRecover(guild, cfg) {
    await recoverGiveaways(guild.client, guild, cfg);
  },
};

// ---------------------------------------------------------------------------
// Wizard step builders
// ---------------------------------------------------------------------------

function showDurationStep(interaction, session) {
  const draft = getDraft(session);

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK ?? 0x2B2D31)
    .setAuthor({ name: '🎉 Buat Giveaway — Langkah 2/7: Durasi' })
    .setDescription(
      `**Hadiah:** ${draft.prize}\n${DIVIDER}\nPilih berapa lama giveaway berlangsung.\n` +
      `Pilih **✏️ Custom...** untuk memasukkan menit bebas (min 1m, maks 7d).`
    );

  const options = [
    { label: '1 Menit',   value: '1m',       description: 'Cocok untuk tes cepat'       },
    { label: '5 Menit',   value: '5m'                                                    },
    { label: '10 Menit',  value: '10m'                                                   },
    { label: '15 Menit',  value: '15m'                                                   },
    { label: '30 Menit',  value: '30m'                                                   },
    { label: '1 Jam',     value: '1h'                                                    },
    { label: '2 Jam',     value: '2h'                                                    },
    { label: '6 Jam',     value: '6h'                                                    },
    { label: '12 Jam',    value: '12h'                                                   },
    { label: '1 Hari',    value: '1d'                                                    },
    { label: '2 Hari',    value: '2d'                                                    },
    { label: '7 Hari',    value: '7d'                                                    },
    { label: '✏️ Custom...', value: '__custom__', description: 'Ketik durasi bebas, contoh: 45m, 3h, 5d' },
  ];

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup1:giveaway:gw_dur')
    .setPlaceholder('Pilih durasi giveaway...')
    .addOptions(options);

  return (interaction.deferred || interaction.replied ? interaction.editReply : interaction.update).call(interaction, {
    embeds:     [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      buildWizardCancelRow(),
    ],
  });
}

function showWinnerStep(interaction, session) {
  const draft = getDraft(session);

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK ?? 0x2B2D31)
    .setAuthor({ name: '🎉 Buat Giveaway — Langkah 3/7: Jumlah Pemenang' })
    .setDescription(
      `**Hadiah:** ${draft.prize}\n**Durasi:** ${formatDuration(draft.durationMs)}\n${DIVIDER}\n` +
      `Pilih jumlah pemenang.`
    );

  const options = [1, 2, 3, 4, 5, 10, 15, 20].map((n) => {
    const opt = { label: `${n} Pemenang`, value: String(n) };
    if (n === 1) opt.description = 'Default';
    return opt;
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup1:giveaway:gw_win')
    .setPlaceholder('Pilih jumlah pemenang...')
    .addOptions(options);

  return interaction.update({
    embeds:     [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      buildWizardBackRow('gw_back_to_dur'),
    ],
  });
}

function showChannelStep(interaction, session, cfg) {
  const draft   = getDraft(session);
  const gwChId  = cfg.giveaway?.channelId;

  const desc =
    `**Hadiah:** ${draft.prize}\n**Durasi:** ${formatDuration(draft.durationMs)}\n` +
    `**Pemenang:** ${draft.winnerCount}\n${DIVIDER}\n` +
    `Pilih channel tempat giveaway akan dikirim.` +
    (gwChId ? `\nChannel default: ${channelLabel(gwChId)}` : '');

  const page = buildChannelSelectPage(
    '🎉 Buat Giveaway — Langkah 4/7: Channel',
    desc,
    'setup1:giveaway:gw_ch_select',
    'setup1:giveaway:gw_back_to_win',
  );

  return interaction.update({ embeds: [page.embed], components: page.components });
}

function showMentionRoleStep(interaction, session, cfg) {
  const draft      = getDraft(session);
  const defaultRoleId = cfg.giveaway?.mentionRoleId;

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK ?? 0x2B2D31)
    .setAuthor({ name: '🎉 Buat Giveaway — Langkah 5/7: Mention Role (Opsional)' })
    .setDescription(
      `**Hadiah:** ${draft.prize}\n**Channel:** ${channelLabel(draft.channelId)}\n${DIVIDER}\n` +
      `Pilih role yang akan di-mention saat giveaway ini dimulai.\n` +
      (defaultRoleId
        ? `Role default server: <@&${defaultRoleId}> — tekan **Gunakan Default** untuk memakainya.`
        : 'Tekan **Lewati** jika tidak ingin mention role apa pun.')
    );

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId('setup1:giveaway:gw_role_mention')
    .setPlaceholder('Pilih mention role...')
    .setMinValues(1)
    .setMaxValues(1);

  const btns = [
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_skip_mention')
      .setLabel('Lewati').setEmoji('⏩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_back_to_ch')
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_cancel')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  ];

  return interaction.update({
    embeds:     [embed],
    components: [
      new ActionRowBuilder().addComponents(roleMenu),
      new ActionRowBuilder().addComponents(...btns),
    ],
  });
}

function showRequiredRoleStep(interaction, session) {
  const draft = getDraft(session);

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK ?? 0x2B2D31)
    .setAuthor({ name: '🎉 Buat Giveaway — Langkah 6/7: Role Wajib (Opsional)' })
    .setDescription(
      `**Hadiah:** ${draft.prize}\n${DIVIDER}\n` +
      `Pilih role yang **wajib dimiliki** user untuk bisa ikut giveaway.\n` +
      `Tekan **Lewati** jika tidak ada syarat role.`
    );

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId('setup1:giveaway:gw_role_required')
    .setPlaceholder('Pilih role wajib...')
    .setMinValues(1)
    .setMaxValues(1);

  const btns = [
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_skip_required')
      .setLabel('Lewati').setEmoji('⏩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_back_to_mention')
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_cancel')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  ];

  return interaction.update({
    embeds:     [embed],
    components: [
      new ActionRowBuilder().addComponents(roleMenu),
      new ActionRowBuilder().addComponents(...btns),
    ],
  });
}

function showWizardPreview(interaction, session) {
  const draft = getDraft(session);

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setAuthor({ name: '🎉 Buat Giveaway — Langkah 7/7: Preview' })
    .setDescription(`Periksa detail giveaway sebelum dipublikasikan.\n${DIVIDER}`)
    .addFields(
      { name: '🎁  Hadiah',      value: `**${draft.prize}**`,                                  inline: false },
      { name: '⏱️  Durasi',      value: formatDuration(draft.durationMs),                      inline: true  },
      { name: '🏆  Pemenang',    value: `**${draft.winnerCount ?? 1}** orang`,                 inline: true  },
      { name: '📢  Channel',     value: channelLabel(draft.channelId),                          inline: true  },
      { name: '📣  Mention Role',  value: draft.mentionRoleId  ? `<@&${draft.mentionRoleId}>`  : '—', inline: true },
      { name: '🔒  Role Wajib',  value: draft.requiredRoleId ? `<@&${draft.requiredRoleId}>` : '—', inline: true },
    )
    .setFooter({ text: 'Tekan Publish untuk membuat giveaway.' });

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_confirm')
      .setLabel('Publish Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_back_to_mention')
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_cancel')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return interaction.update({ embeds: [embed], components: [actionRow] });
}

// ---------------------------------------------------------------------------
// Local helper: role select page
// ---------------------------------------------------------------------------

function buildRoleSelectPage(title, description, customId, backId) {
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

// ---------------------------------------------------------------------------
// Local helpers: wizard navigation rows
// ---------------------------------------------------------------------------

/**
 * Row with a Back button AND a Cancel button.
 * backActionId MUST NOT be 'gw_cancel' — that would produce duplicate custom IDs.
 * For steps where there is no valid "back" target, use buildWizardCancelRow() instead.
 */
function buildWizardBackRow(backActionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup1:giveaway:${backActionId}`)
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_cancel')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );
}

/**
 * Row with only a Cancel button.
 * Use this when there is no valid "back" step (e.g. step 2 after the modal,
 * or error states where the only recovery is to restart the wizard).
 */
function buildWizardCancelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:giveaway:gw_cancel')
      .setLabel('Batal / Kembali ke Menu').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );
}

// ---------------------------------------------------------------------------
// Local helper: error embed
// ---------------------------------------------------------------------------

function buildErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(Colors.ERROR ?? 0xED4245)
    .setTitle('❌  Terjadi Kesalahan')
    .setDescription(message);
}

export default plugin;
