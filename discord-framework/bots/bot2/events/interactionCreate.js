/**
 * Bot 2 — Event: interactionCreate
 *
 * Routes incoming interactions:
 *   - ChatInputCommand  → shared slash handler
 *   - StringSelectMenu  → bawok module navigation
 *   - Button            → bawok back-home navigation
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handleSlashCommand } from '../../../shared/handlers/slashHandler.js';
import { createLogger } from '../../../shared/logger/index.js';
import {
  SELECT_ID,
  BUTTON_BACK_ID,
  homePayload,
  modulePayload,
} from '../features/bawok/panels.js';

const logger = createLogger('BOT2');

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'interactionCreate', once: false });
  }

  async execute(client, interaction) {
    // ── Slash commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, client, logger);
      return;
    }

    // ── Bawok: module select menu ───────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === SELECT_ID) {
      const selected = interaction.values[0];
      await interaction.update(await modulePayload(selected));
      return;
    }

    // ── Bawok: back-home button ─────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === BUTTON_BACK_ID) {
      await interaction.update(await homePayload());
      return;
    }
  }
}
