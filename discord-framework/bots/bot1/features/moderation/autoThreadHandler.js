/**
 * Bot 1 — Auto Thread Handler
 *
 * When a new message is sent in a channel that has Auto Thread enabled,
 * the bot automatically creates a thread for that message.
 *
 * Threads are created with the first 50 chars of the message content
 * (or a generic name if the message has no text).
 */

/**
 * Handle auto-thread creation for a message.
 *
 * @param {import('discord.js').Message} message
 * @param {object} cfg  - guild config (already loaded)
 */
export async function handleAutoThread(message, cfg) {
  if (!message.guild)       return;
  if (message.author.bot)   return;
  if (message.hasThread)    return; // Already has a thread
  if (!message.channel?.isTextBased()) return;

  // Don't create threads inside existing threads
  if (message.channel.isThread?.()) return;

  const autoThreadChannels = cfg.autothread?.channels ?? [];
  if (!autoThreadChannels.includes(message.channel.id)) return;

  // Build thread name from message content
  let threadName = message.content?.slice(0, 50).trim();
  if (!threadName) threadName = `Thread oleh ${message.author.username}`;
  // Discord thread names must be 1–100 chars and can't start with a space
  threadName = threadName.replace(/\s+/g, ' ').trim() || 'New Thread';

  try {
    await message.startThread({
      name:                threadName,
      autoArchiveDuration: 1440, // 24 hours
    });
  } catch (err) {
    // Suppress — bot may lack Manage Threads permission or message was deleted
  }
}
