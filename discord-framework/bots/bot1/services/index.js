/**
 * Bot 1 — Services
 *
 * Instantiates shared service factories with Bot 1's config manager.
 * Any Bot 1 feature or plugin that needs a core service imports from here.
 *
 * Usage:
 *   import { systemManager } from '../../services/index.js';
 *   await systemManager.sendSystemLog(client, guildId, 'Config Updated', { detail });
 */

import { createSystemManagerService } from '../../../shared/services/index.js';
import { loadGuildConfig, updateSection } from '../setup/config.js';

export const systemManager = createSystemManagerService({ loadGuildConfig, updateSection });
