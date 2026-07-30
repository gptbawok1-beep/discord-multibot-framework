/**
 * Prefix Command Handler
 *
 * Intercepts messageCreate events and routes them to the correct
 * prefix command, enforcing prefix, cooldowns, and permissions.
 */

import { checkCooldown } from '../utils/cooldown.js';
import { checkUserPermissions, checkBotPermissions } from '../utils/permission.js';
import { errorEmbed, warnEmbed } from '../utils/embed.js';
import { handleCommandError } from '../utils/errorHandler.js';

/**
 * Handle an incoming message for prefix command resolution.
 *
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 * @param {string} prefix
 * @param {ReturnType<import('../logger/index.js').createLogger>} logger
 */
async function handlePrefixCommand(message, client, prefix, logger) {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = client.prefixCommands.get(commandName);
  if (!command) return;

  // Guild-only guard
  if (command.guildOnly && !message.guild) {
    return message.reply({
      embeds: [errorEmbed('Server Only', 'This command can only be used in a server.')],
    });
  }

  // Permission checks (guild only)
  if (message.guild) {
    const member = message.member;
    const botMember = message.guild.members.me;

    const userPerms = checkUserPermissions(member, command.userPermissions);
    if (!userPerms.ok) {
      return message.reply({
        embeds: [
          errorEmbed(
            'Missing Permissions',
            `You need: **${userPerms.missing.join(', ')}** to use this command.`
          ),
        ],
      });
    }

    const botPerms = checkBotPermissions(botMember, command.botPermissions);
    if (!botPerms.ok) {
      return message.reply({
        embeds: [
          errorEmbed(
            'Bot Missing Permissions',
            `I need: **${botPerms.missing.join(', ')}** to run this command.`
          ),
        ],
      });
    }
  }

  // Cooldown check
  const remaining = checkCooldown(command.name, message.author.id, command.cooldown);
  if (remaining > 0) {
    return message.reply({
      embeds: [
        warnEmbed(
          'Cooldown',
          `Please wait **${remaining}s** before using \`${prefix}${command.name}\` again.`
        ),
      ],
    });
  }

  try {
    await command.execute(client, message, args);
    logger.info(`${prefix}${command.name} used by ${message.author.tag}`);
  } catch (error) {
    await handleCommandError(error, message, logger, command.name);
  }
}

export { handlePrefixCommand };
