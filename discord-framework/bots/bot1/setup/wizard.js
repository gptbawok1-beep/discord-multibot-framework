/**
 * Bot 1 — Setup Wizard Engine
 *
 * Manages per-user wizard sessions and routes all setup interactions
 * to the correct page or plugin handler.
 *
 * Custom ID contract:  setup1:{context}:{action}
 *   context = 'nav'   — global navigation (back, home, refresh, save, cancel)
 *   context = 'main'  — main page actions (reset, save_ack)
 *   context = pluginId — routed to that plugin's handleInteraction()
 *
 * Modal IDs:  setup1:modal:{pluginId}:{field}
 */

import { loadGuildConfig, saveGuildConfig, resetGuildConfig } from './config.js';
import {
  buildMainEmbed,
  buildMainSelectRow,
  buildMainButtonRow,
  buildSaveConfirmation,
} from './ui.js';
import { PLUGINS, getPlugin } from './plugins/index.js';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

class WizardSession {
  /**
   * @param {string} userId
   * @param {string} guildId
   */
  constructor(userId, guildId) {
    this.userId = userId;
    this.guildId = guildId;
    /** Current plugin ID, or 'main' */
    this.page = 'main';
    /** Temporary data used during multi-step flows (e.g. Take Role wizard) */
    this.wizardData = {};
    this._touched = Date.now();
  }

  touch() { this._touched = Date.now(); }
  isExpired() { return Date.now() - this._touched > SESSION_TTL_MS; }
}

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

/** @type {Map<string, WizardSession>} */
const sessions = new Map();

/**
 * Get or create a session for a user in a guild.
 * @param {string} userId
 * @param {string} guildId
 * @returns {WizardSession}
 */
function getSession(userId, guildId) {
  const key = `${userId}:${guildId}`;
  let session = sessions.get(key);
  if (!session || session.isExpired()) {
    session = new WizardSession(userId, guildId);
    sessions.set(key, session);
  }
  session.touch();
  return session;
}

// Prune expired sessions every 15 minutes to prevent memory leaks
setInterval(() => {
  for (const [key, session] of sessions) {
    if (session.isExpired()) sessions.delete(key);
  }
}, 15 * 60 * 1000);

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------

/**
 * Build the main wizard page payload.
 * @param {object} guildConfig
 * @param {import('discord.js').Guild} guild
 * @returns {{ embeds, components }}
 */
function buildMainPage(guildConfig, guild) {
  const embed = buildMainEmbed(PLUGINS, guildConfig, guild?.name ?? 'Server');
  return {
    embeds: [embed],
    components: [buildMainSelectRow(PLUGINS), buildMainButtonRow()],
  };
}

// ---------------------------------------------------------------------------
// Navigation handlers
// ---------------------------------------------------------------------------

/**
 * Handle global navigation actions (context = 'nav').
 */
async function handleNav(interaction, session, action) {
  const guildConfig = await loadGuildConfig(session.guildId);

  switch (action) {
    case 'select': {
      // Dropdown: navigate to selected plugin page
      const pluginId = interaction.values[0];
      const plugin = getPlugin(pluginId);
      if (!plugin) return;
      session.page = pluginId;
      session.wizardData = {};
      const page = await plugin.buildPage(guildConfig, session);
      await interaction.update({ embeds: [page.embed], components: page.components });
      break;
    }

    case 'home':
    case 'back': {
      session.page = 'main';
      session.wizardData = {};
      const page = buildMainPage(guildConfig, interaction.guild);
      await interaction.update(page);
      break;
    }

    case 'refresh': {
      const freshConfig = await loadGuildConfig(session.guildId);
      if (session.page === 'main') {
        await interaction.update(buildMainPage(freshConfig, interaction.guild));
      } else {
        const plugin = getPlugin(session.page);
        if (plugin) {
          const page = await plugin.buildPage(freshConfig, session);
          await interaction.update({ embeds: [page.embed], components: page.components });
        }
      }
      break;
    }

    case 'save': {
      // Generic save: show confirmation, then re-render current plugin page
      const plugin = getPlugin(session.page);
      if (plugin) {
        const confirm = buildSaveConfirmation();
        await interaction.update(confirm);
      }
      break;
    }

    case 'cancel': {
      await interaction.update({
        content: '❌  Setup dibatalkan.',
        embeds: [],
        components: [],
      });
      break;
    }
  }
}

/**
 * Handle main page actions (context = 'main').
 */
async function handleMain(interaction, session, action) {
  switch (action) {
    case 'reset': {
      const freshConfig = await resetGuildConfig(session.guildId);
      session.page = 'main';
      const page = buildMainPage(freshConfig, interaction.guild);
      // Prepend a notice to the embed description
      page.embeds[0].setDescription(
        `⚠️  **Semua konfigurasi telah direset.**\n\n` +
        page.embeds[0].data.description
      );
      await interaction.update(page);
      break;
    }
    case 'save_ack': {
      // "Save" on main page just shows a confirmation
      await interaction.update(buildSaveConfirmation('Semua konfigurasi telah disimpan.'));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open the Setup Wizard in response to /setup bot1.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function openWizard(interaction) {
  const session = getSession(interaction.user.id, interaction.guildId);
  session.page = 'main';
  session.wizardData = {};

  const guildConfig = await loadGuildConfig(interaction.guildId);
  const page = buildMainPage(guildConfig, interaction.guild);

  await interaction.reply({ ...page, ephemeral: true });
}

/**
 * Route an incoming component or modal interaction to the correct handler.
 * Returns true if the interaction was handled, false if it should be ignored.
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>}
 */
async function handleInteraction(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('setup1:')) return false;

  // Parse:  setup1:{context}:{action}
  const parts = customId.split(':');
  // parts[0] = 'setup1', parts[1] = context, parts[2] = action, parts[3+] = extra
  const context = parts[1];
  const action = parts.slice(2).join(':'); // support colons in action for modal IDs

  const session = getSession(interaction.user.id, interaction.guildId);

  // Global navigation
  if (context === 'nav') {
    await handleNav(interaction, session, action);
    return true;
  }

  // Main page actions
  if (context === 'main') {
    await handleMain(interaction, session, action);
    return true;
  }

  // Modal submit with plugin routing: setup1:modal:{pluginId}:{field}
  if (context === 'modal') {
    const pluginId = parts[2];
    const field = parts.slice(3).join(':');
    const plugin = getPlugin(pluginId);
    if (plugin?.handleModal) {
      const guildConfig = await loadGuildConfig(session.guildId);
      await plugin.handleModal(interaction, session, guildConfig, field);
      return true;
    }
    return false;
  }

  // Plugin-specific interaction
  const plugin = getPlugin(context);
  if (plugin?.handleInteraction) {
    const guildConfig = await loadGuildConfig(session.guildId);
    await plugin.handleInteraction(interaction, session, guildConfig, action);
    return true;
  }

  return false;
}

export { openWizard, handleInteraction, getSession };
