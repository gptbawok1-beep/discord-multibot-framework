/**
 * Plugin: 👋 Welcome & Goodbye
 *
 * Setup wizard for configuring welcome and goodbye messages.
 * The actual sending of welcome messages is NOT implemented here
 * (foundation only — ready to be connected in a future phase).
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';

const plugin = {
  id: 'welcome',
  label: 'Welcome & Goodbye',
  emoji: '👋',
  description: 'Pesan sambutan dan perpisahan anggota baru.',

  getStatus(cfg) {
    return {
      enabled: cfg.welcome.enabled,
      summary: cfg.welcome.channelId ? channelLabel(cfg.welcome.channelId) : 'Channel belum diatur',
    };
  },

  async buildPage(cfg) {
    const w = cfg.welcome;
    const embed = new EmbedBuilder()
      .setColor(w.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '👋  Welcome & Goodbye' })
      .setDescription(`Konfigurasi pesan selamat datang dan selamat tinggal.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',   value: statusDot(w.enabled),           inline: true },
        { name: '📢  Channel',  value: channelLabel(w.channelId),       inline: true },
        { name: '🎨  Color',    value: w.embed.color ?? '#5865F2',       inline: true },
        { name: '📝  Judul',    value: w.embed.title || '*Belum diatur*', inline: true },
        { name: '🖼️  Image',    value: w.image ? '`Tersimpan`' : '`Belum diatur`', inline: true },
        { name: '🎞️  GIF',      value: w.gif   ? '`Tersimpan`' : '`Belum diatur`', inline: true },
      )
      .setFooter({ text: 'Gunakan tombol di bawah untuk konfigurasi.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:enable')
        .setLabel('Enable')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success)
        .setDisabled(w.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:disable')
        .setLabel('Disable')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!w.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_channel')
        .setLabel('Set Channel')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_embed')
        .setLabel('Set Embed')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_color')
        .setLabel('Set Color')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_image')
        .setLabel('Set Image URL')
        .setEmoji('🖼️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:set_gif')
        .setLabel('Set GIF URL')
        .setEmoji('🎞️')
        .setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:welcome:preview')
        .setLabel('Preview')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:welcome:test')
        .setLabel('Test')
        .setEmoji('🔬')
        .setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    if (action === 'enable') {
      await updateSection(session.guildId, 'welcome', { enabled: true });
      const fresh = await loadGuildConfig(session.guildId);
      const page = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'disable') {
      await updateSection(session.guildId, 'welcome', { enabled: false });
      const fresh = await loadGuildConfig(session.guildId);
      const page = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'set_channel') {
      const page = buildChannelSelectPage(
        '📢  Set Welcome Channel',
        'Pilih channel tempat bot akan mengirim pesan welcome/goodbye.',
        'setup1:welcome:ch_select',
        'setup1:welcome:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_select') {
      // Stage the selected channel — don't save yet; show preview first
      session.wizardData.pendingChannel = interaction.values[0];
      const page = buildChannelPreviewPage(
        '📢  Welcome Channel — Preview',
        'Channel ini akan digunakan untuk mengirim pesan selamat datang & selamat tinggal.',
        interaction.values[0],
        'setup1:welcome:ch_confirm',
        'setup1:welcome:ch_retry',
        'setup1:welcome:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // User confirmed the channel selection → now save to config
    if (action === 'ch_confirm') {
      const channelId = session.wizardData.pendingChannel;
      if (channelId) {
        await updateSection(session.guildId, 'welcome', { channelId });
        delete session.wizardData.pendingChannel;
      }
      const fresh = await loadGuildConfig(session.guildId);
      const page = await plugin.buildPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // User wants to re-pick the channel
    if (action === 'ch_retry') {
      delete session.wizardData.pendingChannel;
      const page = buildChannelSelectPage(
        '📢  Set Welcome Channel',
        'Pilih channel tempat bot akan mengirim pesan welcome/goodbye.',
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

    if (action === 'set_embed') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:embed')
        .setTitle('Set Welcome Embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Judul Embed')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.welcome.embed.title ?? '')
            .setMaxLength(256)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Deskripsi Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(cfg.welcome.embed.description ?? '')
            .setMaxLength(1024)
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'set_color') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:welcome:color')
        .setTitle('Set Embed Color');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Warna Hex (contoh: #5865F2)')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.welcome.embed.color ?? '#5865F2')
            .setMinLength(4)
            .setMaxLength(7)
            .setRequired(true),
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
          new TextInputBuilder()
            .setCustomId('url')
            .setLabel('URL Gambar (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.welcome.image ?? '')
            .setRequired(false),
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
          new TextInputBuilder()
            .setCustomId('url')
            .setLabel('URL GIF (kosongkan untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.welcome.gif ?? '')
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'preview') {
      const w = cfg.welcome;
      const previewEmbed = new EmbedBuilder()
        .setColor(parseInt((w.embed.color ?? '#5865F2').replace('#', ''), 16))
        .setTitle(w.embed.title || 'Selamat Datang!')
        .setDescription(w.embed.description || 'Tidak ada deskripsi.')
        .setFooter({ text: 'Preview — bukan kiriman nyata' });
      if (w.image) previewEmbed.setImage(w.image);

      return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
    }

    if (action === 'test') {
      if (!cfg.welcome.channelId) {
        return interaction.reply({
          content: '⚠️  Atur channel terlebih dahulu sebelum test.',
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: `✅  Test welcome akan dikirim ke <#${cfg.welcome.channelId}> saat fitur diimplementasikan.`,
        ephemeral: true,
      });
    }
  },

  async handleModal(interaction, session, cfg, field) {
    if (field === 'embed') {
      const title = interaction.fields.getTextInputValue('title');
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

    await interaction.reply({ content: '✅  Welcome settings disimpan.', ephemeral: true });
  },
};

export default plugin;
