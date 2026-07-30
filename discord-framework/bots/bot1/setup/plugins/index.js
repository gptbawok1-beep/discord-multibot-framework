/**
 * Bot 1 — Setup Wizard Plugin Auto-Loader
 *
 * Automatically discovers and loads all plugin files in this directory.
 * To add a new plugin: create bots/bot1/setup/plugins/myFeature.js
 * No other files need to change — it will be picked up on next start.
 *
 * Plugin interface:
 *   id                  {string}    Unique kebab-case ID
 *   label               {string}    Human-readable name shown in dropdown
 *   emoji               {string}    Emoji prefix
 *   description         {string}    Short description for dropdown tooltip
 *   order               {number}    Sort order in dropdown (lower = first)
 *   requiredPermission  {bigint?}   PermissionFlagsBits value required to access this plugin
 *   getStatus   (guildConfig) => { enabled: boolean, summary: string }
 *   buildPage   (guildConfig, session) => Promise<{ embed, components }>
 *   handleInteraction (interaction, session, guildConfig, action) => Promise<void>
 *   handleModal? (interaction, session, guildConfig, field) => Promise<void>
 *   onRecover?  (guild, guildConfig) => Promise<void>  — called on bot startup
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Discover all .js plugin files in this directory (excluding index.js)
const pluginFiles = readdirSync(__dirname).filter(
  (f) => f.endsWith('.js') && f !== 'index.js'
);

// Dynamically import each plugin file; failures are isolated so one broken
// plugin doesn't prevent the rest from loading.
const loadResults = await Promise.allSettled(
  pluginFiles.map((file) => import(`./${file}`).then((m) => m.default))
);

/** @type {Plugin[]} */
const PLUGINS = loadResults
  .map((result, i) => {
    if (result.status === 'rejected') {
      console.warn(`[PluginLoader] Failed to load plugin "${pluginFiles[i]}": ${result.reason}`);
      return null;
    }
    const plugin = result.value;
    if (!plugin?.id || typeof plugin.buildPage !== 'function') {
      console.warn(`[PluginLoader] Skipping invalid plugin in "${pluginFiles[i]}"`);
      return null;
    }
    return plugin;
  })
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

/** @type {Map<string, Plugin>} */
const PLUGIN_MAP = new Map(PLUGINS.map((p) => [p.id, p]));

/**
 * Look up a plugin by ID.
 * @param {string} id
 * @returns {Plugin|undefined}
 */
function getPlugin(id) {
  return PLUGIN_MAP.get(id);
}

export { PLUGINS, PLUGIN_MAP, getPlugin };
