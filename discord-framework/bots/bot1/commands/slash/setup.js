/**
 * Bot 1 — Slash Command: /setup bot1
 *
 * Entry point for the Bot 1 Setup Wizard.
 * Requires Manage Guild permission.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { openWizard } from '../../setup/wizard.js';

export default class SetupCommand extends BaseCommand {
  constructor() {
    super({
      name: 'setup',
      description: 'Buka Setup Wizard BOT 1.',
      type: 'slash',
      guildOnly: true,
      userPermissions: ['ManageGuild'],
      data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('BOT 1 Setup Wizard — konfigurasi semua fitur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
          sub
            .setName('bot1')
            .setDescription('Buka Setup Wizard untuk BOT 1.')
        ),
    });
  }

  async execute(client, interaction) {
    if (interaction.options.getSubcommand() !== 'bot1') return;
    await openWizard(interaction);
  }
}
