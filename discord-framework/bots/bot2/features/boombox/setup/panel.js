/**
 * panel.js — Panel utama BoomBox Setup & Unified Dashboard.
 *
 * Menggunakan StringSelectMenu (dropdown) sebagai navigasi utama,
 * bukan banyak tombol.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { db }              from "../database.js";
import { providerHealth }  from "../providers/providerHealth.js";
import { getQueueSnapshot } from "../queue.js";
import { getCacheStats }    from "../cache.js";

const COLOR  = 0x3498DB; // Boombox blue
const FOOTER = "BoomBox • Dashboard Utama";

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

// ── Unified Main Dashboard Builder ────────────────────────────────────────────

export function buildBoomboxMainDashboard(userId = null) {
  const stats = db.getStatistics();
  const cStats = getCacheStats();
  const qSnap = getQueueSnapshot();
  const allStatuses = providerHealth.getAllStatuses();

  const activeProviders = Object.keys(allStatuses)
    .filter(k => allStatuses[k].status === "ONLINE")
    .join(", ") || "None";

  const memory = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;
  const uptime = formatUptime(process.uptime());

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎵 BoomBox — Dashboard Utama")
    .setDescription(
      "Selamat datang di Pusat Kontrol BoomBox GTA SA:MP.\n" +
      "Di sini Anda dapat mendownload lagu, mengatur channel, mengelola logs, cookies, " +
      "dan memantau performa bot secara real-time."
    )
    .addFields(
      {
        name: "📈 Statistik Konversi",
        value: `• **Total Download**: ${stats.total}\n• **Sukses**: ✅ ${stats.successCount}\n• **Gagal**: ❌ ${stats.failureCount}`,
        inline: true
      },
      {
        name: "💾 Cache Layer",
        value: `• **Hit Rate**: ${cStats.hitRate}\n• **Cache Hit**: ${cStats.hits}\n• **Cache Miss**: ${cStats.misses}`,
        inline: true
      },
      {
        name: "⚙️ Sistem & Performa",
        value: `• **Worker**: ${qSnap.active} aktif / ${qSnap.maxConcurrent} max\n• **Memory**: ${memory}\n• **Uptime**: ${uptime}`,
        inline: false
      },
      {
        name: "🔌 Provider Aktif",
        value: `\`\`\`\n${activeProviders}\n\`\`\``,
        inline: false
      }
    )
    .setFooter({ text: "🩸 Kenyut" })
    .setTimestamp();

  // Row 1: Core Operations & Settings
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbdash:download")
      .setLabel("Download")
      .setEmoji("🎵")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbdash:setup")
      .setLabel("Setup")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbdash:queue")
      .setLabel("Queue")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbdash:dashboard")
      .setLabel("Dashboard Config")
      .setEmoji("🎨")
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 2: Resources & Management
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbdash:logs")
      .setLabel("Logs")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbdash:resource")
      .setLabel("Resource Manager")
      .setEmoji("🗂️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbdash:maintenance")
      .setLabel("Maintenance")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbdash:stats")
      .setLabel("Statistics")
      .setEmoji("📈")
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 3: Navigation
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bawok_back_home")
      .setLabel("Back Home")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bawok_close_panel")
      .setLabel("Close Panel")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// ── Dropdown navigasi utama (Setup panel lama) ────────────────────────────────

function _buildMenuRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("bbsetup:menu:select")
      .setPlaceholder("⚙️ Pilih opsi konfigurasi...")
      .addOptions([
        { label: "📺 Channel",           value: "channel",     description: "Atur channel BoomBox per platform" },
        { label: "📋 Logs",              value: "logs",        description: "Atur channel log BoomBox" },
        { label: "🛠️ Maintenance",       value: "maintenance", description: "Toggle maintenance per platform" },
        { label: "📊 Monitor",           value: "monitor",     description: "Lihat status provider, queue, cache, dan statistik" },
        { label: "⏱️ Batas Durasi",      value: "duration",    description: "Atur batas durasi audio per role" },
        { label: "🎨 Dashboard BoomBox", value: "dashboard",   description: "Atur tampilan embed BoomBox" },
        { label: "🗄️ Resource Manager",  value: "resource",    description: "Kelola Cookies, GIF, dan status resource BoomBox" },
        { label: "🗑️ Reset Konfigurasi", value: "reset",       description: "Hapus seluruh konfigurasi BoomBox" },
      ]),
  );
}

function _buildBackRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:back_to_dashboard")
      .setLabel("🔙 Dashboard Utama")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbsetup:close")
      .setLabel("❌ Tutup")
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Panel utama ───────────────────────────────────────────────────────────────

function _buildPanelEmbed() {
  const channels      = db.getChannels();
  const maintenance   = db.getMaintenance();
  const logChannel    = db.getLogChannel();
  const platformLogCh = db.getPlatformLogChannels();

  const chYT  = channels.youtube ? `<#${channels.youtube}>` : "❌ Belum diatur";
  const chTK  = channels.tiktok  ? `<#${channels.tiktok}>`  : "❌ Belum diatur";
  const chSP  = channels.spotify ? `<#${channels.spotify}>` : "❌ Belum diatur";
  const chLog = logChannel        ? `<#${logChannel}>`       : "❌ Belum diatur";

  const chLogYT = platformLogCh.youtube ? `<#${platformLogCh.youtube}>` : "—";
  const chLogTK = platformLogCh.tiktok  ? `<#${platformLogCh.tiktok}>`  : "—";
  const chLogSP = platformLogCh.spotify ? `<#${platformLogCh.spotify}>` : "—";

  const maintYT = maintenance.youtube ? "🔴 Maintenance" : "🟢 Aktif";
  const maintTK = maintenance.tiktok  ? "🔴 Maintenance" : "🟢 Aktif";
  const maintSP = maintenance.spotify ? "🔴 Maintenance" : "🟢 Aktif";

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎵 BoomBox — Konfigurasi")
    .addFields(
      { name: "📺 Channel",     value: `YouTube: ${chYT}\nTikTok: ${chTK}\nSpotify: ${chSP}`, inline: true },
      { name: "🛠️ Status",     value: `YouTube: ${maintYT}\nTikTok: ${maintTK}\nSpotify: ${maintSP}`, inline: true },
      { name: "📋 Global Log", value: chLog, inline: false },
      { name: "📊 Platform Log", value: `YouTube: ${chLogYT}\nTikTok: ${chLogTK}\nSpotify: ${chLogSP}`, inline: false },
    )
    .setFooter({ text: "BoomBox • Setup" })
    .setTimestamp();
}

export function buildSetupBoomBoxPanel() {
  return { embeds: [_buildPanelEmbed()], components: [_buildMenuRow(), _buildBackRow()] };
}

export function buildConfiguredBoomBoxPanel() {
  return buildSetupBoomBoxPanel();
}

// ── Konfirmasi hapus ──────────────────────────────────────────────────────────

export function buildDeleteConfirmPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🗑️ Reset Konfigurasi BoomBox")
    .setDescription(
      "⚠️ Yakin ingin mereset **seluruh konfigurasi** BoomBox?\n\n" +
      "Semua channel, log channel, maintenance, dan role limits akan dihapus.\n" +
      "Bot tidak akan memproses BoomBox sampai di-setup ulang."
    )
    .setFooter({ text: "BoomBox • Reset" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bbsetup:delete:confirm").setLabel("✅ Ya, Reset").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("bbsetup:delete:cancel").setLabel("❌ Batal").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

// ── Closed ────────────────────────────────────────────────────────────────────

export function buildClosedEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎵 BoomBox")
    .setDescription("Panel ditutup.")
    .setFooter({ text: "BoomBox • Closed" });
}

// ── Monitor ───────────────────────────────────────────────────────────────────

export function buildMonitorEmbed() {
  const allStatuses = providerHealth.getAllStatuses();
  const providerLines = Object.entries(allStatuses).map(([label, s]) => {
    const icon   = s.status === "ONLINE" ? "🟢" : "🔴";
    const streak = s.consecutiveFailures > 0 ? ` (${s.consecutiveFailures}x gagal)` : "";
    const skip   = s.totalSkipped > 0 ? ` | skip=${s.totalSkipped}` : "";
    return `${icon} **${label}** — ✅ ${s.totalSuccess} | ❌ ${s.totalFailure}${skip}${streak}`;
  });
  const providerSection = providerLines.length > 0 ? providerLines.join("\n") : "_Belum ada data._";

  const q = getQueueSnapshot();
  const c = getCacheStats();
  const stats = db.getStatistics();

  const byPlatformLines = Object.entries(stats.byPlatform).map(([p, n]) => `${p}: ${n}`).join("  |  ");
  const byProviderLines = Object.entries(stats.byProvider ?? {})
    .sort(([, a], [, b]) => b - a).slice(0, 6)
    .map(([p, n]) => `${p}: ${n}`).join("\n");

  const desc = [
    "**🔌 Provider**",
    providerSection,
    "",
    "**🗂️ Queue**",
    `Aktif: **${q.active}** / ${q.maxConcurrent}  |  Antrean: **${q.queued}**`,
    "",
    "**💾 Cache**",
    `Result: **${c.resultSize}**  |  Meta: **${c.metaSize}**  |  Hit Rate: **${c.hitRate}** (${c.hits}/${c.hits + c.misses})`,
    "",
    "**📈 Statistik**",
    `Total: **${stats.total}**  |  ✅ ${stats.successCount}  |  ❌ ${stats.failureCount}`,
    byPlatformLines ? `Platform: ${byPlatformLines}` : "",
    byProviderLines ? `Provider:\n${byProviderLines}` : "",
  ].filter(l => l !== "").join("\n");

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📊 BoomBox Monitor")
    .setDescription(desc.slice(0, 4096))
    .setFooter({ text: "BoomBox • Monitor" })
    .setTimestamp();
}
