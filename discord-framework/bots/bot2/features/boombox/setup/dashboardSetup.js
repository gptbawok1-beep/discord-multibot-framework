/**
 * setup/dashboardSetup.js — Sub-panel: Setup Tampilan Embed Dashboard BoomBox.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "../database.js";

const COLOR  = 0x9b59b6;
const FOOTER = "BoomBox • Dashboard Setup";

// ── Step 1: Panel utama Dashboard Setup ───────────────────────────────────────

export function buildDashboardMainPanel() {
  const d = db.getDashboard();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎨 Kustomisasi Dashboard Embed")
    .setDescription(
      "Atur bagaimana hasil konversi BoomBox ditampilkan kepada member di Discord.\n\n" +
      "**⚙️ Pengaturan Saat Ini:**\n" +
      `• **Enabled**: ${d.enabled ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Proses Pipeline**: ${d.showStatus ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Tampilkan GIF**: ${d.showGif ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Tampilkan Thumbnail**: ${d.showThumbnail ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Tampilkan Footer**: ${d.showFooter ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Tampilkan Timestamp**: ${d.showTimestamp ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Mention User**: ${d.showMention ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Tampilkan Durasi Proses**: ${d.showDuration ? "🟢 ON" : "🔴 OFF"}\n` +
      `• **Embed Color**: \`${d.embedColor}\`\n\n` +
      "👉 Pilih opsi kustomisasi di bawah."
    )
    .setFooter({ text: FOOTER });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("bbsetup:dash:menu")
      .setPlaceholder("Pilih bagian kustomisasi...")
      .addOptions([
        { label: "🔘 Toggle Fitur",       value: "toggles",     description: "Aktifkan/Nonaktifkan elemen dashboard" },
        { label: "🖼️ Atur GIF / Banner", value: "gifs",        description: "Atur GIF loading, success, cache, error, dll" },
        { label: "🎨 Atur Warna Embed",   value: "color",       description: "Ubah warna hex dashboard" },
        { label: "🔎 Lihat Preview",      value: "preview",     description: "Tampilkan preview dashboard" },
        { label: "🔄 Reset Default",      value: "reset",       description: "Kembalikan pengaturan ke default" },
      ])
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:back")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [selectRow, backRow] };
}

// ── Step 2: Toggle Elemen Panel ──────────────────────────────────────────────

export function buildDashboardTogglePanel() {
  const d = db.getDashboard();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🔘 Toggle Elemen Dashboard")
    .setDescription("Aktifkan atau matikan elemen dashboard di bawah ini:")
    .setFooter({ text: FOOTER });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:enabled")
      .setLabel(`Dashboard: ${d.enabled ? "ON" : "OFF"}`)
      .setStyle(d.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showStatus")
      .setLabel(`Status Pipeline: ${d.showStatus ? "ON" : "OFF"}`)
      .setStyle(d.showStatus ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showGif")
      .setLabel(`Tampilkan GIF: ${d.showGif ? "ON" : "OFF"}`)
      .setStyle(d.showGif ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showThumbnail")
      .setLabel(`Thumbnail: ${d.showThumbnail ? "ON" : "OFF"}`)
      .setStyle(d.showThumbnail ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showFooter")
      .setLabel(`Footer: ${d.showFooter ? "ON" : "OFF"}`)
      .setStyle(d.showFooter ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showTimestamp")
      .setLabel(`Timestamp: ${d.showTimestamp ? "ON" : "OFF"}`)
      .setStyle(d.showTimestamp ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showMention")
      .setLabel(`Mention User: ${d.showMention ? "ON" : "OFF"}`)
      .setStyle(d.showMention ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:dash:toggle:showDuration")
      .setLabel(`Durasi: ${d.showDuration ? "ON" : "OFF"}`)
      .setStyle(d.showDuration ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:dashboard")
      .setLabel("🔙 Kembali")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// ── Step 3: Atur GIF / Banner Panel ──────────────────────────────────────────

export function buildDashboardGifPanel() {
  const d = db.getDashboard();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🖼️ Atur GIF / Banner Dashboard")
    .setDescription(
      "Atur link GIF/Banner yang akan ditampilkan pada setiap status pemrosesan audio.\n" +
      "Pastikan link berakhiran `.gif` atau `.png` / `.jpg` agar ter-render sempurna.\n\n" +
      `• **Loading/Preparing**: ${d.gifs.loading ? `[Link](${d.gifs.loading})` : "—"}\n` +
      `• **Success (Fresh)**: ${d.gifs.success ? `[Link](${d.gifs.success})` : "—"}\n` +
      `• **Success (Cache)**: ${d.gifs.cache ? `[Link](${d.gifs.cache})` : "—"}\n` +
      `• **Error/Failure**: ${d.gifs.error ? `[Link](${d.gifs.error})` : "—"}\n` +
      `• **Maintenance**: ${d.gifs.maintenance ? `[Link](${d.gifs.maintenance})` : "—"}\n` +
      `• **Timeout**: ${d.gifs.timeout ? `[Link](${d.gifs.timeout})` : "—"}\n\n` +
      "👉 Pilih status GIF di bawah untuk mengubah."
    )
    .setFooter({ text: FOOTER });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("bbsetup:dash:gif:select")
      .setPlaceholder("Pilih jenis GIF status...")
      .addOptions([
        { label: "Preparing / Loading", value: "loading" },
        { label: "Success (Fresh Download)", value: "success" },
        { label: "Success (Cache Hit)", value: "cache" },
        { label: "Error / Failure", value: "error" },
        { label: "Maintenance Active", value: "maintenance" },
        { label: "Timeout / Slow Job", value: "timeout" },
      ])
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:dashboard")
      .setLabel("🔙 Kembali")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [selectRow, backRow] };
}

export function buildGifModal(type) {
  const titles = {
    loading: "Preparing / Loading GIF",
    success: "Success (Fresh) GIF",
    cache: "Success (Cache Hit) GIF",
    error: "Error / Failure GIF",
    maintenance: "Maintenance Active GIF",
    timeout: "Timeout / Slow Job GIF",
  };

  const current = db.getDashboard().gifs[type] || "";

  const input = new TextInputBuilder()
    .setCustomId("gif_url")
    .setLabel(titles[type] || "GIF URL")
    .setPlaceholder("https://example.com/image.gif")
    .setStyle(TextInputStyle.Short)
    .setDefaultValue(current)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`bbsetup:dash:gif:modal:${type}`)
    .setTitle("🖼️ Atur GIF Link")
    .addComponents(new ActionRowBuilder().addComponents(input));
}

// ── Step 4: Atur Warna Hex Embed ─────────────────────────────────────────────

export function buildColorModal() {
  const current = db.getDashboard().embedColor || "#5865f2";

  const input = new TextInputBuilder()
    .setCustomId("embed_color")
    .setLabel("Warna Dashboard (Hex Color)")
    .setPlaceholder("Contoh: #5865F2 atau 0x5865F2")
    .setStyle(TextInputStyle.Short)
    .setDefaultValue(current)
    .setRequired(true)
    .setMaxLength(10);

  return new ModalBuilder()
    .setCustomId("bbsetup:dash:color:modal")
    .setTitle("🎨 Atur Warna Embed Hex")
    .addComponents(new ActionRowBuilder().addComponents(input));
}

// ── Step 5: Tampilkan Preview Embed ───────────────────────────────────────────

export function buildPreviewPanel() {
  const d = db.getDashboard();

  const embed = new EmbedBuilder()
    .setColor(d.embedColor || "#5865f2")
    .setTitle("🎵 Preview Dashboard — Sukses (Fresh)")
    .setDescription(
      "📻 **BoomBox URL Siap!**\n\n" +
      "**Judul**: *Aci Resti - Ujung Titik Tiga*\n" +
      "**Platform**: YouTube\n" +
      "**Durasi**: 5:12\n\n" +
      "```\nhttps://e.top4top.io/m_3846w9xix0.mp3\n```"
    );

  if (d.showThumbnail) {
    embed.setThumbnail("https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=300");
  }
  if (d.showGif && d.gifs.success) {
    embed.setImage(d.gifs.success);
  }
  if (d.showFooter) {
    embed.setFooter({ text: "BoomBox • Preview" });
  }
  if (d.showTimestamp) {
    embed.setTimestamp();
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:dashboard")
      .setLabel("🔙 Kembali")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ── Step 6: Reset Default Confirm ────────────────────────────────────────────

export function buildDashboardResetConfirmPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔄 Reset Dashboard Setup")
    .setDescription("Yakin ingin mengembalikan seluruh pengaturan tampilan dashboard BoomBox ke default bawaan?")
    .setFooter({ text: FOOTER });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bbsetup:dash:reset:confirm").setLabel("Ya, Reset").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("bbsetup:dashboard").setLabel("Batal").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}
