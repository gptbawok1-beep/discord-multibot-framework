/**
 * Giveaway — Core Manager
 *
 * Handles all giveaway lifecycle:
 *   createGiveaway   → post embed, persist, schedule timer
 *   endGiveaway      → pick winners, update embed, announce
 *   cancelGiveaway   → cancel without picking winners
 *   rerollGiveaway   → pick new winners from participants
 *   handleJoin       → button: join giveaway
 *   handleParticipants → button: view participants
 *   handleInfo       → button: view info
 *   recoverGiveaways → called on bot ready, restores all active timers
 *
 * In-memory timer registry is cleared on restart; recoverGiveaways re-creates
 * all timers from the persistent JSON store.
 */

import { createLogger } from '../../../../shared/logger/index.js';
import {
  getGiveaway,
  setGiveaway,
  listGiveaways,
} from './store.js';
import {
  buildGiveawayEmbed,
  buildGiveawayComponents,
  buildGiveawayEndedEmbed,
  buildGiveawayCancelledEmbed,
  buildParticipantsEmbed,
  buildInfoEmbed,
} from './embed.js';
import { loadGuildConfig } from '../../setup/config.js';

const logger = createLogger('GIVEAWAY');

// In-memory timer map: messageId → NodeJS.Timeout
const timers = new Map();

// ---------------------------------------------------------------------------
// Duration parser
// ---------------------------------------------------------------------------

/** Valid duration format hint shown in error messages */
export const VALID_DURATIONS = ['1m', '5m', '10m', '30m', '45m', '1h', '2h', '6h', '12h', '1d', '2d', '7d'];

/**
 * Parse a duration string like "10m", "2h", "1d" into milliseconds.
 * Returns null if invalid.
 * @param {string} str
 * @returns {number|null}
 */
export function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  const match = /^(\d+)(m|h|d)$/i.exec(str.trim());
  if (!match) return null;
  const n    = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (n <= 0) return null;
  const ms = unit === 'm' ? n * 60_000
           : unit === 'h' ? n * 3_600_000
           :                 n * 86_400_000;
  // Min 1 minute, max 7 days
  if (ms < 60_000)             return null;
  if (ms > 7 * 86_400_000)     return null;
  return ms;
}

/**
 * Format milliseconds into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const parts = [];
  if (d) parts.push(`${d} hari`);
  if (h) parts.push(`${h} jam`);
  if (m) parts.push(`${m} menit`);
  return parts.join(' ') || '< 1 menit';
}

// ---------------------------------------------------------------------------
// Internal: schedule end timer
// ---------------------------------------------------------------------------

function scheduleEnd(client, giveaway) {
  const remaining = Math.max(0, giveaway.endsAt - Date.now());

  // Clear any existing timer for this giveaway
  if (timers.has(giveaway.id)) {
    clearTimeout(timers.get(giveaway.id));
    timers.delete(giveaway.id);
  }

  const t = setTimeout(async () => {
    timers.delete(giveaway.id);
    try {
      await endGiveaway(client, giveaway.guildId, giveaway.id, { silent: false });
    } catch (err) {
      logger.error(`Auto-end failed for giveaway ${giveaway.id}: ${err.message}`);
    }
  }, remaining);

  timers.set(giveaway.id, t);
}

// ---------------------------------------------------------------------------
// Internal: fetch the Discord message for a giveaway
// ---------------------------------------------------------------------------

async function fetchGiveawayMessage(client, giveaway) {
  try {
    const guild   = client.guilds.cache.get(giveaway.guildId)
                 ?? await client.guilds.fetch(giveaway.guildId).catch(() => null);
    if (!guild) return null;

    const channel = guild.channels.cache.get(giveaway.channelId)
                 ?? await guild.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;

    return await channel.messages.fetch(giveaway.id).catch(() => null);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal: pick random winners
// ---------------------------------------------------------------------------

function pickWinners(participants, count) {
  if (participants.length === 0) return [];
  const pool    = [...participants];
  const winners = [];
  const take    = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

// ---------------------------------------------------------------------------
// Internal: update participant count on the giveaway message
// ---------------------------------------------------------------------------

async function refreshGiveawayMessage(client, giveaway) {
  try {
    const msg = await fetchGiveawayMessage(client, giveaway);
    if (!msg) return;
    await msg.edit({
      embeds:     [buildGiveawayEmbed(giveaway)],
      components: buildGiveawayComponents(giveaway),
    });
  } catch (err) {
    logger.warn(`Could not refresh giveaway message ${giveaway.id}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Public: createGiveaway
// ---------------------------------------------------------------------------

/**
 * Create a new giveaway.
 *
 * @param {import('discord.js').Client} client
 * @param {{
 *   guildId: string,
 *   channelId: string,
 *   hostId: string,
 *   prize: string,
 *   durationMs: number,
 *   winnerCount?: number,
 *   requiredRoleId?: string|null,
 *   mentionRoleId?: string|null,
 * }} options
 * @returns {Promise<object>} The created giveaway record
 */
