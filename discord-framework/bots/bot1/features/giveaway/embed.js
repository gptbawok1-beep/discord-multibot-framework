/**
 * Giveaway — Embed & Component Builders
 *
 * All Discord UI pieces for the giveaway feature:
 *   - Active giveaway panel embed + buttons
 *   - Ended / Cancelled embed
 *   - Participants ephemeral embed
 *   - Info ephemeral embed
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

// Design tokens
const COLOR_ACTIVE    = 0xFEE75C; // Yellow
const COLOR_ENDED     = 0x57F287; // Green
const COLOR_CANCELLED = 0xED4245; // Red
const COLOR_INFO      = 0x5865F2; // Blurple

// ---------------------------------------------------------------------------
// Active giveaway panel
// ---------------------------------------------------------------------------

/**
 * Build the main giveaway embed shown in the giveaway channel.
 * @param {object} giveaway
 * @returns {EmbedBuilder}
 */
export function buildGiveawayEmbed(giveaway) {
  const endsAtSec = Math.floor(giveaway.endsAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACTIVE)
    .setTitle(`🎉  GIVEAWAY`)
    .setDescription(`**${giveaway.prize}**`)
    .addFields(
      { name: '🏆  Pemenang',    value: `**${giveaway.winnerCount}** orang`,              inline: true },
      { name: '👤  Host',        value: `<@${giveaway.hostId}>`,                           inline: true },
      { name: '👥  Peserta',     value: `**${giveaway.participants.length}** orang`,       inline: true },
      { name: '⏰  Berakhir',    value: `<t:${endsAtSec}:R>  ·  <t:${endsAtSec}:f>`,     inline: false },
    )
    .setFooter({ text: `Tekan 🎉 untuk ikut  ·  ID: ${giveaway.id}` })
    .setTimestamp(new Date(giveaway.createdAt));

  if (giveaway.requiredRoleId) {
    embed.addFields({ name: '🔒  Role Wajib', value: `<@&${giveaway.requiredRoleId}>`, inline: true });
  }

  return embed;
}

/**
 * Build the action-row buttons for an active giveaway panel.
 * @param {object} giveaway
 * @returns {ActionRowBuilder[]}
 */
export function buildGiveawayComponents(giveaway) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw1:${giveaway.id}:join`)
      .setLabel('Ikut Giveaway')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`gw1:${giveaway.id}:participants`)
      .setLabel('Peserta')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gw1:${giveaway.id}:info`)
      .setLabel('Info')
      .setEmoji('ℹ️')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row];
}

// ---------------------------------------------------------------------------
// Ended giveaway panel
// ---------------------------------------------------------------------------

/**
 * Build the embed shown after a giveaway ends (or is rerolled).
 * @param {object} giveaway
 * @param {string[]} winners  - Winner user IDs
 * @returns {EmbedBuilder}
 */
export function buildGiveawayEndedEmbed(giveaway, winners) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_ENDED)
    .setTitle(`🎊  GIVEAWAY SELESAI`)
    .setDescription(`**${giveaway.prize}**`)
    .setFooter({ text: `ID: ${giveaway.id}` })
    .setTimestamp();

  if (winners.length === 0) {
    embed.addFields({
      name: '❌  Tidak Ada Pemenang',
      value: 'Peserta tidak mencukupi untuk menentukan pemenang. Giveaway berakhir tanpa pemenang.',
      inline: false,
    });
  } else {
    const winnerMentions = winners.map((id) => `<@${id}>`).join(', ');
    embed.addFields(
      { name: '🏆  Pemenang',       value: winnerMentions,                               inline: false },
      { name: '👤  Host',           value: `<@${giveaway.hostId}>`,                       inline: true },
      { name: '👥  Total Peserta',  value: `**${giveaway.participants.length}** orang`,   inline: true },
    );
  }

  return embed;
}

// ---------------------------------------------------------------------------
// Cancelled giveaway panel
// ---------------------------------------------------------------------------

/**
 * Build the embed shown after a giveaway is cancelled.
 * @param {object} giveaway
 * @returns {EmbedBuilder}
 */
export function buildGiveawayCancelledEmbed(giveaway) {
  return new EmbedBuilder()
    .setColor(COLOR_CANCELLED)
    .setTitle(`❌  GIVEAWAY DIBATALKAN`)
    .setDescription(`**${giveaway.prize}**`)
    .addFields({ name: '👤  Host', value: `<@${giveaway.hostId}>`, inline: true })
    .setFooter({ text: `ID: ${giveaway.id}` })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Ephemeral: Participants list
// ---------------------------------------------------------------------------

/**
 * Build the ephemeral embed listing current participants.
 * @param {object} giveaway
 * @returns {EmbedBuilder}
 */
export function buildParticipantsEmbed(giveaway) {
  const count = giveaway.participants.length;

  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle(`👥  Peserta Giveaway — ${giveaway.prize}`)
    .setFooter({ text: `Total: ${count} peserta  ·  ID: ${giveaway.id}` });

  if (count === 0) {
    embed.setDescription('Belum ada peserta. Jadilah yang pertama menekan 🎉!');
  } else {
    const first10 = giveaway.participants.slice(0, 10).map((id) => `• <@${id}>`).join('\n');
    const extra   = count > 10 ? `\n\n... dan **${count - 10}** peserta lainnya.` : '';
    embed.setDescription(first10 + extra);
  }

  return embed;
}

// ---------------------------------------------------------------------------
// Ephemeral: Info
// ---------------------------------------------------------------------------

/**
 * Build the ephemeral embed showing full giveaway info.
 * @param {object} giveaway
 * @returns {EmbedBuilder}
 */
export function buildInfoEmbed(giveaway) {
  const endsAtSec    = Math.floor(giveaway.endsAt    / 1000);
  const createdAtSec = Math.floor(giveaway.createdAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle(`ℹ️  Info Giveaway`)
    .setDescription(`**${giveaway.prize}**`)
    .addFields(
      { name: '👤  Host',         value: `<@${giveaway.hostId}>`,                          inline: true },
      { name: '🏆  Pemenang',     value: `**${giveaway.winnerCount}** orang`,              inline: true },
      { name: '👥  Peserta',      value: `**${giveaway.participants.length}** orang`,       inline: true },
      { name: '📅  Dibuat',       value: `<t:${createdAtSec}:f>`,                          inline: true },
      { name: '⏰  Berakhir',     value: `<t:${endsAtSec}:R>`,                             inline: true },
      { name: '🔖  Status',       value: giveaway.status === 'active' ? '🟢 Aktif' : giveaway.status === 'ended' ? '✅ Selesai' : '❌ Dibatalkan', inline: true },
    )
    .setFooter({ text: `ID: ${giveaway.id}` });

  if (giveaway.requiredRoleId) {
    embed.addFields({ name: '🔒  Role Wajib', value: `<@&${giveaway.requiredRoleId}>`, inline: true });
  }
  if (giveaway.mentionRoleId) {
    embed.addFields({ name: '📢  Mention Role', value: `<@&${giveaway.mentionRoleId}>`, inline: true });
  }

  return embed;
}
