/**
 * Plugin: 💾 Backup
 *
 * Setup wizard for server backup and restore configuration.
 * Also surfaces the guild config backup/restore controls.
 * Execution of full server backup is a future implementation.
 *
 * Required permission: Administrator
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Colors, DIVIDER, statusDot, buildNavRow } from '../ui.js';
import { backupGuildConfig, listBackups, restoreBackup, loadGuildConfig } from '../config.js';

const plugin = {
  id:                 'backup',
  label:              'Backup',
  emoji:              '💾',
  description:        'Backup dan restore konfigurasi server.',
  order:              6,
  requiredPermission: PermissionFlagsBits.Administrator,

  getStatus(cfg) {
    const count = cfg.backup.backups?.length ?? 0;
    return {
      enabled: cfg.backup.enabled,
      summary: `${count} backup tersimpan`,
    };
  },

  async buildPage(cfg, session) {
    const guildId = session?.guildId;
    const backups = guildId ? await listBackups(guildId) : [];
    const embed   = new EmbedBuilder()
      .setColor(cfg.backup.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '💾  Backup' })
      .setDescription(`Kelola backup konfigurasi server.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',      value: statusDot(cfg.backup.enabled), inline: true },
        { name: '📦  Config Backup', value: `${backups.length} backup`, inline: true },
      );

    if (backups.length > 0) {
      const list = backups
        .slice(0, 5) // show last 5
        .map((b, i) => `**${i + 1}.** \`${b.id}\` — ${new Date(b.date).toLocaleString('id-ID')}`)
        .join('\n');
      embed.addFields({ name: '📋  Backup Terbaru', value: list });
    }

    embed.setFooter({ text: 'Backup konfigurasi melindungi pengaturan wizard kamu.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:backup:create_backup')
        .setLabel('Backup Config Sekarang').setEmoji('💾').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:backup:run_backup')
        .setLabel('Backup Server').setEmoji('🗄️').setStyle(ButtonStyle.Secondary),
    );

    const restoreComponents = [row1];

    if (backups.length > 0) {
      const select = new StringSelectMenuBuilder()
        .setCustomId('setup1:backup:select_restore')
        .setPlaceholder('Pilih backup untuk di-Restore...')
        .addOptions(
          backups.slice(0, 25).map((b) => ({
            label:       `Backup ${new Date(b.date).toLocaleString('id-ID')}`,
            value:       b.id,
            description: `ID: ${b.id}`,
          }))
        );
      restoreComponents.push(new ActionRowBuilder().addComponents(select));
    }

    restoreComponents.push(buildNavRow());

    return { embed, components: restoreComponents };
  },

  async handleInteraction(interaction, session, cfg, action) {
    if (action === 'create_backup') {
      const backupId = await backupGuildConfig(session.guildId);
      if (backupId) {
        await interaction.reply({
          content:  `✅  Config backup berhasil dibuat.\nID: \`${backupId}\`\n\nBackup dapat di-Restore kapan saja melalui menu ini.`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content:  `⚠️  Tidak ada konfigurasi yang perlu di-backup (belum ada config tersimpan).`,
          ephemeral: true,
        });
      }
      // Refresh plugin page
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh, session);
      return interaction.editReply({ embeds: [], components: [] }).catch(() => null);
    }

    if (action === 'run_backup') {
      return interaction.reply({
        content:  `⚙️  **Backup Server** akan tersedia pada fase implementasi berikutnya.`,
        ephemeral: true,
      });
    }

    if (action === 'select_restore') {
      const backupId = interaction.values[0];

      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('♻️  Restore Config — Konfirmasi')
        .setDescription(
          `Apakah kamu yakin ingin me-restore backup \`${backupId}\`?\n\n${DIVIDER}\n` +
          `**Konfigurasi saat ini akan ditimpa.**\n` +
          `Konfigurasi saat ini otomatis di-backup sebelum restore.`
        );

      session.wizardData.pendingRestoreId = backupId;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:backup:confirm_restore')
          .setLabel('Ya, Restore').setEmoji('♻️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('setup1:backup:back_to_page')
          .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (action === 'confirm_restore') {
      const backupId = session.wizardData.pendingRestoreId;
      if (!backupId) {
        return interaction.update({
          content:    '⚠️  Tidak ada backup yang dipilih.',
          embeds:     [],
          components: [],
        });
      }

      try {
        // Create backup of current config before restoring
        await backupGuildConfig(session.guildId);
        // Restore the chosen backup
        await restoreBackup(session.guildId, backupId);
        delete session.wizardData.pendingRestoreId;

        const fresh = await loadGuildConfig(session.guildId);
        const page  = await plugin.buildPage(fresh, session);
        page.embed.setDescription(
          `✅  **Config berhasil di-restore dari backup \`${backupId}\`.**\n\n` +
          (page.embed.data.description ?? '')
        );
        return interaction.update({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.update({
          embeds:     [
            new EmbedBuilder()
              .setColor(Colors.ERROR)
              .setTitle('❌  Restore Gagal')
              .setDescription(`Tidak dapat me-restore backup: ${err.message}`)
          ],
          components: [buildNavRow()],
        });
      }
    }

    if (action === 'back_to_page') {
      delete session.wizardData.pendingRestoreId;
      const page = await plugin.buildPage(cfg, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }
  },
};

export default plugin;