export async function createGiveaway(client, options) {
  const {
    guildId,
    channelId,
    hostId,
    prize,
    durationMs,
    winnerCount    = 1,
    requiredRoleId = null,
    mentionRoleId  = null,
  } = options;

  const now    = Date.now();
  const endsAt = now + durationMs;

  // Resolve channel
  const guild   = client.guilds.cache.get(guildId)
               ?? await client.guilds.fetch(guildId);
  const channel = guild.channels.cache.get(channelId)
               ?? await guild.channels.fetch(channelId);

  if (!channel?.isTextBased()) {
    throw new Error('Channel tidak ditemukan atau bukan text channel.');
  }

  // Build a temporary giveaway (id not yet known)
  const tempGiveaway = {
    id:            'pending',
    guildId,
    channelId,
    hostId,
    prize,
    winnerCount,
    endsAt,
    participants:  [],
    requiredRoleId,
    mentionRoleId,
    status:        'active',
    winners:       [],
    createdAt:     now,
  };

  // Build mention content
  let content = '';
  if (mentionRoleId) content = `<@&${mentionRoleId}>`;

  // Send the giveaway message (without buttons — id not known yet)
  const msg = await channel.send({
    content:  content || undefined,
    embeds:   [buildGiveawayEmbed(tempGiveaway)],
  });

  // Now we have the message ID — store and finalize
  const giveaway = { ...tempGiveaway, id: msg.id };
  setGiveaway(guildId, msg.id, giveaway);

  // Edit the message to add the buttons (now that we have the id)
  await msg.edit({
    content:    content || null,
    embeds:     [buildGiveawayEmbed(giveaway)],
    components: buildGiveawayComponents(giveaway),
  });

  // Schedule auto-end
  scheduleEnd(client, giveaway);

  logger.info(`Giveaway created: ${giveaway.id} in guild ${guildId} (${prize})`);
  return giveaway;
}

// ---------------------------------------------------------------------------
// Public: endGiveaway
// ---------------------------------------------------------------------------

/**
 * End a giveaway — picks winners and announces.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} messageId
 * @param {{ silent?: boolean, reroll?: boolean }} [opts]
 * @returns {Promise<object>} Updated giveaway record
 */
