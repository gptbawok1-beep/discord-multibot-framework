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
 * @param {1|2} botNumber
 * @returns {BotConfig}
 */
function buildBotConfig(botNumber) {
  const prefix = `BOT${botNumber}`;
  return Object.freeze({
    token: env(`${prefix}_TOKEN`),
    clientId: env(`${prefix}_CLIENT_ID`),
    prefix: env(`${prefix}_PREFIX`, botNumber === 1 ? '!' : '?'),
    name: `BOT${botNumber}`,
  });
}

const config = Object.freeze({
  bot1: buildBotConfig(1),
  bot2: buildBotConfig(2),
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  logLevel: process.env.LOG_LEVEL ?? 'INFO',
});

export default config;
