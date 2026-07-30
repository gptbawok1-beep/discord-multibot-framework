/**
 * Shared Setup Engine — Public Exports
 *
 * Import from this file to use the shared engine in any bot:
 *
 *   import { createSetupEngine } from '../../../shared/setup/index.js';
 */

export { createSetupEngine } from './engine.js';
export { createConfigManager } from './config.js';
export { createUIBuilders, Colors, DIVIDER, statusDot, channelLabel } from './ui.js';
export { createWizard } from './wizard.js';
export { createRecovery } from './recovery.js';
export { migrate, CURRENT_VERSION } from './migration.js';
export {
  validateTextChannel,
  validateRole,
  validateRoles,
  memberHasPermissions,
  buildValidationErrorEmbed,
  buildPermissionDeniedEmbed,
} from './validation.js';
export { createPluginLoader } from './pluginLoader.js';
