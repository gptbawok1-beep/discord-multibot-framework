/**
 * handler.js — Main BoomBox message handler.
 *
 * Pipeline (engine V3):
 *   [1]  Request received — validate channel / role / URL / daily limit
 *   [2]  Maintenance check — check DB before processing
 *   [3]  Duration limit — use db.getEffectiveDurationLimitSec(member)
 *   [4]  Enqueue job with platform-specific priority queue worker
 *   [5]  Fetch metadata & audio direct link
 *   [6]  Upload to top4top and save to DB + Cache
 *   [7]  Edit message to success or clean error detail
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { BOOMBOX_CONFIG, ALLOWED_ROLES, UNLIMITED_ROLES } from "./config.js";
import { db } from "./database.js";
import { cacheManager, extractVideoId } from "./cache.js";
import { router } from "./router.js";
import { validateURL } from "./validator.js";
import { enqueueForPlatform, PRIORITY, getQueueSnapshot } from "./queue.js";
import { storeErrorDetail } from "./errorStore.js";
import { buildPublicLogPanel } from "./logs/viewer.js";
import { buildUnsupportedPlatformEmbed, buildProcessingEmbed, buildResultEmbed, buildDurationLimitEmbed, buildUserErrorEmbed } from "./embed.js";
import { buildDashProcessingEmbed, buildDashSuccessEmbed, buildDashCacheEmbed, buildDashErrorEmbed, buildDashMaintenanceEmbed, buildDashTimeoutEmbed } from "./dashboardEmbed.js";
import { createLogger } from "../../../../shared/logger/index.js";

const logger = createLogger("BoomboxHandler");

// Rolling dedup — prevents double-processing
const processingSet = new Set();
const MAX_DEDUP     = 200;

function hasAllowedRole(member) {
  if (!member) return false;
  // If no roles specified, fallback to allowing everyone
  if (ALLOWED_ROLES.length === 0) return true;
  return member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
}

function isUnlimited(member) {
  if (!member) return false;
  return member.roles.cache.some(r => UNLIMITED_ROLES.includes(r.id));
}

function getJobPriority(member) {
  if (!member) return PRIORITY.FREE;
  if (BOOMBOX_CONFIG.OWNER_ROLE_ID && member.roles.cache.has(BOOMBOX_CONFIG.OWNER_ROLE_ID)) return PRIORITY.OWNER;
  if (BOOMBOX_CONFIG.DEVELOPER_ROLE_ID && member.roles.cache.has(BOOMBOX_CONFIG.DEVELOPER_ROLE_ID)) return PRIORITY.DEVELOPER;
  if (BOOMBOX_CONFIG.PREMIUM_ROLE_ID && member.roles.cache.has(BOOMBOX_CONFIG.PREMIUM_ROLE_ID)) return PRIORITY.PREMIUM;
  return PRIORITY.FREE;
}

/**
 * Handle incoming message for BoomBox links.
 */
