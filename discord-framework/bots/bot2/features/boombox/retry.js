/**
 * Boombox — Retry Manager
 *
 * Handles the `!requlang` prefix command.
 *
 * Flow:
 *   1. Parse the URL from the message
 *   2. Validate it
 *   3. Check database for an existing record
 *   4. If found: delete from cache + DB, re-enqueue the job
 *   5. If not found: process as a fresh request
 *   6. Reply with the new URL
 */

import { validateURL, buildCacheKey } from './validator.js';
import { cacheManager } from './cache.js';
import { db } from './database.js';
import { queueManager } from './queue.js';
import { boomboxLogger } from './logger.js';
import { analyticsManager } from './analytics.js';
import { Colors } from '../../../../shared/utils/embed.js';
import { EmbedBuilder } from 'discord.js';

const FOOTER = '🩸 Kenyut';
const COLOR  = 0x3498DB; // Boombox blue

/**
 * Handle the `!requlang <url>` prefix command.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 * @param {string[]} args
 */
export async function handleRequlang(client, message, args) {
  const url = args[0];

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!url) {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setDescription('**Penggunaan:** `!requlang <url>`\n\nContoh: `!requlang https://youtu.be/dQw4w9WgXcQ`')
          .setFooter({ text: FOOTER }),
      ],
    });
  }

  const validation = validateURL(url);
  if (!validation.valid) {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ ${validation.error}`)
          .setFooter({ text: FOOTER }),
      ],
    });
  }

  const cacheKey = buildCacheKey(validation.platform, validation.id);
  analyticsManager.incrementRetry();
  boomboxLogger.retry(cacheKey, 1);

  // ── Clear old data ─────────────────────────────────────────────────────────
  cacheManager.delete(cacheKey);
  db.delete(cacheKey);

  // ── Notify user ────────────────────────────────────────────────────────────
  const processingMsg = await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setDescription(`🔄 **Memproses ulang...**\n\n\`${cacheKey}\``)
        .setFooter({ text: FOOTER }),
    ],
  });

  // ── Enqueue ────────────────────────────────────────────────────────────────
  try {
    const uploadUrl = await queueManager.enqueue({
      cacheKey,
      platform:    validation.platform,
      videoId:     validation.id,
      originalUrl: url,
      userId:      message.author.id,
      guildId:     message.guildId ?? 'dm',
    });

    await processingMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ Retry Berhasil')
          .setDescription(`**URL Baru:**\n\`\`\`\n${uploadUrl}\n\`\`\``)
          .setFooter({ text: FOOTER }),
      ],
    });
  } catch (err) {
    boomboxLogger.failed(cacheKey, err.message);
    await processingMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Retry Gagal')
          .setDescription(`\`${cacheKey}\`\n\n${err.message}`)
          .setFooter({ text: FOOTER }),
      ],
    });
  }
}
