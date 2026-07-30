/**
 * Bot 1 — Setup Engine Instance
 *
 * Assembles the full Setup Engine for BOT 1 using the Shared Engine factory.
 * This is the single import point for all setup-related functionality:
 *
 *   import { openWizard, handleInteraction, recoverOnStartup } from './setup/index.js';
 *
 * BOT 2 will create its own instance in bots/bot2/setup/index.js using the
 * same shared factory — no code duplication needed.
 */

import { createSetupEngine } from '../../../shared/setup/engine.js';
import { configManager, defaultConfig } from './config.js';
import * as uiModule from './ui.js';
import { createLogger } from '../../../shared/logger/index.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger    = createLogger('BOT1');

// ---------------------------------------------------------------------------
// Auto-load plugins
// ---------------------------------------------------------------------------
// Plugins are loaded dynamically from bots/bot1/setup/plugins/ so that
// new plugin files are picked up automatically without editing this file.

const { PLUGINS, getPlugin } = await import('./plugins/index.js');

// ---------------------------------------------------------------------------
// Create the engine
// ---------------------------------------------------------------------------

const engine = createSetupEngine({
  prefix:            'setup1',
  botName:           'BOT 1',
  dataDir:           join(__dirname, '..', 'data', 'guilds'),
  makeDefaultConfig: defaultConfig,
  configVersion:     1,
  getPlugin:         (id) => getPlugin(id),
  getPlugins:        () => PLUGINS,
  logger,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Open the setup wizard in response to /setup bot1 */
export const openWizard = engine.openWizard;

/** Route a setup1:* component or modal interaction */
export const handleInteraction = engine.handleInteraction;

/** Run full startup/recovery for all guilds on bot ready */
export const recoverOnStartup = engine.recoverOnStartup;

/** Config manager — available for plugins and advanced use */
export { configManager };

/** Plugin list — available for introspection */
export { PLUGINS, getPlugin };
