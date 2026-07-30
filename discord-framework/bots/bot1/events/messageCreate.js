/**
 * Bot 1 — Event: messageCreate
 *
 * Routes incoming messages to the shared prefix command handler.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handlePrefixCommand } from '../../../shared/handlers/prefixHandler.js';
import { createLogger } from '../../../shared/logger/index.js';
import bot1Config from '../config/index.js';

const logger = createLogger('BOT1');

export default class MessageCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'messageCreate', once: false });
  }

  async execute(client, message) {
    await handlePrefixCommand(message, client, bot1Config.prefix, logger);
  }
}
