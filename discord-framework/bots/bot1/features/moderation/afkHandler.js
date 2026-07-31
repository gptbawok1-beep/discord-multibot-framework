/**
 * Bot 1 — AFK Feature Handler
 *
 * Handles:
 *   - Notifying when a mentioned user is AFK
 *   - Auto-removing AFK status when the user sends a message
 *
 * Anti-spam: replies tentang AFK user tertentu dibatasi setiap 5 detik.
 * Auto-delete: semua respons AFK otomatis terhapus setelah 30 detik.
 */

import { EmbedBuilder } from 'discord.js';
import { loadGuildConfig, updateSection } from '../../setup/config.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const AFK_REPLY_COOLDOWN_MS = 5_000;
const AUTO_DELETE_MS        = 30_000;

// Kata kunci ibadah (case-insensitive)
const IBADAH_KEYWORDS = [
  'sholat', 'salat', 'jumatan', 'jumat',
  'ngaji', 'mengaji', 'pengajian', 'kajian',
  'tadarus', 'tarawih', 'tahajud',
  'dhuha', 'subuh', 'dzuhur', 'zuhur', 'ashar', 'maghrib', 'isya',
  'masjid', 'umrah', 'haji',
];

// In-memory cooldown map: "guildId:afkUserId" → lastReplyTimestamp
const recentAfkReplies = new Map();

// Bersihkan entry expired secara periodik
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentAfkReplies) {
    if (now - ts > AFK_REPLY_COOLDOWN_MS * 4) recentAfkReplies.delete(key);
  }
}, 30_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Auto-delete pesan setelah delay (gagal permission = diabaikan). */
function autoDelete(msg, delayMs = AUTO_DELETE_MS) {
  setTimeout(() => msg.delete().catch(() => null), delayMs);
}

/** Cek apakah alasan mengandung kata kunci ibadah. */
function isIbadahReason(reason) {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return IBADAH_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Format durasi ms ke string pendek. */
function formatElapsed(ms) {
  const secs = Math.floor(ms / 1_000);
  const mins = Math.floor(secs / 60);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0)  return `${days} hari ${hrs % 24} jam`;
  if (hrs > 0)   return `${hrs} jam ${mins % 60} menit`;
  if (mins > 0)  return `${mins} menit`;
  return `${secs} detik`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Kirim notifikasi jika user yang di-mention sedang AFK.
 *
 * @param {import('discord.js').Message} message
 * @param {object} cfg  - guild config (sudah dimuat)
 */
export async function handleAfkMention(message, cfg) {
  if (!message.guild)             return;
  if (message.author.bot)         return;
  if (!message.mentions.users.size) return;

  const afkUsers = cfg.afk?.users ?? {};

  for (const [userId, afkData] of Object.entries(afkUsers)) {
    if (!message.mentions.users.has(userId)) continue;
    if (userId === message.author.id)        continue; // Jangan balas mention diri sendiri

    // Anti-spam
    const spamKey  = `${message.guild.id}:${userId}`;
    const lastReply = recentAfkReplies.get(spamKey) ?? 0;
    if (Date.now() - lastReply < AFK_REPLY_COOLDOWN_MS) continue;
    recentAfkReplies.set(spamKey, Date.now());

    const elapsed     = formatElapsed(Date.now() - afkData.timestamp);
    const alasan      = afkData.reason ?? 'Tanpa alasan';

    const embed = new EmbedBuilder()
      .setColor(0x4F545C)
      .setDescription(
        `💤 **<@${userId}> sedang AFK**\n📝 ${alasan}\n⏱️ ${elapsed}`,
      );

    try {
      const reply = await message.reply({
        embeds:          [embed],
        allowedMentions: { repliedUser: false },
      });
      autoDelete(reply);
    } catch {
      // Channel tidak mengizinkan reply — abaikan
    }
  }
}

/**
 * Hapus status AFK saat user mengirim pesan, lalu beritahu mereka.
 *
 * @param {import('discord.js').Message} message
 * @param {object} cfg  - guild config (sudah dimuat)
 */
export async function handleAfkRemoval(message, cfg) {
  if (!message.guild)   return;
  if (message.author.bot) return;

  const afkUsers = cfg.afk?.users ?? {};
  const afkData  = afkUsers[message.author.id];
  if (!afkData) return;

  // Hapus status AFK dari storage
  const newUsers = { ...afkUsers };
  delete newUsers[message.author.id];

  try {
    await updateSection(message.guild.id, 'afk', { users: newUsers });
  } catch {
    // Non-fatal — tetap tampilkan pesan
  }

  const elapsed = formatElapsed(Date.now() - afkData.timestamp);
  const alasan  = afkData.reason ?? 'Tanpa alasan';
  const ibadah  = isIbadahReason(afkData.reason);

  const headline = ibadah
    ? '👀 Ehem... calon ustaz balik nih.'
    : '😴 Udah kelar AFK-nya?';

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setDescription(`${headline}\n💤 ${elapsed} • ${alasan}`);

  try {
    const reply = await message.reply({
      embeds:          [embed],
      allowedMentions: { repliedUser: false },
    });
    autoDelete(reply);
  } catch {
    // Abaikan
  }
}
