/**
 * Bot 1 — Setup Wizard
 *
 * Backwards-compatibility re-export.
 * All logic lives in setup/index.js (which uses the Shared Engine).
 *
 * Existing imports like:
 *   import { openWizard, handleInteraction } from '../setup/wizard.js';
 * continue to work without changes.
 */

export { openWizard, handleInteraction } from './index.js';
