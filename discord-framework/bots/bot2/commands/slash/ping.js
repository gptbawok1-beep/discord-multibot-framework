/**
 * Bot 2 — Slash Command: /ping
 *
 * Example slash command to verify the framework is operational.
 */

import { SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { successEmbed } from '../../../../shared/utils/embed.js';

export default class PingCommand extends BaseCommand {
  constructor() {
    super({
      name: 'ping',
      description: 'Check Bot 2 latency and connection status.',
      type: 'slash',
      cooldown: 5,
      data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check Bot 2 latency and connection status.'),
    });
  }

  async execute(client, interaction) {
    const latency = Math.round(client.ws.ping);
    const embed = successEmbed(
      'Pong!',
      `**Bot 2** is online and ready.\n\n🏓 WebSocket Latency: **${latency}ms**`
    );

    await interaction.reply({ embeds: [embed] });
  }
}
