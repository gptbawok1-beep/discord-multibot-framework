/**
 * workers.js — Worker Pool Initializer.
 */

import { createLogger } from '../../../../shared/logger/index.js';

const logger = createLogger("BoomboxWorkers");

export function startWorkers() {
  logger.info('Worker pool started and initialized.');
}
