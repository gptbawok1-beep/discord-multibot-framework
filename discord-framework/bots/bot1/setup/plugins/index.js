/**
 * Bot 1 — Setup Wizard Plugin Registry
 *
 * To add a new plugin:
 *   1. Create bots/bot1/setup/plugins/myFeature.js
 *   2. Import it here and add it to PLUGINS array
 *   That's it — no other files need to change.
 *
 * Plugin interface:
 *   id          {string}    Unique kebab-case ID
 *   label       {string}    Human-readable name shown in dropdown
 *   emoji       {string}    Emoji prefix
 *   description {string}    Short description for dropdown tooltip
 *   getStatus   (guildConfig) => { enabled: boolean, summary: string }
 *   buildPage   (guildConfig, session) => Promise<{ embed, components }>
 *   handleInteraction (interaction, session, guildConfig, action) => Promise<void>
 *   handleModal? (interaction, session, guildConfig, field) => Promise<void>
 */

import serverPlugin from './server.js';
import welcomePlugin from './welcome.js';
import takeRolePlugin from './takeRole.js';
import invitePlugin from './invite.js';
import channelManagerPlugin from './channelManager.js';
import logsPlugin from './logs.js';
import backupPlugin from './backup.js';

/** @type {Plugin[]} Ordered list — this is the order shown in the dropdown */
const PLUGINS = [
  serverPlugin,
  welcomePlugin,
  takeRolePlugin,
  invitePlugin,
  channelManagerPlugin,
  logsPlugin,
  backupPlugin,
];

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
