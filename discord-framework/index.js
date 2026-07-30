/**
 * Main Entry Point — Run Both Bots Simultaneously
 *
 * Spawns both bots as separate child processes so each bot runs
 * in its own isolated Node.js process.
 *
 * Platform notes:
 *   - Uses process.execPath (the running Node binary) — works on all platforms
 *   - windowsHide: true prevents a new console window on Windows
 *   - Graceful shutdown: SIGINT/SIGTERM kill both children before exiting
 *   - On Windows, SIGTERM is not supported for process groups; we send SIGKILL
 *     as a fallback so children always terminate with the parent
 *
 * Usage: node index.js
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './shared/logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('child_process').ChildProcess[]} */
const children = [];

/**
 * Spawn a bot as a child process and track it for cleanup.
 *
 * @param {string} name        - Human-readable label used in log output.
 * @param {string} scriptPath  - Absolute path to the bot's index.js.
 * @returns {import('child_process').ChildProcess}
 */
function spawnBot(name, scriptPath) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
    // Prevents a new console window from appearing on Windows
    windowsHide: true,
  });

  children.push(child);

  child.on('error', (error) => {
    logger.error(`[${name}] Failed to start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      logger.warn(`[${name}] Exited with code ${code} (signal: ${signal ?? 'none'})`);
    }
  });

  logger.info(`[${name}] Process spawned (PID: ${child.pid})`);
  return child;
}

/**
 * Gracefully terminate all child processes.
 * Sends SIGTERM first; on Windows where SIGTERM is unsupported for
 * child processes, falls back to SIGKILL immediately.
 */
function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down all bots...`);

  for (const child of children) {
    if (child.exitCode !== null) continue; // already exited

    try {
      if (process.platform === 'win32') {
        // SIGTERM is not reliably supported on Windows child processes
        child.kill('SIGKILL');
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // Child may have already exited between the check and the kill call
    }
  }

  process.exit(0);
}

// Register shutdown handlers so Ctrl+C and process termination always
// clean up child processes on all platforms (Linux, Windows, Termux, etc.)
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Windows: SIGHUP is not standard, but handle it defensively
if (process.platform !== 'win32') {
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

logger.info('Starting Discord Multi-Bot Framework...');

spawnBot('BOT1', join(__dirname, 'bots', 'bot1', 'index.js'));
spawnBot('BOT2', join(__dirname, 'bots', 'bot2', 'index.js'));
