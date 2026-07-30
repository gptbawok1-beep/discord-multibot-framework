/**
 * Plugin: 📁 Channel Manager
 *
 * Full implementation of all Channel Manager buttons:
 *   💾 Backup Channels — snapshot full Discord structure to persistent config
 *   ♻️  Restore        — recreate structure from a saved backup (preview first)
 *   🏗️  Generate       — paste a structure, parse it, preview, create channels
 *   📋  Clone          — copy a channel or category with its children
 *   ✏️  Rename         — rename any channel or category via modal
 *   🗑️  Delete         — delete a channel with a confirmation step
 *   👁️  Preview        — view the current server channel structure
 *
 * Uses: Shared Config (updateSection / loadGuildConfig) — no new systems.
 * Required permission: Manage Channels
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { Colors, DIVIDER, buildNavRow } from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BACKUPS          = 5;
const MAX_DISCORD_CHANNELS = 500;

// Emoji sets used for flexible parsing
const CATEGORY_EMOJIS = ['📂', '📁', '🗂️', '🗂', '📋', '📌', '🔷', '🔹', '🔸', '🔶', '⭐', '🌟', '✨', '💠', '🏷️', '🏷'];
const VOICE_EMOJIS    = ['🔊', '🎵', '🎶', '🎤', '🎧', '📻', '🔈', '🔉', '🔔', '🎙️', '🎙', '🎚️', '🎚', '🎛️', '🎛'];
const STAGE_EMOJIS    = ['🎭', '🎪', '🎬', '📢', '📣'];

// ─── Helpers: Structure snapshot ─────────────────────────────────────────────

/** Serialize a channel's permission overwrites to plain objects. */
function serializeOverwrites(channel) {
  return channel.permissionOverwrites.cache.map((ow) => ({
    id:    ow.id,
    type:  ow.type,
    allow: ow.allow.bitfield.toString(),
    deny:  ow.deny.bitfield.toString(),
  }));
}

/** Serialize a single channel to a plain object. */
function serializeChannel(ch) {
  const base = {
    name:                ch.name,
    position:            ch.rawPosition,
    permissionOverwrites: serializeOverwrites(ch),
  };
  if (ch.type === ChannelType.GuildText) {
    return {
      ...base,
      type:             'TEXT',
      topic:            ch.topic ?? null,
      rateLimitPerUser: ch.rateLimitPerUser ?? 0,
      nsfw:             ch.nsfw ?? false,
    };
  }
  if (ch.type === ChannelType.GuildVoice) {
    return { ...base, type: 'VOICE', bitrate: ch.bitrate ?? 64000, userLimit: ch.userLimit ?? 0 };
  }
  if (ch.type === ChannelType.GuildStageVoice) {
    return { ...base, type: 'STAGE', bitrate: ch.bitrate ?? 64000, userLimit: ch.userLimit ?? 0 };
  }
  return { ...base, type: 'TEXT' };
}

/**
 * Take a full snapshot of the guild's channel structure.
 * Returns an array of entries: orphan channels first, then categories (with children).
 */
function snapshotStructure(guild) {
  const structure = [];

  // Orphan channels (no parent category)
  const orphans = [...guild.channels.cache.values()]
    .filter((c) =>
      !c.parentId &&
      [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
    )
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const ch of orphans) structure.push(serializeChannel(ch));

  // Categories with their children
  const categories = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const cat of categories) {
    const children = [...guild.channels.cache.values()]
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.rawPosition - b.rawPosition);

    structure.push({
      type:                'CATEGORY',
      name:                cat.name,
      position:            cat.rawPosition,
      permissionOverwrites: serializeOverwrites(cat),
      channels:            children.map(serializeChannel),
    });
  }

  return structure;
}

// ─── Helpers: Count structure entries ────────────────────────────────────────

function countStructure(structure) {
  let categories = 0, text = 0, voice = 0, stage = 0;
  for (const entry of structure) {
    if (entry.type === 'CATEGORY') {
      categories++;
      for (const ch of (entry.channels ?? [])) {
        if (ch.type === 'TEXT')  text++;
        else if (ch.type === 'VOICE') voice++;
        else if (ch.type === 'STAGE') stage++;
      }
    } else {
      if (entry.type === 'TEXT')  text++;
      else if (entry.type === 'VOICE') voice++;
      else if (entry.type === 'STAGE') stage++;
    }
  }
  return { categories, text, voice, stage };
}

// ─── Helpers: Flexible structure parser ──────────────────────────────────────

