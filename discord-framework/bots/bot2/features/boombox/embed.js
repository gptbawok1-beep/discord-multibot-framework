/**
 * boomboxEmbed.js — Embed builders for BoomBox.
 */

import { EmbedBuilder } from "discord.js";

const COLOR_PROCESSING = 0x5865f2; // Blurple
const COLOR_SUCCESS    = 0x57f287; // Green
const COLOR_DURATION   = 0xfaa61a; // Orange — limit notice, not an error
const COLOR_ERROR      = 0xed4245; // Red
const COLOR_QUEUE      = 0xfee75c; // Yellow — waiting, not an error
const FOOTER_TEXT      = "BoomBox";

export const LOG_SEP = "━━━━━━━━━━━━━━━━━━";

/**
 * Format seconds → "H:MM:SS" or "MM:SS".
 * @param {number|null} seconds
 */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "N/A";
  const s   = Math.floor(seconds);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Truncate a title to maxLen chars, appending "..." if cut.
 * @param {string|null} title
 * @param {number} maxLen
 */
export function truncateTitle(title, maxLen = 40) {
  if (!title) return "Unknown";
  return title.length > maxLen ? title.slice(0, maxLen - 3) + "..." : title;
}

const STEPS = [
  { spinner: "⠋", label: "Connecting..."      }, // 0
  { spinner: "⠹", label: "Reading Metadata..."}, // 1
  { spinner: "⠼", label: "Downloading Audio..."},// 2
  { spinner: "⠦", label: "Uploading BoomBox..." }, // 3
  { spinner: "⠇", label: "Verifying..."       }, // 4
];

/**
 * Build the processing embed for a given pipeline step.
 */
