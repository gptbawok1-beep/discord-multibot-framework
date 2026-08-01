/**
 * Bot 2 — Prefix Command: !requlang
 *
 * Forces a re-download and re-upload of a previously processed URL.
 * Clears cache + database record, then re-enqueues the job.
 *
 * Usage: !requlang <url>
 */

import { BaseCommand } from '../../../../shared/structures/index.js';
import { handleRequlang } from '../../features/boombox/retry.js';

export default class RequlangCommand extends BaseCommand {
  constructor() {
    super({
      name: 'requlang',
      description: 'Proses ulang URL Boombox yang rusak atau kedaluwarsa.',
      type: 'prefix',
      cooldown: 10,
    });
  }

  async execute(client, message, args) {
    await handleRequlang(client, message, args);
  }
}
