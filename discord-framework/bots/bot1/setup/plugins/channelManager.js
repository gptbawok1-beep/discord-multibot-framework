/**
 * Plugin: 📁 Channel Manager
 *
 * Setup wizard for channel management operations.
 * All actions are wizard-only (no execution in this phase).
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { Colors, DIVIDER, buildNavRow } from '../ui.js';

const plugin = {
  id: 'channelmanager',
  label: 'Channel Manager',
  emoji: '📁',
  description: 'Backup, restore, clone, dan kelola struktur channel.',

  getStatus(cfg) {
    const count = cfg.channelManager.backups?.length ?? 0;
    return {
      enabled: count > 0,
      summary: `${count} backup tersimpan`,
    };
  },

  async buildPage(cfg) {
    const backupCount = cfg.channelManager.backups?.length ?? 0;
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: '📁  Channel Manager' })
      .setDescription(`Kelola struktur channel server.\n${DIVIDER}`)
      .addFields(
        { name: '💾  Backup Tersimpan', value: `${backupCount} backup`, inline: true },
      )
      .setFooter({ text: 'Fitur akan aktif pada fase implementasi berikutnya.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:backup')
        .setLabel('Backup Channels')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:restore')
        .setLabel('Restore')
        .setEmoji('♻️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(backupCount === 0),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:generate')
        .setLabel('Generate Structure')
        .setEmoji('🏗️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:clone')
        .setLabel('Clone')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:rename')
        .setLabel('Rename')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:preview')
        .setLabel('Preview Structure')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const comingSoon = async (label) =>
      interaction.reply({
        content: `⚙️  **${label}** akan tersedia pada fase implementasi berikutnya.`,
        ephemeral: true,
      });

    const actions = {
      backup:   () => comingSoon('Backup Channels'),
      restore:  () => comingSoon('Restore'),
      generate: () => comingSoon('Generate Structure'),
      clone:    () => comingSoon('Clone'),
      rename:   () => comingSoon('Rename'),
      delete:   () => comingSoon('Delete'),
      preview:  () => comingSoon('Preview Structure'),
    };

    if (actions[action]) return actions[action]();
  },
};

export default plugin;
