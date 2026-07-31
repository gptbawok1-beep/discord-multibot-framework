/**
 * Bot 1 — Prefix Command: !unmute <user>
 *
 * Menghapus timeout (unmute) seorang member.
 * Mendukung Reply dan Mention.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import {
  checkModPermission,
  checkBotHierarchy,
  resolveTarget,
} from '../../../features/moderation/permCheck.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { sendModLog } from '../../../features/moderation/modLogger.js';
import { PermissionFlagsBits } from 'discord.js';

export default class UnmuteCommand extends BaseCommand {
  constructor() {
    super({
      name:           'unmute',
      description:    'Menghapus timeout (unmute) seorang member.',
      type:           'prefix',
      cooldown:       3,
      guildOnly:      true,
      botPermissions: ['ModerateMembers'],
    });
  }

  async execute(client, message, args) {
    // Permission check
    const perm = await checkModPermission(message);
    if (!perm.ok) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', perm.reason)] });
    }

    // Bot permission
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({
        embeds: [errorEmbed('Bot Kurang Izin', '❌ Bot tidak memiliki izin **Moderate Members**.')],
      });
    }

    // Resolve target
    const { user, member, error } = await resolveTarget(message, args);
    if (error)  return message.reply({ embeds: [errorEmbed('Target Tidak Ditemukan', error)] });
    if (!user)  return message.reply({ embeds: [errorEmbed('Target Diperlukan', '❌ Sebutkan target dengan Reply atau Mention.\nContoh: `!unmute @User`')] });

    if (!member) {
      return message.reply({ embeds: [errorEmbed('Tidak Ada di Server', '❌ Member tersebut tidak berada di server ini.')] });
    }

    // Check if actually muted
    if (!member.isCommunicationDisabled()) {
      return message.reply({
        embeds: [errorEmbed('Tidak Di-mute', `❌ **${user.tag}** tidak sedang di-timeout.`)],
      });
    }

    // Hierarchy
    const botH = checkBotHierarchy(message.guild.members.me, member);
    if (!botH.ok) return message.reply({ embeds: [errorEmbed('Hierarchy Error', botH.reason)] });

    // Execute: set timeout to null removes it
    try {
      await member.timeout(null, `[${message.author.tag}] Unmute`);
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Unmute Gagal', `❌ Tidak bisa unmute member ini.\n\`${err.message}\``)],
      });
    }

    void sendModLog(message, 'unmute', { target: user });

    return message.reply({
      embeds: [successEmbed('Member Di-unmute', `🔊 Timeout **${user.tag}** berhasil dihapus.`)],
    });
  }
}
