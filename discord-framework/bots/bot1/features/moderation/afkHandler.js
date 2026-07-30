/**
 * Bot 1 — AFK Feature Handler
 *
 * Handles:
 *   - Notifying when a mentioned user is AFK
 *   - Auto-removing AFK status when the user sends a message
 *
 * Anti-spam: replies about a given AFK user are rate-limited per 5 seconds.
 */

import { loadGuildConfig, updateSection } from '../../setup/config.js';

// In-memory cooldown: "guildId:afkUserId" → lastReplyTimestamp
const recentAfkReplies = new Map();
const AFK_REPLY_COOLDOWN_MS = 5_000;

/**
 * Clean up expired cooldown entries periodically.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentAfkReplies) {
    if (now - ts > AFK_REPLY_COOLDOWN_MS * 2) recentAfkReplies.delete(key);
  }
}, 30_000);

/**
 * Handle AFK mention notification.
 * Call this when a message mentions one or more users.
 *
 * @param {import('discord.js').Message} message
 * @param {object} cfg  - guild config (already loaded)
 */
export async function handleAfkMention(message, cfg) {
  if (!message.guild) return;
  if (message.author.bot)  return;
  if (message.mentions.users.size === 0) return;

  const afkUsers = cfg.afk?.users ?? {};

  for (const [userId, afkData] of Object.entries(afkUsers)) {
    if (!message.mentions.users.has(userId)) continue;
    if (userId === message.author.id) continue; // Don't notify if they mention themselves

    const spamKey = `${message.guild.id}:${userId}`;
    const lastReply = recentAfkReplies.get(spamKey) ?? 0;
    if (Date.now() - lastReply < AFK_REPLY_COOLDOWN_MS) continue;

    recentAfkReplies.set(spamKey, Date.now());

    const elapsed = formatElapsed(Date.now() - afkData.timestamp);
    const reason  = afkData.reason ? `: *${afkData.reason}*` : '';

    try {
      await message.reply({
        content: `💤 **<@${userId}>** sedang AFK sejak ${elapsed} lalu${reason}`,
        allowedMentions: { repliedUser: false },
      });
    } catch {
      // Suppress — channel might not allow replies
    }
  }
}

/**
 * Handle AFK removal when the user sends a message.
 * Call this on every non-bot message.
 *
 * @param {import('discord.js').Message} message
 * @param {object} cfg  - guild config (already loaded)
 */
export async function handleAfkRemoval(message, cfg) {
  if (!message.guild) return;
  if (message.author.bot)  return;

  const afkUsers = cfg.afk?.users ?? {};
  const afkData  = afkUsers[message.author.id];
  if (!afkData) return;

  // Remove AFK status
  const newUsers = { ...afkUsers };
  delete newUsers[message.author.id];

  try {
    await updateSection(message.guild.id, 'afk', { users: newUsers });
  } catch {
    // Non-fatal — still inform the user
  }

  const elapsed = formatElapsed(Date.now() - afkData.timestamp);

  try {
    await message.reply({
      content: `✅ Status AFK kamu telah dihapus. Kamu AFK selama **${elapsed}**.`,
      allowedMentions: { repliedUser: false },
    });
  } catch {
    // Suppress
  }
}

/**
 * Format elapsed milliseconds into a short human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (days > 0)    return `${days} hari ${hours % 24} jam`;
  if (hours > 0)   return `${hours} jam ${minutes % 60} menit`;
  if (minutes > 0) return `${minutes} menit`;
  return `${seconds} detik`;
}
