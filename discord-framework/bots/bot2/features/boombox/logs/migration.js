/**
 * migration.js — BoomBox Logs V2 one-time migration.
 */

import { db }                   from "../database.js";
import { createLogger }         from "../../../../../shared/logger/index.js";
import { buildPublicLogPanel }  from "./viewer.js";
import { BOOMBOX_CONFIG }       from "../config.js";

const logger = createLogger("LogMigration");

// Regex untuk mendeteksi BoomBox/Top4Top URL di dalam embed
const BOOMBOX_URL_RE = /https?:\/\/[^\s<>"']+top4top\.[^\s<>"']+/gi;

/** @param {string} url */
function cleanBoomboxUrl(url) {
  return url.replace(/[)>\]'"]+$/, "").trim();
}

/**
 * Coba ekstrak entry BoomBox dari sebuah Discord Message.
 */
function extractEntriesFromMessage(msg) {
  const results = [];

  for (const embed of msg.embeds) {
    const desc    = embed.description ?? "";
    const allText = [
      embed.title ?? "",
      desc,
      ...embed.fields.map(f => `${f.name}\n${f.value}`),
    ].join("\n");

    const rawUrls = allText.match(BOOMBOX_URL_RE) ?? [];
    if (rawUrls.length === 0) continue;

    let platform = "YouTube";
    const lower  = allText.toLowerCase();
    if (lower.includes("tiktok"))  platform = "TikTok";
    else if (lower.includes("spotify")) platform = "Spotify";

    const blockRe = /\*\*\d+\.\*\*\s*\n?🎵\s*(.+?)\n🔗\s*(https?:\/\/\S+)\n(?:🕒\s*(.+))?/gm;
    let m;
    let matched = false;
    while ((m = blockRe.exec(desc)) !== null) {
      const title      = m[1]?.trim() ?? "Unknown";
      const boomboxUrl = cleanBoomboxUrl(m[2] ?? "");
      const rawDate    = m[3]?.trim();
      const timestamp  = rawDate ? _parseWIBDate(rawDate) : (msg.createdAt?.toISOString() ?? new Date().toISOString());
      if (boomboxUrl) {
        results.push({ title, platform, boomboxUrl, timestamp });
        matched = true;
      }
    }

    if (!matched) {
      for (const rawUrl of rawUrls) {
        const boomboxUrl = cleanBoomboxUrl(rawUrl);
        const title      = embed.title?.replace(/^\s*📻\s*BoomBox\s*Logs?\s*/i, "").trim() || "Unknown";
        const timestamp  = msg.createdAt?.toISOString() ?? new Date().toISOString();
        results.push({ title, platform, boomboxUrl, timestamp });
      }
    }
  }

  return results;
}

/**
 * Parse a WIB-formatted date string "DD/MM/YYYY HH:MM WIB" into an ISO string.
 */
function _parseWIBDate(raw) {
  try {
    const m = /(\d{2})\/(\d{2})\/(\d{4})\s+•?\s*(\d{2}):(\d{2})/.exec(raw);
    if (!m) return new Date().toISOString();
    const [, dd, mm, yyyy, hh, min] = m;
    const utcMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh - 7, +min);
    return new Date(utcMs).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Merge entries from logState.entries into history[] — dedup by boomboxUrl.
 */
function _migrateLogStateEntries(seenUrls) {
  const { entries } = db.getLogState();
  if (!Array.isArray(entries) || entries.length === 0) return 0;

  let added = 0;
  for (const e of entries) {
    const url = e.boomboxUrl;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    db.addHistory({
      platform:  e.platform ?? "YouTube",
      title:     e.title    ?? "Unknown",
      boomboxUrl: url,
      duration:  e.duration ?? null,
      timestamp: e.timestamp ?? new Date().toISOString(),
      userId:         "_migrated_",
      originalUrl:    url,
      limitRemaining: "-",
    });
    added++;
  }
  return added;
}

/**
 * Main migration function. Call once from ready.js.
 */
export async function runBoomBoxLogsMigrationV2(client) {
  if (db.getMigrationV2Done()) {
    logger.debug("V2 migration already done — skipping.");
    return;
  }

  const logChannelId = db.getLogChannel() ?? BOOMBOX_CONFIG.BOOMBOX_LOG_CHANNEL_ID;
  if (!logChannelId) {
    logger.warn("Log channel belum dikonfigurasi — migrasi ditunda.");
    return;
  }

  logger.info(`Memulai migrasi BoomBox Logs ke V2... (channel: ${logChannelId})`);

  const existingHistory = db.getHistoryByPlatform(null);
  const seenUrls = new Set(existingHistory.map(e => e.boomboxUrl).filter(Boolean));

  const fromLogState = _migrateLogStateEntries(seenUrls);
  logger.info(`Step 1 — logState.entries: ${fromLogState} entri baru ditambahkan.`);

  const ch = await client.channels.fetch(logChannelId).catch(() => null);
  if (!ch?.isTextBased()) {
    logger.warn(
      `Log channel ${logChannelId} tidak ditemukan atau bukan text channel. Migrasi ditunda.`
    );
    return;
  }

  const state = db.getLogState();

  try {
    let lastId = undefined;
    const messagesToDelete = [];
    let batchNum = 0;

    while (true) {
      batchNum++;
      const fetchOptions = { limit: 100 };
      if (lastId) fetchOptions.before = lastId;

      const msgs = await ch.messages.fetch(fetchOptions);
      if (!msgs || msgs.size === 0) break;

      logger.debug(`Batch ${batchNum}: scanning ${msgs.size} messages`);

      for (const [id, msg] of msgs) {
        if (state.messageId && id === state.messageId) continue;

        const entries = extractEntriesFromMessage(msg);
        for (const entry of entries) {
          if (!seenUrls.has(entry.boomboxUrl)) {
            seenUrls.add(entry.boomboxUrl);
            db.addHistory({
              platform:       entry.platform,
              title:          entry.title,
              boomboxUrl:     entry.boomboxUrl,
              duration:       null,
              timestamp:      entry.timestamp,
              userId:         "_migrated_",
              originalUrl:    entry.boomboxUrl,
              limitRemaining: "-",
            });
          }
        }

        const isBotMsg = msg.author?.id === client.user?.id;
        if (isBotMsg || entries.length > 0) messagesToDelete.push(msg);
      }

      lastId = msgs.last()?.id;
      if (msgs.size < 100) break;
    }

    let channelDeleted = 0;
    for (const msg of messagesToDelete) {
      try {
        await msg.delete();
        channelDeleted++;
      } catch (e) {
        logger.warn(`Gagal hapus pesan ${msg.id}: ${e.message}`);
      }
    }

    const panelPayload = buildPublicLogPanel();
    if (state.messageId) {
      try {
        const existing = await ch.messages.fetch(state.messageId);
        await existing.edit(panelPayload);
        logger.info("Step 4 — Panel V2 di-edit (sudah ada).");
      } catch {
        const newMsg = await ch.send(panelPayload);
        db.setLogState({ messageId: newMsg.id });
        logger.info(`Step 4 — Panel V2 baru dibuat: ${newMsg.id}`);
      }
    } else {
      const newMsg = await ch.send(panelPayload);
      db.setLogState({ messageId: newMsg.id });
      logger.info(`Step 4 — Panel V2 baru dibuat: ${newMsg.id}`);
    }

  } catch (err) {
    logger.error(
      `❌ Fatal error — migrasi ditunda: ${err.message}`
    );
    return;
  }

  db.setMigrationV2Done(true);
  logger.info(`✅ Selesai migrasi Boombox Logs V2.`);
}
