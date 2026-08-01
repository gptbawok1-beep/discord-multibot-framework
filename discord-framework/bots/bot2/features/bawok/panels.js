/**
 * Bot 2 — Bawok Panel Builder
 *
 * Builds embeds and components for the /bawok command UI.
 * All navigation uses edit-in-place (no new messages).
 *
 * Banner is fetched once at startup and attached as a local file so Discord
 * never has to proxy the external URL (avoids hotlink/CDN failures).
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

const BANNER_URL  = 'https://litter.catbox.moe/nv0463jzrv68x321.png';
const BANNER_NAME = 'banner.png';
const BANNER_REF  = `attachment://${BANNER_NAME}`;

const COLOR_PANEL  = 0x111111;
const FOOTER_TEXT  = '🩸 Kenyut';
const SELECT_ID    = 'bawok_module_select';
const BUTTON_BACK_ID = 'bawok_back_home';

const MODULES = [
  { value: 'ai_core',        label: 'AI Core',         emoji: '🧠' },
  { value: 'boombox',        label: 'Boombox',          emoji: '🎵' },
  { value: 'scan_keylogger', label: 'Scan Keylogger',   emoji: '🛡️' },
  { value: 'obfuscator',     label: 'Obfuscator',       emoji: '🔒' },
  { value: 'deobfuscator',   label: 'Deobfuscator',     emoji: '📖' },
];

// ─── Banner Cache ─────────────────────────────────────────────────────────────

/** @type {Buffer|null} */
let _bannerBuffer = null;

/**
 * Fetch and cache the banner image as a Buffer.
 * Falls back to null on network error so the embed still sends without image.
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
    console.error(`[Bawok] Failed to fetch banner: ${err.message}`);
    return null;
  }
}

// ─── Embed Builders ───────────────────────────────────────────────────────────

function buildHomeEmbed(hasBanner) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setDescription('**Selamat datang di Bawok.**\nPilih modul melalui menu di bawah.')
    .setFooter({ text: FOOTER_TEXT });
  if (hasBanner) embed.setImage(BANNER_REF);
  return embed;
}

function buildModuleEmbed(label, emoji, hasBanner) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setDescription(`**${emoji} ${label}**\n\n🟡 **Development**\nModul ini masih dalam pengembangan.`)
    .setFooter({ text: FOOTER_TEXT });
  if (hasBanner) embed.setImage(BANNER_REF);
  return embed;
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
 * @returns {Promise<{ embeds, components, files }>}
 */
async function homePayload() {
  const buffer = await fetchBanner();
  const files  = buffer ? [new AttachmentBuilder(buffer, { name: BANNER_NAME })] : [];
  return {
    embeds:     [buildHomeEmbed(!!buffer)],
    components: [buildSelectRow()],
    files,
  };
}

/**
 * Complete message payload for a module's placeholder panel.
 * @param {string} moduleValue
 * @returns {Promise<{ embeds, components, files }>}
 */
async function modulePayload(moduleValue) {
  const mod    = MODULES.find((m) => m.value === moduleValue);
  const label  = mod?.label ?? 'Unknown';
  const emoji  = mod?.emoji ?? '❓';
  const buffer = await fetchBanner();
  const files  = buffer ? [new AttachmentBuilder(buffer, { name: BANNER_NAME })] : [];
  return {
    embeds:     [buildModuleEmbed(label, emoji, !!buffer)],
    components: [buildBackRow()],
    files,
  };
}

export { SELECT_ID, BUTTON_BACK_ID, homePayload, modulePayload };
