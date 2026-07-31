/**
 * Bot 1 — Prefix Command: !gend
 *
 * Mengakhiri giveaway lebih awal. Pemenang dipilih dari peserta yang ada.
 *
 * Usage:
 *   !gend <messageId>
 *
 * Contoh:
 *   !gend 1234567890123456789
 *
 * Permission: Owner Server ATAU Giveaway Manager Role
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed, successEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import { endGiveaway } from '../../features/giveaway/manager.js';
import { getGiveaway } from '../../features/giveaway/store.js';

export default class GEndCommand extends BaseCommand {
  constructor() {
    super({
      name:      'gend',
      description: 'Akhiri giveaway lebih awal.',
      type:      'prefix',
      cooldown:  3,
      guildOnly: true,
    });
  }

  async execute(client, message, args) {
    // ── Permission check ────────────────────────────────────────────────────
    const cfg = await loadGuildConfig(message.guild.id).catch(() => null);
    if (!canManageGiveaway(message.member, cfg, message.guild.ownerId)) {
      return message.reply({ embeds: [errorEmbed('Akses Ditolak', permissionDeniedMessage())] });
    }

    // ── Parse args ──────────────────────────────────────────────────────────
    const messageId = args[0]?.trim();
    if (!messageId || !/^\d{17,20}$/.test(messageId)) {
      return message.reply({
        embeds: [errorEmbed(
          'Format Salah',
          '**Usage:** `!gend <messageId>`\n\nContoh: `!gend 1234567890123456789`\n\n> Gunakan `!glist` untuk melihat ID giveaway aktif.'
        )],
      });
    }

    // ── Validate giveaway exists ─────────────────────────────────────────────
    const giveaway = getGiveaway(message.guild.id, messageId);
    if (!giveaway) {
      return message.reply({
        embeds: [errorEmbed('Tidak Ditemukan', `Giveaway dengan ID \`${messageId}\` tidak ditemukan.\n\n> Gunakan \`!glist\` untuk melihat giveaway aktif.`)],
      });
    }

    if (giveaway.status !== 'active') {
      const label = giveaway.status === 'ended' ? 'sudah selesai' : 'sudah dibatalkan';
      return message.reply({
        embeds: [errorEmbed('Tidak Bisa Diakhiri', `Giveaway **${giveaway.prize}** ${label}.`)],
      });
    }

    // ── End giveaway ─────────────────────────────────────────────────────────
    try {
      const updated = await endGiveaway(client, message.guild.id, messageId);
      const winnerText = updated.winners.length
        ? updated.winners.map((id) => `<@${id}>`).join(', ')
        : 'Tidak ada pemenang';

      return message.reply({
        embeds: [successEmbed(
          'Giveaway Diakhiri',
          `✅ Giveaway **${giveaway.prize}** telah diakhiri.\n\n🏆 **Pemenang:** ${winnerText}`
        )],
      });
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Gagal Mengakhiri', `❌ ${err.message}`)],
      });
    }
  }
}
