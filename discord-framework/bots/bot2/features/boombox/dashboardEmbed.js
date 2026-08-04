/**
 * dashboardEmbed.js — Embed builders yang menggunakan dashboard config dari DB.
 */

import { EmbedBuilder } from "discord.js";
import { db } from "./database.js";

const SEP = "━━━━━━━━━━━━━━━━━━";

function parseColor(hex) {
  const clean = (hex ?? "#5865f2").replace("#", "");
  const n = parseInt(clean, 16);
  return isNaN(n) ? 0x5865f2 : n;
}

/**
 * Format elapsed milliseconds.
 */
export function formatElapsed(ms, fmt = "auto") {
  if (!ms && ms !== 0) return "—";
  switch (fmt) {
    case "ms":     return `${Math.round(ms)} ms`;
    case "s":      return `${(ms / 1000).toFixed(2)} Detik`;
    case "minsec": {
      const totalSec = Math.floor(ms / 1000);
      const min      = Math.floor(totalSec / 60);
      const sec      = totalSec % 60;
      return `${min} Menit ${sec} Detik`;
    }
    case "auto":
    default:
      if (ms < 1000)          return `${Math.round(ms)} ms`;
      if (ms < 60_000)        return `${(ms / 1000).toFixed(2)} Detik`;
      {
        const totalSec = Math.floor(ms / 1000);
        const min      = Math.floor(totalSec / 60);
        const sec      = totalSec % 60;
        return `${min} Menit ${sec} Detik`;
      }
  }
}

function nowWIB() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone:  "Asia/Jakarta",
    day:       "2-digit",
    month:     "long",
    year:      "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    false,
  }).format(new Date()) + " WIB";
}

function applyGif(embed, dash, type) {
  if (!dash.showGif) return;
  const url = dash.gifs?.[type];
  if (url) embed.setImage(url);
}

function applyFooter(embed, dash) {
  if (dash.showFooter) embed.setFooter({ text: "🎵 BoomBox" });
}

function applyTimestamp(embed, dash) {
  if (dash.showTimestamp) embed.setTimestamp();
}

function mentionLine(dash, userId) {
  return dash.showMention && userId ? `<@${userId}>` : "";
}

// ── Processing Embed ──────────────────────────────────────────────────────────

export function buildDashProcessingEmbed(userId = null, stepLabel = null, thumbnail = null, dashOverride = null) {
  const dash   = dashOverride ?? db.getDashboard();
  const color  = parseColor(dash.embedColor);
  const label  = stepLabel ?? "Sedang Memproses...";
  const mention = mentionLine(dash, userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push("", `⏳ ${label}`, "", "Mohon tunggu sebentar.", "", SEP);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle("⏳ DIPROSES")
    .setDescription(descParts.join("\n"));

  if (thumbnail && dash.showThumbnail) embed.setThumbnail(thumbnail);
  applyGif(embed, dash, "loading");
  applyFooter(embed, dash);

  return embed;
}

// ── Success Embed ─────────────────────────────────────────────────────────────

export function buildDashSuccessEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const color   = parseColor(dash.embedColor);
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push("", "✅ Berhasil Diproses", "", SEP);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ BERHASIL")
    .setDescription(descParts.join("\n"));

  if (opts.title)  embed.addFields({ name: "🎵 Judul",           value: String(opts.title).slice(0, 256),  inline: false });
  if (opts.artist) embed.addFields({ name: "👤 Artist / Channel", value: String(opts.artist).slice(0, 256), inline: false });
  if (opts.platform) embed.addFields({ name: "📦 Platform",       value: opts.platform,                     inline: true  });

  if (dash.showDuration && opts.elapsedMs != null) {
    const durLabel = opts.fromCache ? "⏱️ Waktu Pengambilan Cache" : "⏱️ Durasi Proses";
    embed.addFields({ name: durLabel, value: formatElapsed(opts.elapsedMs, dash.durationFormat), inline: true });
  }

  embed.addFields({ name: "📅 Diproses",  value: nowWIB(),      inline: false });
  embed.addFields({ name: "⬇️ Download", value: opts.boomboxUrl ?? "—", inline: false });

  if (opts.thumbnail && dash.showThumbnail) embed.setThumbnail(opts.thumbnail);

  applyGif(embed, dash, "success");
  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}

