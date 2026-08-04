/**
 * Bot 2 — Slash Command: /setupboombox
 *
 * Opens the Boombox setup configurations panel.
 * Requires Manage Guild permission.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { buildBoomboxMainDashboard } from '../../features/boombox/setup/panel.js';

export default class SetupBoomboxCommand extends BaseCommand {
  constructor() {
    super({
      name:            'setupboombox',
      description:     'Buka Panel Konfigurasi Boombox BOT 2.',
      type:            'slash',
      guildOnly:       true,
      userPermissions: ['ManageGuild'],
      data: new SlashCommandBuilder()
        .setName('setupboombox')
        .setDescription('Buka Panel Konfigurasi Boombox BOT 2.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    });
  }

  async execute(client, interaction) {
    const payload = buildBoomboxMainDashboard(interaction.user.id);
    await interaction.reply({ ...payload, ephemeral: true });
  }
}
