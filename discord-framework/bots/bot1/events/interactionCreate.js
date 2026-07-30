/**
 * Bot 1 — Event: interactionCreate
 *
 * Routes all incoming interactions:
 *   1. ChatInputCommand   → shared slash command handler
 *   2. setup1:* components & modals → Setup Wizard handler
 *
 * Only the shared handlers (shared/handlers/) are untouched;
 * this file is Bot 1-specific and may be extended freely.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handleSlashCommand } from '../../../shared/handlers/slashHandler.js';
import { handleInteraction as handleSetupInteraction } from '../setup/index.js';
import { createLogger } from '../../../shared/logger/index.js';

const logger = createLogger('BOT1');

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'interactionCreate', once: false });
  }

  async execute(client, interaction) {
    try {
      // ── Slash commands ────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, client, logger);
        return;
      }

      // ── Setup Wizard: buttons, select menus, modals ───────────────────
      // All Setup Wizard custom IDs start with 'setup1:'
      const customId = interaction.customId ?? '';
      if (customId.startsWith('setup1:')) {
        const handled = await handleSetupInteraction(interaction);
        if (!handled) {
          logger.warn(`Unhandled setup interaction: ${customId}`);
        }
        return;
      }

      // ── Add other Bot 1 interaction handlers here in future phases ────

    } catch (error) {
      logger.error(`Unhandled interactionCreate error: ${error.message}`);
      if (process.env.NODE_ENV === 'development') logger.debug(error.stack);

      // Best-effort reply so the user doesn't see a hanging interaction
      try {
        const reply = { content: '❌  Terjadi kesalahan. Silakan coba lagi.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply(reply);
        }
      } catch {
        // Suppress secondary errors
      }
    }
  }
}
