/**
 * Error Handler
 *
 * Centralized error handling for commands and events.
 * Logs the error and optionally replies to the user.
 */

import { errorEmbed } from './embed.js';

/**
 * Handle a command execution error.
 * Logs the error via the provided logger and attempts to notify the user.
 *
 * @param {Error} error
 * @param {import('discord.js').Message|import('discord.js').ChatInputCommandInteraction} ctx
 * @param {ReturnType<import('../logger/index.js').createLogger>} logger
 * @param {string} commandName
 */
async function handleCommandError(error, ctx, logger, commandName) {
  logger.error(`Error in command "${commandName}": ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    logger.debug(error.stack);
  }

  const embed = errorEmbed(
    'An Error Occurred',
    'Something went wrong while executing this command. Please try again later.'
  );

  try {
    if (ctx.replied || ctx.deferred) {
      await ctx.followUp({ embeds: [embed], ephemeral: true });
    } else if (typeof ctx.reply === 'function') {
      await ctx.reply({ embeds: [embed], ephemeral: true });
    }
  } catch {
    // Suppress secondary errors from the error reply itself
  }
}

/**
 * Handle an event execution error.
 * @param {Error} error
 * @param {ReturnType<import('../logger/index.js').createLogger>} logger
 * @param {string} eventName
 */
function handleEventError(error, logger, eventName) {
  logger.error(`Error in event "${eventName}": ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    logger.debug(error.stack);
  }
}

export { handleCommandError, handleEventError };
