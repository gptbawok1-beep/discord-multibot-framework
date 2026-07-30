/**
 * Command Handler
 *
 * Discovers and loads all commands (slash + prefix) from a bot's
 * commands directory. Each bot only loads its own commands.
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dynamicImport } from '../utils/dynamicImport.js';
import { logger } from '../logger/index.js';

/**
 * Recursively collect all .js files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const results = [];

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results; // Directory doesn't exist — skip gracefully
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.endsWith('.js')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Load all commands from a bot's commands directory into the client's
 * command collections.
 *
 * @param {import('discord.js').Client} client - The bot client instance.
 *   Expects client.slashCommands (Collection) and client.prefixCommands (Collection).
 * @param {string} commandsDir - Absolute path to the bot's commands/ folder.
 * @param {ReturnType<import('../logger/index.js').createLogger>} botLogger
 */
async function loadCommands(client, commandsDir, botLogger) {
  const files = collectFiles(commandsDir);
  let loaded = 0;

  for (const filePath of files) {
    try {
      const CommandClass = await dynamicImport(filePath);
      const command = new CommandClass();

      if (!command.name) {
        botLogger.warn(`Skipping command at ${filePath}: missing name.`);
        continue;
      }

      if (command.type === 'slash') {
        client.slashCommands.set(command.name, command);
      } else {
        client.prefixCommands.set(command.name, command);
      }

      loaded++;
      botLogger.debug(`Loaded command: ${command.name} (${command.type})`);
    } catch (error) {
      botLogger.error(`Failed to load command at ${filePath}: ${error.message}`);
    }
  }

  botLogger.info(`Commands loaded: ${loaded} total.`);
}

export { loadCommands };
