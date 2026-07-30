/**
 * Bot 1 — Event: messageCreate
 *
 * Handles:
 *   1. AFK removal  — if the message author has an active AFK, clear it.
 *   2. AFK mentions — if a mentioned user is AFK, reply with their info.
 *   3. Auto Thread  — if the channel has Auto Thread enabled, create a thread.
 *   4. Prefix commands — route to the shared prefix command handler.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { handlePrefixCommand } from '../../../shared/handlers/prefixHandler.js';
import { handleAfkMention, handleAfkRemoval } from '../features/moderation/afkHandler.js';
import { handleAutoThread } from '../features/moderation/autoThreadHandler.js';
import { loadGuildConfig } from '../setup/config.js';
import { createLogger } from '../../../shared/logger/index.js';
import bot1Config from '../config/index.js';

const logger = createLogger('BOT1');

export default class MessageCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'messageCreate', once: false });
  }

  async execute(client, message) {
    // Ignore bot messages for features (prefix handler does its own bot check)
    if (!message.author.bot && message.guild) {
      try {
        // Load config once; share across all feature handlers
        const cfg = await loadGuildConfig(message.guild.id);

        // 1. AFK removal — check if the author has an active AFK status
        await handleAfkRemoval(message, cfg).catch((err) => {
          logger.error(`AFK removal error: ${err.message}`);
        });

        // 2. AFK mentions — notify if a mentioned user is AFK
        if (message.mentions.users.size > 0) {
          await handleAfkMention(message, cfg).catch((err) => {
            logger.error(`AFK mention error: ${err.message}`);
          });
        }

        // 3. Auto Thread — create a thread if channel is configured
        await handleAutoThread(message, cfg).catch((err) => {
          logger.error(`Auto Thread error: ${err.message}`);
        });
      } catch (err) {
        logger.error(`messageCreate feature error: ${err.message}`);
      }
    }

    // 4. Prefix commands
    await handlePrefixCommand(message, client, bot1Config.prefix, logger);
  }
}
