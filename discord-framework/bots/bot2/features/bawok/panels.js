/**
 * Bot 2 — Bawok Panel Builder
 *
 * Builds embeds and components for the /bawok command UI.
 * All navigation uses edit-in-place (no new messages).
 *
 * Banner is fetched once at startup and attached as a local file so Discord
 * never has to proxy the external URL (avoids hotlink/CDN failures).
 * Banner is shown only on the Home panel.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNER_URL     = 'https://litter.catbox.moe/nv0463jzrv68x321.png';
const BANNER_NAME    = 'banner.png';
const BANNER_REF     = `attachment://${BANNER_NAME}`;

const FOOTER_TEXT    = '🩸 Kenyut';
export const SELECT_ID       = 'bawok_module_select';
export const BUTTON_BACK_ID  = 'bawok_back_home';
export const BUTTON_CLOSE_ID = 'bawok_close_panel';

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLORS = Object.freeze({
  HOME:            0xDC143C, // Crimson
  AI_CORE:         0x9B59B6, // Ungu
  BOOMBOX:         0x3498DB, // Biru
  SCAN_KEYLOGGER:  0x2ECC71, // Hijau
  OBFUSCATOR:      0xE67E22, // Orange
  DEOBFUSCATOR:    0x4A4A4A, // Abu gelap
});

// ─── Module Definitions ───────────────────────────────────────────────────────

const MODULES = [
  {
    value:    'ai_core',
    label:    'AI Core',
    subtitle: 'Artificial Intelligence Workspace',
    emoji:    '🧠',
    color:    COLORS.AI_CORE,
  },
  {
    value:    'boombox',
    label:    'Boombox',
    subtitle: 'Media Download Center',
    emoji:    '🎵',
    color:    COLORS.BOOMBOX,
  },
  {
    value:    'scan_keylogger',
    label:    'Scan Keylogger',
    subtitle: 'Security Scanner',
    emoji:    '🛡️',
    color:    COLORS.SCAN_KEYLOGGER,
  },
  {
    value:    'obfuscator',
    label:    'Obfuscator',
    subtitle: 'Code Protection',
    emoji:    '🔒',
    color:    COLORS.OBFUSCATOR,
  },
  {
    value:    'deobfuscator',
    label:    'Deobfuscator',
    subtitle: 'Code Analyzer',
    emoji:    '📖',
    color:    COLORS.DEOBFUSCATOR,
  },
];

// ─── Banner Cache ─────────────────────────────────────────────────────────────

/** @type {Buffer|null} */
let _bannerBuffer = null;

/**
 * Fetch and cache the banner image as a Buffer.
 * Falls back to null on error — embed still sends, just without image.
 * @returns {Promise<Buffer|null>}
 */
async function fetchBanner() {
  if (_bannerBuffer) return _bannerBuffer;
  try {
    const res = await fetch(BANNER_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _bannerBuffer = Buffer.from(await res.arrayBuffer());
    return _bannerBuffer;
  } catch (err) {
    console.error(`[Bawok] Banner fetch failed: ${err.message}`);
    return null;
  }
}

// ─── Embed Builders ───────────────────────────────────────────────────────────

function buildHomeEmbed(hasBanner) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.HOME)
    .setDescription('**Selamat datang di Bawok.**\nPilih modul melalui menu di bawah.')
    .setFooter({ text: FOOTER_TEXT });
  if (hasBanner) embed.setImage(BANNER_REF);
  return embed;
}

function buildModuleEmbed(mod) {
  return new EmbedBuilder()
    .setColor(mod.color)
    .setTitle(`${mod.emoji} ${mod.label}`)
    .setDescription(
      `${mod.subtitle}\n\n🟡 **Development**\nModul ini masih dalam pengembangan.`
    )
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

/**
 * Home panel payload.
 * @returns {Promise<{ embeds, components, files }>}
 */
async function homePayload() {
  const buffer = await fetchBanner();
  const files  = buffer ? [new AttachmentBuilder(buffer, { name: BANNER_NAME })] : [];
  return {
    embeds:     [buildHomeEmbed(!!buffer)],
    components: [buildSelectRow(), buildNavRow(false)],
    files,
  };
}

/**
 * Module placeholder payload.
 * @param {string} moduleValue
 * @returns {Promise<{ embeds, components, files }>}
 */
async function modulePayload(moduleValue) {
  const mod = MODULES.find((m) => m.value === moduleValue);
  if (!mod) return homePayload();
  return {
    embeds:     [buildModuleEmbed(mod)],
    components: [buildNavRow(true)],
    files:      [],
  };
}

/**
 * Closed panel payload — no components, no files.
 * @returns {{ embeds, components, files }}
 */
function closedPayload() {
  return {
    embeds:     [buildClosedEmbed()],
    components: [],
    files:      [],
  };
}

export { homePayload, modulePayload, closedPayload };
