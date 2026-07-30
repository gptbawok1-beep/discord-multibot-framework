/**
 * Cooldown Manager
 *
 * Prevents command spam by enforcing per-user, per-command cooldowns.
 */

/** @type {Map<string, Map<string, number>>} commandName -> userId -> expiresAt */
const cooldowns = new Map();

/**
 * Check if a user is on cooldown for a command.
 * Returns the remaining seconds if on cooldown, or 0 if the user may proceed.
 *
 * @param {string} commandName
 * @param {string} userId
 * @param {number} seconds - Cooldown duration in seconds
 * @returns {number} Remaining cooldown in seconds (0 = free to use)
 */
function checkCooldown(commandName, userId, seconds) {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const timestamps = cooldowns.get(commandName);
  const now = Date.now();
  const expiresAt = timestamps.get(userId) ?? 0;
  const remaining = expiresAt - now;

  if (remaining > 0) {
    return Math.ceil(remaining / 1000);
  }

  // Set cooldown
  timestamps.set(userId, now + seconds * 1000);

  // Auto-clean after expiry to prevent memory leaks
  setTimeout(() => timestamps.delete(userId), seconds * 1000);

  return 0;
}

/**
 * Manually clear a user's cooldown for a command.
 * @param {string} commandName
 * @param {string} userId
 */
function clearCooldown(commandName, userId) {
  cooldowns.get(commandName)?.delete(userId);
}

export { checkCooldown, clearCooldown };
