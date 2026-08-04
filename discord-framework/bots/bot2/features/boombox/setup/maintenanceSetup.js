/**
 * setup/maintenanceSetup.js — Sub-panel: Maintenance BoomBox.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "../database.js";

const COLOR  = 0xed4245;
const FOOTER = "BoomBox • Maintenance";

function statusEmoji(active) {
  return active ? "🔴" : "🟢";
}

function statusLabel(active) {
  return active ? "ON (Maintenance)" : "OFF (Aktif)";
}

// ── Step 1: Panel Maintenance utama ──────────────────────────────────────────

export function buildMaintenancePanel() {
  const maintenance = db.getMaintenance();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🛠️ Mode Maintenance")
    .setDescription(
      "Toggle status maintenance per platform.\n" +
      "Saat maintenance aktif, bot tidak akan memproses konversi untuk platform tersebut.\n\n" +
      `${statusEmoji(maintenance.youtube)} **YouTube**: ${statusLabel(maintenance.youtube)}\n` +
      `${statusEmoji(maintenance.tiktok)} **TikTok**: ${statusLabel(maintenance.tiktok)}\n` +
      `${statusEmoji(maintenance.spotify)} **Spotify**: ${statusLabel(maintenance.spotify)}\n\n`
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:maint:toggle:youtube")
      .setLabel("Toggle YouTube")
      .setEmoji("📺")
      .setStyle(maintenance.youtube ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:maint:toggle:tiktok")
      .setLabel("Toggle TikTok")
      .setEmoji("🎵")
      .setStyle(maintenance.tiktok ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("bbsetup:maint:toggle:spotify")
      .setLabel("Toggle Spotify")
      .setEmoji("🎧")
      .setStyle(maintenance.spotify ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bbsetup:maint:toggle:all")
      .setLabel("Toggle Semua Platform")
      .setEmoji("⚡")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bbsetup:back")
      .setLabel("Kembali")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * Handle Toggle button interactions.
 */
export async function handleMaintenanceToggle(interaction, platform) {
  if (platform === "all") {
    const current = db.getMaintenance();
    const targetState = !(current.youtube && current.tiktok && current.spotify);
    db.setMaintenance("youtube", targetState);
    db.setMaintenance("tiktok", targetState);
    db.setMaintenance("spotify", targetState);
  } else {
    db.toggleMaintenance(platform);
  }

  const { embeds, components } = buildMaintenancePanel();
  await interaction.update({ embeds, components });
}
