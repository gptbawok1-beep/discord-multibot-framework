/**
 * Bot 1 — Prefix Command: !ban <user> [reason]
 *
 * Ban seorang member. Mendukung Reply, Mention, dan User ID.
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

export default class BanCommand extends BaseCommand {
  constructor() {
    super({
      name:           'ban',
      description:    'Ban seorang member.',
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

    // Resolve target
    const { user, member, error } = await resolveTarget(message, args);
    if (error) return message.reply({ embeds: [errorEmbed('Target Tidak Ditemukan', error)] });
    if (!user)  return message.reply({ embeds: [errorEmbed('Target Diperlukan', '❌ Sebutkan target dengan Reply, Mention, atau User ID.\nContoh: `!ban @User Spam`')] });

    // Can't ban self or bot
    if (user.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Kamu tidak bisa ban dirimu sendiri.')] });
    }
    if (user.id === client.user.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Tidak bisa ban bot ini.')] });
    }

    // Load config for protected roles / DM setting
    const cfg = await loadGuildConfig(message.guild.id).catch(() => null);

    // Protected role check (only if target is in the guild)
    if (member && cfg && isProtectedMember(member, cfg)) {
      return message.reply({
        embeds: [errorEmbed('Dilindungi', '❌ Member ini memiliki role yang dilindungi dan tidak bisa dimoderasi.')],
      });
    }

    // Hierarchy checks (only if target is in the guild)
    if (member) {
      const botHierarchy = checkBotHierarchy(message.guild.members.me, member);
      if (!botHierarchy.ok) {
        return message.reply({ embeds: [errorEmbed('Hierarchy Error', botHierarchy.reason)] });
      }
      const modHierarchy = checkModHierarchy(message.member, member, message.guild.ownerId);
      if (!modHierarchy.ok) {
        return message.reply({ embeds: [errorEmbed('Hierarchy Error', modHierarchy.reason)] });
      }
    }

    // Parse reason (skip mention token and user ID token in args)
    const reason = parseReason(args, message);

    // DM the user before ban (if enabled and user is in guild)
    if (member && cfg?.moderation?.dmNotification !== false) {
      try {
        await user.send({
          embeds: [errorEmbed(
            `Kamu di-ban dari ${message.guild.name}`,
            `**Moderator:** ${message.author.tag}\n**Alasan:** ${reason}`,
          )],
        });
      } catch { /* User may have DMs disabled */ }
    }

    // Execute ban
    try {
      await message.guild.bans.create(user.id, {
        reason: `[${message.author.tag}] ${reason}`,
        deleteMessageSeconds: 0,
      });
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Ban Gagal', `❌ Tidak bisa ban user ini.\n\`${err.message}\``)],
      });
    }

    void sendModLog(message, 'ban', { target: user, reason });

    return message.reply({
      embeds: [successEmbed('Member Di-ban', `🔨 **${user.tag}** berhasil di-ban.\n**Alasan:** ${reason}`)],
    });
  }
}

/** Extract reason from args, skipping the user/mention token. */
function parseReason(args, message) {
  // If replied, args[0] might be the reason directly
  // If mentioned, args[0] is the mention token (@), skip it
  // If user ID, args[0] is the ID, skip it
  let start = 0;
  if (!message.reference) {
    if (args[0]?.startsWith('<@') || /^\d{17,20}$/.test(args[0] ?? '')) start = 1;
  }
  const reason = args.slice(start).join(' ').trim();
  return reason || 'Tidak ada alasan.';
}
