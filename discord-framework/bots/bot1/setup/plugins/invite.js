/**
 * Plugin: 📨 Invite Tracker
 *
 * Setup wizard for invite tracking configuration.
 * The actual tracking logic is a future implementation.
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';

const plugin = {
  id: 'invite',
  label: 'Invite Tracker',
  emoji: '📨',
  description: 'Lacak undangan dan tampilkan leaderboard invite.',

  getStatus(cfg) {
    return {
      enabled: cfg.invite.enabled,
      summary: cfg.invite.channelId ? channelLabel(cfg.invite.channelId) : 'Channel belum diatur',
    };
  },

  async buildPage(cfg) {
    const inv = cfg.invite;
    const embed = new EmbedBuilder()
      .setColor(inv.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '📨  Invite Tracker' })
      .setDescription(`Konfigurasi sistem pelacak undangan.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status',      value: statusDot(inv.enabled),                    inline: true },
        { name: '📢  Channel',     value: channelLabel(inv.channelId),                inline: true },
        { name: '📋  Logs',        value: channelLabel(inv.logsChannelId),             inline: true },
        { name: '🏆  Leaderboard', value: channelLabel(inv.leaderboardChannelId),      inline: true },
      )
      .setFooter({ text: 'Semua tracking aktif saat fitur diimplementasikan.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:enable')
        .setLabel('Enable')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success)
        .setDisabled(inv.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:invite:disable')
        .setLabel('Disable')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!inv.enabled),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:set_channel')
        .setLabel('Set Channel')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:set_logs')
        .setLabel('Set Logs Channel')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:invite:set_leaderboard')
        .setLabel('Set Leaderboard Channel')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:invite:preview')
        .setLabel('Preview')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const reload = () => loadGuildConfig(session.guildId);

    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'invite', { enabled: action === 'enable' });
      const page = await plugin.buildPage(await reload());
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // Map: button action → channel select page config
    const channelSelectTargets = {
      set_channel:     { customId: 'setup1:invite:ch_main',        title: 'Set Invite Channel',        desc: 'Pilih channel utama untuk informasi invite.',       configKey: 'channelId',           previewLabel: 'Invite Channel' },
      set_logs:        { customId: 'setup1:invite:ch_logs',         title: 'Set Logs Channel',          desc: 'Pilih channel untuk log detail invite.',             configKey: 'logsChannelId',       previewLabel: 'Logs Channel' },
      set_leaderboard: { customId: 'setup1:invite:ch_leaderboard',  title: 'Set Leaderboard Channel',   desc: 'Pilih channel untuk leaderboard invite.',            configKey: 'leaderboardChannelId', previewLabel: 'Leaderboard Channel' },
    };

    // Show channel select page
    if (channelSelectTargets[action]) {
      const { customId, title, desc } = channelSelectTargets[action];
      // Store which channel type is being changed so confirm/retry know what to do
      session.wizardData.pendingChannelTarget = action;
      const page = buildChannelSelectPage(title, desc, customId, 'setup1:invite:back_to_page');
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // Channel selected — stage in session and show preview (don't save yet)
    const chSelectActions = { ch_main: 'set_channel', ch_logs: 'set_logs', ch_leaderboard: 'set_leaderboard' };
    if (chSelectActions[action]) {
      const target = channelSelectTargets[chSelectActions[action]];
      session.wizardData.pendingChannel = interaction.values[0];
      session.wizardData.pendingChannelTarget = chSelectActions[action];
      const page = buildChannelPreviewPage(
        `📨  Invite Tracker — ${target.previewLabel} Preview`,
        target.desc,
        interaction.values[0],
        'setup1:invite:ch_confirm',
        'setup1:invite:ch_retry',
        'setup1:invite:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // Confirmed — persist staged channel to config
    if (action === 'ch_confirm') {
      const channelId = session.wizardData.pendingChannel;
      const targetKey = channelSelectTargets[session.wizardData.pendingChannelTarget]?.configKey;
      if (channelId && targetKey) {
        await updateSection(session.guildId, 'invite', { [targetKey]: channelId });
      }
      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelTarget;
      const page = await plugin.buildPage(await reload());
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // Retry — re-show the same channel select page
    if (action === 'ch_retry') {
      const tgt = channelSelectTargets[session.wizardData.pendingChannelTarget];
      delete session.wizardData.pendingChannel;
      if (tgt) {
        const page = buildChannelSelectPage(tgt.title, tgt.desc, tgt.customId, 'setup1:invite:back_to_page');
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
    }

    if (action === 'back_to_page') {
      delete session.wizardData.pendingChannel;
      delete session.wizardData.pendingChannelTarget;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'preview') {
      const inv = cfg.invite;
      const previewEmbed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('📨  Invite Tracker — Preview')
        .addFields(
          { name: 'Channel',     value: channelLabel(inv.channelId),           inline: true },
          { name: 'Logs',        value: channelLabel(inv.logsChannelId),         inline: true },
          { name: 'Leaderboard', value: channelLabel(inv.leaderboardChannelId),  inline: true },
        )
        .setFooter({ text: 'Preview — fitur belum aktif' });
      return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
    }
  },
};

export default plugin;
