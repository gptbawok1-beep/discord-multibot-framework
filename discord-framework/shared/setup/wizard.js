/**
 * Shared Setup Engine — Wizard Factory
 *
 * createWizard({ prefix, botName, configManager, uiBuilders, getPlugin, getPlugins, logger })
 *
 * Returns { openWizard, handleInteraction, getSession }.
 *
 * Custom ID contract:   {prefix}:{context}:{action}
 *   context = 'nav'     — global navigation (back, home, refresh, save, cancel)
 *   context = 'main'    — main page actions (reset, reset_confirm, save_ack)
 *   context = pluginId  — routed to that plugin's handleInteraction()
 *
 * Modal IDs:  {prefix}:modal:{pluginId}:{field}
 */

import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { memberHasPermissions, buildPermissionDeniedEmbed } from './validation.js';
import { Colors, DIVIDER } from './ui.js';

// ---------------------------------------------------------------------------
// Permission name lookup (sync, built from PermissionFlagsBits)
// ---------------------------------------------------------------------------

const PERM_NAME_MAP = Object.fromEntries(
  Object.entries(PermissionFlagsBits).map(([k, v]) => [String(v), k])
);

function getPermName(flagValue) {
  return PERM_NAME_MAP[String(flagValue)] ?? String(flagValue);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

class WizardSession {
  constructor(userId, guildId) {
    this.userId  = userId;
    this.guildId = guildId;
    /** Current plugin ID, or 'main' */
    this.page       = 'main';
    /** Temporary data used during multi-step flows */
    this.wizardData = {};
    this._touched   = Date.now();
  }

  touch()     { this._touched = Date.now(); }
  isExpired() { return Date.now() - this._touched > SESSION_TTL_MS; }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * @param {object}   options
 * @param {string}   options.prefix          - e.g. 'setup1'
 * @param {string}   options.botName         - e.g. 'BOT 1' (shown in UI)
 * @param {object}   options.configManager   - from createConfigManager()
 * @param {object}   options.uiBuilders      - from createUIBuilders()
 * @param {Function} options.getPlugin       - (id: string) => Plugin | undefined
 * @param {Function} options.getPlugins      - () => Plugin[]
 * @param {object}   [options.logger]        - optional logger
 */
export function createWizard({
  prefix,
  botName,
  configManager,
  uiBuilders,
  getPlugin,
  getPlugins,
  logger = console,
}) {
  const { loadGuildConfig, resetGuildConfig } = configManager;

  const {
    buildMainEmbed,
    buildMainSelectRow,
    buildMainButtonRow,
    buildNavRow,
    buildSaveConfirmation,
    buildResetConfirmRow,
  } = uiBuilders;

  // ── Session store ────────────────────────────────────────────────────────

  /** @type {Map<string, WizardSession>} */
  const sessions = new Map();

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

  // ── Page builders ─────────────────────────────────────────────────────────

  function buildMainPage(guildConfig, guild) {
    const plugins = getPlugins();
    const embed   = buildMainEmbed(plugins, guildConfig, guild?.name ?? 'Server');
    return {
      embeds:     [embed],
      components: [buildMainSelectRow(plugins), buildMainButtonRow()],
    };
  }

  // ── Navigation handlers ───────────────────────────────────────────────────

  async function handleNav(interaction, session, action) {
    const guildConfig = await loadGuildConfig(session.guildId);

    switch (action) {
      case 'select': {
        const pluginId = interaction.values[0];
        const plugin   = getPlugin(pluginId);
        if (!plugin) return;

        // Per-plugin permission check
        if (plugin.requiredPermission) {
          const member = interaction.member;
          if (member && !memberHasPermissions(member, [plugin.requiredPermission])) {
            const permName = getPermName(plugin.requiredPermission);
            const embed    = buildPermissionDeniedEmbed(plugin.label, permName);
            return interaction.update({ embeds: [embed], components: [buildNavRow()] });
          }
        }

        session.page       = pluginId;
        session.wizardData = {};
        const page = await plugin.buildPage(guildConfig, session);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }

      case 'home':
      case 'back': {
        session.page       = 'main';
        session.wizardData = {};
        return interaction.update(buildMainPage(guildConfig, interaction.guild));
      }

      case 'refresh': {
        const fresh = await loadGuildConfig(session.guildId);
        if (session.page === 'main') {
          return interaction.update(buildMainPage(fresh, interaction.guild));
        }
        const plugin = getPlugin(session.page);
        if (plugin) {
          const page = await plugin.buildPage(fresh, session);
          return interaction.update({ embeds: [page.embed], components: page.components });
        }
        break;
      }

      case 'save': {
        return interaction.update(buildSaveConfirmation());
      }

      case 'cancel': {
        return interaction.update({
          content:    '❌  Setup dibatalkan.',
          embeds:     [],
          components: [],
        });
      }
    }
  }

  // ── Main page handlers ────────────────────────────────────────────────────

  async function handleMain(interaction, session, action) {
    switch (action) {
      case 'reset': {
        // Show a confirmation prompt before resetting
        const embed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle('⚠️  Reset Semua Konfigurasi?')
          .setDescription(
            `Semua konfigurasi untuk server ini akan direset ke default.\n${DIVIDER}\n` +
            `**Backup otomatis akan dibuat sebelum reset.**\n` +
            `Backup dapat di-Restore kapan saja melalui menu Backup.`
          );
        return interaction.update({ embeds: [embed], components: [buildResetConfirmRow()] });
      }

      case 'reset_confirm': {
        const { config: freshConfig, backupId } = await resetGuildConfig(session.guildId);
        session.page = 'main';
        const page   = buildMainPage(freshConfig, interaction.guild);
        const notice = backupId
          ? `⚠️  **Semua konfigurasi telah direset.** Backup tersimpan (ID: \`${backupId}\`).\n\n`
          : '⚠️  **Semua konfigurasi telah direset.**\n\n';
        page.embeds[0].setDescription(notice + (page.embeds[0].data.description ?? ''));
        return interaction.update(page);
      }

      case 'save_ack': {
        return interaction.update(buildSaveConfirmation('Semua konfigurasi telah disimpan.'));
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open the Setup Wizard in response to a slash command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async function openWizard(interaction) {
    const session      = getSession(interaction.user.id, interaction.guildId);
    session.page       = 'main';
    session.wizardData = {};

    const guildConfig = await loadGuildConfig(interaction.guildId);
    const page        = buildMainPage(guildConfig, interaction.guild);

    await interaction.reply({ ...page, ephemeral: true });
  }

  /**
   * Route a component or modal interaction to the correct handler.
   * Returns true if the interaction was handled.
   *
   * @param {import('discord.js').Interaction} interaction
   * @returns {Promise<boolean>}
   */
  async function handleInteraction(interaction) {
    const customId = interaction.customId ?? '';
    if (!customId.startsWith(`${prefix}:`)) return false;

    // Parse: {prefix}:{context}:{action}
    const parts   = customId.split(':');
    const context = parts[1];
    const action  = parts.slice(2).join(':'); // allow colons in action

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

    // Modal submit routing: {prefix}:modal:{pluginId}:{field}
    if (context === 'modal') {
      const pluginId = parts[2];
      const field    = parts.slice(3).join(':');
      const plugin   = getPlugin(pluginId);
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

    logger.warn?.(`[Wizard:${prefix}] Unhandled interaction: ${customId}`);
    return false;
  }

  return { openWizard, handleInteraction, getSession };
}
