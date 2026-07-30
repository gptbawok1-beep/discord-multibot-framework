/**
 * Bot 1 — Event: guildMemberRemove
 *
 * Fires when a member leaves a guild (kick, ban, or voluntary leave).
 * Routes to:
 *   1. Welcome handler  — sends goodbye embed (if welcome.enabled)
 *   2. Invite Tracker   — updates leave/fake stats (if invite.enabled)
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onGuildMemberRemove as welcomeOnRemove } from '../features/welcome/handler.js';
import { onGuildMemberRemove as inviteOnRemove }  from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class GuildMemberRemoveEvent extends BaseEvent {
  constructor() {
    super({ name: 'guildMemberRemove', once: false });
  }

  async execute(client, member) {
    // Welcome handler — send goodbye embed
    try {
      await welcomeOnRemove(member);
    } catch (err) {
      logger.error(`[guildMemberRemove] Error in Welcome/Goodbye handler: ${err.message}`);
    }

    // Invite Tracker handler — record leave, update inviter stats
    try {
      await inviteOnRemove(member);
    } catch (err) {
      logger.error(`[guildMemberRemove] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
