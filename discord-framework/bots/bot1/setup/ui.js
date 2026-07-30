/**
 * Bot 1 — Setup Wizard UI Builders
 *
 * Thin wrapper around the Shared UI Factory pre-configured with the
 * 'setup1' custom-ID prefix.
 *
 * Plugins import from this file as before:
 *   import { buildNavRow, Colors, DIVIDER, ... } from '../ui.js';
 *
 * Nothing changes for plugin code — the exports are identical to the
 * old hand-written version.
 */

import {
  createUIBuilders,
  Colors,
  DIVIDER,
  statusDot,
  channelLabel,
} from '../../../shared/setup/ui.js';

const ui = createUIBuilders('setup1');

export {
  // Shared UI factory results (prefix = 'setup1')
  ui as default,
};

export const {
  buildMainEmbed,
  buildMainSelectRow,
  buildMainButtonRow,
  buildNavRow,
  buildChannelSelectPage,
  buildRoleSelectPage,
  buildChannelPreviewPage,
  buildSaveConfirmation,
  buildResetConfirmRow,
  cid,
} = ui;

// Re-export static constants (prefix-independent)
export { Colors, DIVIDER, statusDot, channelLabel };