export async function endGiveaway(client, guildId, messageId, opts = {}) {
  const { reroll = false } = opts;

  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway) throw new Error(`Giveaway \`${messageId}\` tidak ditemukan.`);
  if (!reroll && giveaway.status === 'ended')     throw new Error('Giveaway sudah selesai.');
  if (!reroll && giveaway.status === 'cancelled') throw new Error('Giveaway sudah dibatalkan.');

  // Clear timer if still scheduled
  if (timers.has(messageId)) {
    clearTimeout(timers.get(messageId));
    timers.delete(messageId);
  }

  // Validate participants: if requiredRoleId, re-check at end time
  let validParticipants = giveaway.participants;
  if (giveaway.requiredRoleId) {
    try {
      const guild = client.guilds.cache.get(guildId)
                 ?? await client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const valid = [];
        for (const uid of giveaway.participants) {
          const member = guild.members.cache.get(uid)
                      ?? await guild.members.fetch(uid).catch(() => null);
          if (member?.roles.cache.has(giveaway.requiredRoleId)) valid.push(uid);
        }
        validParticipants = valid;
      }
    } catch {
      // Use unfiltered list if role check fails
    }
  }

  const winners = pickWinners(validParticipants, giveaway.winnerCount);

  // Persist updated state
  const updated = { ...giveaway, status: 'ended', winners };
  setGiveaway(guildId, messageId, updated);

  // Update giveaway message
  const msg = await fetchGiveawayMessage(client, giveaway);
  if (msg) {
    try {
      await msg.edit({
        embeds:     [buildGiveawayEndedEmbed(updated, winners)],
        components: [], // remove buttons
      });
    } catch (err) {
      logger.warn(`Could not edit giveaway message ${messageId}: ${err.message}`);
    }
  }

  // Announce winners in channel
  try {
    const guild   = client.guilds.cache.get(guildId)
                 ?? await client.guilds.fetch(guildId).catch(() => null);
    const channel = guild?.channels.cache.get(giveaway.channelId)
                 ?? await guild?.channels.fetch(giveaway.channelId).catch(() => null);

    if (channel?.isTextBased()) {
      const label = reroll ? '🔄  **REROLL GIVEAWAY**' : '🎊  **GIVEAWAY SELESAI**';

      if (winners.length === 0) {
        await channel.send({
          content: `${label} — **${giveaway.prize}**\n\n❌  Tidak ada peserta yang valid. Giveaway berakhir tanpa pemenang.`,
          reply:   msg ? { messageReference: msg.id, failIfNotExists: false } : undefined,
        });
      } else {
        const winnerMentions = winners.map((id) => `<@${id}>`).join(', ');
        await channel.send({
          content: `${label} — **${giveaway.prize}**\n\n🏆  Selamat kepada ${winnerMentions}!\nAnda memenangkan **${giveaway.prize}**! Hubungi <@${giveaway.hostId}> untuk mengklaim hadiah.`,
          reply:   msg ? { messageReference: msg.id, failIfNotExists: false } : undefined,
        });
      }
    }
  } catch (err) {
    logger.warn(`Could not send winner announcement for giveaway ${messageId}: ${err.message}`);
  }

  // Log to log channel if configured
  try {
    const cfg = await loadGuildConfig(guildId).catch(() => null);
    const logChannelId = cfg?.giveaway?.logChannelId;
    if (logChannelId) {
      const guild   = client.guilds.cache.get(guildId)
                   ?? await client.guilds.fetch(guildId).catch(() => null);
      const logCh   = guild?.channels.cache.get(logChannelId)
                   ?? await guild?.channels.fetch(logChannelId).catch(() => null);
      if (logCh?.isTextBased()) {
        const action = reroll ? 'Reroll' : 'Selesai';
        const winnerText = winners.length
          ? winners.map((id) => `<@${id}>`).join(', ')
          : 'Tidak ada pemenang';
        await logCh.send({
          embeds: [buildGiveawayEndedEmbed(updated, winners)
            .setTitle(`📋  Log Giveaway — ${action}`)
            .setFooter({ text: `ID: ${messageId}` })],
        });
      }
    }

    // Auto-delete giveaway message if configured
    const autoDelete = cfg?.giveaway?.autoDelete;
    if (autoDelete && msg) {
      setTimeout(() => msg.delete().catch(() => {}), 10_000);
    }
  } catch {
    // Non-critical — log and move on
  }

  logger.info(`Giveaway ended: ${messageId} in guild ${guildId} — winners: ${winners.join(', ') || 'none'}`);
  return updated;
}

