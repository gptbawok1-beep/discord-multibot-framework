/**
 * Event Handler
 *
 * Discovers and registers all events from a bot's events directory.
 * Each bot only loads its own events.
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dynamicImport } from '../utils/dynamicImport.js';
import { handleEventError } from '../utils/errorHandler.js';

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
    return results;
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
 * Load and register all events from a bot's events directory.
 *
 * @param {import('discord.js').Client} client
 * @param {string} eventsDir - Absolute path to the bot's events/ folder.
 * @param {ReturnType<import('../logger/index.js').createLogger>} botLogger
 */
async function loadEvents(client, eventsDir, botLogger) {
  const files = collectFiles(eventsDir);
  let loaded = 0;

  for (const filePath of files) {
    try {
      const EventClass = await dynamicImport(filePath);
      const event = new EventClass();

      if (!event.name) {
        botLogger.warn(`Skipping event at ${filePath}: missing name.`);
        continue;
      }

      const listener = async (...args) => {
        try {
          await event.execute(client, ...args);
        } catch (error) {
          handleEventError(error, botLogger, event.name);
        }
      };

      if (event.once) {
        client.once(event.name, listener);
      } else {
        client.on(event.name, listener);
      }

      loaded++;
      botLogger.debug(`Registered event: ${event.name} (once=${event.once})`);
    } catch (error) {
      botLogger.error(`Failed to load event at ${filePath}: ${error.message}`);
    }
  }

  botLogger.info(`Events registered: ${loaded} total.`);
}

export { loadEvents };
