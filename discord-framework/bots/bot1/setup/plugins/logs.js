/**
 * Plugin: 📜 Logs
 *
 * Setup wizard for configuring log channels per category.
 *
 * Required permission: View Audit Log
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildChannelPreviewPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateTextChannel, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';

const LOG_CATEGORIES = [
  { id: 'member',     label: '👤  Member Logs',    desc: 'Join/leave/ban/kick' },
  { id: 'role',       label: '🎭  Role Logs',       desc: 'Role create/delete/assign' },
  { id: 'invite',     label: '📨  Invite Logs',     desc: 'Invite create/delete/use' },
  { id: 'channel',    label: '📁  Channel Logs',    desc: 'Channel create/delete/update' },
  { id: 'moderation', label: '🔨  Moderation Logs', desc: 'Timeout/kick/ban history' },
  { id: 'welcome',    label: '👋  Welcome Logs',    desc: 'Welcome message delivery' },
  { id: 'error',      label: '⚠️  Error Logs',      desc: 'Bot error reports' },
];

const plugin = {
  id:                 'logs',
  label:              'Logs',
  emoji:              '📜',
  description:        'Konfigurasi channel untuk setiap kategori log.',
  order:              5,
  requiredPermission: PermissionFlagsBits.ViewAuditLog,

  getStatus(cfg) {
    const active = Object.values(cfg.logs.channels).filter(Boolean).length;
    return {
      enabled: cfg.logs.enabled,
      summary: `${active}/${LOG_CATEGORIES.length} aktif`,
    };
  },

  async buildPage(cfg) {
    const logs  = cfg.logs;
    const embed = new EmbedBuilder()
      .setColor(logs.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '📜  Logs' })
      .setDescription(`Konfigurasi channel log per kategori.\n${DIVIDER}`)
      .addFields({ name: '📊  Status', value: statusDot(logs.enabled), inline: true });

    for (const cat of LOG_CATEGORIES) {
      embed.addFields({
        name:   cat.label,
        value:  channelLabel(logs.channels[cat.id]),
        inline: true,
      });
    }
    embed.setFooter({ text: 'Pilih kategori dari dropdown untuk atur channel.' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:logs:enable')
        .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
        .setDisabled(logs.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:logs:disable')
        .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
        .setDisabled(!logs.enabled),
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId('setup1:logs:select_category')
      .setPlaceholder('Pilih kategori untuk atur channel...')
      .addOptions(
        LOG_CATEGORIES.map((cat) => ({
          label:       cat.label.replace(/^\S+\s+/, ''),
          value:       cat.id,
          description: cat.desc,
          emoji:       cat.label.split(' ')[0],
        }))
      );

    return { embed, components: [row1, new ActionRowBuilder().addComponents(select), buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    const reload = () => loadGuildConfig(session.guildId);

    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'logs', { enabled: action === 'enable' });
      const page = await plugin.buildPage(await reload());
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'select_category') {
      const catId = interaction.values[0];
      const cat   = LOG_CATEGORIES.find((c) => c.id === catId);
      if (!cat) return;
      session.wizardData.logsCategory = catId;
      const page = buildChannelSelectPage(
        `📜  Logs — Set Channel: ${cat.label}`,
        `Pilih channel untuk ${cat.desc}.`,
        'setup1:logs:ch_select',
        'setup1:logs:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_select') {
      const catId = session.wizardData.logsCategory;
      const cat   = LOG_CATEGORIES.find((c) => c.id === catId);
      session.wizardData.pendingChannel = interaction.values[0];
      const page = buildChannelPreviewPage(
        `📜  Logs — ${cat?.label ?? catId} Preview`,
        `Channel ini akan digunakan untuk ${cat?.desc ?? catId}.`,
        interaction.values[0],
        'setup1:logs:ch_confirm',
        'setup1:logs:ch_retry',
        'setup1:logs:back_to_page',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_confirm') {
      const catId     = session.wizardData.logsCategory;
      const channelId = session.wizardData.pendingChannel;
      if (catId && channelId) {
        // Validate channel before saving
        const validation = await validateTextChannel(interaction.guild, channelId);
        if (!validation.ok) {
          return interaction.update({
            embeds:     [buildValidationErrorEmbed([validation.reason])],
            components: [buildNavRow()],
          });
        }
        const fresh    = await reload();
        const channels = { ...fresh.logs.channels, [catId]: channelId };
        await updateSection(session.guildId, 'logs', { channels });
      }
      session.wizardData.logsCategory  = null;
      session.wizardData.pendingChannel = null;
      const page = await plugin.buildPage(await reload());
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_retry') {
      const catId = session.wizardData.logsCategory;
      const cat   = LOG_CATEGORIES.find((c) => c.id === catId);
      session.wizardData.pendingChannel = null;
      if (cat) {
        const page = buildChannelSelectPage(
          `📜  Logs — Set Channel: ${cat.label}`,
          `Pilih channel untuk ${cat.desc}.`,
          'setup1:logs:ch_select',
          'setup1:logs:back_to_page',
        );
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
    }

    if (action === 'back_to_page') {
      session.wizardData.logsCategory  = null;
      session.wizardData.pendingChannel = null;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }
  },
};

export default plugin;
