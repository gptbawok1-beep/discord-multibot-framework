/**
 * Shared Setup Engine — Main Factory
 *
 * createSetupEngine(options) → { openWizard, handleInteraction, recoverOnStartup, configManager }
 *
 * This is the single entry point for creating a Setup Wizard for any bot.
 * Both BOT 1 and BOT 2 (and any future bots) use this factory with
 * their own options to get a fully isolated wizard engine.
 *
 * Usage:
 *   import { createSetupEngine } from '../../shared/setup/index.js';
 *
 *   const engine = createSetupEngine({
 *     prefix:          'setup1',          // unique prefix for custom IDs
 *     botName:         'BOT 1',           // shown in wizard UI
 *     dataDir:         '/path/to/data',   // where guild configs are stored
 *     makeDefaultConfig: () => ({ ... }), // returns a fresh default config
 *     configVersion:   1,                 // current schema version
 *     getPlugin:       (id) => ...,       // from your bot's plugin loader
 *     getPlugins:      () => [...],       // full plugin list
 *     logger,                             // shared logger instance
 *   });
 *
 *   // Use in slash command:
 *   await engine.openWizard(interaction);
 *
 *   // Use in interactionCreate event:
 *   const handled = await engine.handleInteraction(interaction);
 *
 *   // Use in ready event:
 *   await engine.recoverOnStartup(client);
 */

import { createConfigManager } from './config.js';
import { createUIBuilders } from './ui.js';
import { createWizard } from './wizard.js';
import { createRecovery } from './recovery.js';

/**
 * @param {object}   options
 * @param {string}   options.prefix            - Custom ID prefix (e.g. 'setup1')
 * @param {string}   options.botName           - Bot display name (e.g. 'BOT 1')
 * @param {string}   options.dataDir           - Absolute path to guild data directory
 * @param {Function} options.makeDefaultConfig - () => object — fresh default guild config
 * @param {number}   [options.configVersion=1] - Current schema version for migration
 * @param {Function} options.getPlugin         - (id: string) => Plugin | undefined
 * @param {Function} options.getPlugins        - () => Plugin[]
 * @param {object}   [options.logger]          - Logger with .info()/.warn()/.error()
 */
export function createSetupEngine({
  prefix,
  botName,
  dataDir,
  makeDefaultConfig,
  configVersion = 1,
  getPlugin,
  getPlugins,
  logger = console,
}) {
  // ── Config Manager ────────────────────────────────────────────────────────
  const configManager = createConfigManager({
    dataDir,
    makeDefault: makeDefaultConfig,
    configVersion,
  });

  // ── UI Builders (prefix-aware) ────────────────────────────────────────────
  const uiBuilders = createUIBuilders(prefix);

  // ── Wizard (session + routing) ────────────────────────────────────────────
  const wizard = createWizard({
    prefix,
    botName,
    configManager,
    uiBuilders,
    getPlugin,
    getPlugins,
    logger,
  });

  // ── Recovery Manager ──────────────────────────────────────────────────────
  const recovery = createRecovery({
    configManager,
    getPlugins,
    logger,
  });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    /** Open the wizard in response to a slash command */
    openWizard: wizard.openWizard,

    /** Route a component/modal interaction — returns true if handled */
    handleInteraction: wizard.handleInteraction,

    /** Run full startup recovery for all guilds on bot ready */
    recoverOnStartup: (client) => recovery.recoverAll(client),

    /** Config manager — available for advanced use (e.g. plugins querying config) */
    configManager,

    /** UI builders — available for advanced use */
    uiBuilders,
  };
}