// ---------------------------------------------------------------------------
// Public: cancelGiveaway
// ---------------------------------------------------------------------------

/**
 * Cancel an active giveaway without picking winners.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} messageId
 * @returns {Promise<object>} Updated giveaway record
 */
export async function cancelGiveaway(client, guildId, messageId) {
  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway)                       throw new Error(`Giveaway \`${messageId}\` tidak ditemukan.`);
  if (giveaway.status === 'ended')     throw new Error('Giveaway sudah selesai. Tidak bisa dibatalkan.');
  if (giveaway.status === 'cancelled') throw new Error('Giveaway sudah dibatalkan sebelumnya.');

  // Clear timer
  if (timers.has(messageId)) {
    clearTimeout(timers.get(messageId));
    timers.delete(messageId);
  }

  const updated = { ...giveaway, status: 'cancelled' };
  setGiveaway(guildId, messageId, updated);

  // Update giveaway message
  const msg = await fetchGiveawayMessage(client, giveaway);
  if (msg) {
    try {
      await msg.edit({
        embeds:     [buildGiveawayCancelledEmbed(updated)],
        components: [],
      });
    } catch (err) {
      logger.warn(`Could not edit cancelled giveaway message ${messageId}: ${err.message}`);
    }
  }

  logger.info(`Giveaway cancelled: ${messageId} in guild ${guildId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// Public: rerollGiveaway
// ---------------------------------------------------------------------------

/**
 * Reroll a finished giveaway — picks new winners.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} messageId
 * @returns {Promise<object>} Updated giveaway record
 */
export async function rerollGiveaway(client, guildId, messageId) {
  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway)                         throw new Error(`Giveaway \`${messageId}\` tidak ditemukan.`);
  if (giveaway.status === 'cancelled')   throw new Error('Giveaway dibatalkan — tidak bisa di-reroll.');
  if (giveaway.status === 'active')      throw new Error('Giveaway masih berjalan. Akhiri dulu dengan `!gend`.');

  return endGiveaway(client, guildId, messageId, { reroll: true });
}

// ---------------------------------------------------------------------------
// Public: interaction handlers (buttons on giveaway panel)
// ---------------------------------------------------------------------------

