/**
 * Plugin: 🏠 Server Settings
 *
 * Configures basic bot behaviour for this server:
 * prefix, language, timezone.
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
import { Colors, DIVIDER, buildNavRow } from '../ui.js';
import { updateSection } from '../config.js';

const plugin = {
  id: 'server',
  label: 'Server',
  emoji: '🏠',
  description: 'Prefix, bahasa, dan pengaturan dasar server.',

  getStatus(cfg) {
    return {
      enabled: true, // always active
      summary: `Prefix: \`${cfg.server.prefix}\``,
    };
  },

  async buildPage(cfg) {
    const s = cfg.server;
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: '🏠  Server Settings' })
      .setDescription(`Konfigurasi pengaturan dasar server.\n${DIVIDER}`)
      .addFields(
        { name: '🔤  Prefix',   value: `\`${s.prefix}\``, inline: true },
        { name: '🌐  Bahasa',   value: s.language,         inline: true },
        { name: '🕐  Timezone', value: s.timezone,         inline: true },
      )
      .setFooter({ text: 'Klik tombol di bawah untuk mengedit.' });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:server:edit_prefix')
        .setLabel('Edit Prefix')
        .setEmoji('🔤')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:server:edit_lang')
        .setLabel('Edit Bahasa')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:server:edit_tz')
        .setLabel('Edit Timezone')
        .setEmoji('🕐')
        .setStyle(ButtonStyle.Primary),
    );

    return { embed, components: [actionRow, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const modals = {
      edit_prefix: {
        id: 'setup1:modal:server:prefix',
        title: 'Edit Prefix',
        label: 'Prefix Baru',
        value: cfg.server.prefix,
        min: 1, max: 5,
      },
      edit_lang: {
        id: 'setup1:modal:server:language',
        title: 'Edit Bahasa',
        label: 'Kode Bahasa (contoh: id, en)',
        value: cfg.server.language,
        min: 2, max: 5,
      },
      edit_tz: {
        id: 'setup1:modal:server:timezone',
        title: 'Edit Timezone',
        label: 'Timezone (contoh: Asia/Jakarta)',
        value: cfg.server.timezone,
        min: 3, max: 40,
      },
    };

    const def = modals[action];
    if (!def) return;

    const modal = new ModalBuilder().setCustomId(def.id).setTitle(def.title);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(def.label)
          .setStyle(TextInputStyle.Short)
          .setValue(def.value)
          .setMinLength(def.min)
          .setMaxLength(def.max)
          .setRequired(true),
      ),
    );
    await interaction.showModal(modal);
  },

  async handleModal(interaction, session, cfg, field) {
    const value = interaction.fields.getTextInputValue('value').trim();
    const keyMap = { prefix: 'prefix', language: 'language', timezone: 'timezone' };
    if (keyMap[field]) {
      await updateSection(session.guildId, 'server', { [keyMap[field]]: value });
    }
    await interaction.reply({ content: `✅  Server Settings diperbarui.`, ephemeral: true });
  },
};

export default plugin;
