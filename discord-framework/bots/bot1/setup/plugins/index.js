/**
 * Bot 1 — Setup Wizard Plugin Auto-Loader
 *
 * Thin wrapper around the Shared Plugin Loader factory.
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

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPluginLoader } from '../../../../shared/setup/pluginLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { PLUGINS, PLUGIN_MAP, getPlugin } = await createPluginLoader({ pluginDir: __dirname });

export { PLUGINS, PLUGIN_MAP, getPlugin };
