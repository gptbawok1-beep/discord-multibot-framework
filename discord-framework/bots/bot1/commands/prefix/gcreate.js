/**
 * Bot 1 — Prefix Command: !gcreate
 *
 * Membuat giveaway baru.
 *
 * Usage:
 *   !gcreate <durasi> <pemenang> <hadiah>
 *
 * Contoh:
 *   !gcreate 1h 1 Nitro Classic
 *   !gcreate 30m 3 Steam Key
 *   !gcreate 2d 1 Hadiah Spesial
 *
 * Durasi yang valid: 10m, 30m, 1h, 2h, 6h, 12h, 1d, 2d, 7d
 * (format: angka + m/h/d — min 10m, maks 7d)
 *
 * Permission: Owner Server ATAU Giveaway Manager Role (diatur via /setup bot1)
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed, successEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import {
  parseDuration,
  formatDuration,
  createGiveaway,
  VALID_DURATIONS,
} from '../../features/giveaway/manager.js';
import { validateTextChannel } from '../../../../shared/setup/validation.js';

export default class GCreateCommand extends BaseCommand {
  constructor() {
    super({
      name:      'gcreate',
      description: 'Buat giveaway baru.',
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

    // ── Parse args: <durasi> <pemenang> <hadiah> ────────────────────────────
    if (args.length < 3) {
      return message.reply({
        embeds: [errorEmbed(
          'Format Salah',
          `**Usage:** \`!gcreate <durasi> <pemenang> <hadiah>\`\n\n` +
          `**Contoh:**\n• \`!gcreate 1h 1 Nitro Classic\`\n• \`!gcreate 30m 3 Steam Key\`\n\n` +
          `**Durasi valid:** ${VALID_DURATIONS.join(', ')}`
        )],
      });
    }

    const durationStr = args[0];
    const winnersStr  = args[1];
    const prize       = args.slice(2).join(' ').trim();

    // Validate duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return message.reply({
        embeds: [errorEmbed(
          'Durasi Tidak Valid',
          `Durasi \`${durationStr}\` tidak dikenali.\n\n**Durasi valid:** ${VALID_DURATIONS.join(', ')}\n\n**Format:** angka diikuti \`m\` (menit), \`h\` (jam), atau \`d\` (hari).`
        )],
      });
    }

    // Validate winner count
    const winnerCount = parseInt(winnersStr, 10);
    if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
      return message.reply({
        embeds: [errorEmbed('Jumlah Pemenang Tidak Valid', 'Jumlah pemenang harus antara **1** dan **20**.')],
      });
    }

    // Validate prize
    if (!prize || prize.length > 200) {
      return message.reply({
        embeds: [errorEmbed('Hadiah Tidak Valid', 'Hadiah tidak boleh kosong dan maksimal 200 karakter.')],
      });
    }

    // ── Determine target channel ─────────────────────────────────────────────
    // Use configured giveaway channel; fall back to current channel
    let targetChannelId = cfg?.giveaway?.channelId ?? message.channel.id;

    // Validate channel
    const validation = await validateTextChannel(message.guild, targetChannelId);
    if (!validation.ok) {
      // Fall back to current channel
      targetChannelId = message.channel.id;
    }

    // ── Create giveaway ──────────────────────────────────────────────────────
    try {
      const giveaway = await createGiveaway(client, {
        guildId:       message.guild.id,
        channelId:     targetChannelId,
        hostId:        message.author.id,
        prize,
        durationMs,
        winnerCount,
        requiredRoleId: null,
        mentionRoleId:  cfg?.giveaway?.mentionRoleId ?? null,
      });

      // Confirm only if the giveaway was posted in a different channel
      if (targetChannelId !== message.channel.id) {
        return message.reply({
          embeds: [successEmbed(
            'Giveaway Dibuat!',
            `🎉 Giveaway **${prize}** berhasil dibuat di <#${targetChannelId}>!\n\n` +
            `**Durasi:** ${formatDuration(durationMs)}\n**Pemenang:** ${winnerCount} orang\n**ID:** \`${giveaway.id}\``
          )],
        });
      }
    } catch (err) {
      return message.reply({
        embeds: [errorEmbed('Giveaway Gagal Dibuat', `❌ ${err.message}`)],
      });
    }
  }
}
