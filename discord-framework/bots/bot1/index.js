/**
 * Bot 1 — Entry Point
 *
 * Bootstraps Bot 1: creates the Discord client, loads commands and events
 * from Bot 1's own directories, then logs in using Bot 1's token.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createLogger } from '../../shared/logger/index.js';
import { loadCommands } from '../../shared/handlers/commandHandler.js';
import { loadEvents } from '../../shared/handlers/eventHandler.js';
import bot1Config from './config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('BOT1');

/** Create the Discord client with the required gateway intents */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

/** Attach command collections to the client instance */
client.slashCommands = new Collection();
client.prefixCommands = new Collection();

/** Attach the bot's config for easy access inside handlers */
client.config = bot1Config;

async function start() {
  logger.info('Starting Bot 1...');

  try {
    // Load commands from Bot 1's own commands directory (isolated from Bot 2)
    await loadCommands(client, join(__dirname, 'commands'), logger);

    // Load events from Bot 1's own events directory (isolated from Bot 2)
    await loadEvents(client, join(__dirname, 'events'), logger);

    // Login to Discord
    await client.login(bot1Config.token);
  } catch (error) {
    logger.error(`Fatal error during startup: ${error.message}`);
    process.exit(1);
  }
}

start();
