/**
 * Bot 2 — Event: messageCreate
 *
 * Routes incoming messages to the shared prefix command handler.
 * Also checks messages for Boombox links.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handlePrefixCommand } from '../../../shared/handlers/prefixHandler.js';
import { handleBoomBoxMessage } from '../features/boombox/handler.js';
import { createLogger } from '../../../shared/logger/index.js';
import bot2Config from '../config/index.js';

const logger = createLogger('BOT2');

export default class MessageCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'messageCreate', once: false });
  }

  async execute(client, message) {
    // ── Boombox message scanner ──
    await handleBoomBoxMessage(message);

    // ── Standard prefix commands ──
    await handlePrefixCommand(message, client, bot2Config.prefix, logger);
  }
}
