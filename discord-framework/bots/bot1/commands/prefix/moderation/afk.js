/**
 * Bot 1 — Prefix Command: !afk [alasan]
 *
 * Mengaktifkan status AFK untuk pengguna.
 * Status otomatis dihapus saat pengguna mengirim pesan.
 * Respons bot otomatis terhapus setelah 30 detik.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { loadGuildConfig, updateSection } from '../../../setup/config.js';
import { EmbedBuilder } from 'discord.js';

const AUTO_DELETE_MS = 30_000;

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
      return message.reply({ content: '❌ Tidak bisa memuat konfigurasi server.' });
    }

    const afkUsers = cfg.afk?.users ?? {};
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
      return message.reply({ content: '❌ Tidak bisa menyimpan status AFK.' });
    }

    const displayReason = reason ?? 'Tanpa alasan';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setDescription(`👀 **Kemana nih?**\n📝 ${displayReason}`);

    const reply = await message.reply({ embeds: [embed] }).catch(() => null);

    // Auto-delete bot reply setelah 30 detik
    if (reply) {
      setTimeout(() => reply.delete().catch(() => null), AUTO_DELETE_MS);
    }
  }
}
