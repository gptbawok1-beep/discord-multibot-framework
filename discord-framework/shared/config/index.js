/**
 * Shared Config Loader
 *
 * Loads and validates environment variables for all bots.
 * Throws early with a clear message if required values are missing.
 */

import 'dotenv/config';

/**
 * Retrieve an environment variable, throwing if it is required and missing.
 * @param {string} key
 * @param {string|undefined} fallback
 * @returns {string}
 */
function env(key, fallback = undefined) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Build the config object for a specific bot by index (1 or 2).
 * Returns null if the bot's token is not configured (allows optional bots).
 * @param {1|2} botNumber
 * @param {boolean} required  - throw if token is missing (default: false)
 * @returns {BotConfig|null}
 */
function buildBotConfig(botNumber, required = false) {
  const prefix = `BOT${botNumber}`;
  const token    = process.env[`${prefix}_TOKEN`];
  const clientId = process.env[`${prefix}_CLIENT_ID`];

  if (!token || !clientId) {
    if (required) {
      throw new Error(
        `Missing required environment variable: ${!token ? `${prefix}_TOKEN` : `${prefix}_CLIENT_ID`}`
      );
    }
    return null; // bot is optional — caller should skip it
  }

  return Object.freeze({
    token,
    clientId,
    prefix: env(`${prefix}_PREFIX`, botNumber === 1 ? '!' : '?'),
    name: `BOT${botNumber}`,
  });
}

const config = Object.freeze({
  bot1: buildBotConfig(1, true), // BOT 1 token is required
  bot2: buildBotConfig(2, false), // BOT 2 token is optional
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  logLevel: process.env.LOG_LEVEL ?? 'INFO',
});

export default config;
