/**
 * Plugin: 👋 Welcome & Goodbye
 *
 * Setup wizard for configuring welcome and goodbye messages.
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
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateTextChannel, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';
import { buildWelcomeEmbed, buildGoodbyeEmbed } from '../../features/welcome/handler.js';

const plugin = {
  id:                 'welcome',
  label:              'Welcome & Goodbye',
  emoji:              '👋',
  description:        'Pesan sambutan dan perpisahan anggota baru.',
  order:              1,
  requiredPermission: PermissionFlagsBits.ManageGuild,

  getStatus(cfg) {
    return {
      enabled: cfg.welcome.enabled,
      summary: cfg.welcome.channelId ? channelLabel(cfg.welcome.channelId) : 'Channel belum diatur',
    };
  },

  async buildPage(cfg) {
    const w  = cfg.welcome;
    const gb = w.goodbye ?? {};

    const embed = new EmbedBuilder()
      .setColor(w.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '👋  Welcome & Goodbye' })
      .setDescription(`Konfigurasi pesan selamat datang dan selamat tinggal.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',          value: statusDot(w.enabled),                        inline: true },
        { name: '📢  Channel',         value: channelLabel(w.channelId),                   inline: true },
        { name: '\u200B',              value: '\u200B',                                    inline: true },
        // Welcome
        { name: '🟢  Welcome Color',   value: w.embed.color ?? '#5865F2',                  inline: true },
        { name: '🟢  Welcome Judul',   value: w.embed.title || '*Belum diatur*',            inline: true },
        { name: '🟢  Welcome Media',   value: w.gif ? '`GIF`' : w.image ? '`Image`' : '`–`', inline: true },
        // Goodbye
        { name: '🔴  Goodbye Color',   value: gb.embed?.color ?? '#5865F2',                inline: true },
        { name: '🔴  Goodbye Judul',   value: gb.embed?.title || '*Belum diatur*',          inline: true },
        { name: '🔴  Goodbye Media',   value: gb.gif ? '`GIF`' : gb.image ? '`Image`' : '`–`', inline: true },
      )
      .setFooter({ text: 'Gunakan tombol di bawah untuk konfigurasi.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:enable')
        .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
        .setDisabled(w.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:disable')
        .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
        .setDisabled(!w.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_channel')
        .setLabel('Set Channel').setEmoji('📢').setStyle(ButtonStyle.Primary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_embed')
        .setLabel('Welcome Embed').setEmoji('🟢').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_color')
        .setLabel('Welcome Color').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_image')
        .setLabel('Welcome Image').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_gif')
        .setLabel('Welcome GIF').setEmoji('🎞️').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_embed_goodbye')
        .setLabel('Goodbye Embed').setEmoji('🔴').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_color_goodbye')
        .setLabel('Goodbye Color').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_image_goodbye')
        .setLabel('Goodbye Image').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_gif_goodbye')
        .setLabel('Goodbye GIF').setEmoji('🎞️').setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:preview')
        .setLabel('Preview Welcome').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:preview_goodbye')
        .setLabel('Preview Goodbye').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:test')
        .setLabel('Test Welcome').setEmoji('🔬').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:test_goodbye')
        .setLabel('Test Goodbye').setEmoji('🔬').setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, row4, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    // ── Enable / Disable ────────────────────────────────────────────────────
    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'welcome', { enabled: action === 'enable' });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Channel flow ────────────────────────────────────────────────────────
    if (action === 'set_channel') {
      const page = buildChannelSelectPage(
        '📢  Set Welcome Channel',
        'Pilih channel tempat bot akan mengirim pesan welcome & goodbye.',
        'setup1:welcome:ch_select',
        'setup1:welcome:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_select') {
      session.wizardData.pendingChannel = interaction.values[0];
      const page = buildChannelPreviewPage(
        '📢  Welcome Channel — Preview',
        'Channel ini akan digunakan untuk pesan selamat datang & selamat tinggal.',
        interaction.values[0],
        'setup1:welcome:ch_confirm',
        'setup1:welcome:ch_retry',
        'setup1:welcome:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_confirm') {
      const channelId = session.wizardData.pendingChannel;
      if (channelId) {
        const validation = await validateTextChannel(interaction.guild, channelId);
        if (!validation.ok) {
          return interaction.update({
            embeds:     [buildValidationErrorEmbed([validation.reason])],
            components: [buildNavRow()],
          });
        }
        await updateSection(session.guildId, 'welcome', { channelId });
        delete session.wizardData.pendingChannel;
      }
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_retry') {
      delete session.wizardData.pendingChannel;
      const page = buildChannelSelectPage(
        '📢  Set Welcome Channel',
        'Pilih channel tempat bot akan mengirim pesan welcome & goodbye.',
        'setup1:welcome:ch_select',
        'setup1:welcome:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'back_to_page') {
      delete session.wizardData.pendingChannel;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Welcome modals ──────────────────────────────────────────────────────
    if (action === 'set_embed') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:embed')
        .setTitle('Set Welcome Embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Judul Embed')
            .setStyle(TextInputStyle.Short).setValue(cfg.welcome.embed.title ?? '')
            .setMaxLength(256).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Deskripsi Embed')
            .setStyle(TextInputStyle.Paragraph).setValue(cfg.welcome.embed.description ?? '')
            .setMaxLength(1024).setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_color') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:color')
        .setTitle('Set Welcome Embed Color');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color').setLabel('Warna Hex (contoh: #5865F2)')
            .setStyle(TextInputStyle.Short).setValue(cfg.welcome.embed.color ?? '#5865F2')
            .setMinLength(4).setMaxLength(7).setRequired(true),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_image') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:image')
        .setTitle('Set Welcome Image');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('url').setLabel('URL Gambar (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short).setValue(cfg.welcome.image ?? '').setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_gif') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:gif')
        .setTitle('Set Welcome GIF');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('url').setLabel('URL GIF (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short).setValue(cfg.welcome.gif ?? '').setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Goodbye modals ──────────────────────────────────────────────────────
    if (action === 'set_embed_goodbye') {
      const gb = cfg.welcome.goodbye ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:embed_goodbye')
        .setTitle('Set Goodbye Embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Judul Embed')
            .setStyle(TextInputStyle.Short).setValue(gb.embed?.title ?? '')
            .setMaxLength(256).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Deskripsi Embed')
            .setStyle(TextInputStyle.Paragraph).setValue(gb.embed?.description ?? '')
            .setMaxLength(1024).setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_color_goodbye') {
      const gb = cfg.welcome.goodbye ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:color_goodbye')
        .setTitle('Set Goodbye Embed Color');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color').setLabel('Warna Hex (contoh: #5865F2)')
            .setStyle(TextInputStyle.Short).setValue(gb.embed?.color ?? '#5865F2')
            .setMinLength(4).setMaxLength(7).setRequired(true),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_image_goodbye') {
      const gb = cfg.welcome.goodbye ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:image_goodbye')
        .setTitle('Set Goodbye Image');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('url').setLabel('URL Gambar (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short).setValue(gb.image ?? '').setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_gif_goodbye') {
      const gb = cfg.welcome.goodbye ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:gif_goodbye')
        .setTitle('Set Goodbye GIF');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('url').setLabel('URL GIF (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short).setValue(gb.gif ?? '').setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Preview (ephemeral — shows embed without sending to channel) ─────────
    if (action === 'preview') {
      const w = cfg.welcome;
      const rawColor = parseInt((w.embed.color ?? '#5865F2').replace('#', ''), 16);
      const previewEmbed = new EmbedBuilder()
        .setColor(isNaN(rawColor) ? 0x5865F2 : rawColor)
        .setTitle(w.embed.title || 'Selamat Datang, {user}!')
        .setDescription(w.embed.description || '{mention} bergabung ke **{server}**!')
        .setFooter({ text: 'Preview — bukan kiriman nyata' });
      // Gif takes priority over image, consistent with handler
      if (w.gif)        previewEmbed.setImage(w.gif);
      else if (w.image) previewEmbed.setImage(w.image);
      return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
    }

    if (action === 'preview_goodbye') {
      const gb = cfg.welcome.goodbye ?? {};
      const rawColor = parseInt((gb.embed?.color ?? '#5865F2').replace('#', ''), 16);
      const previewEmbed = new EmbedBuilder()
        .setColor(isNaN(rawColor) ? 0x5865F2 : rawColor)
        .setTitle(gb.embed?.title || 'Selamat Tinggal, {user}!')
        .setDescription(gb.embed?.description || '{mention} telah meninggalkan **{server}**.')
        .setFooter({ text: 'Preview — bukan kiriman nyata' });
      if (gb.gif)        previewEmbed.setImage(gb.gif);
      else if (gb.image) previewEmbed.setImage(gb.image);
      return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
    }

    // ── Test (actually sends to the configured channel) ──────────────────────
    if (action === 'test') {
      if (!cfg.welcome.channelId) {
        return interaction.reply({
          content: '⚠️  Atur channel terlebih dahulu sebelum test.',
          ephemeral: true,
        });
      }
      const channel = await interaction.guild.channels
        .fetch(cfg.welcome.channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.reply({
          content: '⚠️  Channel tidak ditemukan atau bukan text channel.',
          ephemeral: true,
        });
      }

      // Use the interaction member as a fake member for preview
      const fakeMember = interaction.member;
      const embed = buildWelcomeEmbed(fakeMember, cfg);
      embed.setFooter({ text: '🔬 Test Welcome — bukan kiriman nyata' });
      await channel.send({ embeds: [embed] });
      return interaction.reply({
        content: `✅  Test welcome dikirim ke <#${cfg.welcome.channelId}>.`,
        ephemeral: true,
      });
    }

    if (action === 'test_goodbye') {
      if (!cfg.welcome.channelId) {
        return interaction.reply({
          content: '⚠️  Atur channel terlebih dahulu sebelum test.',
          ephemeral: true,
        });
      }
      const channel = await interaction.guild.channels
        .fetch(cfg.welcome.channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.reply({
          content: '⚠️  Channel tidak ditemukan atau bukan text channel.',
          ephemeral: true,
        });
      }

      const fakeMember = interaction.member;
      const embed = buildGoodbyeEmbed(fakeMember, cfg);
      embed.setFooter({ text: '🔬 Test Goodbye — bukan kiriman nyata' });
      await channel.send({ embeds: [embed] });
      return interaction.reply({
        content: `✅  Test goodbye dikirim ke <#${cfg.welcome.channelId}>.`,
        ephemeral: true,
      });
    }
  },

  async handleModal(interaction, session, cfg, field) {
    // ── Welcome modals ──────────────────────────────────────────────────────
    if (field === 'embed') {
      const title       = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      await updateSection(session.guildId, 'welcome', {
        embed: { ...cfg.welcome.embed, title, description },
      });
    } else if (field === 'color') {
      const color = interaction.fields.getTextInputValue('color').trim();
      await updateSection(session.guildId, 'welcome', {
        embed: { ...cfg.welcome.embed, color },
      });
    } else if (field === 'image') {
      const url = interaction.fields.getTextInputValue('url').trim() || null;
      await updateSection(session.guildId, 'welcome', { image: url });
    } else if (field === 'gif') {
      const url = interaction.fields.getTextInputValue('url').trim() || null;
      await updateSection(session.guildId, 'welcome', { gif: url });
    }

    // ── Goodbye modals ──────────────────────────────────────────────────────
    else if (field === 'embed_goodbye') {
      const title       = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const existing    = cfg.welcome.goodbye ?? {};
      await updateSection(session.guildId, 'welcome', {
        goodbye: { ...existing, embed: { ...(existing.embed ?? {}), title, description } },
      });
    } else if (field === 'color_goodbye') {
      const color    = interaction.fields.getTextInputValue('color').trim();
      const existing = cfg.welcome.goodbye ?? {};
      await updateSection(session.guildId, 'welcome', {
        goodbye: { ...existing, embed: { ...(existing.embed ?? {}), color } },
      });
    } else if (field === 'image_goodbye') {
      const url      = interaction.fields.getTextInputValue('url').trim() || null;
      const existing = cfg.welcome.goodbye ?? {};
      await updateSection(session.guildId, 'welcome', {
        goodbye: { ...existing, image: url },
      });
    } else if (field === 'gif_goodbye') {
      const url      = interaction.fields.getTextInputValue('url').trim() || null;
      const existing = cfg.welcome.goodbye ?? {};
      await updateSection(session.guildId, 'welcome', {
        goodbye: { ...existing, gif: url },
      });
    }

    await interaction.reply({ content: '✅  Welcome & Goodbye settings disimpan.', ephemeral: true });
  },
};

export default plugin;
