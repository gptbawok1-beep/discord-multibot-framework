/**
 * Bot 1 — Prefix Command: !glist
 *
 * Menampilkan daftar giveaway yang sedang aktif di server ini.
 *
 * Usage:
 *   !glist
 *
 * Permission: Owner Server ATAU Giveaway Manager Role
 */

import { EmbedBuilder } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import { listGiveaways } from '../../features/giveaway/store.js';

export default class GListCommand extends BaseCommand {
  constructor() {
    super({
      name:      'glist',
      description: 'Lihat daftar giveaway yang sedang aktif.',
      type:      'prefix',
      cooldown:  5,
      guildOnly: true,
    });
  }

  async execute(client, message, args) {
    // ── Permission check ────────────────────────────────────────────────────
    const cfg = await loadGuildConfig(message.guild.id).catch(() => null);
    if (!canManageGiveaway(message.member, cfg, message.guild.ownerId)) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', permissionDeniedMessage())] });
    }

    // ── Fetch active giveaways ───────────────────────────────────────────────
    const all    = listGiveaways(message.guild.id);
    const active = all.filter((g) => g.status === 'active');

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎉  Giveaway Aktif')
      .setFooter({ text: `${active.length} giveaway aktif` })
      .setTimestamp();

    if (active.length === 0) {
      embed.setDescription('Tidak ada giveaway yang sedang berjalan saat ini.');
    } else {
      // Sort by soonest ending first
      active.sort((a, b) => a.endsAt - b.endsAt);

      const lines = active.map((g) => {
        const endsAtSec  = Math.floor(g.endsAt / 1000);
        const channelStr = g.channelId ? `<#${g.channelId}>` : 'Unknown';
        return [
          `**${g.prize}**`,
          `• Channel: ${channelStr}`,
          `• Peserta: **${g.participants.length}** orang`,
          `• Berakhir: <t:${endsAtSec}:R>`,
          `• ID: \`${g.id}\``,
        ].join('\n');
      });

      // Discord field limit: 1024 chars each, max 25 fields
      const MAX_FIELDS = 10;
      const shown = lines.slice(0, MAX_FIELDS);
      if (shown.length < active.length) {
        embed.setDescription(
          shown.join('\n\n') +
          `\n\n... dan **${active.length - shown.length}** giveaway lainnya.`
        );
      } else {
        embed.setDescription(shown.join('\n\n'));
      }
    }

    return message.reply({ embeds: [embed] });
  }
}
