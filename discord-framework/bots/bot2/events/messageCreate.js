/**
 * Bot 2 — Event: messageCreate
 *
 * Routes incoming messages to the shared prefix command handler.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handlePrefixCommand } from '../../../shared/handlers/prefixHandler.js';
import { createLogger } from '../../../shared/logger/index.js';
import bot2Config from '../config/index.js';

const logger = createLogger('BOT2');

export default class MessageCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'messageCreate', once: false });
  }

  async execute(client, message) {
    await handlePrefixCommand(message, client, bot2Config.prefix, logger);
  }
}
