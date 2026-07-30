/**
 * Embed Helper
 *
 * Factory functions for creating consistently styled Discord embeds.
 */

import { EmbedBuilder } from 'discord.js';

/** Default embed colors */
const Colors = Object.freeze({
  PRIMARY: 0x5865f2,   // Discord Blurple
  SUCCESS: 0x57f287,   // Green
  WARNING: 0xfee75c,   // Yellow
  ERROR: 0xed4245,     // Red
  INFO: 0x5865f2,      // Blurple
  NEUTRAL: 0x99aab5,   // Gray
});

/**
 * Create a basic embed with a title, description, and optional color.
 * @param {string} title
 * @param {string} description
 * @param {number} [color]
 * @returns {EmbedBuilder}
 */
function createEmbed(title, description, color = Colors.PRIMARY) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

/**
 * Create a success embed.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function successEmbed(title, description) {
  return createEmbed(`✅ ${title}`, description, Colors.SUCCESS);
}

/**
 * Create an error embed.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function errorEmbed(title, description) {
  return createEmbed(`❌ ${title}`, description, Colors.ERROR);
}

/**
 * Create a warning embed.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function warnEmbed(title, description) {
  return createEmbed(`⚠️ ${title}`, description, Colors.WARNING);
}

/**
 * Create an info embed.
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function infoEmbed(title, description) {
  return createEmbed(`ℹ️ ${title}`, description, Colors.INFO);
}

export { createEmbed, successEmbed, errorEmbed, warnEmbed, infoEmbed, Colors };
