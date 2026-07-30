/**
 * Bot 2 — Slash Command Deployer
 *
 * Registers Bot 2's slash commands with Discord's API.
 * Run with: node bots/bot2/deploy-commands.js
 *
 * To deploy to a specific guild (instant update, recommended for development):
 *   GUILD_ID=your_guild_id node bots/bot2/deploy-commands.js
 *
 * To deploy globally (may take up to 1 hour to propagate):
 *   node bots/bot2/deploy-commands.js
 */

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import bot2Config from './config/index.js';
import { createLogger } from '../../shared/logger/index.js';
import { dynamicImport } from '../../shared/utils/dynamicImport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('BOT2');

/**
 * Recursively collect .js files.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectFiles(full));
    else if (entry.endsWith('.js')) results.push(full);
  }
  return results;
}

async function deploy() {
  const slashDir = join(__dirname, 'commands', 'slash');
  const commandData = [];

  for (const filePath of collectFiles(slashDir)) {
    const CommandClass = await dynamicImport(filePath);
    const command = new CommandClass();
    if (command.data) {
      commandData.push(command.data.toJSON());
      logger.debug(`Queued: /${command.name}`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(bot2Config.token);
  const guildId = process.env.GUILD_ID;

  const route = guildId
    ? Routes.applicationGuildCommands(bot2Config.clientId, guildId)
    : Routes.applicationCommands(bot2Config.clientId);

  logger.info(`Deploying ${commandData.length} slash command(s) ${guildId ? `to guild ${guildId}` : 'globally'}...`);

  await rest.put(route, { body: commandData });

  logger.success(`Successfully registered ${commandData.length} slash command(s) for Bot 2.`);
}

deploy().catch((error) => {
  logger.error(`Deploy failed: ${error.message}`);
  process.exit(1);
});
