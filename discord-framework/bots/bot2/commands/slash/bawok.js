/**
 * Bot 2 — Slash Command: /bawok
 *
 * Opens the Bawok panel — a single embed that is edited in-place
 * as the user navigates between modules.
 */

import { SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { homePayload } from '../../features/bawok/panels.js';

export default class BawokCommand extends BaseCommand {
  constructor() {
    super({
      name: 'bawok',
      description: 'Buka panel Bawok.',
      type: 'slash',
      cooldown: 3,
      data: new SlashCommandBuilder()
        .setName('bawok')
        .setDescription('Buka panel Bawok.'),
    });
  }

  async execute(_client, interaction) {
    await interaction.reply(homePayload());
  }
}
