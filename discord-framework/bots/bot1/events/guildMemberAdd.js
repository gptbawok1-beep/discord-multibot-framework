/**
 * Bot 1 — Event: guildMemberAdd
 *
 * Fires when a member joins a guild.
 * Routes to:
 *   1. Welcome handler  — sends welcome embed (if welcome.enabled)
 *   2. Invite Tracker   — detects inviter and sends notification (if invite.enabled)
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onGuildMemberAdd as welcomeOnAdd } from '../features/welcome/handler.js';
import { onGuildMemberAdd as inviteOnAdd }  from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super({ name: 'guildMemberAdd', once: false });
  }

  async execute(client, member) {
    // Welcome handler — send welcome embed
    try {
      await welcomeOnAdd(member);
    } catch (err) {
      logger.error(`[guildMemberAdd] Error in Welcome handler: ${err.message}`);
    }

    // Invite Tracker handler — detect inviter, update stats
    try {
      await inviteOnAdd(member);
    } catch (err) {
      logger.error(`[guildMemberAdd] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
