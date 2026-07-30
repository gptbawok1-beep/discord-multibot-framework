/**
 * Bot 1 — Event: guildMemberAdd
 *
 * Fires when a member joins a guild.
 * Routes to the Invite Tracker runtime handler if the feature is enabled.
 */

import { BaseEvent } from '../../../shared/structures/index.js';
import { createLogger } from '../../../shared/logger/index.js';
import { onGuildMemberAdd } from '../features/inviteTracker/handler.js';

const logger = createLogger('BOT1');

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super({ name: 'guildMemberAdd', once: false });
  }

  async execute(client, member) {
    try {
      await onGuildMemberAdd(member);
    } catch (err) {
      logger.error(`[guildMemberAdd] Error in InviteTracker handler: ${err.message}`);
    }
  }
}
