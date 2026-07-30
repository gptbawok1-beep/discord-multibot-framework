/**
 * Main Entry Point — Run Both Bots Simultaneously
 *
 * Spawns both bots as separate child processes so each bot runs
 * in its own isolated Node.js process.
 *
 * Usage: node index.js
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './shared/logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Spawn a bot as a child process.
 * @param {string} name - Human-readable bot name for logging.
 * @param {string} scriptPath - Absolute path to the bot's index.js.
 */
function spawnBot(name, scriptPath) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    logger.error(`[${name}] Failed to start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      logger.warn(`[${name}] Exited with code ${code} (signal: ${signal ?? 'none'})`);
    }
  });

  logger.info(`[${name}] Process spawned (PID: ${child.pid})`);
  return child;
}

logger.info('Starting Discord Multi-Bot Framework...');

spawnBot('BOT1', join(__dirname, 'bots', 'bot1', 'index.js'));
spawnBot('BOT2', join(__dirname, 'bots', 'bot2', 'index.js'));
