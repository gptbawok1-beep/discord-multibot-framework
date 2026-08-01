/**
 * Bot 2 — Bawok Panel Builder
 *
 * Builds embeds and components for the /bawok command UI.
 * All navigation uses edit-in-place (no new messages).
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNER_URL = 'https://litter.catbox.moe/nv0463jzrv68x321.png';
const COLOR_PANEL = 0x111111;
const FOOTER_TEXT = '🩸 Kenyut';
const SELECT_ID = 'bawok_module_select';
const BUTTON_BACK_ID = 'bawok_back_home';

const MODULES = [
  { value: 'ai_core',      label: 'AI Core',         emoji: '🧠' },
  { value: 'boombox',      label: 'Boombox',          emoji: '🎵' },
  { value: 'scan_keylogger', label: 'Scan Keylogger', emoji: '🛡️' },
  { value: 'obfuscator',   label: 'Obfuscator',       emoji: '🔒' },
  { value: 'deobfuscator', label: 'Deobfuscator',     emoji: '📖' },
];

// ─── Embed Builders ───────────────────────────────────────────────────────────

/**
 * Build the home panel embed.
 * @returns {EmbedBuilder}
 */
function buildHomeEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setImage(BANNER_URL)
    .setDescription('**Selamat datang di Bawok.**\nPilih modul melalui menu di bawah.')
    .setFooter({ text: FOOTER_TEXT });
}

/**
 * Build the "in development" placeholder embed for a selected module.
 * @param {string} label  - Display name of the module
 * @param {string} emoji  - Emoji for the module
 * @returns {EmbedBuilder}
 */
function buildModuleEmbed(label, emoji) {
  return new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setImage(BANNER_URL)
    .setDescription(`**${emoji} ${label}**\n\n🟡 **Development**\nModul ini masih dalam pengembangan.`)
    .setFooter({ text: FOOTER_TEXT });
}

// ─── Component Builders ───────────────────────────────────────────────────────

/**
 * Build the module select menu row (shown on home panel).
 * @returns {ActionRowBuilder}
 */
function buildSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('Pilih modul...')
    .addOptions(
      MODULES.map(({ value, label, emoji }) =>
        new StringSelectMenuOptionBuilder()
          .setValue(value)
          .setLabel(label)
          .setEmoji(emoji)
      )
    );

  return new ActionRowBuilder().addComponents(select);
}

/**
 * Build the Back Home button row (shown on module panels).
 * @returns {ActionRowBuilder}
 */
function buildBackRow() {
  const btn = new ButtonBuilder()
    .setCustomId(BUTTON_BACK_ID)
    .setLabel('Back Home')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(btn);
}

// ─── Payload Helpers ──────────────────────────────────────────────────────────

/**
 * Complete message payload for the home panel.
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function homePayload() {
  return {
    embeds: [buildHomeEmbed()],
    components: [buildSelectRow()],
  };
}

/**
 * Complete message payload for a module's placeholder panel.
 * @param {string} moduleValue - The select menu value
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function modulePayload(moduleValue) {
  const mod = MODULES.find((m) => m.value === moduleValue);
  const label = mod?.label ?? 'Unknown';
  const emoji = mod?.emoji ?? '❓';

  return {
    embeds: [buildModuleEmbed(label, emoji)],
    components: [buildBackRow()],
  };
}

export { SELECT_ID, BUTTON_BACK_ID, homePayload, modulePayload };
