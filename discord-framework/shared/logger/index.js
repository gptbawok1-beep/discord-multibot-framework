/**
 * Shared Logger
 *
 * Supports: INFO, WARN, ERROR, SUCCESS, DEBUG
 * Each log entry clearly shows which bot it came from.
 *
 * Color support:
 *   - Honors the NO_COLOR standard (https://no-color.org/)
 *   - Honors FORCE_COLOR=1 (used by Railway, GitHub Actions, etc.)
 *   - Auto-detects via process.stdout.hasColors() / isTTY
 *   - Falls back to plain text on dumb terminals, Windows CMD, Pterodactyl, etc.
 */

import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', '..', 'logs');

// Ensure the logs directory exists on every platform
mkdirSync(LOG_DIR, { recursive: true });

// Write log lines to a file; handle stream errors without crashing the process
const logStream = createWriteStream(join(LOG_DIR, 'combined.log'), { flags: 'a' });
logStream.on('error', (err) => {
  // Use process.stderr directly — never recurse into the logger here
  process.stderr.write(`[LOGGER] Failed to write to log file: ${err.message}\n`);
});

// ---------------------------------------------------------------------------
// Color support detection
//
//   Priority order (highest → lowest):
//     1. NO_COLOR env var  → always disable  (https://no-color.org/)
//     2. FORCE_COLOR env var → always enable  (Railway, CI, etc.)
//     3. process.stdout.hasColors() / isTTY  → auto-detect
// ---------------------------------------------------------------------------
const NO_COLOR = Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR');
const FORCE_COLOR =
  Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR') &&
  process.env.FORCE_COLOR !== '0';

const supportsColor =
  !NO_COLOR &&
  (FORCE_COLOR ||
    (typeof process.stdout.hasColors === 'function'
      ? process.stdout.hasColors()
      : process.stdout.isTTY === true));

/** ANSI color codes — only used when color is supported */
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

  // Bot source labels
  BOT1: '\x1b[34m',     // Blue
  BOT2: '\x1b[94m',     // Bright Blue
  SYSTEM: '\x1b[90m',   // Gray
});

/**
 * Wrap a string in ANSI codes only if the terminal supports color.
 * @param {string} code  - ANSI escape code from Colors
 * @param {string} text
 * @returns {string}
 */
function paint(code, text) {
  if (!supportsColor) return text;
  return `${code}${text}${Colors.RESET}`;
}

/** Log levels and their numeric priorities */
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 1,
  WARN: 2,
  ERROR: 3,
});

const CURRENT_LEVEL =
  LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() ?? 'INFO'] ?? LOG_LEVELS.INFO;

/**
 * Format the current time as HH:MM:SS.
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Return the ANSI color code for a bot source label.
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
 * Append a plain-text line to the log file (no ANSI codes).
 * @param {string} level
 * @param {string} message
 * @param {string|null} source
 */
function writeToFile(level, message, source) {
  const timestamp = new Date().toISOString();
  const sourceLabel = source ? `[${source}]` : '[SYSTEM]';
  // '\n' is intentional — cross-platform log readers handle LF correctly
  logStream.write(`${timestamp} ${level.padEnd(7)} ${sourceLabel} ${message}\n`);
}

/**
 * Core log function.
 * @param {string} level
 * @param {string} message
 * @param {string|null} source  - 'BOT1', 'BOT2', or null for system logs
 */
function log(level, message, source = null) {
  const priority = LOG_LEVELS[level];
  if (priority !== undefined && priority < CURRENT_LEVEL) return;

  const timestampRaw = `[${getTimestamp()}]`;
  const levelPadded = `[${level.padEnd(7)}]`;
  const sourceLabel = source ? `[${source}]` : '[SYSTEM]';

  const line = supportsColor
    ? [
        paint(Colors.DIM, timestampRaw),
        paint((Colors[level] ?? Colors.RESET) + Colors.BOLD, levelPadded),
        paint(getBotColor(source) + Colors.BOLD, sourceLabel),
        message,
      ].join(' ')
    : `${timestampRaw} ${levelPadded} ${sourceLabel} ${message}`;

  process.stdout.write(line + '\n');
  writeToFile(level, message, source);
}

/**
 * Logger factory — creates a logger bound to a specific source (bot name).
 * @param {string|null} source
 * @returns {{ info, warn, error, success, debug }}
 */
function createLogger(source = null) {
  return {
    info:    (message) => log('INFO',    message, source),
    warn:    (message) => log('WARN',    message, source),
    error:   (message) => log('ERROR',   message, source),
    success: (message) => log('SUCCESS', message, source),
    debug:   (message) => log('DEBUG',   message, source),
  };
}

/** System-level logger (no bot source label) */
const systemLogger = createLogger(null);

export { createLogger, systemLogger as logger };
export default createLogger;
