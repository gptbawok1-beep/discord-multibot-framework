/**
 * Slash Command Handler
 *
 * Intercepts interactionCreate events and routes them to the
 * correct slash command, enforcing cooldowns and permissions.
 */

import { checkCooldown } from '../utils/cooldown.js';
import { checkUserPermissions, checkBotPermissions } from '../utils/permission.js';
import { errorEmbed, warnEmbed } from '../utils/embed.js';
import { handleCommandError } from '../utils/errorHandler.js';

/**
 * Handle an incoming slash command interaction.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {ReturnType<import('../logger/index.js').createLogger>} logger
 */
async function handleSlashCommand(interaction, client, logger) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;

  // Guild-only guard
  if (command.guildOnly && !interaction.guild) {
    return interaction.reply({
      embeds: [errorEmbed('Server Only', 'This command can only be used in a server.')],
      ephemeral: true,
    });
  }

  // Permission checks (guild only)
  if (interaction.guild) {
    const member = interaction.member;
    const botMember = interaction.guild.members.me;

    const userPerms = checkUserPermissions(member, command.userPermissions);
    if (!userPerms.ok) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Missing Permissions',
            `You need: **${userPerms.missing.join(', ')}** to use this command.`
          ),
        ],
        ephemeral: true,
      });
    }

    const botPerms = checkBotPermissions(botMember, command.botPermissions);
    if (!botPerms.ok) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Bot Missing Permissions',
            `I need: **${botPerms.missing.join(', ')}** to run this command.`
          ),
        ],
        ephemeral: true,
      });
    }
  }

  // Cooldown check
  const remaining = checkCooldown(command.name, interaction.user.id, command.cooldown);
  if (remaining > 0) {
    return interaction.reply({
      embeds: [
        warnEmbed(
          'Cooldown',
          `Please wait **${remaining}s** before using \`/${command.name}\` again.`
        ),
      ],
      ephemeral: true,
    });
  }

  try {
    await command.execute(client, interaction);
    logger.info(`/${command.name} used by ${interaction.user.tag}`);
  } catch (error) {
    await handleCommandError(error, interaction, logger, command.name);
  }
}

export { handleSlashCommand };
