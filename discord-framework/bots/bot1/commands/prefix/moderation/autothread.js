/**
 * Bot 1 — Prefix Command: !autothread <#channel> <on/off>
 *
 * Mengaktifkan atau menonaktifkan Auto Thread pada channel tertentu.
 * Gunakan channel mention untuk memilih channel.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { checkModPermission } from '../../../features/moderation/permCheck.js';
import { loadGuildConfig, updateSection } from '../../../setup/config.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { PermissionFlagsBits } from 'discord.js';

export default class AutothreadCommand extends BaseCommand {
  constructor() {
    super({
      name:      'autothread',
      description: 'Aktifkan atau nonaktifkan Auto Thread pada sebuah channel.',
      type:      'prefix',
      cooldown:  5,
      guildOnly: true,
    });
  }

  async execute(client, message, args) {
    // Permission check
    const perm = await checkModPermission(message);
    if (!perm.ok) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', perm.reason)] });
    }

    // Bot permission
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.CreatePublicThreads)) {
      return message.reply({
        embeds: [errorEmbed('Bot Kurang Izin', '❌ Bot tidak memiliki izin **Create Public Threads**.')],
      });
    }

    // Parse: !autothread #channel on/off
    const channelMention = message.mentions.channels.first();
    if (!channelMention) {
      return message.reply({
        embeds: [errorEmbed('Format Salah',
          '❌ Gunakan channel mention.\nContoh: `!autothread #general on` | `!autothread #general off`',
        )],
      });
    }

    // Find the on/off argument (skip the mention token in args)
    const toggle = args.find((a) => /^(on|off)$/i.test(a))?.toLowerCase();
    if (!toggle) {
      return message.reply({
        embeds: [errorEmbed('Toggle Diperlukan', '❌ Gunakan `on` atau `off`.\nContoh: `!autothread #general on`')],
      });
    }

    // Validate channel type
    if (!channelMention.isTextBased() || channelMention.isThread()) {
      return message.reply({
        embeds: [errorEmbed('Channel Tidak Valid', '❌ Auto Thread hanya bisa diaktifkan pada text channel biasa.')],
      });
    }

    let cfg;
    try {
      cfg = await loadGuildConfig(message.guild.id);
    } catch {
      return message.reply({ embeds: [errorEmbed('Error', '❌ Tidak bisa memuat konfigurasi server.')] });
    }

    const channels = [...(cfg.autothread?.channels ?? [])];
    const alreadyEnabled = channels.includes(channelMention.id);

    if (toggle === 'on') {
      if (alreadyEnabled) {
        return message.reply({
          embeds: [errorEmbed('Sudah Aktif', `❌ Auto Thread sudah aktif di <#${channelMention.id}>.`)],
        });
      }
      channels.push(channelMention.id);
    } else {
      if (!alreadyEnabled) {
        return message.reply({
          embeds: [errorEmbed('Tidak Aktif', `❌ Auto Thread tidak aktif di <#${channelMention.id}>.`)],
        });
      }
      const idx = channels.indexOf(channelMention.id);
      channels.splice(idx, 1);
    }

    try {
      await updateSection(message.guild.id, 'autothread', { channels });
    } catch {
      return message.reply({ embeds: [errorEmbed('Error', '❌ Tidak bisa menyimpan konfigurasi Auto Thread.')] });
    }

    if (toggle === 'on') {
      return message.reply({
        embeds: [successEmbed('Auto Thread Aktif', `🧵 Auto Thread berhasil diaktifkan di <#${channelMention.id}>.\nSetiap pesan baru di channel tersebut akan otomatis dibuatkan thread.`)],
      });
    } else {
      return message.reply({
        embeds: [successEmbed('Auto Thread Nonaktif', `🧵 Auto Thread berhasil dinonaktifkan di <#${channelMention.id}>.`)],
      });
    }
  }
}
