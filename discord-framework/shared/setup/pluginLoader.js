/**
 * Shared Setup Engine — Plugin Loader Factory
 *
 * createPluginLoader({ pluginDir }) → Promise<{ PLUGINS, PLUGIN_MAP, getPlugin }>
 *
 * Automatically discovers and loads all plugin files in a given directory.
 * To add a new plugin: create a .js file in the target directory.
 * No other files need to change — it will be picked up on next start.
 *
 * Plugin interface (required):
 *   id                  {string}    Unique kebab-case ID
 *   label               {string}    Human-readable name shown in dropdown
 *   emoji               {string}    Emoji prefix
 *   description         {string}    Short description for dropdown tooltip
 *   order               {number}    Sort order in dropdown (lower = first)
 *   requiredPermission  {bigint?}   PermissionFlagsBits value required
 *   getStatus   (guildConfig) => { enabled: boolean, summary: string }
 *   buildPage   (guildConfig, session) => Promise<{ embed, components }>
 *   handleInteraction (interaction, session, guildConfig, action) => Promise<void>
 *   handleModal? (interaction, session, guildConfig, field) => Promise<void>
 *   onRecover?  (guild, guildConfig) => Promise<void>
 *
 * Usage:
 *   import { createPluginLoader } from '../../../shared/setup/pluginLoader.js';
 *   import { dirname } from 'path';
 *   import { fileURLToPath } from 'url';
 *
 *   const __dirname = dirname(fileURLToPath(import.meta.url));
 *   const { PLUGINS, PLUGIN_MAP, getPlugin } = await createPluginLoader({ pluginDir: __dirname });
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * @param {object} options
 * @param {string} options.pluginDir - Absolute path to the directory containing plugin files
 * @returns {Promise<{ PLUGINS: Plugin[], PLUGIN_MAP: Map<string, Plugin>, getPlugin: (id: string) => Plugin|undefined }>}
 */
export async function createPluginLoader({ pluginDir }) {
  // Discover all .js plugin files in the directory (excluding index.js itself)
  const pluginFiles = readdirSync(pluginDir).filter(
    (f) => f.endsWith('.js') && f !== 'index.js'
  );

  // Dynamically import each plugin file; failures are isolated so one broken
  // plugin doesn't prevent the rest from loading.
  const loadResults = await Promise.allSettled(
    pluginFiles.map((file) =>
      import(pathToFileURL(join(pluginDir, file)).href).then((m) => m.default)
    )
  );

  /** @type {Plugin[]} */
  const PLUGINS = loadResults
    .map((result, i) => {
      if (result.status === 'rejected') {
        console.warn(
          `[PluginLoader] Failed to load plugin "${pluginFiles[i]}": ${result.reason}`
        );
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

  return { PLUGINS, PLUGIN_MAP, getPlugin };
}
