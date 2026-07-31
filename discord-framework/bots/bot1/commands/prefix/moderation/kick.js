/**
 * Bot 1 — Prefix Command: !kick <user> [reason]
 *
 * Kick seorang member. Mendukung Reply dan Mention.
 * Reason dicatat di Discord Audit Log.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import {
  checkModPermission,
  isProtectedMember,
  checkBotHierarchy,
  checkModHierarchy,
  resolveTarget,
} from '../../../features/moderation/permCheck.js';
import { loadGuildConfig } from '../../../setup/config.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { sendModLog } from '../../../features/moderation/modLogger.js';
import { PermissionFlagsBits } from 'discord.js';

export default class KickCommand extends BaseCommand {
  constructor() {
    super({
      name:           'kick',
      description:    'Kick seorang member.',
      type:           'prefix',
      cooldown:       3,
      guildOnly:      true,
      botPermissions: ['KickMembers'],
    });
  }

  async execute(client, message, args) {
    // Permission check
    const perm = await checkModPermission(message);
    if (!perm.ok) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', perm.reason)] });
    }

    // Bot permission
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply({
        embeds: [errorEmbed('Bot Kurang Izin', '❌ Bot tidak memiliki izin **Kick Members**.')],
      });
    }

    // Resolve target
    const { user, member, error } = await resolveTarget(message, args);
    if (error)  return message.reply({ embeds: [errorEmbed('Target Tidak Ditemukan', error)] });
    if (!user)  return message.reply({ embeds: [errorEmbed('Target Diperlukan', '❌ Sebutkan target dengan Reply atau Mention.\nContoh: `!kick @User Spam`')] });

    if (!member) {
      return message.reply({ embeds: [errorEmbed('Tidak Ada di Server', '❌ Member tersebut tidak berada di server ini.')] });
    }

    // Self/bot guard
    if (user.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Kamu tidak bisa kick dirimu sendiri.')] });
    }
    if (user.id === client.user.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Tidak bisa kick bot ini.')] });
    }

    const cfg = await loadGuildConfig(message.guild.id).catch(() => null);

    // Protected role check
    if (cfg && isProtectedMember(member, cfg)) {
      return message.reply({
        embeds: [errorEmbed('Dilindungi', '❌ Member ini memiliki role yang dilindungi dan tidak bisa dimoderasi.')],
      });
    }

    // Hierarchy
    const botH = checkBotHierarchy(message.guild.members.me, member);
    if (!botH.ok) return message.reply({ embeds: [errorEmbed('Hierarchy Error', botH.reason)] });

    const modH = checkModHierarchy(message.member, member, message.guild.ownerId);
    if (!modH.ok) return message.reply({ embeds: [errorEmbed('Hierarchy Error', modH.reason)] });

    // Parse reason
    let start = 0;
    if (!message.reference) {
      if (args[0]?.startsWith('<@') || /^\d{17,20}$/.test(args[0] ?? '')) start = 1;
    }
    const reason = args.slice(start).join(' ').trim() || 'Tidak ada alasan.';

    // DM before kick
    if (cfg?.moderation?.dmNotification !== false) {
      try {
        await user.send({
          embeds: [errorEmbed(
            `Kamu di-kick dari ${message.guild.name}`,
            `**Moderator:** ${message.author.tag}\n**Alasan:** ${reason}`,
          )],
        });
      } catch { /* DM disabled */ }
    }

    // Execute
    try {
      await member.kick(`[${message.author.tag}] ${reason}`);
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Kick Gagal', `❌ Tidak bisa kick member ini.\n\`${err.message}\``)],
      });
    }

    void sendModLog(message, 'kick', { target: user, reason });

    return message.reply({
      embeds: [successEmbed('Member Di-kick', `👢 **${user.tag}** berhasil di-kick.\n**Alasan:** ${reason}`)],
    });
  }
}
