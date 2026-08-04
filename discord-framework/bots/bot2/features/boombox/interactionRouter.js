/**
 * interactionRouter.js — Core Interaction Router for all Boombox setup and features.
 */

import { buildSetupBoomBoxPanel, buildDeleteConfirmPanel, buildMonitorEmbed, buildBoomboxMainDashboard } from "./setup/panel.js";
import { buildChannelPlatformPanel, buildChannelSelectPanel, handleChannelSelected, handleChannelSave } from "./setup/channelSetup.js";
import { buildLogsPanel, buildLogChannelSelectPanel, handleLogChannelSelected, buildPlatformLogSelectPanel, handlePlatformLogSelected, handlePlatformLogSave } from "./setup/logsSetup.js";
import { buildMaintenancePanel, handleMaintenanceToggle } from "./setup/maintenanceSetup.js";
import { buildDurationSetPanel, buildDurationSetPanelForRole, buildDurationModal, buildDurationSavedEmbed, buildDurationResetEmbed } from "./setup/durationSetup.js";
import { buildDashboardMainPanel, buildDashboardTogglePanel, buildDashboardGifPanel, buildGifModal, buildColorModal, buildPreviewPanel, buildDashboardResetConfirmPanel } from "./setup/dashboardSetup.js";
import { handleResourceManagerInteraction } from "./setup/resourceManagerInteraction.js";
import { handleLogViewerInteraction, buildPublicLogPanel } from "./logs/viewer.js";
import { handleBoomBoxInteraction } from "./interaction.js";
import { db } from "./database.js";
import { createLogger } from "../../../../shared/logger/index.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { buildBoomboxModal } from "../bawok/panels.js";

const logger = createLogger("BoomboxInteractionRouter");
const FOOTER = "BoomBox • Dashboard";

/**
 * Main interaction handler entry point for Bot 2 interactionCreate event.
 */
