/**
 * Bot 1 — Prefix Command: !afk [alasan]
 *
 * Mengaktifkan status AFK untuk pengguna.
 * Status otomatis dihapus saat pengguna mengirim pesan.
 * Saat pengguna di-mention, bot membalas dengan info AFK mereka.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { loadGuildConfig, updateSection } from '../../../setup/config.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';

export default class AfkCommand extends BaseCommand {
  constructor() {
    super({
      name:      'afk',
      description: 'Mengaktifkan status AFK.',
      type:      'prefix',
      cooldown:  5,
      guildOnly: true,
    });
  }

  async execute(client, message, args) {
    const reason = args.join(' ').trim() || null;

    let cfg;
    try {
      cfg = await loadGuildConfig(message.guild.id);
    } catch {
      return message.reply({ embeds: [errorEmbed('Error', '❌ Tidak bisa memuat konfigurasi server.')] });
    }

    const afkUsers = cfg.afk?.users ?? {};

    // If already AFK, update reason
    const alreadyAfk = !!afkUsers[message.author.id];

    const newUsers = {
      ...afkUsers,
      [message.author.id]: {
        reason:    reason,
        timestamp: Date.now(),
      },
    };

    try {
      await updateSection(message.guild.id, 'afk', { users: newUsers });
    } catch {
      return message.reply({ embeds: [errorEmbed('Error', '❌ Tidak bisa menyimpan status AFK.')] });
    }

    const desc = reason
      ? `💤 **${message.author.username}** sekarang AFK.\n**Alasan:** ${reason}`
      : `💤 **${message.author.username}** sekarang AFK.`;

    return message.reply({
      embeds: [successEmbed(alreadyAfk ? 'AFK Diperbarui' : 'AFK Aktif', desc)],
    });
  }
}
