/**
 * Bot 1 — Prefix Command: ping
 *
 * Example prefix command to verify the framework is operational.
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { successEmbed } from '../../../../shared/utils/embed.js';

export default class PingCommand extends BaseCommand {
  constructor() {
    super({
      name: 'ping',
      description: 'Check Bot 1 latency and connection status.',
      type: 'prefix',
      cooldown: 5,
    });
  }

  async execute(client, message, args) {
    const latency = Math.round(client.ws.ping);
    const embed = successEmbed(
      'Pong!',
      `**Bot 1** is online and ready.\n\n🏓 WebSocket Latency: **${latency}ms**`
    );

    await message.reply({ embeds: [embed] });
  }
}
