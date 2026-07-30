/**
 * Bot 1 — Invite Tracker: Runtime Handler
 *
 * Public API for all invite tracking events. Called from Bot 1 event files.
 *
 * Exports:
 *   onGuildMemberAdd(member)     — member joined
 *   onGuildMemberRemove(member)  — member left
 *   onInviteCreate(invite)       — new invite created
 *   onInviteDelete(invite)       — invite deleted
 *   recoverGuild(guild, cfg)     — startup recovery (cache load)
 */

import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildCache, addInvite, removeInvite } from './cache.js';
import { refreshGuildCache, detectInviter } from './tracker.js';
import { recordJoin, recordLeave, getMemberStats, loadStats } from './stats.js';
import { createLogger } from '../../../../shared/logger/index.js';
import { loadGuildConfig } from '../../setup/config.js';

const logger = createLogger('BOT1');

// ── Placeholder replacement ───────────────────────────────────────────────────

/**
 * Replace all supported placeholders in a string.
 *
 * @param {string} str
 * @param {object} vars
 * @returns {string}
 */
function replacePlaceholders(str, vars) {
  if (!str) return str ?? '';
  return str
    .replace(/\{user\}/g,         vars.user         ?? '')
    .replace(/\{mention\}/g,      vars.mention      ?? '')
    .replace(/\{inviter\}/g,      vars.inviter      ?? 'Unknown')
    .replace(/\{inviteCode\}/g,   vars.inviteCode   ?? 'Unknown')
    .replace(/\{totalInvites\}/g, String(vars.totalInvites ?? 0))
    .replace(/\{fakeInvites\}/g,  String(vars.fakeInvites  ?? 0))
    .replace(/\{leaveInvites\}/g, String(vars.leaveInvites ?? 0))
    .replace(/\{server\}/g,       vars.server       ?? '');
}

// ── Build notification embed ──────────────────────────────────────────────────

/**
 * Build the invite join notification embed from guild config + runtime data.
 *
 * @param {object}                       cfg        - Guild config
 * @param {import('discord.js').GuildMember} member
 * @param {string|null}                  inviterId
 * @param {string|null}                  inviteCode
 * @returns {Promise<EmbedBuilder>}
 */
async function buildNotificationEmbed(cfg, member, inviterId, inviteCode) {
  const embedCfg = cfg.invite?.embed ?? {};
  const guild    = member.guild;

  // Resolve inviter user object
  let inviterUser = null;
  if (inviterId) {
    inviterUser =
      guild.members.cache.get(inviterId)?.user ??
      (await guild.client.users.fetch(inviterId).catch(() => null));
  }

  // Get updated inviter stats
  const inviterStats = inviterId
    ? await getMemberStats(guild.id, inviterId)
    : { total: 0, fake: 0, left: 0 };

  const vars = {
    user:         member.user.username,
    mention:      `<@${member.user.id}>`,
    inviter:      inviterUser ? inviterUser.username : 'Unknown',
    inviteCode:   inviteCode ?? 'Unknown',
    totalInvites: inviterStats.total ?? 0,
    fakeInvites:  inviterStats.fake  ?? 0,
    leaveInvites: inviterStats.left  ?? 0,
    server:       guild.name,
  };

  // Parse embed color
  const rawColor = embedCfg.color ?? '#5865F2';
  const colorInt = parseInt(rawColor.replace('#', ''), 16);
  const color    = isNaN(colorInt) ? 0x5865F2 : colorInt;

  const defaultTitle = '👋 {user} bergabung ke {server}!';
  const defaultDesc  = 'Diundang oleh **{inviter}** menggunakan kode `{inviteCode}`.\nTotal invite: **{totalInvites}** | Fake: **{fakeInvites}** | Pergi: **{leaveInvites}**';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(replacePlaceholders(embedCfg.title || defaultTitle, vars))
    .setDescription(replacePlaceholders(embedCfg.description || defaultDesc, vars))
    .setTimestamp();

  if (embedCfg.thumbnail) {
    const thumb = replacePlaceholders(embedCfg.thumbnail, vars);
    embed.setThumbnail(thumb);
  } else if (member.user.displayAvatarURL()) {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
  }

  if (embedCfg.footer) {
    embed.setFooter({ text: replacePlaceholders(embedCfg.footer, vars) });
  }

  if (embedCfg.image) {
    embed.setImage(replacePlaceholders(embedCfg.image, vars));
  }

  // GIF appears as image if set (override image)
  if (embedCfg.gif) {
    embed.setImage(replacePlaceholders(embedCfg.gif, vars));
  }

  return embed;
}

/**
 * Build a preview/test notification embed (same as live but uses fake data).
 *
 * @param {object}                cfg   - Guild config
 * @param {import('discord.js').Guild}   guild
 * @param {import('discord.js').User}    testUser  - The admin running the test
 * @returns {EmbedBuilder}
 */
