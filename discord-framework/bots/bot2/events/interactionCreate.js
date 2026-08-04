/**
 * Bot 2 — Event: interactionCreate
 *
 * Routes incoming interactions:
 *   - ChatInputCommand  → shared slash handler
 *   - BoomBox components → Boombox Interaction Router
 *   - StringSelectMenu  → bawok module navigation
 *   - Button            → bawok back-home / close-panel / boombox URL input
 *   - ModalSubmit       → boombox URL processing
 */

import { EmbedBuilder } from 'discord.js';
import { BaseEvent } from '../../../shared/structures/index.js';
import { handleSlashCommand } from '../../../shared/handlers/slashHandler.js';
import { createLogger } from '../../../shared/logger/index.js';
import {
  SELECT_ID,
  BUTTON_BACK_ID,
  BUTTON_CLOSE_ID,
  BUTTON_BOOMBOX_URL,
  MODAL_BOOMBOX_ID,
  MODAL_BOOMBOX_INPUT,
  homePayload,
  modulePayload,
  closedPayload,
  buildBoomboxModal,
} from '../features/bawok/panels.js';
import { boomboxManager } from '../features/boombox/manager.js';
import { validateURL } from '../features/boombox/validator.js';
import { handleBoomBoxInteractionRouter } from '../features/boombox/interactionRouter.js';

const logger     = createLogger('BOT2');
const FOOTER     = '🩸 Kenyut';
const COLOR_BOOM = 0x3498DB;

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'interactionCreate', once: false });
  }

  async execute(client, interaction) {
    // ── Boombox specialized interactions ──
    const id = interaction.customId ?? "";
    if (id.startsWith("bbsetup:") || id.startsWith("bbrm:") || id.startsWith("bblog:") || id.startsWith("bm:")) {
      const handled = await handleBoomBoxInteractionRouter(interaction);
      if (handled) return;
    }

    // ── Slash commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, client, logger);
      return;
    }

    // ── Bawok: module select menu ───────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
      await interaction.update(modulePayload(interaction.values[0]));
      return;
    }

    // ── Bawok: back-home button ─────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === BUTTON_BACK_ID) {
      await interaction.update(homePayload());
      return;
    }

    // ── Bawok: close-panel button ───────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === BUTTON_CLOSE_ID) {
      await interaction.update(closedPayload());
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // ── Boombox: open URL input modal ───────────────────────────────────────
    if (interaction.isButton() && interaction.customId === BUTTON_BOOMBOX_URL) {
      await interaction.showModal(buildBoomboxModal());
      return;
    }

    // ── Boombox: modal submitted ────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === MODAL_BOOMBOX_ID) {
      const url = interaction.fields.getTextInputValue(MODAL_BOOMBOX_INPUT).trim();

      const validation = validateURL(url);
      if (!validation.valid) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setDescription(`❌ ${validation.error}`)
              .setFooter({ text: FOOTER }),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await boomboxManager.request(url, interaction.user.id, interaction.guildId);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLOR_BOOM)
              .setTitle('✅ Boombox URL Siap')
              .addFields(
                { name: 'Platform', value: result.platform.charAt(0).toUpperCase() + result.platform.slice(1), inline: true },
                { name: 'Cache',    value: result.fromCache ? '✅ Hit' : '🔄 Fresh', inline: true },
                { name: 'URL Audio (SA:MP)', value: `\`\`\`\n${result.uploadUrl}\n\`\`\`` },
              )
              .setFooter({ text: FOOTER }),
          ],
        });
        logger.info(`[Boombox] ${interaction.user.tag} → ${result.uploadUrl}`);
      } catch (err) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Gagal')
              .setDescription(err.message)
              .setFooter({ text: FOOTER }),
          ],
        });
        logger.error(`[Boombox] ${interaction.user.tag}: ${err.message}`);
      }
      return;
    }
  }
}
