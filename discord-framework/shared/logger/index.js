/**
 * Shared Logger
 *
 * Supports: INFO, WARN, ERROR, SUCCESS, DEBUG
 * Each log entry clearly shows which bot it came from.
 */

import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '../../logs');

// Ensure logs directory exists
mkdirSync(LOG_DIR, { recursive: true });

const logStream = createWriteStream(join(LOG_DIR, 'combined.log'), { flags: 'a' });

/** ANSI color codes */
const Colors = Object.freeze({
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',

  // Log levels
  INFO: '\x1b[36m',     // Cyan
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  SUCCESS: '\x1b[32m',  // Green
  DEBUG: '\x1b[35m',    // Magenta

  // Bot labels
  BOT1: '\x1b[34m',     // Blue
  BOT2: '\x1b[94m',     // Bright Blue
  SYSTEM: '\x1b[90m',   // Gray
});

/** Log levels and their priorities */
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 1,
});

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() ?? 'INFO'] ?? LOG_LEVELS.INFO;

/**
 * Format a timestamp as [HH:MM:SS]
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Get ANSI color for a bot source label.
 * @param {string|null} source
 * @returns {string}
 */
function getBotColor(source) {
  if (!source) return Colors.SYSTEM;
  const upper = source.toUpperCase();
  if (upper.includes('BOT1')) return Colors.BOT1;
  if (upper.includes('BOT2')) return Colors.BOT2;
  return Colors.SYSTEM;
}

/**
 * Write a plain-text line to the log file.
 * @param {string} level
 * @param {string} message
 * @param {string|null} source
 */
function writeToFile(level, message, source) {
  const timestamp = new Date().toISOString();
  const sourceLabel = source ? `[${source}]` : '[SYSTEM]';
  logStream.write(`${timestamp} ${level.padEnd(7)} ${sourceLabel} ${message}\n`);
}

/**
 * Core log function.
 * @param {string} level
 * @param {string} message
 * @param {string|null} source  - e.g. 'BOT1', 'BOT2', or null for system
 */
function log(level, message, source = null) {
  const priority = LOG_LEVELS[level];
  if (priority !== undefined && priority < CURRENT_LEVEL) return;

  const timestamp = `${Colors.DIM}[${getTimestamp()}]${Colors.RESET}`;
  const levelColor = Colors[level] ?? Colors.RESET;
  const levelLabel = `${levelColor}${Colors.BOLD}[${level.padEnd(7)}]${Colors.RESET}`;
  const botColor = getBotColor(source);
  const sourceLabel = source
    ? `${botColor}${Colors.BOLD}[${source}]${Colors.RESET}`
    : `${Colors.SYSTEM}[SYSTEM]${Colors.RESET}`;

  console.log(`${timestamp} ${levelLabel} ${sourceLabel} ${message}`);
  writeToFile(level, message, source);
}

/**
 * Logger factory — creates a logger bound to a specific source (bot name).
 * @param {string|null} source
 * @returns {Logger}
 */
function createLogger(source = null) {
  return {
    info: (message) => log('INFO', message, source),
    warn: (message) => log('WARN', message, source),
    error: (message) => log('ERROR', message, source),
    success: (message) => log('SUCCESS', message, source),
    debug: (message) => log('DEBUG', message, source),
  };
}

/** System-level logger (no bot source) */
const systemLogger = createLogger(null);

export { createLogger, systemLogger as logger };
export default createLogger;
