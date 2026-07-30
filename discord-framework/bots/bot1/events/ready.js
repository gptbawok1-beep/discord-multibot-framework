/**
 * Bot 1 — Event: ready
 *
 * Fires once when Bot 1 successfully connects to Discord.
 * Runs the full Auto Recovery sequence to restore all guild configurations.
 *
 * Recovery sequence:
 *   1. Load Environment       ← done before login
 *   2. Load Shared Core       ← done before login
 *   3. Auto Load Plugins      ← done at module init (setup/index.js)
 *   4. Load Guild Config      ↓
 *   5. Validate Config        ↓  recoverOnStartup(client)
 *   6. Restore Runtime        ↓
 *   7. Bot Ready log          ← below
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { recoverOnStartup } from '../setup/index.js';

const logger = createLogger('BOT1');

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super({ name: 'ready', once: true });
  }

  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s).`);
    logger.info(`Slash commands loaded: ${client.slashCommands.size}`);
    logger.info(`Prefix commands loaded: ${client.prefixCommands.size}`);

    // Auto Recovery — restore all guild configurations
    await recoverOnStartup(client);

    // Step 8: Register Interaction (slash commands are already registered via deploy-commands.js)
    // Step 9: Bot Ready
    logger.success(`BOT 1 is ready.`);
  }
}
