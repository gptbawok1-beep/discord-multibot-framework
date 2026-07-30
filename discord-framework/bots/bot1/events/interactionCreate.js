/**
 * Bot 1 — Event: interactionCreate
 *
 * Routes incoming interactions to the shared slash command handler.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handleSlashCommand } from '../../../shared/handlers/slashHandler.js';
import { createLogger } from '../../../shared/logger/index.js';

const logger = createLogger('BOT1');

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'interactionCreate', once: false });
  }

  async execute(client, interaction) {
    await handleSlashCommand(interaction, client, logger);
  }
}