/**
 * Strip emoji characters from a string.
 * Uses Unicode property escape — valid in Node.js 10+ with ESM / modern V8.
 */
function stripEmojis(str) {
  // eslint-disable-next-line no-misleading-character-class
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, '').trim();
}

/**
 * Sanitize a text-channel name: lowercase, spaces → dashes, remove invalid chars.
 * Voice/stage names are kept as-is (Discord is more lenient there).
 */
function sanitizeChannelName(name, type = 'text') {
  const clean = name.trim().slice(0, 100);
  if (type !== 'text') return clean || 'channel';
  return (clean.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '') || 'channel');
}

/**
 * Parse a pasted channel structure into a normalized structure array.
 * Handles emoji-prefixed, keyword-prefixed (CATEGORY:/TEXT:/VOICE:), and plain text formats.
 * Tolerates bullets, numbers, extra spaces, mixed case.
 */
function parseStructure(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const structure = [];
  let currentCategory = null;

  for (const rawLine of lines) {
    // Strip common bullets / numbering
    let line = rawLine
      .replace(/^[-•*▪▫·→►>]+\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .trim();
    if (!line) continue;

    // ── Keyword format ──────────────────────────────────────────────────────
    const kwCategory = line.match(/^(?:CATEGORY|KATEGORI|CAT)\s*:\s*(.+)/i);
    if (kwCategory) {
      const name = kwCategory[1].trim();
      currentCategory = { type: 'CATEGORY', name, position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory);
      continue;
    }

    const kwVoice = line.match(/^(?:VOICE|SUARA|VC|VOICE[\s_]CHANNEL)\s*[:#]?\s*(.+)/i);
    if (kwVoice) {
      const name = kwVoice[1].replace(/^#+\s*/, '').trim();
      const ch   = makeVoiceEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch);
      else structure.push(ch);
      continue;
    }

    const kwStage = line.match(/^STAGE\s*[:#]?\s*(.+)/i);
    if (kwStage) {
      const name = kwStage[1].replace(/^#+\s*/, '').trim();
      const ch   = makeStageEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch);
      else structure.push(ch);
      continue;
    }

    const kwText = line.match(/^(?:TEXT|TEKS|TXT|#)\s*[:#]?\s*(.+)/i);
    if (kwText) {
      const name = sanitizeChannelName(kwText[1].trim(), 'text');
      const ch   = makeTextEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch);
      else structure.push(ch);
      continue;
    }

    // ── Emoji-prefix format ─────────────────────────────────────────────────
    const hasStageEmoji    = STAGE_EMOJIS.some((e) => line.includes(e));
    const hasVoiceEmoji    = VOICE_EMOJIS.some((e) => line.includes(e));
    const hasCategoryEmoji = CATEGORY_EMOJIS.some((e) => line.startsWith(e));

    if (hasCategoryEmoji) {
      let name = line;
      for (const e of CATEGORY_EMOJIS) name = name.split(e).join('');
      name = name.trim();
      if (!name) continue;
      currentCategory = { type: 'CATEGORY', name, position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory);
      continue;
    }

    if (hasStageEmoji) {
      let name = line;
      for (const e of STAGE_EMOJIS) name = name.split(e).join('');
      name = name.replace(/^#+\s*/, '').trim();
      if (!name) continue;
      const ch = makeStageEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch);
      else structure.push(ch);
      continue;
    }

    if (hasVoiceEmoji) {
      let name = line;
      for (const e of VOICE_EMOJIS) name = name.split(e).join('');
      name = name.replace(/^#+\s*/, '').trim();
      if (!name) continue;
      const ch = makeVoiceEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch);
      else structure.push(ch);
      continue;
    }

    // ── Heuristic: ALL CAPS line without # prefix → treat as category ───────
    const stripped = stripEmojis(line);
    const isAllCaps = /^[A-Z0-9\s\-_,.'&!|]{3,}$/.test(stripped) && !line.startsWith('#');
    if (isAllCaps && !line.startsWith('#')) {
      currentCategory = { type: 'CATEGORY', name: stripped.trim(), position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory);
      continue;
    }

    // ── Default: text channel ───────────────────────────────────────────────
    let name = line.replace(/^#+\s*/, '');
    // Remove any stray leading emojis
    name = name.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]+\s*/gu, '').trim();
    if (!name) continue;
    const ch = makeTextEntry(sanitizeChannelName(name, 'text'), currentCategory);
    if (currentCategory) currentCategory.channels.push(ch);
    else structure.push(ch);
  }

  return structure;
}

function makeTextEntry(name, ctx) {
  return { type: 'TEXT',  name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], topic: null, rateLimitPerUser: 0, nsfw: false };
}
function makeVoiceEntry(name, ctx) {
  return { type: 'VOICE', name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], bitrate: 64000, userLimit: 0 };
}
function makeStageEntry(name, ctx) {
  return { type: 'STAGE', name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], bitrate: 64000, userLimit: 0 };
}

// ─── Helpers: Conflict detection ─────────────────────────────────────────────

/** Return list of names in the structure that already exist in the guild. */
function detectConflicts(structure, guild) {
  const existing = new Set([...guild.channels.cache.values()].map((c) => c.name.toLowerCase()));
  const conflicts = [];
  for (const entry of structure) {
    if (existing.has(entry.name.toLowerCase())) conflicts.push(entry.name);
    for (const ch of (entry.channels ?? [])) {
      if (existing.has(ch.name.toLowerCase())) conflicts.push(ch.name);
    }
  }
  return conflicts;
}

// ─── Helpers: Execute channel generation ─────────────────────────────────────

/**
 * Create channels from a parsed structure.
 * conflictMode: 'skip' | 'rename' | 'replace'
 */
async function executeGenerate(guild, structure, conflictMode) {
  const results  = { categories: 0, text: 0, voice: 0, stage: 0, failed: 0, errors: [] };
  const existing = new Map([...guild.channels.cache.values()].map((c) => [c.name.toLowerCase(), c]));

  for (const entry of structure) {
    if (entry.type === 'CATEGORY') {
      let parentCategory = null;
      const existingCat  = existing.get(entry.name.toLowerCase());

      if (existingCat) {
        if (conflictMode === 'skip' || conflictMode === 'replace') {
          // Use existing category as parent — too destructive to delete
          parentCategory = existingCat;
        } else {
          // rename: add -copy suffix
          const newName = `${entry.name}-copy`;
          try {
            parentCategory = await guild.channels.create({ name: newName, type: ChannelType.GuildCategory });
            results.categories++;
            existing.set(newName.toLowerCase(), parentCategory);
          } catch (err) {
            results.failed++;
            results.errors.push(`📂 ${entry.name}: ${err.message}`);
          }
        }
      } else {
        try {
          parentCategory = await guild.channels.create({ name: entry.name, type: ChannelType.GuildCategory });
          results.categories++;
          existing.set(entry.name.toLowerCase(), parentCategory);
        } catch (err) {
          results.failed++;
          results.errors.push(`📂 ${entry.name}: ${err.message}`);
        }
      }

      for (const ch of (entry.channels ?? [])) {
        await _createOneChannel(guild, ch, parentCategory, conflictMode, existing, results);
      }
    } else {
      await _createOneChannel(guild, entry, null, conflictMode, existing, results);
    }
  }

  return results;
}

async function _createOneChannel(guild, ch, parent, conflictMode, existing, results) {
  const existingCh = existing.get(ch.name.toLowerCase());
  let finalName    = ch.name;

  if (existingCh) {
    if (conflictMode === 'skip') return;
    if (conflictMode === 'rename') {
      finalName = `${ch.name}-copy`;
    } else if (conflictMode === 'replace') {
      try { await existingCh.delete('Channel Manager: replace'); } catch { /* ignore */ }
    }
  }

  const opts = { name: finalName };
  if (parent) opts.parent = parent.id;

  if (ch.type === 'TEXT') {
    opts.type = ChannelType.GuildText;
    if (ch.topic)            opts.topic            = ch.topic;
    if (ch.rateLimitPerUser) opts.rateLimitPerUser = ch.rateLimitPerUser;
    if (ch.nsfw)             opts.nsfw             = ch.nsfw;
  } else if (ch.type === 'VOICE') {
    opts.type      = ChannelType.GuildVoice;
    if (ch.bitrate)    opts.bitrate    = ch.bitrate;
    if (ch.userLimit)  opts.userLimit  = ch.userLimit;
  } else if (ch.type === 'STAGE') {
    opts.type = ChannelType.GuildStageVoice;
  }

  try {
    const created = await guild.channels.create(opts);
    existing.set(finalName.toLowerCase(), created);
    if (ch.type === 'TEXT')  results.text++;
    else if (ch.type === 'VOICE') results.voice++;
    else if (ch.type === 'STAGE') results.stage++;
  } catch (err) {
    results.failed++;
    results.errors.push(`${ch.name}: ${err.message}`);
  }
}

// ─── Helpers: Build current structure preview text ───────────────────────────

function buildStructureText(guild) {
  const lines = [];

  const orphans = [...guild.channels.cache.values()]
    .filter((c) =>
      !c.parentId &&
      [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
    )
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const ch of orphans) {
    if (ch.type === ChannelType.GuildText)       lines.push(`#${ch.name}`);
    else if (ch.type === ChannelType.GuildVoice) lines.push(`🔊 ${ch.name}`);
    else                                          lines.push(`🎭 ${ch.name}`);
  }

  const categories = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const cat of categories) {
    lines.push(`📂 ${cat.name}`);
    const children = [...guild.channels.cache.values()]
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.rawPosition - b.rawPosition);
    for (const ch of children) {
      if (ch.type === ChannelType.GuildText)       lines.push(`   #${ch.name}`);
      else if (ch.type === ChannelType.GuildVoice) lines.push(`   🔊 ${ch.name}`);
      else                                          lines.push(`   🎭 ${ch.name}`);
    }
  }

  return lines.join('\n') || '_(Tidak ada channel)_';
}

// ─── Helper: Build result summary embed description ──────────────────────────

function buildResultDescription(results, actionLabel) {
  let desc = `✅ **${actionLabel} selesai.**\n\n`;
  desc += `📂 Kategori: **${results.categories}**\n`;
  desc += `📝 Text: **${results.text}**\n`;
  desc += `🔊 Voice: **${results.voice}**\n`;
  desc += `🎭 Stage: **${results.stage}**\n`;
  if (results.failed > 0) {
    desc += `\n❌ Gagal: **${results.failed}**\n`;
    const shown = results.errors.slice(0, 5).map((e) => `• ${e}`).join('\n');
    desc += `**Error:**\n${shown}`;
    if (results.errors.length > 5) desc += `\n_...dan ${results.errors.length - 5} lainnya_`;
  }
  desc += `\n${DIVIDER}`;
  return desc;
}

// ─── Helper: back-to-plugin-page row ─────────────────────────────────────────

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:channelmanager:cm_back')
      .setLabel('Kembali').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
  );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const plugin = {
  id:                 'channelmanager',
  label:              'Channel Manager',
  emoji:              '📁',
  description:        'Backup, restore, clone, dan kelola struktur channel.',
  order:              4,
  requiredPermission: PermissionFlagsBits.ManageChannels,

  getStatus(cfg) {
    const count = cfg.channelManager.backups?.length ?? 0;
    return {
      enabled: count > 0,
      summary: `${count} backup tersimpan`,
    };
  },

  async buildPage(cfg) {
    const backupCount = cfg.channelManager.backups?.length ?? 0;
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: '📁  Channel Manager' })
      .setDescription(`Kelola struktur channel server.\n${DIVIDER}`)
      .addFields(
        { name: '💾  Backup Tersimpan', value: `${backupCount} backup`, inline: true },
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:backup')
        .setLabel('Backup Channels').setEmoji('💾').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:restore')
        .setLabel('Restore').setEmoji('♻️').setStyle(ButtonStyle.Primary)
        .setDisabled(backupCount === 0),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:generate')
        .setLabel('Generate Structure').setEmoji('🏗️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:clone')
        .setLabel('Clone').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:rename')
        .setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:delete')
        .setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:preview')
        .setLabel('Preview Structure').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2, row3, buildNavRow()] };
  },

  // ── handleInteraction ───────────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {
    const guild = interaction.guild;

    // ── Generic back-to-page ────────────────────────────────────────────────
    if (action === 'cm_back') {
      // Clear any pending session data
      delete session.wizardData.pendingRestoreId;
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;
      delete session.wizardData.cloneChannelId;
      delete session.wizardData.deleteChannelId;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── BACKUP CHANNELS ──────────────────────────────────────────────────────
    if (action === 'backup') {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }

      await interaction.deferUpdate();

      const structure = snapshotStructure(guild);
      const id        = Date.now().toString();
      const date      = new Date().toISOString();

      const backups = [...(cfg.channelManager.backups ?? [])];
      backups.unshift({ id, date, structure });
      if (backups.length > MAX_BACKUPS) backups.splice(MAX_BACKUPS);

      await updateSection(guild.id, 'channelManager', { backups });
      const fresh  = await loadGuildConfig(guild.id);
      const page   = await plugin.buildPage(fresh);
      const counts = countStructure(structure);

      page.embed.setDescription(
        `✅ **Backup berhasil dibuat!**\n\n` +
        `📂 Kategori: **${counts.categories}**\n` +
        `📝 Text Channel: **${counts.text}**\n` +
        `🔊 Voice Channel: **${counts.voice}**\n` +
        `🎭 Stage Channel: **${counts.stage}**\n\n` +
        `ID Backup: \`${id}\`\n${DIVIDER}`
      );
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    // ── RESTORE ──────────────────────────────────────────────────────────────
    if (action === 'restore') {
      const backups = cfg.channelManager.backups ?? [];
      if (backups.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setDescription('⚠️ Belum ada backup yang tersimpan.\nGunakan **Backup Channels** terlebih dahulu.');
        return interaction.update({ embeds: [embed], components: [backRow()] });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setAuthor({ name: '♻️  Restore Channel Structure' })
        .setDescription(`Pilih backup yang ingin di-restore.\n${DIVIDER}`);

      const select = new StringSelectMenuBuilder()
        .setCustomId('setup1:channelmanager:restore_select')
        .setPlaceholder('Pilih backup...')
        .addOptions(
          backups.slice(0, 25).map((b, i) => ({
            label:       `Backup ${i + 1} — ${new Date(b.date).toLocaleString('id-ID')}`,
            value:       b.id,
            description: `ID: ${b.id}`,
          }))
        );

      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(select),
          backRow(),
        ],
      });
    }

    if (action === 'restore_select') {
      const backupId = interaction.values[0];
      const backup   = (cfg.channelManager.backups ?? []).find((b) => b.id === backupId);
      if (!backup) {
        return interaction.update({ content: '❌ Backup tidak ditemukan.', embeds: [], components: [] });
      }

      session.wizardData.pendingRestoreId = backupId;
      const counts = countStructure(backup.structure);
      const embed  = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setAuthor({ name: '♻️  Restore — Preview' })
        .setDescription(
          `**Preview struktur yang akan dibuat:**\n${DIVIDER}\n\n` +
          `📂 Kategori: **${counts.categories}**\n` +
          `📝 Text Channel: **${counts.text}**\n` +
          `🔊 Voice Channel: **${counts.voice}**\n` +
          `🎭 Stage Channel: **${counts.stage}**\n\n` +
          `⚠️ Channel yang sudah ada akan di-skip.\n${DIVIDER}\n` +
          `Tanggal backup: \`${new Date(backup.date).toLocaleString('id-ID')}\``
        );

      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:restore_confirm')
              .setLabel('Restore').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'restore_confirm') {
      const backupId = session.wizardData.pendingRestoreId;
      const backup   = (cfg.channelManager.backups ?? []).find((b) => b.id === backupId);
      if (!backup) {
        return interaction.update({ content: '❌ Backup tidak ditemukan atau sesi habis.', embeds: [], components: [] });
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }

      await interaction.deferUpdate();
      const results = await executeGenerate(guild, backup.structure, 'skip');
      delete session.wizardData.pendingRestoreId;

      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDescription(results, 'Restore'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    // ── GENERATE STRUCTURE ───────────────────────────────────────────────────
    if (action === 'generate') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:generate')
        .setTitle('🏗️ Generate Structure');

      const input = new TextInputBuilder()
        .setCustomId('structure_input')
        .setLabel('Tempel struktur channel di sini')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('📂 INFORMATION\n#rules\n#welcome\n\n📂 GENERAL\n#chat\n🔊 General')
        .setRequired(true)
        .setMaxLength(2000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === 'generate_confirm') {
      const structure    = session.wizardData.generateStructure;
      const conflictMode = session.wizardData.generateConflictMode ?? 'skip';
      if (!structure) {
        return interaction.update({ content: '❌ Sesi habis. Silakan tekan Generate lagi.', embeds: [], components: [] });
      }
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }

      await interaction.deferUpdate();
      const results = await executeGenerate(guild, structure, conflictMode);
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;

      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDescription(results, 'Generate'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    // Conflict resolution buttons: generate_conflict_skip / rename / replace
    if (action.startsWith('generate_conflict_')) {
      const mode      = action.replace('generate_conflict_', ''); // 'skip' | 'rename' | 'replace'
      const structure = session.wizardData.generateStructure;
      if (!structure) {
        return interaction.update({ content: '❌ Sesi habis. Silakan tekan Generate lagi.', embeds: [], components: [] });
      }
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }

      await interaction.deferUpdate();
      const results = await executeGenerate(guild, structure, mode);
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;

      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDescription(results, 'Generate'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    if (action === 'generate_cancel') {
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── CLONE ────────────────────────────────────────────────────────────────
    if (action === 'clone') {
      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setAuthor({ name: '📋  Clone Channel atau Kategori' })
        .setDescription(`Pilih channel atau kategori yang ingin di-clone.\n${DIVIDER}`);

      const select = new ChannelSelectMenuBuilder()
        .setCustomId('setup1:channelmanager:clone_select')
        .setPlaceholder('Pilih channel atau kategori...')
        .setMinValues(1).setMaxValues(1);

      return interaction.update({
        embeds:     [embed],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    if (action === 'clone_select') {
      const channelId = interaction.values[0];
      session.wizardData.cloneChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      }

      const typeName = {
        [ChannelType.GuildCategory]:   'Kategori',
        [ChannelType.GuildVoice]:      'Voice Channel',
        [ChannelType.GuildStageVoice]: 'Stage Channel',
      }[channel.type] ?? 'Text Channel';

      const childCount = channel.type === ChannelType.GuildCategory
        ? [...guild.channels.cache.values()].filter((c) => c.parentId === channel.id).length
        : 0;

      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setAuthor({ name: '📋  Clone — Konfirmasi' })
        .setDescription(
          `Konfirmasi clone:\n${DIVIDER}\n\n` +
          `**${typeName}:** \`${channel.name}\`\n` +
          `**Nama salinan:** \`${channel.name}-copy\`\n` +
          (childCount > 0 ? `**Channel di dalamnya:** ${childCount} (ikut di-clone)\n\n` : '\n') +
          `Klik **Clone** untuk membuat salinan.`
        );

      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:clone_confirm')
              .setLabel('Clone').setEmoji('📋').setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'clone_confirm') {
      const channelId = session.wizardData.cloneChannelId;
      if (!channelId) {
        return interaction.update({ content: '❌ Tidak ada channel yang dipilih.', embeds: [], components: [] });
      }
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }

      await interaction.deferUpdate();
      try {
        const copyName = `${channel.name}-copy`;

        if (channel.type === ChannelType.GuildCategory) {
          const newCat   = await guild.channels.create({ name: copyName, type: ChannelType.GuildCategory });
          const children = [...guild.channels.cache.values()]
            .filter((c) => c.parentId === channel.id)
            .sort((a, b) => a.rawPosition - b.rawPosition);
          let cloned = 0;
          for (const child of children) {
            const opts = { name: child.name, parent: newCat.id, type: child.type };
            if (child.type === ChannelType.GuildText) {
              if (child.topic) opts.topic = child.topic;
              opts.rateLimitPerUser = child.rateLimitPerUser;
              opts.nsfw             = child.nsfw;
            } else if (child.type === ChannelType.GuildVoice) {
              opts.bitrate    = child.bitrate;
              opts.userLimit  = child.userLimit;
            }
            await guild.channels.create(opts).catch(() => null);
            cloned++;
          }
          delete session.wizardData.cloneChannelId;
          const fresh = await loadGuildConfig(guild.id);
          const page  = await plugin.buildPage(fresh);
          page.embed.setDescription(
            `✅ **Kategori \`${channel.name}\` berhasil di-clone.**\n\n` +
            `Nama baru: \`${copyName}\` (${cloned} channel)\n${DIVIDER}`
          );
          return interaction.editReply({ embeds: [page.embed], components: page.components });
        } else {
          const opts = { name: copyName, type: channel.type };
          if (channel.parentId) opts.parent = channel.parentId;
          if (channel.type === ChannelType.GuildText) {
            if (channel.topic) opts.topic = channel.topic;
            opts.rateLimitPerUser = channel.rateLimitPerUser;
            opts.nsfw             = channel.nsfw;
          } else if (channel.type === ChannelType.GuildVoice) {
            opts.bitrate   = channel.bitrate;
            opts.userLimit = channel.userLimit;
          }
          await guild.channels.create(opts);
          delete session.wizardData.cloneChannelId;
          const fresh = await loadGuildConfig(guild.id);
          const page  = await plugin.buildPage(fresh);
          page.embed.setDescription(
            `✅ **Channel \`${channel.name}\` berhasil di-clone.**\n\nNama baru: \`${copyName}\`\n${DIVIDER}`
          );
          return interaction.editReply({ embeds: [page.embed], components: page.components });
        }
      } catch (err) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder().setColor(Colors.ERROR)
              .setTitle('❌  Clone Gagal')
              .setDescription(`Gagal meng-clone channel: ${err.message}`)
          ],
          components: [buildNavRow()],
        });
      }
    }

    // ── RENAME ───────────────────────────────────────────────────────────────
    if (action === 'rename') {
      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setAuthor({ name: '✏️  Rename Channel' })
        .setDescription(`Pilih channel yang ingin di-rename.\n${DIVIDER}`);

      const select = new ChannelSelectMenuBuilder()
        .setCustomId('setup1:channelmanager:rename_select')
        .setPlaceholder('Pilih channel...')
        .setMinValues(1).setMaxValues(1);

      return interaction.update({
        embeds:     [embed],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    if (action === 'rename_select') {
      const channelId = interaction.values[0];
      session.wizardData.renameChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      }

      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:rename')
        .setTitle(`✏️ Rename — ${channel.name.slice(0, 40)}`);

      const input = new TextInputBuilder()
        .setCustomId('rename_input')
        .setLabel('Nama baru')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Masukkan nama baru...')
        .setValue(channel.name)
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Delete Channel' })
        .setDescription(`Pilih channel yang ingin dihapus.\n${DIVIDER}\n⚠️ **Tindakan ini tidak dapat dibatalkan.**`);

      const select = new ChannelSelectMenuBuilder()
        .setCustomId('setup1:channelmanager:delete_select')
        .setPlaceholder('Pilih channel...')
        .setMinValues(1).setMaxValues(1);

      return interaction.update({
        embeds:     [embed],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    if (action === 'delete_select') {
      const channelId = interaction.values[0];
      session.wizardData.deleteChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      }

      const typeName = {
        [ChannelType.GuildCategory]:   'Kategori',
        [ChannelType.GuildVoice]:      'Voice Channel',
        [ChannelType.GuildStageVoice]: 'Stage Channel',
      }[channel.type] ?? 'Text Channel';

      const childCount = channel.type === ChannelType.GuildCategory
        ? [...guild.channels.cache.values()].filter((c) => c.parentId === channel.id).length
        : 0;

      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Delete — Konfirmasi' })
        .setDescription(
          `⚠️ **Yakin ingin menghapus?**\n${DIVIDER}\n\n` +
          `**${typeName}:** \`${channel.name}\`\n` +
          (childCount > 0
            ? `**Channel di dalamnya:** ${childCount} _(tidak ikut terhapus secara otomatis)_\n\n`
            : '\n') +
          `**Tindakan ini tidak dapat dibatalkan!**`
        );

      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:delete_confirm')
              .setLabel('Hapus').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'delete_confirm') {
      const channelId = session.wizardData.deleteChannelId;
      if (!channelId) {
        return interaction.update({ content: '❌ Tidak ada channel yang dipilih.', embeds: [], components: [] });
      }
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        delete session.wizardData.deleteChannelId;
        return interaction.update({ content: '❌ Channel tidak ditemukan atau sudah dihapus.', embeds: [], components: [] });
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }

      await interaction.deferUpdate();
      try {
        const deletedName = channel.name;
        await channel.delete('Channel Manager: user deleted');
        delete session.wizardData.deleteChannelId;
        const fresh = await loadGuildConfig(guild.id);
        const page  = await plugin.buildPage(fresh);
        page.embed.setDescription(`✅ **Channel \`${deletedName}\` berhasil dihapus.**\n${DIVIDER}`);
        return interaction.editReply({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder().setColor(Colors.ERROR)
              .setTitle('❌  Delete Gagal')
              .setDescription(`Gagal menghapus channel: ${err.message}`)
          ],
          components: [buildNavRow()],
        });
      }
    }

    // ── PREVIEW STRUCTURE ────────────────────────────────────────────────────
    if (action === 'preview') {
      const structureText = buildStructureText(guild);

      // Split into lines and chunk to fit embed limits (description max 4096 chars)
      const MAX_CHUNK = 1800;
      const lines     = structureText.split('\n');
      const chunks    = [];
      let   current   = '';

      for (const line of lines) {
        const candidate = current ? current + '\n' + line : line;
        if (candidate.length > MAX_CHUNK) {
          if (current) chunks.push(current);
          current = line;
        } else {
          current = candidate;
        }
      }
      if (current) chunks.push(current);

      const embed = new EmbedBuilder()
        .setColor(Colors.NEUTRAL)
        .setAuthor({ name: '👁️  Preview Structure Saat Ini' })
        .setDescription(`Struktur channel server:\n${DIVIDER}\n\`\`\`\n${chunks[0] ?? '_(Kosong)_'}\n\`\`\``);

      // Add overflow chunks as fields (max 4 total blocks)
      for (const chunk of chunks.slice(1, 3)) {
        embed.addFields({ name: '\u200b', value: `\`\`\`\n${chunk}\n\`\`\`` });
      }
      if (chunks.length > 4) {
        embed.addFields({ name: '\u200b', value: `_... (terlalu panjang, ditampilkan sebagian)_` });
      }

      return interaction.update({
        embeds:     [embed],
        components: [backRow()],
      });
    }
  },

  // ── handleModal ──────────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {
    const guild = interaction.guild;

    // ── Generate structure modal ────────────────────────────────────────────
    if (field === 'generate') {
      const text      = interaction.fields.getTextInputValue('structure_input');
      const structure = parseStructure(text);

      if (structure.length === 0) {
        return interaction.reply({
          content:   '❌ Tidak ada struktur yang bisa diparsing. Pastikan formatnya benar (contoh: `📂 GENERAL` diikuti `#chat`).',
          ephemeral: true,
        });
      }

      // Validate total channel count against Discord limit
      const counts           = countStructure(structure);
      const total            = counts.categories + counts.text + counts.voice + counts.stage;
      const currentTotal     = guild.channels.cache.size;
      if (currentTotal + total > MAX_DISCORD_CHANNELS) {
        return interaction.reply({
          content:   `❌ Jumlah channel akan melebihi batas Discord (500).\nServer sudah memiliki **${currentTotal}** channel, akan menambah **${total}** lagi (total ${currentTotal + total}).`,
          ephemeral: true,
        });
      }

      // Check bot permission
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content:   '❌ Bot tidak memiliki izin **Manage Channels**.',
          ephemeral: true,
        });
      }

      // Store for later confirmation
      session.wizardData.generateStructure    = structure;
      session.wizardData.generateConflictMode = 'skip';

      const conflicts = detectConflicts(structure, guild);

      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setAuthor({ name: '🏗️  Generate Structure — Preview' })
        .setDescription(`**Struktur berhasil diparsing.**\n${DIVIDER}`)
        .addFields(
          { name: '📂 Kategori',     value: `${counts.categories}`, inline: true },
          { name: '📝 Text Channel', value: `${counts.text}`,       inline: true },
          { name: '🔊 Voice Channel', value: `${counts.voice}`,     inline: true },
          { name: '🎭 Stage Channel', value: `${counts.stage}`,     inline: true },
        );

      if (conflicts.length > 0) {
        const shown = conflicts.slice(0, 10).map((n) => `\`${n}\``).join(', ');
        embed.addFields({
          name:  `⚠️  ${conflicts.length} Konflik Ditemukan`,
          value: `Channel berikut sudah ada: ${shown}${conflicts.length > 10 ? ` _+${conflicts.length - 10} lainnya_` : ''}\n\nPilih cara penanganan:`,
        });

        return interaction.update({
          embeds:     [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('setup1:channelmanager:generate_conflict_skip')
                .setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('setup1:channelmanager:generate_conflict_rename')
                .setLabel('Rename Otomatis').setEmoji('✏️').setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('setup1:channelmanager:generate_conflict_replace')
                .setLabel('Replace').setEmoji('♻️').setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('setup1:channelmanager:generate_cancel')
                .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
      }

      // No conflicts — show Generate / Cancel
      embed.addFields({ name: '✅  Semua struktur berhasil dipahami', value: 'Tekan **Generate** untuk membuat channel.' });
      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:generate_confirm')
              .setLabel('Generate').setEmoji('🏗️').setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('setup1:channelmanager:generate_cancel')
              .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Rename modal ────────────────────────────────────────────────────────
    if (field === 'rename') {
      const newName   = interaction.fields.getTextInputValue('rename_input').trim();
      const channelId = session.wizardData.renameChannelId;

      if (!channelId) {
        return interaction.reply({ content: '❌ Sesi habis. Silakan tekan Rename lagi.', ephemeral: true });
      }
      if (!newName || newName.length > 100) {
        return interaction.reply({ content: '❌ Nama channel tidak valid (1–100 karakter).', ephemeral: true });
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        delete session.wizardData.renameChannelId;
        return interaction.reply({ content: '❌ Channel tidak ditemukan.', ephemeral: true });
      }

      try {
        const oldName = channel.name;
        await channel.setName(newName, 'Channel Manager: rename');
        delete session.wizardData.renameChannelId;
        const fresh = await loadGuildConfig(guild.id);
        const page  = await plugin.buildPage(fresh);
        page.embed.setDescription(
          `✅ **Channel berhasil di-rename.**\n\n\`${oldName}\` → \`${newName}\`\n${DIVIDER}`
        );
        return interaction.update({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.reply({ content: `❌ Gagal rename channel: ${err.message}`, ephemeral: true });
      }
    }
  },
};

export default plugin;
