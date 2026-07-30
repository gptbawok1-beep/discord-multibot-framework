/**
 * Bot 1 — Guild Config Manager
 *
 * Thin wrapper around the Shared Config Manager.
 * Exports the same API as before plus backup/restore functions.
 *
 * Storage: bots/bot1/data/guilds/<guildId>.json
 * Backups: bots/bot1/data/guilds/backups/<guildId>/<timestamp>.json
 *
 * Config is persisted across restarts, re-deploys, and updates automatically.
 * Migration runs on every load so newly added keys always appear.
 */

import { createConfigManager } from '../../../shared/setup/config.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '..', 'data', 'guilds');

// ---------------------------------------------------------------------------
// Default config shape — all sections start disabled / unconfigured
// ---------------------------------------------------------------------------

/**
 * Returns a fresh default config for a guild.
 * configVersion is stamped automatically by the config manager.
 */
export function defaultConfig() {
  return {
    server: {
      prefix:   '!',
      language: 'id',
      timezone: 'Asia/Jakarta',
    },
    welcome: {
      enabled:   false,
      channelId: null,
      embed:     { title: 'Selamat Datang, {user}!', description: '', color: '#5865F2' },
      gif:       null,
      image:     null,
      goodbye: {
        embed: { title: 'Selamat Tinggal, {user}!', description: '{mention} telah meninggalkan **{server}**.', color: '#5865F2' },
        gif:   null,
        image: null,
      },
    },
    takeRole: {
      enabled: false,
      panels:  [],
      // panel shape:
      // { id, channelId, messageId, mode: 'dropdown'|'button',
      //   placeholder, maxRoles: 1, single: true, toggle: false,
      //   roles: [{ roleId, name, emoji, description }] }
    },
    invite: {
      enabled:        false,
      logChannelId:   null,   // main channel: join logs / notifications
      joinChannelId:  null,   // optional separate join notification channel
      embed: {
        title:       '👋 {user} bergabung ke {server}!',
        description: 'Diundang oleh **{inviter}** menggunakan kode `{inviteCode}`.\nTotal invite: **{totalInvites}** | Fake: **{fakeInvites}** | Pergi: **{leaveInvites}**',
        color:       '#5865F2',
        thumbnail:   null,
        footer:      'Invite Tracker',
        image:       null,
        gif:         null,
      },
    },
    logs: {
      enabled:  false,
      channels: {
        member:     null,
        role:       null,
        invite:     null,
        channel:    null,
        moderation: null,
        welcome:    null,
        error:      null,
      },
    },
    channelManager: {
      backups: [],
    },
    backup: {
      enabled: false,
      backups: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Config manager instance (shared across all imports of this module)
// ---------------------------------------------------------------------------

export const configManager = createConfigManager({
  dataDir:     DATA_DIR,
  makeDefault: defaultConfig,
  configVersion: 1,
});

// Re-export individual functions for backwards compatibility with plugins
// that do: import { loadGuildConfig, updateSection, ... } from '../config.js'
export const {
  loadGuildConfig,
  saveGuildConfig,
  updateSection,
  resetGuildConfig,
  backupGuildConfig,
  listBackups,
  restoreBackup,
} = configManager;
