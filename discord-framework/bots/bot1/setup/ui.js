/**
 * Bot 1 — Setup Wizard UI Builders
 *
 * All embed and component construction lives here to keep plugins thin.
 * Plugins call these helpers instead of building raw Discord objects.
 */

import {
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} from 'discord.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export const Colors = Object.freeze({
  PRIMARY:  0x5865F2,  // Blurple — main wizard
  SUCCESS:  0x57F287,  // Green   — enabled/saved
  WARNING:  0xFEE75C,  // Yellow  — warning/confirm
  ERROR:    0xED4245,  // Red     — disabled/danger
  NEUTRAL:  0x4F545C,  // Gray    — info
  DARK:     0x2B2D31,  // Dark    — sub-pages
});

/** @param {boolean} enabled */
export function statusDot(enabled) {
  return enabled ? '🟢 Aktif' : '🔴 Nonaktif';
}

/** @param {string|null} channelId */
export function channelLabel(channelId) {
  return channelId ? `<#${channelId}>` : '`Belum diatur`';
}

// ---------------------------------------------------------------------------
// Main Wizard Page
// ---------------------------------------------------------------------------

/**
 * Build the main wizard embed.
 * @param {import('./plugins/index.js').Plugin[]} plugins
 * @param {object} guildConfig
 * @param {string} guildName
 * @returns {EmbedBuilder}
 */
export function buildMainEmbed(plugins, guildConfig, guildName) {
  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '⚙️  BOT 1 — Setup Wizard' })
    .setDescription(
      `Selamat datang di **Setup Wizard**.\nPilih fitur yang ingin dikonfigurasi.\n${DIVIDER}`
    )
    .setTimestamp()
    .setFooter({ text: `${guildName} • BOT 1 Setup Wizard` });

  for (const plugin of plugins) {
    const status = plugin.getStatus(guildConfig);
    embed.addFields({
      name: `${plugin.emoji}  ${plugin.label}`,
      value: statusDot(status.enabled) + (status.summary ? `\n${status.summary}` : ''),
      inline: true,
    });
  }

  return embed;
}

/**
 * Build the main feature dropdown.
 * @param {import('./plugins/index.js').Plugin[]} plugins
 * @returns {ActionRowBuilder}
 */
export function buildMainSelectRow(plugins) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup1:nav:select')
    .setPlaceholder('📋  Pilih fitur yang ingin dikonfigurasi...')
    .addOptions(
      plugins.map((p) => ({
        label: p.label,
        value: p.id,
        description: p.description,
        emoji: p.emoji,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

/**
 * Build the main page button row: Home | Refresh | Save | Reset
 * @returns {ActionRowBuilder}
 */
export function buildMainButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:nav:home')
      .setLabel('Home')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:main:save_ack')
      .setLabel('Save')
      .setEmoji('💾')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup1:main:reset')
      .setLabel('Reset')
      .setEmoji('⚠️')
      .setStyle(ButtonStyle.Danger),
  );
}

// ---------------------------------------------------------------------------
// Navigation Row (sub-pages)
// ---------------------------------------------------------------------------

/**
 * Build the navigation row for sub-pages.
 * Always present at the bottom of every plugin page.
 * @returns {ActionRowBuilder}
 */
export function buildNavRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:nav:back')
      .setLabel('Back')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:home')
      .setLabel('Home')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:save')
      .setLabel('Save')
      .setEmoji('💾')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup1:nav:cancel')
      .setLabel('Cancel')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger),
  );
}

// ---------------------------------------------------------------------------
// Channel / Role Selection Pages
// These are temporary pages shown when user needs to select a channel/role.
// ---------------------------------------------------------------------------

/**
 * Build a "select a channel" intermediate page.
 * @param {string} title
 * @param {string} description
 * @param {string} customId   - custom ID for the channel select menu
 * @param {string} backId     - custom ID to use on the Back button
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
export function buildChannelSelectPage(title, description, customId, backId) {
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle(title)
    .setDescription(description + `\n\n${DIVIDER}\nGunakan dropdown di bawah untuk memilih channel.`);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pilih channel...')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(backId).setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup1:nav:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return {
    embed,
    components: [new ActionRowBuilder().addComponents(channelMenu), navRow],
  };
}

/**
 * Build a "select role(s)" intermediate page.
 * @param {string} title
 * @param {string} description
 * @param {string} customId
 * @param {string} backId
 * @param {number} [maxValues]
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
export function buildRoleSelectPage(title, description, customId, backId, maxValues = 1) {
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle(title)
    .setDescription(description + `\n\n${DIVIDER}\nGunakan dropdown di bawah untuk memilih role.`);

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pilih role...')
    .setMinValues(1)
    .setMaxValues(maxValues);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(backId).setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup1:nav:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return {
    embed,
    components: [new ActionRowBuilder().addComponents(roleMenu), navRow],
  };
}

// ---------------------------------------------------------------------------
// Feedback / Confirmation
// ---------------------------------------------------------------------------

/**
 * Build a simple confirmation embed for after save.
 * @param {string} message
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
export function buildSaveConfirmation(message = 'Konfigurasi berhasil disimpan.') {
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setDescription(`✅  **${message}**\n\nTekan **Home** untuk kembali ke menu utama.`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup1:nav:home').setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}
