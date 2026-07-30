/**
 * Bot 1 — Event: inviteCreate
 *
 * Fires when a new guild invite is created.
 * Adds the invite to the Invite Tracker cache so it can be detected on member joins.
 *
 * Requires the GuildInvites gateway intent (already added in bot1/index.js).
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onInviteCreate } from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class InviteCreateEvent extends BaseEvent {
  constructor() {
    super({ name: 'inviteCreate', once: false });
  }

  async execute(client, invite) {
    try {
      await onInviteCreate(invite);
    } catch (err) {
      logger.error(`[inviteCreate] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