// ── Cache Embed ───────────────────────────────────────────────────────────────

export function buildDashCacheEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push("", "📦 File Sudah Tersedia", "", "File ditemukan di database.", "Tidak perlu diproses ulang.", "", SEP);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📦 CACHE")
    .setDescription(descParts.join("\n"));

  if (opts.title)  embed.addFields({ name: "🎵 Judul",            value: String(opts.title).slice(0, 256),  inline: false });
  if (opts.artist) embed.addFields({ name: "👤 Artist / Channel",  value: String(opts.artist).slice(0, 256), inline: false });
  if (opts.platform) embed.addFields({ name: "📦 Platform",        value: opts.platform,                     inline: true  });

  if (dash.showDuration && opts.elapsedMs != null) {
    embed.addFields({ name: "⏱️ Waktu Pengambilan Cache", value: formatElapsed(opts.elapsedMs, dash.durationFormat), inline: true });
  }

  if (opts.savedAt) embed.addFields({ name: "📅 Tersimpan",  value: String(opts.savedAt).slice(0, 100), inline: false });
  if (opts.boomboxUrl) embed.addFields({ name: "⬇️ Download", value: opts.boomboxUrl,                   inline: false });

  if (opts.thumbnail && dash.showThumbnail) embed.setThumbnail(opts.thumbnail);

  applyGif(embed, dash, "cache");
  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}

// ── Error Embed ───────────────────────────────────────────────────────────────

export function buildDashErrorEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push(
    "",
    "❌ Gagal Diproses",
    "",
    "Penyebab:",
    "",
    "• Link tidak valid",
    "atau",
    "• Platform tidak didukung",
    "atau",
    "• File tidak ditemukan",
    "",
    "Silakan periksa kembali link yang dikirim.",
    "",
    SEP
  );

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("❌ GAGAL")
    .setDescription(descParts.join("\n"));

  applyGif(embed, dash, "error");
  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}

// ── Maintenance Embed ─────────────────────────────────────────────────────────

export function buildDashMaintenanceEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push(
    "",
    "🛠 BoomBox Sedang Maintenance",
    "",
    "Fitur sementara tidak dapat digunakan.",
    "Silakan tunggu hingga maintenance selesai.",
    "",
    SEP
  );

  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle("🛠 MAINTENANCE")
    .setDescription(descParts.join("\n"));

  applyGif(embed, dash, "maintenance");
  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}

// ── Timeout Embed ─────────────────────────────────────────────────────────────

export function buildDashTimeoutEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push(
    "",
    "⌛ Waktu Pemrosesan Habis",
    "",
    "Server tidak memberikan respons.",
    "Silakan coba kembali nanti.",
    "",
    SEP
  );

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("⌛ TIMEOUT")
    .setDescription(descParts.join("\n"));

  applyGif(embed, dash, "timeout");
  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}

// ── Gangguan Embed ────────────────────────────────────────────────────────────

export function buildDashDisruptionEmbed(opts = {}) {
  const dash    = opts.dashOverride ?? db.getDashboard();
  const mention = mentionLine(dash, opts.userId);

  const descParts = [SEP, "", "🎵 BoomBox"];
  if (mention) descParts.push(mention);
  descParts.push(
    "",
    "⚠️ BoomBox Sedang Mengalami Gangguan",
    "",
    "Layanan sedang bermasalah.",
    "Silakan coba beberapa menit lagi.",
    "",
    SEP
  );

  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle("⚠️ GANGGUAN")
    .setDescription(descParts.join("\n"));

  if (dash.showGif) {
    const url = dash.gifs?.error || dash.gifs?.maintenance;
    if (url) embed.setImage(url);
  }

  applyFooter(embed, dash);
  applyTimestamp(embed, dash);

  return embed;
}