/**
 * Handle the 🎉 Join Giveaway button click.
 * Custom ID format: gw1:<messageId>:join
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleJoin(interaction) {
  const [, messageId] = interaction.customId.split(':');
  const guildId       = interaction.guildId;
  const userId        = interaction.user.id;

  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway) {
    return interaction.reply({
      content:   '❌  Data giveaway tidak ditemukan. Mungkin sudah dihapus.',
      ephemeral: true,
    });
  }

  if (giveaway.status !== 'active') {
    const label = giveaway.status === 'ended' ? 'sudah selesai' : 'sudah dibatalkan';
    return interaction.reply({
      content:   `❌  Giveaway ini **${label}** dan tidak menerima peserta baru.`,
      ephemeral: true,
    });
  }

  // Check required role
  if (giveaway.requiredRoleId) {
    const member = interaction.member;
    if (!member?.roles.cache.has(giveaway.requiredRoleId)) {
      return interaction.reply({
        content:   `❌  Kamu harus memiliki role <@&${giveaway.requiredRoleId}> untuk ikut giveaway ini.`,
        ephemeral: true,
      });
    }
  }

  // Check duplicate
  if (giveaway.participants.includes(userId)) {
    // Toggle: allow leaving
    const updated = {
      ...giveaway,
      participants: giveaway.participants.filter((id) => id !== userId),
    };
    setGiveaway(guildId, messageId, updated);
    await refreshGiveawayMessage(interaction.client, updated).catch(() => {});
    return interaction.reply({
      content:   '👋  Kamu telah **keluar** dari giveaway ini.',
      ephemeral: true,
    });
  }

  // Add participant
  const updated = {
    ...giveaway,
    participants: [...giveaway.participants, userId],
  };
  setGiveaway(guildId, messageId, updated);

  // Refresh the message embed (update participant count)
  await refreshGiveawayMessage(interaction.client, updated).catch(() => {});

  return interaction.reply({
    content:   `🎉  Kamu berhasil **terdaftar** dalam giveaway **${giveaway.prize}**!\n\nTekan 🎉 lagi jika ingin keluar.`,
    ephemeral: true,
  });
}

/**
 * Handle the 👥 Participants button click.
 * Custom ID format: gw1:<messageId>:participants
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleParticipants(interaction) {
  const [, messageId] = interaction.customId.split(':');
  const guildId       = interaction.guildId;

  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway) {
    return interaction.reply({
      content:   '❌  Data giveaway tidak ditemukan.',
      ephemeral: true,
    });
  }

  return interaction.reply({
    embeds:    [buildParticipantsEmbed(giveaway)],
    ephemeral: true,
  });
}

/**
 * Handle the ℹ️ Info button click.
 * Custom ID format: gw1:<messageId>:info
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleInfo(interaction) {
  const [, messageId] = interaction.customId.split(':');
  const guildId       = interaction.guildId;

  const giveaway = getGiveaway(guildId, messageId);
  if (!giveaway) {
    return interaction.reply({
      content:   '❌  Data giveaway tidak ditemukan.',
      ephemeral: true,
    });
  }

  return interaction.reply({
    embeds:    [buildInfoEmbed(giveaway)],
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------
// Public: main interaction dispatcher
// ---------------------------------------------------------------------------

/**
 * Route a gw1:* button interaction to the correct handler.
 * Returns true if handled, false if unknown action.
 *
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<boolean>}
 */
export async function handleGiveawayInteraction(interaction) {
  const parts  = interaction.customId.split(':');
  // parts[0] = 'gw1', parts[1] = messageId, parts[2] = action
  const action = parts[2];

  if (action === 'join')         { await handleJoin(interaction);         return true; }
  if (action === 'participants') { await handleParticipants(interaction); return true; }
  if (action === 'info')         { await handleInfo(interaction);         return true; }

  return false;
}

// ---------------------------------------------------------------------------
// Public: recoverGiveaways (called from setup plugin's onRecover hook)
// ---------------------------------------------------------------------------

/**
 * Recover all active giveaways for a guild on bot startup.
 * - Re-schedules timers for active giveaways.
 * - Immediately ends giveaways whose endsAt is in the past.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild} guild
 * @param {object} cfg  - Guild config (from loadGuildConfig)
 */
export async function recoverGiveaways(client, guild, cfg) {
  if (cfg?.giveaway?.autoRecovery === false) return;

  const giveaways = listGiveaways(guild.id);
  const active    = giveaways.filter((g) => g.status === 'active');

  if (active.length === 0) return;
  logger.info(`Recovering ${active.length} active giveaway(s) for guild ${guild.id}...`);

  for (const giveaway of active) {
    try {
      const now       = Date.now();
      const remaining = giveaway.endsAt - now;

      if (remaining <= 0) {
        // Already past end time — end immediately with a small stagger
        setTimeout(async () => {
          try {
            await endGiveaway(client, guild.id, giveaway.id);
          } catch (err) {
            logger.error(`Recovery-end failed for giveaway ${giveaway.id}: ${err.message}`);
          }
        }, 2_000 + Math.random() * 3_000); // 2–5 s stagger
      } else {
        // Still active — reschedule timer
        scheduleEnd(client, giveaway);
        logger.info(`  ↳ Rescheduled giveaway ${giveaway.id} (ends in ${Math.round(remaining / 1000)}s)`);
      }
    } catch (err) {
      logger.error(`Recovery failed for giveaway ${giveaway.id}: ${err.message}`);
    }
  }
}
