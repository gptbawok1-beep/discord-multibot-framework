/**
 * setup/durationSetup.js — Sub-panel: Batas Durasi per Role.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "../database.js";

const COLOR  = 0x3498db;
const FOOTER = "BoomBox • Batas Durasi";

// ── Step 1: Menu Durasi Utama ────────────────────────────────────────────────

export function buildDurationSetPanel(role = null) {
  const roleLimits = db.getRoleLimits();
  const sorted = Object.entries(roleLimits).sort((a, b) => b[1] - a[1]);

  let desc =
    "Atur batas durasi maksimum pemutaran file audio BoomBox per role Discord.\n" +
    "Sangat berguna untuk mencegah spam video super panjang oleh member biasa.\n\n" +
    "**⏱️ Batas Durasi Saat Ini:**\n";

  if (sorted.length > 0) {
    desc += sorted.map(([id, min]) => `- <@&${id}>: **${min} menit**`).join("\n") + "\n\n";
  } else {
    desc += "_Belum ada batas durasi per role. Semua member default ke 25 menit._\n\n";
  }

  desc += "👉 Pilih role di bawah untuk menambahkan atau mengubah batas durasinya.";

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("⏱️ Batas Durasi per Role")
    .setDescription(desc)
    .setFooter({ text: FOOTER });

  const selectRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("bbsetup:dur:rolesel")
      .setPlaceholder("Pilih role untuk dikonfigurasi...")
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

// ── Step 2: Set Batas Durasi untuk Role terpilih ────────────────────────────────

export function buildDurationSetPanelForRole(role) {
  const current = db.getRoleLimits()[role.id];

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`⏱️ Batas Durasi — @${role.name}`)
    .setDescription(
      `Role: <@&${role.id}>\n` +
      `Batas saat ini: **${current ? `${current} menit` : "Tidak ada (default 25 menit)"}**\n\n` +
      "Atur batas durasi pemutaran menggunakan opsi di bawah."
    )
    .setFooter({ text: FOOTER });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bbsetup:dur:set:${role.id}:5`).setLabel("5 Menit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bbsetup:dur:set:${role.id}:10`).setLabel("10 Menit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bbsetup:dur:set:${role.id}:15`).setLabel("15 Menit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bbsetup:dur:set:${role.id}:30`).setLabel("30 Menit").setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bbsetup:dur:custom:${role.id}`).setLabel("✍️ Custom Menit").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bbsetup:dur:reset:${role.id}`).setLabel("🗑️ Hapus Batas").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("bbsetup:duration").setLabel("🔙 Kembali").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ── Step 3: Modal Custom Durasi ──────────────────────────────────────────────

export function buildDurationModal(roleId) {
  const input = new TextInputBuilder()
    .setCustomId("duration_minutes")
    .setLabel("Maksimum Durasi (dalam Menit)")
    .setPlaceholder("Contoh: 45")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(4);

  return new ModalBuilder()
    .setCustomId(`bbsetup:dur:modal:${roleId}`)
    .setTitle("⏱️ Batas Durasi Custom")
    .addComponents(new ActionRowBuilder().addComponents(input));
}

// ── Step 4: Embed Konfirmasi Simpan ───────────────────────────────────────────

export function buildDurationSavedEmbed(roleName, minutes) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Batas Durasi Berhasil Disimpan")
    .setDescription(`Role **@${roleName}** sekarang dibatasi maksimal **${minutes} menit** per audio.`)
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

export function buildDurationResetEmbed(roleName) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🗑️ Batas Durasi Dihapus")
    .setDescription(`Batas durasi untuk role **@${roleName}** telah dihapus.`)
    .setFooter({ text: FOOTER })
    .setTimestamp();
}
