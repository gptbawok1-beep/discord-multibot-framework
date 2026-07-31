/**
 * Bot 1 — Prefix Command: !gcancel
 *
 * Membatalkan giveaway yang sedang berjalan tanpa memilih pemenang.
 *
 * Usage:
 *   !gcancel <messageId>
 *
 * Permission: Owner Server ATAU Giveaway Manager Role
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed, successEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import { cancelGiveaway } from '../../features/giveaway/manager.js';
import { getGiveaway } from '../../features/giveaway/store.js';

export default class GCancelCommand extends BaseCommand {
  constructor() {
    super({
      name:      'gcancel',
      description: 'Batalkan giveaway yang sedang berjalan.',
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
          '**Usage:** `!gcancel <messageId>`\n\nContoh: `!gcancel 1234567890123456789`\n\n> Gunakan `!glist` untuk melihat ID giveaway aktif.'
        )],
      });
    }

    // ── Validate giveaway ────────────────────────────────────────────────────
    const giveaway = getGiveaway(message.guild.id, messageId);
    if (!giveaway) {
      return message.reply({
        embeds: [errorEmbed('Tidak Ditemukan', `Giveaway dengan ID \`${messageId}\` tidak ditemukan.\n\n> Gunakan \`!glist\` untuk melihat giveaway aktif.`)],
      });
    }

    if (giveaway.status !== 'active') {
      const label = giveaway.status === 'ended' ? 'sudah selesai' : 'sudah dibatalkan';
      return message.reply({
        embeds: [errorEmbed('Tidak Bisa Dibatalkan', `Giveaway **${giveaway.prize}** ${label}.`)],
      });
    }

    // ── Cancel ───────────────────────────────────────────────────────────────
    try {
      await cancelGiveaway(client, message.guild.id, messageId);

      return message.reply({
        embeds: [successEmbed(
          'Giveaway Dibatalkan',
          `❌ Giveaway **${giveaway.prize}** telah dibatalkan.\n\nTidak ada pemenang yang dipilih.`
        )],
      });
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Pembatalan Gagal', `❌ ${err.message}`)],
      });
    }
  }
}
