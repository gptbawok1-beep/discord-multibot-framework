/**
 * Bot 1 — Prefix Command: !cc <jumlah>
 *
 * Menghapus pesan bertahap (batch) sesuai batas API Discord.
 * Mendukung penghapusan hingga ratusan pesan secara otomatis.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { checkModPermission } from '../../../features/moderation/permCheck.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { sendModLog } from '../../../features/moderation/modLogger.js';
import { PermissionFlagsBits } from 'discord.js';

const MAX_BULK_DELETE = 100;   // Discord API limit per call
const MSG_AGE_LIMIT   = 14 * 24 * 60 * 60 * 1_000; // 14 days — older msgs can't bulk-delete

export default class CcCommand extends BaseCommand {
  constructor() {
    super({
      name:            'cc',
      description:     'Hapus sejumlah pesan di channel.',
      type:            'prefix',
      cooldown:        5,
      guildOnly:       true,
      botPermissions:  ['ManageMessages'],
    });
  }

  async execute(client, message, args) {
    // Permission check
    const perm = await checkModPermission(message);
    if (!perm.ok) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', perm.reason)] });
    }

    // Bot permission
    const botMember = message.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({
        embeds: [errorEmbed('Bot Kurang Izin', '❌ Bot tidak memiliki izin **Manage Messages**.')],
      });
    }

    // Parse amount
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 1) {
      return message.reply({
        embeds: [errorEmbed('Format Salah', '❌ Gunakan: `!cc <jumlah>`\nContoh: `!cc 10`')],
      });
    }
    if (amount > 1000) {
      return message.reply({
        embeds: [errorEmbed('Terlalu Banyak', '❌ Jumlah maksimum yang bisa dihapus sekaligus adalah **1000** pesan.')],
      });
    }

    // Delete the command message first
    await message.delete().catch(() => null);

    let remaining = amount;
    let totalDeleted = 0;
    let tooOldCount  = 0;

    while (remaining > 0) {
      const batch = Math.min(remaining, MAX_BULK_DELETE);

      // Fetch messages
      const fetched = await message.channel.messages
        .fetch({ limit: batch })
        .catch(() => null);

      if (!fetched || fetched.size === 0) break;

      // Filter to messages not older than 14 days (Discord requirement for bulk delete)
      const now         = Date.now();
      const deletable   = fetched.filter((m) => now - m.createdTimestamp < MSG_AGE_LIMIT);
      const tooOld      = fetched.size - deletable.size;
      tooOldCount      += tooOld;

      if (deletable.size === 0) break;

      let deleted;
      if (deletable.size === 1) {
        // bulkDelete requires ≥2 messages; delete single message individually
        await deletable.first().delete().catch(() => null);
        deleted = 1;
      } else {
        const result = await message.channel.bulkDelete(deletable, true).catch(() => null);
        deleted = result?.size ?? 0;
      }

      totalDeleted += deleted;
      remaining    -= batch;

      if (deleted < batch) break; // Ran out of messages
    }

    // Send feedback
    let desc = `✅ Berhasil menghapus **${totalDeleted}** pesan.`;
    if (tooOldCount > 0) {
      desc += `\n⚠️ **${tooOldCount}** pesan tidak bisa dihapus karena lebih dari 14 hari.`;
    }

    void sendModLog(message, 'clear', { count: totalDeleted });

    const feedback = await message.channel.send({
      embeds: [successEmbed('Pesan Dihapus', desc)],
    }).catch(() => null);

    // Auto-delete feedback after 5s
    if (feedback) setTimeout(() => feedback.delete().catch(() => null), 5_000);
  }
}
