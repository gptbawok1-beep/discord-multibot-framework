/**
 * Shared Setup Engine — UI Builder Factory
 *
 * Call createUIBuilders(prefix) to get a full set of Discord component
 * builders pre-wired to the given custom-ID prefix.
 *
 * Example:
 *   const ui = createUIBuilders('setup1');
 *   ui.buildNavRow()   // buttons use "setup1:nav:back", etc.
 *
 * Static helpers (Colors, DIVIDER, statusDot, channelLabel) are exported
 * directly — they don't need a prefix.
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
// Static constants (prefix-independent)
// ---------------------------------------------------------------------------

export const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export const Colors = Object.freeze({
  PRIMARY: 0x5865F2,  // Blurple — main wizard
  SUCCESS: 0x57F287,  // Green   — enabled/saved
  WARNING: 0xFEE75C,  // Yellow  — warning/confirm
  ERROR:   0xED4245,  // Red     — disabled/danger
  NEUTRAL: 0x4F545C,  // Gray    — info
  DARK:    0x2B2D31,  // Dark    — sub-pages
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
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a set of UI builder functions wired to the given prefix.
 *
 * @param {string} prefix  e.g. 'setup1' or 'setup2'
 * @returns {UIBuilders}
 */
export function createUIBuilders(prefix) {
  // ---------------------------------------------------------------------------
  // Custom ID helpers
  // ---------------------------------------------------------------------------

  /** @param {string} ctx @param {string} action */
  function cid(ctx, action) { return `${prefix}:${ctx}:${action}`; }

  // ---------------------------------------------------------------------------
  // Main Wizard Page
  // ---------------------------------------------------------------------------

  function buildMainEmbed(plugins, guildConfig, guildName) {
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: `⚙️  ${guildName} — Setup Wizard` })
      .setDescription(
        `Selamat datang di **Setup Wizard**.\nPilih fitur yang ingin dikonfigurasi.\n${DIVIDER}`
      )
      .setTimestamp()
      .setFooter({ text: `${guildName} • Setup Wizard` });

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

  function buildMainSelectRow(plugins) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(cid('nav', 'select'))
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

  function buildMainButtonRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(cid('nav', 'home'))
        .setLabel('Home')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'refresh'))
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('main', 'save_ack'))
        .setLabel('Save')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(cid('main', 'reset'))
        .setLabel('Reset')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Danger),
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation Row (sub-pages)
  // ---------------------------------------------------------------------------

  function buildNavRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(cid('nav', 'back'))
        .setLabel('Back')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'home'))
        .setLabel('Home')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'refresh'))
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'save'))
        .setLabel('Save')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'cancel'))
        .setLabel('Cancel')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger),
    );
  }

  // ---------------------------------------------------------------------------
  // Channel / Role Selection Pages
  // ---------------------------------------------------------------------------

  function buildChannelSelectPage(title, description, customId, backId) {
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
      new ButtonBuilder()
        .setCustomId(backId)
        .setLabel('Back')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'cancel'))
        .setLabel('Cancel')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger),
    );

    return {
      embed,
      components: [new ActionRowBuilder().addComponents(channelMenu), navRow],
    };
  }

  function buildRoleSelectPage(title, description, customId, backId, maxValues = 1) {
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
      new ButtonBuilder()
        .setCustomId(backId)
        .setLabel('Back')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'cancel'))
        .setLabel('Cancel')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger),
    );

    return {
      embed,
      components: [new ActionRowBuilder().addComponents(roleMenu), navRow],
    };
  }

  // ---------------------------------------------------------------------------
  // Channel Selection Preview
  // ---------------------------------------------------------------------------

  function buildChannelPreviewPage(
    title,
    description,
    channelId,
    confirmId,
    retryId,
    cancelId,
  ) {
    const effectiveCancelId = cancelId ?? cid('nav', 'cancel');

    const embed = new EmbedBuilder()
      .setColor(Colors.WARNING)
      .setTitle(title)
      .setDescription(
        `**Channel dipilih:** <#${channelId}>\n\n${DIVIDER}\n` +
        `${description}\n\n` +
        `Klik **Simpan** untuk konfirmasi, atau **Pilih Ulang** untuk ganti channel.`,
      )
      .setFooter({ text: 'Konfigurasi belum disimpan — tekan Simpan untuk mengonfirmasi.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel('Simpan')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(retryId)
        .setLabel('Pilih Ulang')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(effectiveCancelId)
        .setLabel('Batal')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Danger),
    );

    return { embed, components: [row] };
  }

  // ---------------------------------------------------------------------------
  // Feedback / Confirmation
  // ---------------------------------------------------------------------------

  function buildSaveConfirmation(message = 'Konfigurasi berhasil disimpan.') {
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setDescription(`✅  **${message}**\n\nTekan **Home** untuk kembali ke menu utama.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(cid('nav', 'home'))
        .setLabel('Home')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Build a reset-confirm prompt (shown before actually resetting).
   */
  function buildResetConfirmRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(cid('main', 'reset_confirm'))
        .setLabel('Ya, Reset Semua')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cid('nav', 'home'))
        .setLabel('Batal')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // ---------------------------------------------------------------------------
  // Return all builders
  // ---------------------------------------------------------------------------

  return {
    buildMainEmbed,
    buildMainSelectRow,
    buildMainButtonRow,
    buildNavRow,
    buildChannelSelectPage,
    buildRoleSelectPage,
    buildChannelPreviewPage,
    buildSaveConfirmation,
    buildResetConfirmRow,
    /** Helper: build a custom ID string for this prefix */
    cid,
  };
}
