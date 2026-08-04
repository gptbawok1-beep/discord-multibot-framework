/**
 * Bot 2 — Event: ready
 *
 * Fires once when Bot 2 successfully connects to Discord.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { boomboxManager } from '../features/boombox/manager.js';
import { runBoomBoxLogsMigrationV2 } from '../features/boombox/logs/migration.js';

const logger = createLogger('BOT2');

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super({ name: 'ready', once: true });
  }

  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s).`);
    logger.info(`Slash commands loaded: ${client.slashCommands.size}`);
    logger.info(`Prefix commands loaded: ${client.prefixCommands.size}`);

    // Initialise Boombox engine
    boomboxManager.init();

    // Run Boombox Logs migration
    try {
      await runBoomBoxLogsMigrationV2(client);
    } catch (err) {
      logger.warn(`Logs migration failed: ${err.message}`);
    }
  }
}
