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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOOTER_TEXT    = '🩸 Kenyut';
export const SELECT_ID            = 'bawok_module_select';
export const BUTTON_BACK_ID       = 'bawok_back_home';
export const BUTTON_CLOSE_ID      = 'bawok_close_panel';
export const BUTTON_BOOMBOX_URL   = 'boombox_enter_url';
export const MODAL_BOOMBOX_ID     = 'boombox_url_modal';
export const MODAL_BOOMBOX_INPUT  = 'boombox_url_input';

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLORS = Object.freeze({
  HOME:           0xDC143C,
  AI_CORE:        0x9B59B6,
  BOOMBOX:        0x3498DB,
  SCAN_KEYLOGGER: 0x2ECC71,
  OBFUSCATOR:     0xE67E22,
  DEOBFUSCATOR:   0x4A4A4A,
});

// ─── Module Definitions ───────────────────────────────────────────────────────

const MODULES = [
  { value: 'ai_core',        label: 'AI Core',       subtitle: 'Artificial Intelligence Workspace', emoji: '🧠', color: COLORS.AI_CORE },
  { value: 'boombox',        label: 'Boombox',        subtitle: 'Media Download Center',            emoji: '🎵', color: COLORS.BOOMBOX },
  { value: 'scan_keylogger', label: 'Scan Keylogger', subtitle: 'Security Scanner',                 emoji: '🛡️', color: COLORS.SCAN_KEYLOGGER },
  { value: 'obfuscator',     label: 'Obfuscator',     subtitle: 'Code Protection',                  emoji: '🔒', color: COLORS.OBFUSCATOR },
  { value: 'deobfuscator',   label: 'Deobfuscator',   subtitle: 'Code Analyzer',                    emoji: '📖', color: COLORS.DEOBFUSCATOR },
];

// ─── Embed Builders ───────────────────────────────────────────────────────────

function buildHomeEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.HOME)
    .setDescription('**Selamat datang di Bawok.**\nPilih modul melalui menu di bawah.')
    .setFooter({ text: FOOTER_TEXT });
}

function buildModuleEmbed(mod) {
  return new EmbedBuilder()
    .setColor(mod.color)
    .setTitle(`${mod.emoji} ${mod.label}`)
    .setDescription(`${mod.subtitle}\n\n🟡 **Development**\nModul ini masih dalam pengembangan.`)
    .setFooter({ text: FOOTER_TEXT });
}

function buildClosedEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.HOME)
    .setDescription('🔒 **Panel Closed**\n\nGunakan `/bawok` untuk membuka kembali.')
    .setFooter({ text: FOOTER_TEXT });
}

// ─── Component Builders ───────────────────────────────────────────────────────

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

function buildNavRow(includeBack = false) {
  const row = new ActionRowBuilder();
  if (includeBack) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_BACK_ID)
        .setLabel('Back Home')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_CLOSE_ID)
      .setLabel('Close Panel')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

// ─── Payload Helpers ──────────────────────────────────────────────────────────

function homePayload() {
  return {
    embeds:     [buildHomeEmbed()],
    components: [buildSelectRow(), buildNavRow(false)],
    files:      [],
  };
}

import { buildBoomboxMainDashboard } from '../boombox/setup/panel.js';

function modulePayload(moduleValue) {
  const mod = MODULES.find((m) => m.value === moduleValue);
  if (!mod) return homePayload();
  // Boombox gets its own panel with a URL input button
  if (mod.value === 'boombox') return buildBoomboxMainDashboard();
  return {
    embeds:     [buildModuleEmbed(mod)],
    components: [buildNavRow(true)],
    files:      [],
  };
}

function boomboxModulePayload(mod = MODULES.find((m) => m.value === 'boombox')) {
  const embed = new EmbedBuilder()
    .setColor(mod.color)
    .setTitle(`${mod.emoji} ${mod.label}`)
    .setDescription(
      `${mod.subtitle}\n\n` +
      `Kirim link **YouTube**, **TikTok**, atau **Spotify** untuk mendapatkan URL audio SA:MP Boombox.\n\n` +
      `> Tekan **🔗 Masukkan Link** lalu tempel URL-mu.`
    )
    .setFooter({ text: FOOTER_TEXT });

  const urlBtn = new ButtonBuilder()
    .setCustomId(BUTTON_BOOMBOX_URL)
    .setLabel('Masukkan Link')
    .setEmoji('🔗')
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder().addComponents(urlBtn);

  return {
    embeds:     [embed],
    components: [actionRow, buildNavRow(true)],
    files:      [],
  };
}

/**
 * Build the Boombox URL input modal.
 * @returns {ModalBuilder}
 */
function buildBoomboxModal() {
  const input = new TextInputBuilder()
    .setCustomId(MODAL_BOOMBOX_INPUT)
    .setLabel('YouTube / TikTok / Spotify URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://youtu.be/...')
    .setRequired(true)
    .setMaxLength(512);

  return new ModalBuilder()
    .setCustomId(MODAL_BOOMBOX_ID)
    .setTitle('🎵 Boombox — Masukkan Link')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function closedPayload() {
  return {
    embeds:     [buildClosedEmbed()],
    components: [],
    files:      [],
  };
}

export { homePayload, modulePayload, closedPayload, buildBoomboxModal };