export function buildProcessingEmbed(stepIndex = 0, thumbnail = null, labelOverride = null) {
  const { spinner, label } = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const displayLabel = labelOverride ?? label;
  const embed = new EmbedBuilder()
    .setColor(COLOR_PROCESSING)
    .setTitle("🎵 BoomBox")
    .setDescription(`${spinner} ${displayLabel}`)
    .setFooter({ text: FOOTER_TEXT });
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

/**
 * Build queue notification embed.
 */
export function buildQueueEmbed(user, position, total, etaSec) {
  return new EmbedBuilder()
    .setColor(COLOR_QUEUE)
    .setTitle("🎵 BoomBox — Antrean")
    .setDescription(
      `<@${user.id}>\n\n` +
      `⏳ Posisi: **#${position}**${total > 1 ? ` dari ${total}` : ""}  |  ±${etaSec}s`,
    )
    .setFooter({ text: FOOTER_TEXT });
}

/**
 * Success embed.
 */
export function buildResultEmbed(platform, ytResult, boomboxUrl, elapsedMs, usageInfo, downloadMs = 0, uploadMs = 0) {
  const title    = truncateTitle(ytResult.title, 40);
  const duration = formatDuration(ytResult.duration);
  const elapsed  = `${(elapsedMs / 1000).toFixed(1)}s`;

  const limitLine = usageInfo.isUnlimited
    ? "👑 Premium : Unlimited"
    : `💎 Free : ${usageInfo.usage} / ${usageInfo.limit}`;

  const rawProvider = ytResult.provider ?? null;
  const providerLabel = rawProvider
    ? rawProvider
        .replace("yt-dlp/method", "yt-dlp #")
        .replace("ytdl-core (race)", "ytdl-core")
        .replace("yt-dlp (race)", "yt-dlp")
    : null;

  const dlSec   = (downloadMs / 1000).toFixed(1);
  const upSec   = (uploadMs   / 1000).toFixed(1);
  const timingValue = downloadMs > 0
    ? `⬇️ ${dlSec}s  ⬆️ ${upSec}s  ⏱ ${elapsed}`
    : `⚡ ${elapsed} (cached)`;

  const embed = new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setTitle("🎵 BoomBox Ready")
    .addFields(
      { name: "🎵 Song Title",  value: title,        inline: false },
      { name: "🌍 Platform",    value: platform,     inline: true  },
      { name: "⏱ Duration",     value: duration,     inline: true  },
      { name: "🔗 BoomBox URL", value: boomboxUrl,   inline: false },
      { name: "📊 Daily Limit", value: limitLine,    inline: false },
      { name: "⚡ Waktu",       value: timingValue,  inline: false },
    )
    .setFooter({ text: providerLabel ? `${FOOTER_TEXT} • via ${providerLabel}` : FOOTER_TEXT })
    .setTimestamp();

  if (ytResult.thumbnail) embed.setThumbnail(ytResult.thumbnail);

  return embed;
}

/**
 * Shown when the video exceeds the max supported duration.
 */
export function buildDurationLimitEmbed(detectedSec, maxSec = 25 * 60) {
  const maxMin = Math.floor(maxSec / 60);
  const dMin   = Math.floor(detectedSec / 60);
  const dSec   = detectedSec % 60;
  const detFmt = dSec > 0 ? `${dMin} Minutes ${dSec} Seconds` : `${dMin} Minutes`;

  return new EmbedBuilder()
    .setColor(COLOR_DURATION)
    .setTitle("⏱ Duration Limit")
    .addFields(
      { name: "❌ Maximum Duration", value: `${maxMin} Minutes`, inline: true  },
      { name: "⚠️ Your Video",       value: detFmt,             inline: true  },
    )
    .setDescription(`Please choose a video under **${maxMin} minutes**.`)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Clean user-facing error embed.
 */
export function buildUserErrorEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("❌ BoomBox gagal diproses.")
    .setDescription("Silakan coba lagi beberapa saat.")
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Shown when the URL doesn't match any supported platform.
 */
export function buildUnsupportedPlatformEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("⚠️ Platform belum didukung.")
    .setDescription(
      "Saat ini BoomBox hanya mendukung:\n\n" +
      "• **YouTube** (termasuk YouTube Music & Shorts)\n" +
      "• **TikTok**\n" +
      "• **Spotify** (track saja)"
    )
    .setFooter({ text: FOOTER_TEXT });
}

export function buildErrorEmbed(err) {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const { label, reason, suggestion } = classifyError(rawMsg);

  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("❌ BoomBox Failed")
    .addFields(
      { name: "❗ Reason",     value: `**${label}**\n${reason}`, inline: false },
      { name: "💡 Suggestion", value: suggestion,                inline: false },
    )
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

export function buildErrorDetailEmbed(detail) {
  const stackBlock = detail.stack
    ? "```\n" + detail.stack.slice(0, 1000) + "\n```"
    : "```\n" + detail.message.slice(0, 1000) + "\n```";

  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("🔍 BoomBox Failure — Technical Detail")
    .addFields(
      { name: "📍 Stage",       value: String(detail.stage || "Unknown"), inline: true  },
      { name: "📜 Detail",      value: stackBlock,                        inline: false },
    )
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

export function formatWIB(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day:      "2-digit",
    month:    "short",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} • ${get("hour")}:${get("minute")} WIB`;
}

export function buildLogEntryBlock(entry) {
  const title = truncateTitle(entry.title, 60);
  return `🎵 ${title}\n🔗 ${entry.boomboxUrl ?? "-"}`;
}

function classifyError(msg) {
  const m = msg.toLowerCase();

  const httpMatch = msg.match(/HTTP (\d{3})/i);
  if (httpMatch) {
    const code = parseInt(httpMatch[1], 10);
    const suggestions = {
      403: "Coba lagi nanti atau gunakan video dari sumber lain.",
      404: "Pastikan link valid dan video masih tersedia.",
      429: "Tunggu beberapa menit sebelum mencoba lagi.",
      500: "Server sedang bermasalah. Coba lagi nanti.",
    };
    return {
      label:      `HTTP ${code}`,
      reason:     msg.slice(0, 200),
      suggestion: suggestions[code] ?? "Coba lagi beberapa saat.",
    };
  }

  if (m.includes("anti-bot") || m.includes("not a bot") || m.includes("not a robot"))
    return { label: "Anti-Bot Detection",      reason: "YouTube mendeteksi seluruh metode download sebagai bot dan menahan akses.", suggestion: "Ini biasanya sementara — coba lagi dalam beberapa menit, atau coba video lain." };
  if (m.includes("unsupported url"))
    return { label: "Unsupported URL",        reason: "Link tidak dikenali oleh downloader.", suggestion: "Pastikan link valid, publik, dan berasal dari YouTube atau TikTok." };
  if (m.includes("timed out") || m.includes("timeout"))
    return { label: "Network Timeout",        reason: "Download tidak merespons dalam 2 menit.", suggestion: "Coba lagi — server mungkin sedang sibuk." };
  if (m.includes("region blocked"))
    return { label: "Region Blocked",         reason: "Video tidak tersedia di wilayah server / diblokir karena copyright.", suggestion: "Coba video lain yang tidak memiliki pembatasan wilayah." };
  if (m.includes("deleted video") || m.includes("dihapus"))
    return { label: "Deleted Video",          reason: "Video ini telah dihapus oleh pembuatnya.", suggestion: "Video tidak dapat diproses lagi — coba link lain." };
  if (m.includes("tidak tersedia") || m.includes("unavailable"))
    return { label: "Video Unavailable",      reason: "Video tidak tersedia atau telah dihapus.", suggestion: "Periksa apakah video masih bisa diakses publik." };
  if (m.includes("privat") || m.includes("private"))
    return { label: "Private Video",          reason: "Video bersifat privat — tidak dapat diakses.", suggestion: "Gunakan video yang bisa diakses publik." };
  if (m.includes("login") || m.includes("usia") || m.includes("age"))
    return { label: "Login Required",         reason: "Video memerlukan login atau dibatasi usia.", suggestion: "Gunakan video yang bisa diakses tanpa login." };
  if (m.includes("geo") || m.includes("wilayah") || m.includes("country") || m.includes("copyright"))
    return { label: "Region Blocked",         reason: "Video tidak tersedia di wilayah server.", suggestion: "Coba video lain yang tidak memiliki pembatasan wilayah." };
  if (m.includes("tidak ditemukan") || m.includes("not found") || m.includes("no such"))
    return { label: "Video Not Found",        reason: "Video tidak ditemukan.", suggestion: "Pastikan link benar dan video masih ada." };
  if (m.includes("top4top") || m.includes("upload"))
    return { label: "Upload Failed",          reason: msg.slice(0, 200), suggestion: "Layanan hosting sedang bermasalah. Coba lagi nanti." };
  if (m.includes("enotfound") || m.includes("getaddrinfo"))
    return { label: "DNS Error",              reason: "Domain tidak dapat ditemukan oleh server.", suggestion: "Masalah pada koneksi server. Coba lagi nanti." };
  if (m.includes("econnrefused"))
    return { label: "Connection Refused",     reason: "Koneksi ditolak oleh server.", suggestion: "Server mungkin sedang offline. Coba lagi nanti." };
  if (m.includes("network") || m.includes("socket") || m.includes("econnreset"))
    return { label: "Network Error",          reason: msg.slice(0, 200), suggestion: "Masalah pada jaringan server. Coba lagi nanti." };

  return {
    label:      "Conversion Failed",
    reason:     msg.slice(0, 300),
    suggestion: "Coba lagi atau gunakan video lain.",
  };
}
