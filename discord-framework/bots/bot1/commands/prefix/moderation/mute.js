/**
 * Bot 1 — Prefix Command: !mute <user> <durasi> [reason]
 *
 * Timeout (mute) seorang member menggunakan Discord Timeout.
 * Mendukung Reply dan Mention.
 *
 * Format durasi: 10s | 10m | 1h | 2d | 1w (maks 28 hari)
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import {
  checkModPermission,
  isProtectedMember,
  checkBotHierarchy,
  checkModHierarchy,
  resolveTarget,
  parseDuration,
  formatDuration,
} from '../../../features/moderation/permCheck.js';
import { loadGuildConfig } from '../../../setup/config.js';
import { errorEmbed, successEmbed } from '../../../../../shared/utils/embed.js';
import { PermissionFlagsBits } from 'discord.js';

export default class MuteCommand extends BaseCommand {
  constructor() {
    super({
      name:           'mute',
      description:    'Timeout (mute) seorang member.',
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
    if (!user)  return message.reply({ embeds: [errorEmbed('Target Diperlukan', '❌ Sebutkan target dengan Reply atau Mention.\nContoh: `!mute @User 10m Spam`')] });

    if (!member) {
      return message.reply({ embeds: [errorEmbed('Tidak Ada di Server', '❌ Member tersebut tidak berada di server ini.')] });
    }

    // Self/bot guard
    if (user.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Kamu tidak bisa mute dirimu sendiri.')] });
    }
    if (user.id === client.user.id) {
      return message.reply({ embeds: [errorEmbed('Tidak Valid', '❌ Tidak bisa mute bot ini.')] });
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

    // Find duration arg: skip mention/ID token, then look for duration pattern
    let argOffset = 0;
    if (!message.reference) {
      if (args[0]?.startsWith('<@') || /^\d{17,20}$/.test(args[0] ?? '')) argOffset = 1;
    }
    const durationArg = args[argOffset];
    if (!durationArg) {
      return message.reply({
        embeds: [errorEmbed('Durasi Diperlukan', '❌ Gunakan: `!mute <user> <durasi> [reason]`\nContoh: `!mute @User 10m Spam` | `!mute @User 1h` | `!mute @User 2d`')],
      });
    }

    const ms = parseDuration(durationArg);
    if (!ms) {
      return message.reply({
        embeds: [errorEmbed('Durasi Tidak Valid',
          `❌ Format durasi tidak dikenal: \`${durationArg}\`\n` +
          'Gunakan: `10s` `10m` `1h` `2d` `1w` (maks **28 hari**)',
        )],
      });
    }

    const reason = args.slice(argOffset + 1).join(' ').trim() || 'Tidak ada alasan.';
    const until  = new Date(Date.now() + ms);

    // DM before mute
    if (cfg?.moderation?.dmNotification !== false) {
      try {
        await user.send({
          embeds: [errorEmbed(
            `Kamu di-mute di ${message.guild.name}`,
            `**Moderator:** ${message.author.tag}\n**Durasi:** ${formatDuration(ms)}\n**Alasan:** ${reason}`,
          )],
        });
      } catch { /* DM disabled */ }
    }

    // Execute timeout
    try {
      await member.timeout(ms, `[${message.author.tag}] ${reason}`);
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Mute Gagal', `❌ Tidak bisa mute member ini.\n\`${err.message}\``)],
      });
    }

    return message.reply({
      embeds: [successEmbed('Member Di-mute',
        `🔇 **${user.tag}** berhasil di-mute.\n**Durasi:** ${formatDuration(ms)}\n**Sampai:** <t:${Math.floor(until.getTime() / 1000)}:F>\n**Alasan:** ${reason}`,
      )],
    });
  }
}
