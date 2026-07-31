/**
 * Bot 1 — Prefix Command: !greroll
 *
 * Mengambil pemenang baru dari peserta yang sama (reroll).
 * Giveaway harus sudah selesai (status: ended).
 *
 * Usage:
 *   !greroll <messageId>
 *
 * Permission: Owner Server ATAU Giveaway Manager Role
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed, successEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import { rerollGiveaway } from '../../features/giveaway/manager.js';
import { getGiveaway } from '../../features/giveaway/store.js';

export default class GRerollCommand extends BaseCommand {
  constructor() {
    super({
      name:      'greroll',
      description: 'Pilih ulang pemenang giveaway.',
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
          '**Usage:** `!greroll <messageId>`\n\nContoh: `!greroll 1234567890123456789`'
        )],
      });
    }

    // ── Validate giveaway exists ─────────────────────────────────────────────
    const giveaway = getGiveaway(message.guild.id, messageId);
    if (!giveaway) {
      return message.reply({
        embeds: [errorEmbed('Tidak Ditemukan', `Giveaway dengan ID \`${messageId}\` tidak ditemukan.`)],
      });
    }

    // ── Reroll ───────────────────────────────────────────────────────────────
    try {
      const updated = await rerollGiveaway(client, message.guild.id, messageId);
      const winnerText = updated.winners.length
        ? updated.winners.map((id) => `<@${id}>`).join(', ')
        : 'Tidak ada pemenang';

      return message.reply({
        embeds: [successEmbed(
          'Reroll Berhasil',
          `🔄 Giveaway **${giveaway.prize}** telah di-reroll.\n\n🏆 **Pemenang Baru:** ${winnerText}`
        )],
      });
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Reroll Gagal', `❌ ${err.message}`)],
      });
    }
  }
}
