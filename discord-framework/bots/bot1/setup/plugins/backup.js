/**
 * Plugin: 💾 Backup
 *
 * Setup wizard for server backup and restore configuration.
 * Execution logic is a future implementation.
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { Colors, DIVIDER, statusDot, buildNavRow } from '../ui.js';

const plugin = {
  id: 'backup',
  label: 'Backup',
  emoji: '💾',
  description: 'Backup dan restore konfigurasi server.',

  getStatus(cfg) {
    const count = cfg.backup.backups?.length ?? 0;
    return {
      enabled: cfg.backup.enabled,
      summary: `${count} backup tersimpan`,
    };
  },

  async buildPage(cfg) {
    const backups = cfg.backup.backups ?? [];
    const embed = new EmbedBuilder()
      .setColor(cfg.backup.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '💾  Backup' })
      .setDescription(`Kelola backup server.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',   value: statusDot(cfg.backup.enabled), inline: true },
        { name: '📦  Backups',  value: `${backups.length} backup`,     inline: true },
      );

    if (backups.length > 0) {
      const list = backups
        .slice(-5) // show last 5
        .reverse()
        .map((b, i) => `**${i + 1}.** \`${b.id}\` — ${new Date(b.createdAt).toLocaleDateString('id-ID')}`)
        .join('\n');
      embed.addFields({ name: '📋  Backup Terbaru', value: list });
    }

    embed.setFooter({ text: 'Backup akan dieksekusi pada fase implementasi berikutnya.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:backup:run_backup')
        .setLabel('Backup Server')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:backup:restore')
        .setLabel('Restore Server')
        .setEmoji('♻️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(backups.length === 0),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:backup:delete_backup')
        .setLabel('Hapus Backup')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(backups.length === 0),
      new ButtonBuilder()
        .setCustomId('setup1:backup:preview')
        .setLabel('Preview')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const comingSoon = (label) =>
      interaction.reply({
        content: `⚙️  **${label}** akan tersedia pada fase implementasi berikutnya.`,
        ephemeral: true,
      });

    const map = {
      run_backup:    () => comingSoon('Backup Server'),
      restore:       () => comingSoon('Restore Server'),
      delete_backup: () => comingSoon('Hapus Backup'),
      preview:       () => comingSoon('Preview'),
    };

    if (map[action]) return map[action]();
  },
};

export default plugin;
