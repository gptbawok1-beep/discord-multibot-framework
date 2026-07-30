/**
 * Bot 1 — Event: inviteDelete
 *
 * Fires when a guild invite is deleted or expires.
 * Removes the invite from the Invite Tracker cache.
 *
 * Requires the GuildInvites gateway intent (already added in bot1/index.js).
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onInviteDelete } from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class InviteDeleteEvent extends BaseEvent {
  constructor() {
    super({ name: 'inviteDelete', once: false });
  }

  async execute(client, invite) {
    try {
      await onInviteDelete(invite);
    } catch (err) {
      logger.error(`[inviteDelete] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
