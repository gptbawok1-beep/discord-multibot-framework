/**
 * Bot 1 — Moderation Logger
 *
 * Mengirim embed log tindakan moderasi ke log channel yang dikonfigurasi
 * di `logs.channels.moderation`. Jika channel tidak dikonfigurasi atau
 * tidak ditemukan, fungsi ini diam-diam tidak melakukan apa pun.
 *
 * Fire-and-forget — error tidak pernah crash command yang memanggilnya.
 *
 * Cara pakai:
 *   import { sendModLog } from '../../../features/moderation/modLogger.js';
 *   // setelah tindakan berhasil:
 *   void sendModLog(message, 'ban', { target: user, reason });
 */

import { EmbedBuilder } from 'discord.js';
import { loadGuildConfig } from '../../setup/config.js';

// ── Action metadata ────────────────────────────────────────────────────────────

const ACTION_META = {
  ban:    { emoji: '🔨', label: 'Member Di-ban',    color: 0xED4245 },
  kick:   { emoji: '👢', label: 'Member Di-kick',   color: 0xE67E22 },
  mute:   { emoji: '🔇', label: 'Member Di-mute',   color: 0xFEE75C },
  unmute: { emoji: '🔊', label: 'Member Di-unmute', color: 0x57F287 },
  unban:  { emoji: '🔓', label: 'Member Di-unban',  color: 0x5865F2 },
  clear:  { emoji: '🧹', label: 'Pesan Dihapus',    color: 0x99AAB5 },
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Kirim log moderasi ke log channel yang dikonfigurasi.
 *
 * @param {import('discord.js').Message}                      message
 * @param {'ban'|'kick'|'mute'|'unmute'|'unban'|'clear'}     action
 * @param {object}                                            [data]
 * @param {import('discord.js').User}  [data.target]    User yang dikenai tindakan
 * @param {string}                     [data.reason]    Alasan tindakan
 * @param {string}                     [data.duration]  Durasi (khusus mute)
 * @param {number}                     [data.count]     Jumlah pesan (khusus clear)
 */
export async function sendModLog(message, action, data = {}) {
  try {
    const cfg = await loadGuildConfig(message.guild.id);
    const channelId = cfg?.logs?.channels?.moderation;
    if (!channelId) return;

    const logChannel = message.guild.channels.cache.get(channelId);
    if (!logChannel?.isTextBased()) return;

    const meta = ACTION_META[action] ?? { emoji: '🛡️', label: action, color: 0x5865F2 };
    const { target, reason = 'Tidak ada alasan.', duration, count } = data;

    const fields = [];

    if (target) {
      fields.push({
        name:   'Target',
        value:  `${target.tag}\n\`${target.id}\``,
        inline: true,
      });
    }

    fields.push({
      name:   'Moderator',
      value:  `${message.author.tag}\n\`${message.author.id}\``,
      inline: true,
    });

    fields.push({
      name:   'Channel',
      value:  `${message.channel}`,
      inline: true,
    });

    if (duration) {
      fields.push({ name: 'Durasi', value: duration, inline: true });
    }

    if (count != null) {
      fields.push({ name: 'Jumlah Pesan', value: `${count} pesan`, inline: true });
    }

    fields.push({ name: 'Alasan', value: reason, inline: false });

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setAuthor({ name: `${meta.emoji}  ${meta.label}` })
      .addFields(fields)
      .setFooter({ text: `Case oleh ${message.author.tag} • ID: ${message.author.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch {
    // Logging tidak boleh crash command utama — abaikan semua error
  }
}