function buildTestEmbed(cfg, guild, testUser) {
  const embedCfg = cfg.invite?.embed ?? {};

  const vars = {
    user:         testUser.username,
    mention:      `<@${testUser.id}>`,
    inviter:      testUser.username,
    inviteCode:   'ABC123',
    totalInvites: '5',
    fakeInvites:  '1',
    leaveInvites: '2',
    server:       guild.name,
  };

  const rawColor = embedCfg.color ?? '#5865F2';
  const colorInt = parseInt(rawColor.replace('#', ''), 16);
  const color    = isNaN(colorInt) ? 0x5865F2 : colorInt;

  const defaultTitle = '👋 {user} bergabung ke {server}!';
  const defaultDesc  = 'Diundang oleh **{inviter}** menggunakan kode `{inviteCode}`.\nTotal invite: **{totalInvites}** | Fake: **{fakeInvites}** | Pergi: **{leaveInvites}**';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(replacePlaceholders(embedCfg.title || defaultTitle, vars))
    .setDescription(replacePlaceholders(embedCfg.description || defaultDesc, vars))
    .setFooter({ text: '🔬 Test — bukan notifikasi nyata' })
    .setTimestamp();

  if (embedCfg.thumbnail) {
    embed.setThumbnail(replacePlaceholders(embedCfg.thumbnail, vars));
  } else {
    embed.setThumbnail(testUser.displayAvatarURL({ dynamic: true }));
  }

  if (embedCfg.image) embed.setImage(replacePlaceholders(embedCfg.image, vars));
  if (embedCfg.gif)   embed.setImage(replacePlaceholders(embedCfg.gif,   vars));

  return embed;
}

// ── Event handlers ────────────────────────────────────────────────────────────

/**
 * Handle guildMemberAdd — detect invite, record join, send notification.
 *
 * @param {import('discord.js').GuildMember} member
 */
async function onGuildMemberAdd(member) {
  const { guild } = member;

  // Load fresh config
  const cfg = await loadGuildConfig(guild.id);
  if (!cfg.invite?.enabled) return;

  logger.info(`[InviteTracker] Member joined: ${member.user.tag} in guild ${guild.id}`);

  // Snapshot old cache NOW (before we await detection — avoids race conditions)
  const rawCache = getGuildCache(guild.id);
  const oldCache = rawCache ? new Map(rawCache) : null;

  // Detect which invite was used
  const detected  = await detectInviter(guild, oldCache);
  const inviterId  = detected?.inviterId  ?? null;
  const inviteCode = detected?.code       ?? null;

  if (!inviterId) {
    logger.warn(`[InviteTracker] Could not detect inviter for ${member.user.tag} in guild ${guild.id}`);
  } else {
    logger.info(`[InviteTracker] Inviter: ${inviterId} via code: ${inviteCode}`);
  }

  // Check if this is a rejoin (member has a previous join record)
  const stats    = await loadStats(guild.id);
  const isRejoin = !!stats.joins[member.user.id];

  // Record the join in stats
  await recordJoin(guild.id, member.user.id, inviterId, inviteCode, isRejoin);

  // Build the notification embed
  const embed = await buildNotificationEmbed(cfg, member, inviterId, inviteCode);

  const logChannelId  = cfg.invite.logChannelId;
  const joinChannelId = cfg.invite.joinChannelId;

  // Send to log channel
  if (logChannelId) {
    try {
      const channel = guild.channels.cache.get(logChannelId)
        ?? await guild.channels.fetch(logChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        logger.info(`[InviteTracker] Notification sent → #${logChannelId}`);
      }
    } catch (err) {
      logger.error(`[InviteTracker] Failed to send to log channel ${logChannelId}: ${err.message}`);
    }
  }

  // Send to join notification channel (only if it's different from log channel)
  if (joinChannelId && joinChannelId !== logChannelId) {
    try {
      const channel = guild.channels.cache.get(joinChannelId)
        ?? await guild.channels.fetch(joinChannelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        logger.info(`[InviteTracker] Notification sent → #${joinChannelId}`);
      }
    } catch (err) {
      logger.error(`[InviteTracker] Failed to send to join channel ${joinChannelId}: ${err.message}`);
    }
  }
}

/**
 * Handle guildMemberRemove — update leave/fake stats for the inviter.
 *
 * @param {import('discord.js').GuildMember} member
 */
async function onGuildMemberRemove(member) {
  const { guild } = member;

  const cfg = await loadGuildConfig(guild.id);
  if (!cfg.invite?.enabled) return;

  logger.info(`[InviteTracker] Member left: ${member.user.tag} in guild ${guild.id}`);
  await recordLeave(guild.id, member.user.id);
}

/**
 * Handle inviteCreate — add the new invite to the cache.
 *
 * @param {import('discord.js').Invite} invite
 */
async function onInviteCreate(invite) {
  if (!invite.guild) return;
  addInvite(invite.guild.id, invite);
  logger.debug(`[InviteTracker] Invite created: ${invite.code} in guild ${invite.guild.id}`);
}

/**
 * Handle inviteDelete — remove the invite from the cache.
 *
 * @param {import('discord.js').Invite} invite
 */
async function onInviteDelete(invite) {
  if (!invite.guild) return;
  removeInvite(invite.guild.id, invite.code);
  logger.debug(`[InviteTracker] Invite deleted: ${invite.code} in guild ${invite.guild.id}`);
}

/**
 * Auto-recovery: load invite cache for a guild on bot startup.
 * Called by the invite plugin's onRecover hook.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} cfg - Guild config
 */
async function recoverGuild(guild, cfg) {
  if (!cfg.invite?.enabled) return;

  // Verify the bot has MANAGE_GUILD to fetch invites
  const botMember = guild.members.me;
  if (botMember && !botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    logger.warn(`[InviteTracker] No MANAGE_GUILD permission for guild ${guild.id} — invite cache not loaded`);
    return;
  }

  await refreshGuildCache(guild);
  logger.info(`[InviteTracker] Cache loaded for guild ${guild.id} ✅`);
}

export {
  onGuildMemberAdd,
  onGuildMemberRemove,
  onInviteCreate,
  onInviteDelete,
  recoverGuild,
  buildTestEmbed,
};
