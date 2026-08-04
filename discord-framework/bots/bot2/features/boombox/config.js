/**
 * config.js — BoomBox-specific constants.
 * Loads role, channel, and server IDs dynamically from environment variables,
 * with neutral fallback values to prevent hardcoding.
 */

export const BOOMBOX_CONFIG = {
  // Server
  GUILD_ID: process.env.GUILD_ID ?? process.env.BOT2_GUILD_ID ?? "",

  // Channels
  BOOMBOX_CHANNEL_ID:     process.env.BOOMBOX_CHANNEL_ID ?? "",
  BOOMBOX_LOG_CHANNEL_ID: process.env.BOOMBOX_LOG_CHANNEL_ID ?? "",

  // Roles
  OWNER_ROLE_ID:        process.env.OWNER_ROLE_ID ?? "",
  DEVELOPER_ROLE_ID:    process.env.DEVELOPER_ROLE_ID ?? "",
  PREMIUM_ROLE_ID:      process.env.PREMIUM_ROLE_ID ?? "",
  BOOMBOX_FREE_ROLE_ID: process.env.BOOMBOX_FREE_ROLE_ID ?? "",
  MEMBER_ROLE_ID:       process.env.MEMBER_ROLE_ID ?? "",

  // Conversion defaults
  AUDIO_TYPE:    process.env.BOOMBOX_AUDIO_TYPE ?? "mp3",
  AUDIO_QUALITY: process.env.BOOMBOX_AUDIO_QUALITY ?? "128", // kbps

  // Default daily request limit for BoomBox Free role
  DEFAULT_FREE_DAILY_LIMIT: parseInt(process.env.DEFAULT_FREE_DAILY_LIMIT ?? "10", 10),
};

/** Roles that have unlimited BoomBox access. */
export const UNLIMITED_ROLES = [
  BOOMBOX_CONFIG.OWNER_ROLE_ID,
  BOOMBOX_CONFIG.DEVELOPER_ROLE_ID,
  BOOMBOX_CONFIG.PREMIUM_ROLE_ID,
].filter(Boolean);

/** All roles allowed to use BoomBox at all. */
export const ALLOWED_ROLES = [
  ...UNLIMITED_ROLES,
  BOOMBOX_CONFIG.BOOMBOX_FREE_ROLE_ID,
].filter(Boolean);
