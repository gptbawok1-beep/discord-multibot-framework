/**
 * Bot 1 — Feature: Welcome & Goodbye
 *
 * Runtime handler: sends a welcome embed when a member joins,
 * and a goodbye embed when a member leaves.
 * Called by the guildMemberAdd and guildMemberRemove events.
 */

import { EmbedBuilder } from 'discord.js';
import { loadGuildConfig } from '../../setup/config.js';
import { createLogger } from '../../../../shared/logger/index.js';

const logger = createLogger('BOT1');

function replacePlaceholders(str, vars) {
  return str
    .replace(/\{user\}/g,        vars.user        ?? '')
    .replace(/\{mention\}/g,     vars.mention      ?? '')
    .replace(/\{server\}/g,      vars.server       ?? '')
    .replace(/\{memberCount\}/g, vars.memberCount   ?? '?');
}

// ── Welcome embed ─────────────────────────────────────────────────────────────

export function buildWelcomeEmbed(member, cfg) {
  const w    = cfg.welcome;
  const vars = {
    user:        member.user.username,
    mention:     member.toString(),
    server:      member.guild.name,
    memberCount: String(member.guild.memberCount ?? '?'),
  };

  const rawColor = (w.embed?.color ?? '#5865F2').replace('#', '');
  const color    = parseInt(rawColor, 16);

  const title = replacePlaceholders(w.embed?.title || 'Selamat Datang, {user}!', vars);
  const desc  = replacePlaceholders(
    w.embed?.description || '{mention} bergabung ke **{server}**!',
    vars,
  );

  const embed = new EmbedBuilder()
    .setColor(isNaN(color) ? 0x5865F2 : color)
    .setTitle(title)
    .setDescription(desc)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));

  if (w.gif)        embed.setImage(w.gif);
  else if (w.image) embed.setImage(w.image);

  return embed;
}

// ── Goodbye embed ─────────────────────────────────────────────────────────────

export function buildGoodbyeEmbed(member, cfg) {
  const w  = cfg.welcome;
  const gb = w.goodbye ?? {};

  const vars = {
    user:        member.user.username,
    mention:     `<@${member.user.id}>`,
    server:      member.guild.name,
    memberCount: String(member.guild.memberCount ?? '?'),
  };

  const rawColor = (gb.embed?.color ?? w.embed?.color ?? '#5865F2').replace('#', '');
  const color    = parseInt(rawColor, 16);

  const title = replacePlaceholders(
    gb.embed?.title || 'Selamat Tinggal, {user}!',
    vars,
  );
  const desc = replacePlaceholders(
    gb.embed?.description || '{mention} telah meninggalkan **{server}**.',
    vars,
  );

  const embed = new EmbedBuilder()
    .setColor(isNaN(color) ? 0x5865F2 : color)
    .setTitle(title)
    .setDescription(desc)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));

  if (gb.gif)        embed.setImage(gb.gif);
  else if (gb.image) embed.setImage(gb.image);

  return embed;
}

// ── Event handlers ────────────────────────────────────────────────────────────

export async function onGuildMemberAdd(member) {
  const cfg = await loadGuildConfig(member.guild.id);
  const w   = cfg?.welcome;

  if (!w?.enabled)   return;
  if (!w?.channelId) return;

  const channel = await member.guild.channels.fetch(w.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    logger.warn(`[Welcome] Channel ${w.channelId} not found or not a text channel in guild ${member.guild.id}`);
    return;
  }

  const embed = buildWelcomeEmbed(member, cfg);
  await channel.send({ embeds: [embed] });
  logger.info(`[Welcome] Sent welcome for ${member.user.username} in guild ${member.guild.id}`);
}

export async function onGuildMemberRemove(member) {
  const cfg = await loadGuildConfig(member.guild.id);
  const w   = cfg?.welcome;

  if (!w?.enabled)   return;
  if (!w?.channelId) return;

  const channel = await member.guild.channels.fetch(w.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    logger.warn(`[Goodbye] Channel ${w.channelId} not found or not a text channel in guild ${member.guild.id}`);
    return;
  }

  const embed = buildGoodbyeEmbed(member, cfg);
  await channel.send({ embeds: [embed] });
  logger.info(`[Goodbye] Sent goodbye for ${member.user.username} in guild ${member.guild.id}`);
}
