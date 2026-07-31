/**
 * Bot 1 — Prefix Command: !unban <userID> [reason]
 *
 * Membuka ban seorang user berdasarkan User ID.
 * Reason dicatat di Discord Audit Log.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { checkModPermission } from '../../../features/moderation/permCheck.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { sendModLog } from '../../../features/moderation/modLogger.js';
import { PermissionFlagsBits } from 'discord.js';

export default class UnbanCommand extends BaseCommand {
  constructor() {
    super({
      name:           'unban',
      description:    'Membuka ban seorang user.',
      type:           'prefix',
      cooldown:       3,
      guildOnly:      true,
      botPermissions: ['BanMembers'],
    });
  }

  async execute(client, message, args) {
    // Permission check
    const perm = await checkModPermission(message);
    if (!perm.ok) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', perm.reason)] });
    }

    // Bot permission
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({
        embeds: [errorEmbed('Bot Kurang Izin', '❌ Bot tidak memiliki izin **Ban Members**.')],
      });
    }

    // Target user ID required
    const userId = args[0];
    if (!userId || !/^\d{17,20}$/.test(userId)) {
      return message.reply({
        embeds: [errorEmbed('Format Salah', '❌ Gunakan: `!unban <userID> [reason]`\nContoh: `!unban 123456789012345678 Sudah direhabilitasi`')],
      });
    }

    // Check that the user is actually banned
    const banEntry = await message.guild.bans.fetch(userId).catch(() => null);
    if (!banEntry) {
      return message.reply({
        embeds: [errorEmbed('Tidak Ditemukan', `❌ User dengan ID \`${userId}\` tidak ada dalam daftar ban.`)],
      });
    }

    const reason = args.slice(1).join(' ').trim() || 'Tidak ada alasan.';

    try {
      await message.guild.bans.remove(userId, `[${message.author.tag}] ${reason}`);
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Unban Gagal', `❌ Tidak bisa membuka ban user ini.\n\`${err.message}\``)],
      });
    }

    const user = banEntry.user;
    void sendModLog(message, 'unban', { target: user, reason });

    return message.reply({
      embeds: [successEmbed('Ban Dicabut', `🔓 **${user.tag}** berhasil di-unban.\n**Alasan:** ${reason}`)],
    });
  }
}
