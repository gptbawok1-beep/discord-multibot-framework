/**
 * Plugin: 📨 Invite Tracker
 *
 * Full setup wizard for the Invite Tracker feature.
 * Supports: Enable/Disable, Log Channel, Join Notification Channel,
 * Embed customisation, Statistics view, Stats reset, and Test.
 *
 * Config section: cfg.invite
 * Stats storage:  bots/bot1/data/invite-stats/<guildId>.json
 *
 * Required permission: Manage Guild
 *
 * Custom ID scheme (all prefixed with 'setup1:invite:'):
 *   enable | disable
 *   set_log_channel | set_join_channel
 *   ch_log | ch_join                (channel-select menus)
 *   ch_confirm | ch_retry | back_to_page
 *   edit_embed | edit_style         (open modals)
 *   view_stats | reset_stats | reset_confirm
 *   test
 *
 * Modal IDs:
 *   setup1:modal:invite:embed       (title, description, footer)
 *   setup1:modal:invite:style       (color, thumbnail, image, gif)
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateTextChannel, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';
import { getTopInviters, resetStats } from '../../features/inviteTracker/stats.js';
import { recoverGuild, buildTestEmbed } from '../../features/inviteTracker/handler.js';

// ── Channel target metadata ───────────────────────────────────────────────────

const CHANNEL_TARGETS = {
  set_log_channel: {
    menuId:       'setup1:invite:ch_log',
    configKey:    'logChannelId',
    title:        '📋  Set Log Channel',
    desc:         'Pilih channel untuk log notifikasi saat member bergabung.',
    previewLabel: 'Log Channel',
  },
  set_join_channel: {
    menuId:       'setup1:invite:ch_join',
    configKey:    'joinChannelId',
    title:        '📢  Set Join Notification Channel',
    desc:         'Pilih channel untuk notifikasi join (opsional, boleh sama dengan Log Channel).',
    previewLabel: 'Join Notification Channel',
  },
};

// Reverse: ch_* action → set_* key
const CH_ACTION_MAP = {
  ch_log:  'set_log_channel',
  ch_join: 'set_join_channel',
};

// ── Plugin definition ─────────────────────────────────────────────────────────

const plugin = {
  id:                 'invite',
  label:              'Invite Tracker',
  emoji:              '📨',
  description:        'Lacak siapa yang mengundang member baru ke server.',
  order:              3,
  requiredPermission: PermissionFlagsBits.ManageGuild,

  // ── Status (shown on main wizard page) ───────────────────────────────────

  getStatus(cfg) {
    const inv = cfg.invite ?? {};
    return {
      enabled: inv.enabled ?? false,
      summary: inv.logChannelId
        ? channelLabel(inv.logChannelId)
        : 'Channel belum diatur',
    };
  },

  // ── Main plugin page ──────────────────────────────────────────────────────

  async buildPage(cfg) {
    const inv = cfg.invite ?? {};
    const embedCfg = inv.embed ?? {};

    const embed = new EmbedBuilder()
      .setColor(inv.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '📨  Invite Tracker' })
      .setDescription(`Lacak undangan dan catat siapa yang mengundang member baru.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',            value: statusDot(inv.enabled ?? false),           inline: true },
        { name: '📋  Log Channel',        value: channelLabel(inv.logChannelId),             inline: true },
        { name: '📢  Join Channel',       value: channelLabel(inv.joinChannelId),            inline: true },
        { name: '🎨  Embed Color',        value: embedCfg.color   ?? '#5865F2',             inline: true },
        { name: '📝  Embed Judul',        value: embedCfg.title   ? `\`${embedCfg.title.slice(0, 40)}\`` : '*Default*', inline: true },
        { name: '🖼️  Thumbnail/Image',   value: (embedCfg.thumbnail || embedCfg.image || embedCfg.gif) ? '`Tersimpan`' : '`Default`', inline: true },
      )
      .setFooter({ text: 'Gunakan tombol di bawah untuk konfigurasi.' });

    // Row 1: Enable / Disable
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:enable')
        .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
        .setDisabled(inv.enabled ?? false),
      new ButtonBuilder()
        .setCustomId('setup1:invite:disable')
        .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
        .setDisabled(!(inv.enabled ?? false)),
    );

    // Row 2: Channel settings
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:set_log_channel')
        .setLabel('Set Log Channel').setEmoji('📋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:set_join_channel')
        .setLabel('Set Join Channel').setEmoji('📢').setStyle(ButtonStyle.Primary),
    );

    // Row 3: Embed / Stats / Test
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:edit_embed')
        .setLabel('Edit Embed').setEmoji('📝').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:edit_style')
        .setLabel('Edit Style').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:view_stats')
        .setLabel('Lihat Statistik').setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:reset_stats')
        .setLabel('Reset Statistik').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('setup1:invite:test')
        .setLabel('Test').setEmoji('🔬').setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  // ── Interaction handler ───────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {
    const reload = () => loadGuildConfig(session.guildId);

    // ── Enable / Disable ────────────────────────────────────────────────────
    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'invite', { enabled: action === 'enable' });
      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Open channel select pages ───────────────────────────────────────────
    if (CHANNEL_TARGETS[action]) {
      const { menuId, title, desc } = CHANNEL_TARGETS[action];
      session.wizardData.pendingChannelAction = action;
      const page = buildChannelSelectPage(title, desc, menuId, 'setup1:invite:back_to_page');
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Channel selected → preview ──────────────────────────────────────────
    if (CH_ACTION_MAP[action]) {
      const target = CHANNEL_TARGETS[CH_ACTION_MAP[action]];
      session.wizardData.pendingChannel       = interaction.values[0];
      session.wizardData.pendingChannelAction = CH_ACTION_MAP[action];
      const page = buildChannelPreviewPage(
        `📨  Invite Tracker — ${target.previewLabel} Preview`,
        target.desc,
        interaction.values[0],
        'setup1:invite:ch_confirm',
        'setup1:invite:ch_retry',
        'setup1:invite:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Confirm channel selection ───────────────────────────────────────────
    if (action === 'ch_confirm') {
      const channelId  = session.wizardData.pendingChannel;
      const targetData = CHANNEL_TARGETS[session.wizardData.pendingChannelAction];

      if (channelId && targetData) {
        const validation = await validateTextChannel(interaction.guild, channelId);
        if (!validation.ok) {
          return interaction.update({
            embeds:     [buildValidationErrorEmbed([validation.reason])],
            components: [buildNavRow()],
          });
        }
        await updateSection(session.guildId, 'invite', { [targetData.configKey]: channelId });
      }

      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelAction;

      const fresh = await reload();
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Retry channel selection ─────────────────────────────────────────────
    if (action === 'ch_retry') {
      const tgt = CHANNEL_TARGETS[session.wizardData.pendingChannelAction];
      delete session.wizardData.pendingChannel;
      if (tgt) {
        const page = buildChannelSelectPage(tgt.title, tgt.desc, tgt.menuId, 'setup1:invite:back_to_page');
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
    }

    // ── Back to main plugin page ────────────────────────────────────────────
    if (action === 'back_to_page') {
      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelAction;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Edit embed (text content) ───────────────────────────────────────────
    if (action === 'edit_embed') {
      const embedCfg = cfg.invite?.embed ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:invite:embed')
        .setTitle('Edit Invite Embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Judul Embed')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.title ?? '')
            .setMaxLength(256)
            .setPlaceholder('👋 {user} bergabung ke {server}!')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Deskripsi Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(embedCfg.description ?? '')
            .setMaxLength(1024)
            .setPlaceholder('Diundang oleh **{inviter}** menggunakan kode `{inviteCode}`.')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer Embed')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.footer ?? '')
            .setMaxLength(128)
            .setPlaceholder('Invite Tracker')
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Edit embed style ────────────────────────────────────────────────────
    if (action === 'edit_style') {
      const embedCfg = cfg.invite?.embed ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:invite:style')
        .setTitle('Edit Invite Embed Style');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Warna Hex (contoh: #5865F2)')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.color ?? '#5865F2')
            .setMinLength(4)
            .setMaxLength(7)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel('URL Thumbnail (kosong = avatar member)')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.thumbnail ?? '')
            .setMaxLength(512)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('URL Gambar (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.image ?? '')
            .setMaxLength(512)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gif')
            .setLabel('URL GIF (menimpa Image jika diisi)')
            .setStyle(TextInputStyle.Short)
            .setValue(embedCfg.gif ?? '')
            .setMaxLength(512)
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── View statistics ─────────────────────────────────────────────────────
    if (action === 'view_stats') {
      const top = await getTopInviters(session.guildId, 10);

      const statsEmbed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setAuthor({ name: '📊  Invite Tracker — Statistik' })
        .setDescription(`Statistik invite untuk server ini.\n${DIVIDER}`)
        .setTimestamp();

      if (top.length === 0) {
        statsEmbed.addFields({ name: 'ℹ️  Belum ada data', value: 'Belum ada invite yang tercatat.', inline: false });
      } else {
        const lines = top.map((entry, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} <@${entry.userId}> — **${entry.net}** net (Total: ${entry.total} | Fake: ${entry.fake} | Pergi: ${entry.left} | Rejoin: ${entry.rejoin})`;
        });
        statsEmbed.addFields({ name: '🏆  Top Inviters', value: lines.join('\n').slice(0, 1024), inline: false });
      }

      return interaction.reply({ embeds: [statsEmbed], ephemeral: true });
    }

    // ── Reset stats (confirmation page) ────────────────────────────────────
    if (action === 'reset_stats') {
      const confirmEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('⚠️  Reset Statistik Invite?')
        .setDescription(
          `Semua statistik invite untuk server ini akan dihapus permanen.\n${DIVIDER}\n` +
          `**Tindakan ini tidak dapat dibatalkan.**\n` +
          `Konfigurasi channel dan embed tidak akan terpengaruh.`
        );

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:invite:reset_confirm')
          .setLabel('Ya, Reset Statistik')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('setup1:invite:back_to_page')
          .setLabel('Batal')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    // ── Confirm stats reset ─────────────────────────────────────────────────
    if (action === 'reset_confirm') {
      await resetStats(session.guildId);

      const page = await plugin.buildPage(cfg);
      // Add a notice banner to the embed description
      const updatedEmbed = EmbedBuilder.from(page.embed)
        .setDescription(`✅  **Statistik berhasil direset.**\n\n${page.embed.data.description}`);

      return interaction.update({ embeds: [updatedEmbed], components: page.components });
    }

    // ── Test (simulate invite notification) ────────────────────────────────
    if (action === 'test') {
      const inv = cfg.invite ?? {};

      const testEmbed = buildTestEmbed(cfg, interaction.guild, interaction.user);

      // If a channel is configured, offer to send there; otherwise ephemeral preview only
      const logChannelId = inv.logChannelId;

      let content = '🔬  **Invite Tracker Test** — Ini adalah simulasi notifikasi invite.';

      if (logChannelId) {
        try {
          const channel = interaction.guild.channels.cache.get(logChannelId)
            ?? await interaction.guild.channels.fetch(logChannelId).catch(() => null);
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [testEmbed] });
            content += `\n\n✅  Notifikasi test dikirim ke <#${logChannelId}>.`;
          } else {
            content += `\n\n⚠️  Channel log <#${logChannelId}> tidak ditemukan atau tidak dapat diakses.`;
          }
        } catch (err) {
          content += `\n\n❌  Gagal mengirim ke channel: ${err.message}`;
        }
      } else {
        content += '\n\n_Atur Log Channel terlebih dahulu untuk mengirim notifikasi ke channel._';
      }

      return interaction.reply({
        content,
        embeds:    [testEmbed],
        ephemeral: true,
      });
    }
  },

  // ── Modal handler ─────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {
    const embedCfg = cfg.invite?.embed ?? {};

    if (field === 'embed') {
      const title       = interaction.fields.getTextInputValue('title').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const footer      = interaction.fields.getTextInputValue('footer').trim();
      await updateSection(session.guildId, 'invite', {
        embed: {
          ...embedCfg,
          title:       title       || null,
          description: description || null,
          footer:      footer      || null,
        },
      });
      return interaction.reply({ content: '✅  Embed teks berhasil disimpan.', ephemeral: true });
    }

    if (field === 'style') {
      const color     = interaction.fields.getTextInputValue('color').trim();
      const thumbnail = interaction.fields.getTextInputValue('thumbnail').trim();
      const image     = interaction.fields.getTextInputValue('image').trim();
      const gif       = interaction.fields.getTextInputValue('gif').trim();

      // Basic hex color validation
      const validColor = /^#[0-9A-Fa-f]{3,6}$/.test(color) ? color : embedCfg.color;

      await updateSection(session.guildId, 'invite', {
        embed: {
          ...embedCfg,
          color:     validColor  || '#5865F2',
          thumbnail: thumbnail   || null,
          image:     image       || null,
          gif:       gif         || null,
        },
      });
      return interaction.reply({ content: '✅  Embed style berhasil disimpan.', ephemeral: true });
    }
  },

  // ── Auto-recovery hook ────────────────────────────────────────────────────

  /**
   * Called by the Recovery Manager on bot startup for each guild.
   * Loads the invite cache so tracking is ready immediately.
   *
   * @param {import('discord.js').Guild} guild
   * @param {object} cfg  - Guild config
   */
  async onRecover(guild, cfg) {
    await recoverGuild(guild, cfg);
  },
};

export default plugin;
