/**
 * Bot 1 — Event: guildMemberRemove
 *
 * Fires when a member leaves a guild (kick, ban, or voluntary leave).
 * Routes to the Invite Tracker runtime handler to update leave/fake stats.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onGuildMemberRemove } from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class GuildMemberRemoveEvent extends BaseEvent {
  constructor() {
    super({ name: 'guildMemberRemove', once: false });
  }

  async execute(client, member) {
    try {
      await onGuildMemberRemove(member);
    } catch (err) {
      logger.error(`[guildMemberRemove] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