export async function handleBoomBoxInteractionRouter(interaction) {
  const id = interaction.customId ?? "";

  // ── 1. bm: interactions (audio details/link results) ────────────────────────
  if (id.startsWith("bm:")) {
    await handleBoomBoxInteraction(interaction);
    return true;
  }

  // ── 2. bblog: interactions (logs viewer panels) ─────────────────────────────
  if (id.startsWith("bblog:")) {
    await handleLogViewerInteraction(interaction);
    return true;
  }

  // ── 3. bbrm: interactions (resource manager) ────────────────────────────────
  if (id.startsWith("bbrm:")) {
    await handleResourceManagerInteraction(interaction);
    return true;
  }

  // ── 4. bbdash: unified control dashboard buttons ───────────────────────────
  if (id.startsWith("bbdash:")) {
    try {
      if (id === "bbdash:download") {
        await interaction.showModal(buildBoomboxModal());
        return true;
      }
      if (id === "bbdash:setup") {
        await interaction.update(buildSetupBoomBoxPanel());
        return true;
      }
      if (id === "bbdash:queue") {
        await interaction.update({
          embeds: [buildMonitorEmbed()],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("bbsetup:back_to_dashboard").setLabel("🔙 Dashboard Utama").setStyle(ButtonStyle.Primary)
            )
          ]
        });
        return true;
      }
      if (id === "bbdash:dashboard") {
        await interaction.update(buildDashboardMainPanel());
        return true;
      }
      if (id === "bbdash:logs") {
        await interaction.update(buildLogsPanel());
        return true;
      }
      if (id === "bbdash:resource") {
        const { embed, components } = await import("./setup/resourceManager.js").then(m => m.buildResourceManagerPanel());
        await interaction.update({ embeds: [embed], components });
        return true;
      }
      if (id === "bbdash:maintenance") {
        await interaction.update(buildMaintenancePanel());
        return true;
      }
      if (id === "bbdash:stats") {
        await interaction.update({
          embeds: [buildMonitorEmbed()],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("bbsetup:back_to_dashboard").setLabel("🔙 Dashboard Utama").setStyle(ButtonStyle.Primary)
            )
          ]
        });
        return true;
      }
    } catch (err) {
      logger.error(`Error in bbdash interaction routing: ${err.message}`);
      await interaction.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, ephemeral: true }).catch(() => {});
    }
    return true;
  }

  // ── 5. bbsetup: interactions (setup subpanels) ──────────────────────────────
  if (id.startsWith("bbsetup:")) {
    try {
      // Setup Main back-home, back-to-dashboard & close
      if (id === "bbsetup:back" || id === "bbsetup:back_to_dashboard") {
        await interaction.update(buildBoomboxMainDashboard(interaction.user.id));
        return true;
      }
      if (id === "bbsetup:close") {
        await interaction.update({ embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("🎵 BoomBox")
            .setDescription("Panel ditutup.")
            .setFooter({ text: FOOTER })
        ], components: [] });
        return true;
      }

      // Dropdown menu select
      if (id === "bbsetup:menu:select" && interaction.isStringSelectMenu()) {
        const val = interaction.values[0];
        if (val === "channel") {
          await interaction.update(buildChannelPlatformPanel());
        } else if (val === "logs") {
          await interaction.update(buildLogsPanel());
        } else if (val === "maintenance") {
          await interaction.update(buildMaintenancePanel());
        } else if (val === "monitor") {
          await interaction.update({ embeds: [buildMonitorEmbed()], components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("bbsetup:back_to_dashboard").setLabel("🔙 Dashboard Utama").setStyle(ButtonStyle.Primary)
            )
          ] });
        } else if (val === "duration") {
          await interaction.update(buildDurationSetPanel());
        } else if (val === "dashboard") {
          await interaction.update(buildDashboardMainPanel());
        } else if (val === "resource") {
          const { embed, components } = await import("./setup/resourceManager.js").then(m => m.buildResourceManagerPanel());
          await interaction.update({ embeds: [embed], components });
        } else if (val === "reset") {
          await interaction.update(buildDeleteConfirmPanel());
        }
        return true;
      }

      // Reset confirm executions
      if (id === "bbsetup:delete:confirm") {
        db.resetUsage();
        db.resetLogState();
        db.resetDashboard();
        await interaction.update({ embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("✅ Reset Berhasil")
            .setDescription("Seluruh konfigurasi Boombox berhasil dikembalikan ke bawaan pabrik.")
            .setFooter({ text: FOOTER })
        ], components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("bbsetup:back_to_dashboard").setLabel("Dashboard Utama").setStyle(ButtonStyle.Success)
          )
        ] });
        return true;
      }
      if (id === "bbsetup:delete:cancel") {
        await interaction.update(buildSetupBoomBoxPanel());
        return true;
      }

      // ── Sub-module: Channel Setup ──
      if (id === "bbsetup:channel") {
        await interaction.update(buildChannelPlatformPanel());
        return true;
      }
      const platformSelectMatch = /^bbsetup:channel:(youtube|tiktok|spotify)$/.exec(id);
      if (platformSelectMatch) {
        await interaction.update(buildChannelSelectPanel(platformSelectMatch[1]));
        return true;
      }
      const channelSelectMatch = /^bbsetup:channel:select:(youtube|tiktok|spotify)$/.exec(id);
      if (channelSelectMatch && interaction.isChannelSelectMenu()) {
        await handleChannelSelected(interaction, channelSelectMatch[1]);
        return true;
      }
      const channelSaveMatch = /^bbsetup:channel:save:(youtube|tiktok|spotify):(\d+)$/.exec(id);
      if (channelSaveMatch) {
        await handleChannelSave(interaction, channelSaveMatch[1], channelSaveMatch[2]);
        return true;
      }

      // ── Sub-module: Logs Setup ──
      if (id === "bbsetup:logs") {
        await interaction.update(buildLogsPanel());
        return true;
      }
      if (id === "bbsetup:logs:setchannel") {
        await interaction.update(buildLogChannelSelectPanel());
        return true;
      }
      if (id === "bbsetup:logs:channel:select" && interaction.isChannelSelectMenu()) {
        await handleLogChannelSelected(interaction);
        return true;
      }
      const logsPlatMatch = /^bbsetup:logs:platcfg:(youtube|tiktok|spotify)$/.exec(id);
      if (logsPlatMatch) {
        await interaction.update(buildPlatformLogSelectPanel(logsPlatMatch[1]));
        return true;
      }
      const logsPlatSelectMatch = /^bbsetup:logs:platcfg:select:(youtube|tiktok|spotify)$/.exec(id);
      if (logsPlatSelectMatch && interaction.isChannelSelectMenu()) {
        await handlePlatformLogSelected(interaction, logsPlatSelectMatch[1]);
        return true;
      }
      const logsPlatSaveMatch = /^bbsetup:logs:platcfg:save:(youtube|tiktok|spotify):(\d+)$/.exec(id);
      if (logsPlatSaveMatch) {
        await handlePlatformLogSave(interaction, logsPlatSaveMatch[1], logsPlatSaveMatch[2]);
        return true;
      }
      const logsToggleMatch = /^bbsetup:logs:toggle:(youtube|tiktok|spotify)$/.exec(id);
      if (logsToggleMatch) {
        const platform = logsToggleMatch[1];
        db.setPlatformLogChannel(platform, null);
        await interaction.update(buildLogsPanel());
        return true;
      }
      if (id === "bbsetup:logs:deletepanel") {
        db.resetLogState();
        try {
          const globalLogCh = db.getLogChannel();
          if (globalLogCh) {
            const ch = await interaction.client.channels.fetch(globalLogCh).catch(() => null);
            if (ch?.isTextBased()) {
              const newMsg = await ch.send(buildPublicLogPanel());
              db.setLogState({ messageId: newMsg.id });
            }
          }
        } catch {}
        await interaction.update(buildLogsPanel());
        return true;
      }

      // ── Sub-module: Maintenance Setup ──
      const maintToggleMatch = /^bbsetup:maint:toggle:(youtube|tiktok|spotify|all)$/.exec(id);
      if (maintToggleMatch) {
        await handleMaintenanceToggle(interaction, maintToggleMatch[1]);
        return true;
      }

      // ── Sub-module: Duration Setup ──
      if (id === "bbsetup:duration") {
        await interaction.update(buildDurationSetPanel());
        return true;
      }
      if (id === "bbsetup:dur:rolesel" && interaction.isRoleSelectMenu()) {
        const role = interaction.roles.first();
        if (role) {
          await interaction.update(buildDurationSetPanelForRole(role));
        }
        return true;
      }
      const durSetMatch = /^bbsetup:dur:set:(\d+):(\d+)$/.exec(id);
      if (durSetMatch) {
        const [, roleId, min] = durSetMatch;
        db.setRoleLimit(roleId, parseInt(min, 10));
        const role = await interaction.guild.roles.fetch(roleId);
        await interaction.update({
          embeds: [buildDurationSavedEmbed(role?.name || "Role", min)],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("bbsetup:duration").setLabel("Kembali ke Durasi").setStyle(ButtonStyle.Primary)
            )
          ]
        });
        return true;
      }
      const durResetMatch = /^bbsetup:dur:reset:(\d+)$/.exec(id);
      if (durResetMatch) {
        const roleId = durResetMatch[1];
        db.deleteRoleLimit(roleId);
        const role = await interaction.guild.roles.fetch(roleId);
        await interaction.update({
          embeds: [buildDurationResetEmbed(role?.name || "Role")],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("bbsetup:duration").setLabel("Kembali ke Durasi").setStyle(ButtonStyle.Primary)
            )
          ]
        });
        return true;
      }
      const durCustomMatch = /^bbsetup:dur:custom:(\d+)$/.exec(id);
      if (durCustomMatch) {
        await interaction.showModal(buildDurationModal(durCustomMatch[1]));
        return true;
      }
      const durModalSubmitMatch = /^bbsetup:dur:modal:(\d+)$/.exec(id);
      if (durModalSubmitMatch && interaction.isModalSubmit()) {
        const roleId = id.split(":").pop();
        const minStr = interaction.fields.getTextInputValue("duration_minutes")?.trim();
        const min = parseInt(minStr, 10);
        if (isNaN(min) || min <= 0) {
          await interaction.reply({ content: "❌ Input menit tidak valid. Masukkan angka positif.", ephemeral: true });
          return true;
        }
        db.setRoleLimit(roleId, min);
        const role = await interaction.guild.roles.fetch(roleId);
        await interaction.reply({
          embeds: [buildDurationSavedEmbed(role?.name || "Role", min)],
          ephemeral: true,
        });
        return true;
      }

      // ── Sub-module: Dashboard Setup ──
      if (id === "bbsetup:dashboard") {
        await interaction.update(buildDashboardMainPanel());
        return true;
      }
      if (id === "bbsetup:dash:menu" && interaction.isStringSelectMenu()) {
        const val = interaction.values[0];
        if (val === "toggles") {
          await interaction.update(buildDashboardTogglePanel());
        } else if (val === "gifs") {
          await interaction.update(buildDashboardGifPanel());
        } else if (val === "color") {
          await interaction.showModal(buildColorModal());
        } else if (val === "preview") {
          await interaction.update(buildPreviewPanel());
        } else if (val === "reset") {
          await interaction.update(buildDashboardResetConfirmPanel());
        }
        return true;
      }
      const dashToggleMatch = /^bbsetup:dash:toggle:([a-zA-Z]+)$/.exec(id);
      if (dashToggleMatch) {
        db.toggleDashboard(dashToggleMatch[1]);
        await interaction.update(buildDashboardTogglePanel());
        return true;
      }
      if (id === "bbsetup:dash:gif:select" && interaction.isStringSelectMenu()) {
        await interaction.showModal(buildGifModal(interaction.values[0]));
        return true;
      }
      const dashGifModalMatch = /^bbsetup:dash:gif:modal:([a-zA-Z]+)$/.exec(id);
      if (dashGifModalMatch && interaction.isModalSubmit()) {
        const type = dashGifModalMatch[1];
        const url = interaction.fields.getTextInputValue("gif_url")?.trim() || "";
        db.setDashboardGif(type, url);
        await interaction.reply({ content: `✅ Link GIF untuk **${type}** berhasil diperbarui!`, ephemeral: true });
        return true;
      }
      if (id === "bbsetup:dash:color:modal" && interaction.isModalSubmit()) {
        const color = interaction.fields.getTextInputValue("embed_color")?.trim() || "#5865f2";
        db.setDashboard({ embedColor: color });
        await interaction.reply({ content: `✅ Warna embed dashboard diatur ke **${color}**!`, ephemeral: true });
        return true;
      }
      if (id === "bbsetup:dash:reset:confirm") {
        db.resetDashboard();
        await interaction.update(buildDashboardMainPanel());
        return true;
      }

    } catch (err) {
      logger.error(`Error in setup interaction routing: ${err.message}`);
      await interaction.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, ephemeral: true }).catch(() => {});
    }
    return true;
  }

  return false;
}