export async function handleBoomBoxMessage(message) {
  if (message.author.bot || !message.guild) return;

  const content = message.content?.trim() || "";
  if (!content.startsWith("http")) return;

  // Extract link
  const urls = content.match(/https?:\/\/[^\s]+/gi);
  if (!urls || urls.length === 0) return;
  const url = urls[0];

  // Quick platform check
  const validation = validateURL(url);
  if (!validation.valid) return;

  const platform = validation.platform;
  const videoId = validation.id;

  // Check channel setup per platform
  const configuredChannels = db.getChannels();
  const allowedChannelId = configuredChannels[platform.toLowerCase()];

  if (!allowedChannelId) {
    // Platform channel not set up yet — ignore or notify owner in console
    return;
  }

  if (message.channelId !== allowedChannelId) {
    // Posted in wrong channel — ignore
    return;
  }

  // Deduplicate rapid gateway double fires
  const dedupKey = `${message.id}:${url}`;
  if (processingSet.has(dedupKey)) return;
  processingSet.add(dedupKey);
  if (processingSet.size > MAX_DEDUP) {
    processingSet.delete(processingSet.keys().next().value);
  }

  logger.info(`Received BoomBox request: url=${url} from ${message.author.tag} in #${message.channel.name}`);

  const member = message.member;

  // 1. Role validation
  if (!hasAllowedRole(member)) {
    await message.reply({ content: "❌ Anda tidak memiliki role yang diizinkan untuk menggunakan Boombox.", ephemeral: true }).catch(() => {});
    return;
  }

  // 2. Maintenance validation
  const maintenance = db.getMaintenance();
  if (maintenance[platform.toLowerCase()]) {
    await message.reply({ embeds: [buildDashMaintenanceEmbed({ userId: message.author.id })] }).catch(() => {});
    return;
  }

  // 3. Daily usage validation (Free limits only)
  const isUserUnlimited = isUnlimited(member);
  const limit = db.getFreeDailyLimit();
  if (!isUserUnlimited) {
    const currentUsage = db.getUsage(message.author.id);
    if (currentUsage >= limit) {
      await message.reply({ content: `❌ Limit harian Anda habis. Limit Anda: **${currentUsage}/${limit}** hari ini.`, ephemeral: true }).catch(() => {});
      return;
    }
  }

  // 4. Cache & DB lookups (instant reply without queueing!)
  const cacheKey = `${platform}:${videoId}`;
  const startMs = Date.now();

  const cached = cacheManager.get(cacheKey);
  if (cached) {
    db.incrementUsage(message.author.id);
    db.incrementStats(platform, "In-Memory Cache");
    db.updateVideoCacheHit(videoId);

    const elapsed = Date.now() - startMs;
    const usage = db.getUsage(message.author.id);

    await message.reply({
      embeds: [buildDashCacheEmbed({
        userId: message.author.id,
        title: cached.title,
        platform,
        boomboxUrl: cached.uploadUrl,
        elapsedMs: elapsed,
      })],
    }).catch(() => {});
    return;
  }

  const record = db.get(cacheKey);
  if (record && record.status === 'ok' && record.uploadUrl) {
    db.incrementUsage(message.author.id);
    db.incrementStats(platform, "Database Records");
    db.updateVideoCacheHit(videoId);

    cacheManager.set(cacheKey, {
      uploadUrl: record.uploadUrl,
      title: record.title,
      platform,
    });

    const elapsed = Date.now() - startMs;
    await message.reply({
      embeds: [buildDashCacheEmbed({
        userId: message.author.id,
        title: record.title,
        platform,
        boomboxUrl: record.uploadUrl,
        elapsedMs: elapsed,
        savedAt: new Date(record.uploadTime).toLocaleString("id-ID"),
      })],
    }).catch(() => {});
    return;
  }

  // 5. Send processing / Preparing... embed
  const processingMsg = await message.reply({
    embeds: [buildDashProcessingEmbed(message.author.id, "Connecting...")],
  }).catch(() => null);

  if (!processingMsg) return;

  // 6. Enqueue for background processing
  const priority = getJobPriority(member);

  try {
    const uploadUrl = await enqueueForPlatform(platform, priority, async () => {
      // Resolve provider
      const provider = router.getProvider(platform.toLowerCase());
      if (!provider) throw new Error(`Unsupported platform provider: ${platform}`);

      // Step 2: Reading Metadata
      await processingMsg.edit({ embeds: [buildDashProcessingEmbed(message.author.id, "Reading Metadata...")] }).catch(() => {});
      const audioData = await provider.getAudioURL(videoId, url);

      // Verify duration limits
      const effectiveMaxDurationSec = db.getEffectiveDurationLimitSec(member, DEFAULT_MAX_DURATION_SEC);
      if (audioData.duration > effectiveMaxDurationSec) {
        throw new Error(`DURATION_LIMIT_EXCEEDED:${audioData.duration}`);
      }

      // Step 3: Downloading & Uploading
      await processingMsg.edit({ embeds: [buildDashProcessingEmbed(message.author.id, "Uploading BoomBox...")] }).catch(() => {});

      // Save to cache & DB
      db.set(cacheKey, {
        videoId, platform, title: audioData.title, duration: audioData.duration,
        uploadUrl: audioData.uploadUrl, uploadTime: Date.now(),
        status: 'ok', useCount: 1, lastUsed: Date.now(),
      });

      cacheManager.set(cacheKey, {
        uploadUrl: audioData.uploadUrl,
        title: audioData.title,
        platform,
      });

      return audioData;
    });

    // Success! Update stats, usage, and edit reply
    db.incrementUsage(message.author.id);
    db.incrementStats(platform, `Fresh Conversion (${platform})`);

    const elapsed = Date.now() - startMs;
    const usage = db.getUsage(message.author.id);

    await processingMsg.edit({
      embeds: [buildDashSuccessEmbed({
        userId: message.author.id,
        title: uploadUrl.title,
        artist: uploadUrl.artist,
        platform,
        boomboxUrl: uploadUrl.uploadUrl,
        thumbnail: uploadUrl.thumbnail,
        elapsedMs: elapsed,
        fromCache: false,
      })],
    }).catch(() => {});

    // Update global Log Dashboard Panel
    await updateBoomBoxLogDashboard(message.client);

  } catch (err) {
    db.incrementFailureStats(platform);

    if (err.message?.startsWith("DURATION_LIMIT_EXCEEDED:")) {
      const seconds = parseInt(err.message.split(":")[1], 10);
      const limitSec = db.getEffectiveDurationLimitSec(member, DEFAULT_MAX_DURATION_SEC);
      await processingMsg.edit({
        embeds: [buildDurationLimitEmbed(seconds, limitSec)],
      }).catch(() => {});
      return;
    }

    logger.error(`Pipeline failure for ${cacheKey}: ${err.message}`);

    await processingMsg.edit({
      embeds: [buildDashErrorEmbed({ userId: message.author.id })],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bm:detail:${storeErrorDetail({ message: err.message, stage: "Pipeline processing", stack: err.stack })}`)
            .setLabel("🔍 Detail")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    }).catch(() => {});
  }
}

async function updateBoomBoxLogDashboard(client) {
  const globalLogCh = db.getLogChannel();
  if (!globalLogCh) return;

  try {
    const ch = await client.channels.fetch(globalLogCh).catch(() => null);
    if (ch?.isTextBased()) {
      const state = db.getLogState();
      if (state.messageId) {
        try {
          const old = await ch.messages.fetch(state.messageId);
          await old.edit(buildPublicLogPanel());
        } catch {
          // If deleted, create a new one
          const newMsg = await ch.send(buildPublicLogPanel());
          db.setLogState({ messageId: newMsg.id });
        }
      } else {
        const newMsg = await ch.send(buildPublicLogPanel());
        db.setLogState({ messageId: newMsg.id });
      }
    }
  } catch (e) {
    logger.warn(`Failed to update public log dashboard: ${e.message}`);
  }
}

const DEFAULT_MAX_DURATION_SEC = 25 * 60; // 25 minutes
