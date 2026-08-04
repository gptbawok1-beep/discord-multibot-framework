/**
 * setup/logsSetup.js — Sub-panel: Setup BoomBox Logs.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from "discord.js";
import { db }               from "../database.js";
import { BOOMBOX_CONFIG }   from "../config.js";
import { buildPublicLogPanel } from "../logs/viewer.js";
import { createLogger }     from "../../../../../shared/logger/index.js";

const logger = createLogger("LogsSetup");
const COLOR  = 0x3ba4ff;
const FOOTER = "BoomBox • Logs";

const PLATFORM_LOG_META = {
  youtube: { emoji: "📺", label: "YouTube Logs" },
  tiktok:  { emoji: "🎵", label: "TikTok Logs"  },
  spotify: { emoji: "🎧", label: "Spotify Logs" },
};

// ── Step 1: Logs Panel utama ──────────────────────────────────────────────────

export function buildLogsPanel() {
  const globalLogCh   = db.getLogChannel();
  const platformLogCh = db.getPlatformLogChannels();

  const lines = Object.entries(PLATFORM_LOG_META).map(([key, { emoji, label }]) => {
    const ch = platformLogCh[key] ? `<#${platformLogCh[key]}>` : "❌ Belum diatur";
    return `${emoji} **${label}**: ${ch}`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📋 Setup BoomBox Logs")
    .setDescription(
      "BoomBox menggunakan dua jenis logging:\n\n" +
      "1. **Global Log Channel** (Logs Dashboard Publik)\n" +
      `   📌 Channel: ${globalLogCh ? `<#${globalLogCh}>` : "❌ Belum diatur"}\n` +
      "   *Satu pesan ringkasan yang diedit terus-menerus oleh bot.*\n\n" +
      "2. **Platform Log Channel** (Detail platform)\n" +
      "   *Pesan logs detail yang dikirim setiap kali proses download selesai.*\n\n" +
      lines.join("\n") + "\n\n"
    )
    .setFooter({ text: FOOTER });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs:setchannel")
      .setLabel("Ganti Global Log Channel")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbsetup:logs:deletepanel")
      .setLabel("Hapus & Buat Ulang Panel")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs:platcfg:youtube")
      .setLabel("YouTube")
      .setEmoji("📺")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbsetup:logs:platcfg:tiktok")
      .setLabel("TikTok")
      .setEmoji("🎵")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbsetup:logs:platcfg:spotify")
      .setLabel("Spotify")
      .setEmoji("🎧")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbsetup:back")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ── Global Log Channel select panel ──────────────────────────────────────────

export function buildLogChannelSelectPanel() {
  const current = db.getLogChannel();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📋 Setup Global Log Channel")
    .setDescription(
      "Global Log Channel digunakan untuk menampilkan **BoomBox Logs Dashboard** (panel publik).\n" +
      "Semua riwayat pemutaran terbaru akan tercatat pada panel tersebut.\n\n" +
      `Channel log saat ini: ${current ? `<#${current}>` : "❌ Belum diatur"}\n\n`
    )
    .setFooter({ text: FOOTER });

  const selectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("bbsetup:logs:channel:select")
      .setPlaceholder("Pilih channel untuk Global Log")
      .addChannelTypes(ChannelType.GuildText),
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [selectRow, backRow] };
}

export function buildLogChannelSavedEmbed(channelId, panelStatus = "created") {
  const desc =
    panelStatus === "edited"
      ? `✅ Global Log Channel diatur ke <#${channelId}>.\n` +
        "Panel Dashboard lama terdeteksi dan berhasil diperbarui!"
      : `✅ Global Log Channel diatur ke <#${channelId}>.\n` +
        "Pesan Dashboard baru berhasil dikirim ke channel tersebut.";

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Global Log Channel Berhasil Disimpan")
    .setDescription(desc)
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

export async function handleLogChannelSelected(interaction) {
  const channel = interaction.channels.first();
  if (!channel) {
    await interaction.reply({ content: "❌ Channel tidak valid.", ephemeral: true });
    return;
  }

  db.setLogChannel(channel.id);

  let panelStatus = "created";
  try {
    const logCh = await interaction.client.channels.fetch(channel.id).catch(() => null);
    if (logCh?.isTextBased()) {
      const state   = db.getLogState();
      const payload = buildPublicLogPanel();

      if (state.messageId) {
        try {
          const old = await logCh.messages.fetch(state.messageId);
          await old.edit(payload);
          panelStatus = "edited";
          logger.info(`[BoomBox] Log panel berhasil diedit di #${channel.name}`);
        } catch {
          logger.info("[BoomBox] Pesan panel lama tidak ditemukan, membuat baru.");
        }
      }

      if (panelStatus !== "edited") {
        const newMsg = await logCh.send(payload);
        db.setLogState({ messageId: newMsg.id });
        logger.info(`[BoomBox] Panel BoomBox Logs V2 dibuat di #${channel.name}: ${newMsg.id}`);
      }
    }
  } catch (err) {
    logger.warn(`[BoomBox] Gagal posting panel ke log channel: ${err.message}`);
  }

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs")
      .setLabel("Kembali ke Setup Logs")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbsetup:back")
      .setLabel("Menu Utama")
      .setEmoji("🏠")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds:     [buildLogChannelSavedEmbed(channel.id, panelStatus)],
    components: [backRow],
  });
}

// ── Per-Platform Log Channel Panels ──────────────────────────────────────────

export function buildPlatformLogSelectPanel(platform) {
  const { emoji, label } = PLATFORM_LOG_META[platform];
  const platformLogCh    = db.getPlatformLogChannels();
  const current          = platformLogCh[platform];

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${emoji} Setup ${label}`)
    .setDescription(
      `Channel log saat ini: ${current ? `<#${current}>` : "❌ Belum diatur"}\n\n` +
      `Pilih channel yang akan menerima **log detail ${label}**.\n` +
      "Log sukses dan gagal akan dikirim ke channel ini setelah setiap job selesai.\n\n"
    )
    .setFooter({ text: FOOTER });

  const selectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`bbsetup:logs:platcfg:select:${platform}`)
      .setPlaceholder(`Pilih channel ${label}`)
      .addChannelTypes(ChannelType.GuildText),
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [selectRow, backRow] };
}

export function buildPlatformLogPendingEmbed(platform, channelId) {
  const { emoji, label } = PLATFORM_LOG_META[platform];
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle(`${emoji} ${label} — Menunggu Konfirmasi`)
    .setDescription(
      `📌 **Channel dipilih**: <#${channelId}>\n\n` +
      "⚠️ **Konfigurasi belum disimpan.**\n" +
      "Tekan **💾 Simpan** untuk menyimpan ke database.\n\n"
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

export function buildPlatformLogSavedEmbed(platform, channelId) {
  const { emoji, label } = PLATFORM_LOG_META[platform];
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`✅ ${label} Channel Berhasil Disimpan`)
    .setDescription(
      `${emoji} **Platform**: ${label}\n` +
      `📌 **Channel**: <#${channelId}>\n\n` +
      "✅ Konfigurasi telah disimpan ke database.\n\n"
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

export async function handlePlatformLogSelected(interaction, platform) {
  const channel = interaction.channels.first();
  if (!channel) {
    await interaction.reply({ content: "❌ Channel tidak valid.", ephemeral: true });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bbsetup:logs:platcfg:save:${platform}:${channel.id}`)
      .setLabel("Simpan")
      .setEmoji("💾")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`bbsetup:logs:platcfg:${platform}`)
      .setLabel("Pilih Ulang")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("bbsetup:logs")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.update({
    embeds:     [buildPlatformLogPendingEmbed(platform, channel.id)],
    components: [row],
  });
}

export async function handlePlatformLogSave(interaction, platform, channelId) {
  db.setPlatformLogChannel(platform, channelId);

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:logs")
      .setLabel("Kembali ke Setup Logs")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbsetup:back")
      .setLabel("Menu Utama")
      .setEmoji("🏠")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds:     [buildPlatformLogSavedEmbed(platform, channelId)],
    components: [backRow],
  });
}
