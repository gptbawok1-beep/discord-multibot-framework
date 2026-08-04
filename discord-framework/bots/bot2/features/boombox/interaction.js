/**
 * boomboxInteraction.js — Handles Discord button interactions for BoomBox.
 */

import { createLogger } from "../../../../shared/logger/index.js";
import { getErrorDetail } from "./errorStore.js";
import { buildErrorDetailEmbed } from "./embed.js";

const logger = createLogger("BoomboxButtonInteraction");

/**
 * Handle a Discord button interaction from BoomBox.
 */
export async function handleBoomBoxInteraction(interaction) {
  if (!interaction.isButton()) return;

  const id = interaction.customId ?? "";

  // ── Show URL ──────────────────────────────────────────────────────────────
  if (id.startsWith("bm:url:")) {
    const boomboxUrl = id.slice("bm:url:".length);

    if (!boomboxUrl) {
      await interaction.reply({
        content: "❌ URL tidak tersedia.",
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    logger.debug(`Show URL button | url=${boomboxUrl}`);
    await interaction.reply({
      content: `🔗 **BoomBox URL:**\n${boomboxUrl}`,
      ephemeral: true,
    }).catch(err => {
      logger.warn(`Failed to reply to Show URL: ${err.message}`);
    });
    return;
  }

  // ── Show error detail ─────────────────────────────────────────────────────
  if (id.startsWith("bm:detail:")) {
    const detailId = id.slice("bm:detail:".length);
    const detail = getErrorDetail(detailId);

    if (!detail) {
      await interaction.reply({
        content: "❌ Detail sudah tidak tersedia (kedaluwarsa).",
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    logger.debug(`Show error detail button | id=${detailId}`);
    await interaction.reply({
      embeds: [buildErrorDetailEmbed(detail)],
      ephemeral: true,
    }).catch(err => {
      logger.warn(`Failed to reply to Detail button: ${err.message}`);
    });
    return;
  }
}
export default handleBoomBoxInteraction;
