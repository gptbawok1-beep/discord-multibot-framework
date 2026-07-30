/**
 * Plugin: 📁 Channel Manager
 *
 * Buttons:
 *   💾 Backup Channels   — named snapshot of full Discord structure → persistent config
 *   ⚙️  Kelola Backup    — list, rename, delete saved backups
 *   ♻️  Restore          — recreate structure from backup (preview first)
 *   🏗️  Generate         — paste structure text, parse, preview, create channels
 *   📋  Clone            — copy a channel or category with its children
 *   ✏️  Rename           — rename any channel or category via modal
 *   🗑️  Delete           — single or bulk delete with double confirmation
 *   👁️  Preview          — view the current server channel structure
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

const MAX_BACKUPS          = 10;
const MAX_DISCORD_CHANNELS = 500;

// Emoji sets for flexible structure parsing
const CATEGORY_EMOJIS = ['📂', '📁', '🗂️', '🗂', '📋', '📌', '🔷', '🔹', '🔸', '🔶', '⭐', '🌟', '✨', '💠', '🏷️', '🏷'];
const VOICE_EMOJIS    = ['🔊', '🎵', '🎶', '🎤', '🎧', '📻', '🔈', '🔉', '🔔', '🎙️', '🎙', '🎚️', '🎚', '🎛️', '🎛'];
const STAGE_EMOJIS    = ['🎭', '🎪', '🎬', '📢', '📣'];

// ─── Helpers: Date / naming ───────────────────────────────────────────────────

/** Format ISO date string to Indonesian locale. */
function fmtDate(iso) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Default backup name: Backup-YYYY-MM-DD-HH-mm */
function defaultBackupName() {
  const now = new Date();
  const pad  = (n) => String(n).padStart(2, '0');
  return `Backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

// ─── Helpers: Structure snapshot ─────────────────────────────────────────────

function serializeOverwrites(channel) {
  return channel.permissionOverwrites.cache.map((ow) => ({
    id:    ow.id,
    type:  ow.type,
    allow: ow.allow.bitfield.toString(),
    deny:  ow.deny.bitfield.toString(),
  }));
}

function serializeChannel(ch) {
  const base = {
    name:                ch.name,
    position:            ch.rawPosition,
    permissionOverwrites: serializeOverwrites(ch),
  };
  if (ch.type === ChannelType.GuildText) {
    return { ...base, type: 'TEXT', topic: ch.topic ?? null, rateLimitPerUser: ch.rateLimitPerUser ?? 0, nsfw: ch.nsfw ?? false };
  }
  if (ch.type === ChannelType.GuildVoice) {
    return { ...base, type: 'VOICE', bitrate: ch.bitrate ?? 64000, userLimit: ch.userLimit ?? 0 };
  }
  if (ch.type === ChannelType.GuildStageVoice) {
    return { ...base, type: 'STAGE', bitrate: ch.bitrate ?? 64000, userLimit: ch.userLimit ?? 0 };
  }
  return { ...base, type: 'TEXT' };
}

function snapshotStructure(guild) {
  const structure = [];

  const orphans = [...guild.channels.cache.values()]
    .filter((c) => !c.parentId && [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition);
  for (const ch of orphans) structure.push(serializeChannel(ch));

  const categories = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const cat of categories) {
    const children = [...guild.channels.cache.values()]
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.rawPosition - b.rawPosition);
    structure.push({
      type: 'CATEGORY', name: cat.name, position: cat.rawPosition,
      permissionOverwrites: serializeOverwrites(cat),
      channels: children.map(serializeChannel),
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
        if (ch.type === 'TEXT') text++;
        else if (ch.type === 'VOICE') voice++;
        else if (ch.type === 'STAGE') stage++;
      }
    } else {
      if (entry.type === 'TEXT') text++;
      else if (entry.type === 'VOICE') voice++;
      else if (entry.type === 'STAGE') stage++;
    }
  }
  return { categories, text, voice, stage };
}

/** Count live guild channels by type for bulk delete previews. */
function countGuildChannels(guild, mode) {
  const all = [...guild.channels.cache.values()];
  if (mode === 'all_channels') {
    const text  = all.filter((c) => c.type === ChannelType.GuildText).length;
    const voice = all.filter((c) => c.type === ChannelType.GuildVoice).length;
    const stage = all.filter((c) => c.type === ChannelType.GuildStageVoice).length;
    return { categories: 0, text, voice, stage, total: text + voice + stage };
  }
  if (mode === 'all_categories') {
    const categories = all.filter((c) => c.type === ChannelType.GuildCategory).length;
    return { categories, text: 0, voice: 0, stage: 0, total: categories };
  }
  // all_structure
  const categories = all.filter((c) => c.type === ChannelType.GuildCategory).length;
  const text       = all.filter((c) => c.type === ChannelType.GuildText).length;
  const voice      = all.filter((c) => c.type === ChannelType.GuildVoice).length;
  const stage      = all.filter((c) => c.type === ChannelType.GuildStageVoice).length;
  return { categories, text, voice, stage, total: categories + text + voice + stage };
}

// ─── Helpers: Flexible structure parser ──────────────────────────────────────

function stripEmojis(str) {
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu, '').trim();
}

function sanitizeChannelName(name, type = 'text') {
  const clean = name.trim().slice(0, 100);
  if (type !== 'text') return clean || 'channel';
  return (clean.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '') || 'channel');
}

function parseStructure(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const structure = [];
  let currentCategory = null;

  for (const rawLine of lines) {
    let line = rawLine.replace(/^[-•*▪▫·→►>]+\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!line) continue;

    const kwCategory = line.match(/^(?:CATEGORY|KATEGORI|CAT)\s*:\s*(.+)/i);
    if (kwCategory) {
      currentCategory = { type: 'CATEGORY', name: kwCategory[1].trim(), position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory); continue;
    }
    const kwVoice = line.match(/^(?:VOICE|SUARA|VC|VOICE[\s_]CHANNEL)\s*[:#]?\s*(.+)/i);
    if (kwVoice) {
      const ch = makeVoiceEntry(kwVoice[1].replace(/^#+\s*/, '').trim(), currentCategory);
      if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch); continue;
    }
    const kwStage = line.match(/^STAGE\s*[:#]?\s*(.+)/i);
    if (kwStage) {
      const ch = makeStageEntry(kwStage[1].replace(/^#+\s*/, '').trim(), currentCategory);
      if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch); continue;
    }
    const kwText = line.match(/^(?:TEXT|TEKS|TXT|#)\s*[:#]?\s*(.+)/i);
    if (kwText) {
      const ch = makeTextEntry(sanitizeChannelName(kwText[1].trim(), 'text'), currentCategory);
      if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch); continue;
    }

    const hasStageEmoji    = STAGE_EMOJIS.some((e) => line.includes(e));
    const hasVoiceEmoji    = VOICE_EMOJIS.some((e) => line.includes(e));
    const hasCategoryEmoji = CATEGORY_EMOJIS.some((e) => line.startsWith(e));

    if (hasCategoryEmoji) {
      let name = line;
      for (const e of CATEGORY_EMOJIS) name = name.split(e).join('');
      name = name.trim(); if (!name) continue;
      currentCategory = { type: 'CATEGORY', name, position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory); continue;
    }
    if (hasStageEmoji) {
      let name = line;
      for (const e of STAGE_EMOJIS) name = name.split(e).join('');
      name = name.replace(/^#+\s*/, '').trim(); if (!name) continue;
      const ch = makeStageEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch); continue;
    }
    if (hasVoiceEmoji) {
      let name = line;
      for (const e of VOICE_EMOJIS) name = name.split(e).join('');
      name = name.replace(/^#+\s*/, '').trim(); if (!name) continue;
      const ch = makeVoiceEntry(name, currentCategory);
      if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch); continue;
    }

    const stripped = stripEmojis(line);
    if (/^[A-Z0-9\s\-_,.'&!|]{3,}$/.test(stripped) && !line.startsWith('#')) {
      currentCategory = { type: 'CATEGORY', name: stripped.trim(), position: structure.length, permissionOverwrites: [], channels: [] };
      structure.push(currentCategory); continue;
    }

    let name = line.replace(/^#+\s*/, '');
    name = name.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]+\s*/gu, '').trim();
    if (!name) continue;
    const ch = makeTextEntry(sanitizeChannelName(name, 'text'), currentCategory);
    if (currentCategory) currentCategory.channels.push(ch); else structure.push(ch);
  }

  return structure;
}

function makeTextEntry(name, ctx)  { return { type: 'TEXT',  name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], topic: null, rateLimitPerUser: 0, nsfw: false }; }
function makeVoiceEntry(name, ctx) { return { type: 'VOICE', name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], bitrate: 64000, userLimit: 0 }; }
function makeStageEntry(name, ctx) { return { type: 'STAGE', name, position: ctx ? ctx.channels.length : 0, permissionOverwrites: [], bitrate: 64000, userLimit: 0 }; }

// ─── Helpers: Conflict detection ─────────────────────────────────────────────

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

async function executeGenerate(guild, structure, conflictMode) {
  const results  = { categories: 0, text: 0, voice: 0, stage: 0, failed: 0, errors: [] };
  const existing = new Map([...guild.channels.cache.values()].map((c) => [c.name.toLowerCase(), c]));

  for (const entry of structure) {
    if (entry.type === 'CATEGORY') {
      let parentCategory = null;
      const existingCat  = existing.get(entry.name.toLowerCase());
      if (existingCat) {
        if (conflictMode === 'skip' || conflictMode === 'replace') {
          parentCategory = existingCat;
        } else {
          const newName = `${entry.name}-copy`;
          try {
            parentCategory = await guild.channels.create({ name: newName, type: ChannelType.GuildCategory });
            results.categories++;
            existing.set(newName.toLowerCase(), parentCategory);
          } catch (err) { results.failed++; results.errors.push(`📂 ${entry.name}: ${err.message}`); }
        }
      } else {
        try {
          parentCategory = await guild.channels.create({ name: entry.name, type: ChannelType.GuildCategory });
          results.categories++;
          existing.set(entry.name.toLowerCase(), parentCategory);
        } catch (err) { results.failed++; results.errors.push(`📂 ${entry.name}: ${err.message}`); }
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
    if (conflictMode === 'rename') finalName = `${ch.name}-copy`;
    else if (conflictMode === 'replace') { try { await existingCh.delete('Channel Manager: replace'); } catch { /* ignore */ } }
  }
  const opts = { name: finalName };
  if (parent) opts.parent = parent.id;
  if (ch.type === 'TEXT') {
    opts.type = ChannelType.GuildText;
    if (ch.topic)            opts.topic            = ch.topic;
    if (ch.rateLimitPerUser) opts.rateLimitPerUser = ch.rateLimitPerUser;
    if (ch.nsfw)             opts.nsfw             = ch.nsfw;
  } else if (ch.type === 'VOICE') {
    opts.type = ChannelType.GuildVoice;
    if (ch.bitrate)   opts.bitrate   = ch.bitrate;
    if (ch.userLimit) opts.userLimit = ch.userLimit;
  } else if (ch.type === 'STAGE') {
    opts.type = ChannelType.GuildStageVoice;
  }
  try {
    const created = await guild.channels.create(opts);
    existing.set(finalName.toLowerCase(), created);
    if (ch.type === 'TEXT') results.text++;
    else if (ch.type === 'VOICE') results.voice++;
    else if (ch.type === 'STAGE') results.stage++;
  } catch (err) { results.failed++; results.errors.push(`${ch.name}: ${err.message}`); }
}

// ─── Helpers: Execute bulk delete ────────────────────────────────────────────

async function executeBulkDelete(guild, mode) {
  const all     = [...guild.channels.cache.values()];
  const results = { categories: 0, text: 0, voice: 0, stage: 0, failed: 0, errors: [] };

  let targets = [];
  if (mode === 'all_channels') {
    targets = all.filter((c) => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type));
  } else if (mode === 'all_categories') {
    targets = all.filter((c) => c.type === ChannelType.GuildCategory);
  } else {
    // all_structure — delete channels first, then categories
    const channels    = all.filter((c) => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type));
    const cats        = all.filter((c) => c.type === ChannelType.GuildCategory);
    targets = [...channels, ...cats];
  }

  for (const ch of targets) {
    try {
      await ch.delete('Channel Manager: bulk delete');
      if (ch.type === ChannelType.GuildCategory)   results.categories++;
      else if (ch.type === ChannelType.GuildText)   results.text++;
      else if (ch.type === ChannelType.GuildVoice)  results.voice++;
      else if (ch.type === ChannelType.GuildStageVoice) results.stage++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${ch.name}: ${err.message}`);
    }
  }
  return results;
}

// ─── Helpers: Build current structure preview text ───────────────────────────

function buildStructureText(guild) {
  const lines = [];
  const orphans = [...guild.channels.cache.values()]
    .filter((c) => !c.parentId && [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition);
  for (const ch of orphans) {
    if (ch.type === ChannelType.GuildText) lines.push(`#${ch.name}`);
    else if (ch.type === ChannelType.GuildVoice) lines.push(`🔊 ${ch.name}`);
    else lines.push(`🎭 ${ch.name}`);
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
      if (ch.type === ChannelType.GuildText) lines.push(`   #${ch.name}`);
      else if (ch.type === ChannelType.GuildVoice) lines.push(`   🔊 ${ch.name}`);
      else lines.push(`   🎭 ${ch.name}`);
    }
  }
  return lines.join('\n') || '_(Tidak ada channel)_';
}

// ─── Helpers: Result description ─────────────────────────────────────────────

function buildResultDesc(results, label) {
  let d = `✅ **${label} selesai.**\n\n`;
  if (results.categories) d += `📂 Kategori: **${results.categories}**\n`;
  d += `📝 Text: **${results.text}**\n`;
  d += `🔊 Voice: **${results.voice}**\n`;
  if (results.stage) d += `🎭 Stage: **${results.stage}**\n`;
  if (results.failed > 0) {
    d += `\n❌ Gagal: **${results.failed}**\n`;
    d += results.errors.slice(0, 5).map((e) => `• ${e}`).join('\n');
    if (results.errors.length > 5) d += `\n_...+${results.errors.length - 5} lainnya_`;
  }
  return d + `\n${DIVIDER}`;
}

// ─── Helpers: UI components ───────────────────────────────────────────────────

function backBtn() {
  return new ButtonBuilder()
    .setCustomId('setup1:channelmanager:cm_back')
    .setLabel('Kembali').setEmoji('◀️').setStyle(ButtonStyle.Secondary);
}
function backRow() {
  return new ActionRowBuilder().addComponents(backBtn());
}

// ─── Helpers: Backup manager page ────────────────────────────────────────────

function buildBackupListEmbed(backups, title = '⚙️  Kelola Backup') {
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: title })
    .setDescription(backups.length === 0
      ? `Belum ada backup tersimpan.\n${DIVIDER}`
      : `${DIVIDER}`
    );

  if (backups.length > 0) {
    const list = backups
      .map((b, i) => `**${i + 1}.** ${b.name ?? defaultBackupName()}\n└ ${fmtDate(b.date)}`)
      .join('\n\n');
    embed.addFields({ name: '📦  Backup Tersimpan', value: list });
  }
  return embed;
}

function buildBackupSelectMenu(backups) {
  return new StringSelectMenuBuilder()
    .setCustomId('setup1:channelmanager:backup_mgr_select')
    .setPlaceholder('Pilih backup...')
    .addOptions(
      backups.slice(0, 25).map((b, i) => ({
        label:       (b.name ?? defaultBackupName()).slice(0, 100),
        value:       b.id,
        description: fmtDate(b.date),
        emoji:       '📦',
      }))
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
    return { enabled: count > 0, summary: `${count} backup tersimpan` };
  },

  async buildPage(cfg) {
    const backups     = cfg.channelManager.backups ?? [];
    const backupCount = backups.length;

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setAuthor({ name: '📁  Channel Manager' })
      .setDescription(`Kelola struktur channel server.\n${DIVIDER}`);

    if (backupCount === 0) {
      embed.addFields({ name: '💾  Backup Tersimpan', value: 'Belum ada backup', inline: true });
    } else {
      const list = backups.slice(0, 3)
        .map((b, i) => `**${i + 1}.** ${(b.name ?? '—').slice(0, 40)} — _${fmtDate(b.date)}_`)
        .join('\n');
      const extra = backupCount > 3 ? `\n_...+${backupCount - 3} lainnya_` : '';
      embed.addFields({ name: `💾  Backup Tersimpan (${backupCount})`, value: list + extra });
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:backup')
        .setLabel('Backup Channels').setEmoji('💾').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:restore')
        .setLabel('Restore').setEmoji('♻️').setStyle(ButtonStyle.Primary)
        .setDisabled(backupCount === 0),
      new ButtonBuilder()
        .setCustomId('setup1:channelmanager:backup_mgr')
        .setLabel('Kelola Backup').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
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

    // ── Generic back ────────────────────────────────────────────────────────
    if (action === 'cm_back') {
      session.wizardData = {};
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BACKUP — shows modal for custom name
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'backup') {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:backup_name')
        .setTitle('💾 Nama Backup');
      const input = new TextInputBuilder()
        .setCustomId('backup_name_input')
        .setLabel('Nama Backup (kosongkan untuk default)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(defaultBackupName())
        .setRequired(false)
        .setMaxLength(80);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ════════════════════════════════════════════════════════════════════════
    // RESTORE — show backup list
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'restore') {
      const backups = cfg.channelManager.backups ?? [];
      if (backups.length === 0) {
        return interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.WARNING).setDescription('⚠️ Belum ada backup.')], components: [backRow()] });
      }
      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setAuthor({ name: '♻️  Restore — Pilih Backup' })
        .setDescription(`Pilih backup yang ingin di-restore.\n${DIVIDER}`);
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(buildBackupSelectMenu(backups).setCustomId('setup1:channelmanager:restore_select')),
          backRow(),
        ],
      });
    }

    if (action === 'restore_select') {
      const backupId = interaction.values[0];
      const backup   = (cfg.channelManager.backups ?? []).find((b) => b.id === backupId);
      if (!backup) return interaction.update({ content: '❌ Backup tidak ditemukan.', embeds: [], components: [] });

      session.wizardData.pendingRestoreId = backupId;
      const counts = countStructure(backup.structure);
      const embed  = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setAuthor({ name: '♻️  Restore — Preview' })
        .setDescription(`**Preview struktur yang akan dibuat:**\n${DIVIDER}`)
        .addFields(
          { name: '📦  Backup',      value: backup.name ?? '—',        inline: true },
          { name: '📅  Dibuat',      value: fmtDate(backup.date),       inline: true },
          { name: '\u200b',          value: '\u200b',                    inline: true },
          { name: '📂  Kategori',    value: `${counts.categories}`,     inline: true },
          { name: '📝  Text Channel', value: `${counts.text}`,           inline: true },
          { name: '🔊  Voice Channel', value: `${counts.voice}`,         inline: true },
        );
      if (counts.stage) embed.addFields({ name: '🎭  Stage', value: `${counts.stage}`, inline: true });
      embed.addFields({ name: '\u200b', value: `⚠️ Channel yang sudah ada akan di-skip.` });
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:restore_confirm')
              .setLabel('Restore').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'restore_confirm') {
      const backupId = session.wizardData.pendingRestoreId;
      const backup   = (cfg.channelManager.backups ?? []).find((b) => b.id === backupId);
      if (!backup) return interaction.update({ content: '❌ Backup tidak ditemukan atau sesi habis.', embeds: [], components: [] });
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }
      await interaction.deferUpdate();
      const results = await executeGenerate(guild, backup.structure, 'skip');
      delete session.wizardData.pendingRestoreId;
      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDesc(results, 'Restore'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BACKUP MANAGER — list, rename, delete backups
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'backup_mgr') {
      const backups = cfg.channelManager.backups ?? [];
      const embed   = buildBackupListEmbed(backups);
      const rows    = [];
      if (backups.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(buildBackupSelectMenu(backups)));
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('setup1:channelmanager:rename_backup')
            .setLabel('Rename Backup').setEmoji('✏️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup')
            .setLabel('Hapus Backup').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup_all')
            .setLabel('Hapus Semua').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
        ));
      }
      rows.push(backRow());
      return interaction.update({ embeds: [embed], components: rows });
    }

    if (action === 'backup_mgr_select') {
      const backupId = interaction.values[0];
      const backup   = (cfg.channelManager.backups ?? []).find((b) => b.id === backupId);
      if (!backup) return interaction.update({ content: '❌ Backup tidak ditemukan.', embeds: [], components: [] });
      session.wizardData.selectedBackupId = backupId;

      const counts = countStructure(backup.structure);
      const embed  = buildBackupListEmbed(cfg.channelManager.backups ?? [])
        .setDescription(`**Backup dipilih:** \`${backup.name ?? '—'}\`\n${DIVIDER}`)
        .addFields(
          { name: '📦  Nama',    value: backup.name ?? '—',    inline: true },
          { name: '📅  Tanggal', value: fmtDate(backup.date),   inline: true },
          { name: '\u200b',      value: '\u200b',                inline: true },
          { name: '📂  Kategori', value: `${counts.categories}`, inline: true },
          { name: '📝  Text',    value: `${counts.text}`,        inline: true },
          { name: '🔊  Voice',   value: `${counts.voice}`,       inline: true },
        );

      const backups = cfg.channelManager.backups ?? [];
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(buildBackupSelectMenu(backups)),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:rename_backup')
              .setLabel('Rename Backup').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup')
              .setLabel('Hapus Backup Ini').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup_all')
              .setLabel('Hapus Semua').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
          ),
          backRow(),
        ],
      });
    }

    if (action === 'rename_backup') {
      const backupId = session.wizardData.selectedBackupId;
      const backups  = cfg.channelManager.backups ?? [];
      const backup   = backups.find((b) => b.id === backupId);
      if (!backup) {
        return interaction.reply({ content: '⚠️ Pilih backup terlebih dahulu dari dropdown.', ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:rename_backup')
        .setTitle('✏️ Rename Backup');
      const input = new TextInputBuilder()
        .setCustomId('rename_backup_input')
        .setLabel('Nama baru')
        .setStyle(TextInputStyle.Short)
        .setValue((backup.name ?? '').slice(0, 80))
        .setPlaceholder('Contoh: Backup Sebelum Renovasi')
        .setRequired(true)
        .setMaxLength(80);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === 'delete_backup') {
      const backupId = session.wizardData.selectedBackupId;
      const backups  = cfg.channelManager.backups ?? [];
      const backup   = backups.find((b) => b.id === backupId);
      if (!backup) {
        return interaction.reply({ content: '⚠️ Pilih backup terlebih dahulu dari dropdown.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Hapus Backup — Konfirmasi' })
        .setDescription(
          `Yakin ingin menghapus backup ini?\n${DIVIDER}\n\n` +
          `**Nama:** ${backup.name ?? '—'}\n` +
          `**Tanggal:** ${fmtDate(backup.date)}\n\n` +
          `**Tindakan ini tidak dapat dibatalkan!**`
        );
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup_exec')
              .setLabel('Hapus').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:backup_mgr')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'delete_backup_exec') {
      const backupId = session.wizardData.selectedBackupId;
      if (!backupId) return interaction.update({ content: '❌ Tidak ada backup dipilih.', embeds: [], components: [] });
      const backups = (cfg.channelManager.backups ?? []).filter((b) => b.id !== backupId);
      await updateSection(guild.id, 'channelManager', { backups });
      delete session.wizardData.selectedBackupId;
      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(`✅ **Backup berhasil dihapus.**\n${DIVIDER}`);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'delete_backup_all') {
      const count = (cfg.channelManager.backups ?? []).length;
      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setAuthor({ name: '⚠️  Hapus Semua Backup — Konfirmasi' })
        .setDescription(
          `Yakin ingin menghapus **semua ${count} backup**?\n${DIVIDER}\n\n` +
          `**Semua backup akan hilang permanen.**\n` +
          `Tindakan ini tidak dapat dibatalkan!`
        );
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_backup_all_exec')
              .setLabel('Hapus Semua').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:backup_mgr')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'delete_backup_all_exec') {
      await updateSection(guild.id, 'channelManager', { backups: [] });
      session.wizardData = {};
      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(`✅ **Semua backup telah dihapus.**\n${DIVIDER}`);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // GENERATE STRUCTURE
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'generate') {
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:generate')
        .setTitle('🏗️ Generate Structure');
      const input = new TextInputBuilder()
        .setCustomId('structure_input')
        .setLabel('Tempel struktur channel di sini')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('📂 INFORMATION\n#rules\n#welcome\n\n📂 GENERAL\n#chat\n🔊 General')
        .setRequired(true).setMaxLength(2000);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === 'generate_confirm') {
      const structure    = session.wizardData.generateStructure;
      const conflictMode = session.wizardData.generateConflictMode ?? 'skip';
      if (!structure) return interaction.update({ content: '❌ Sesi habis. Tekan Generate lagi.', embeds: [], components: [] });
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }
      await interaction.deferUpdate();
      const results = await executeGenerate(guild, structure, conflictMode);
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;
      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDesc(results, 'Generate'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    if (action.startsWith('generate_conflict_')) {
      const mode      = action.replace('generate_conflict_', '');
      const structure = session.wizardData.generateStructure;
      if (!structure) return interaction.update({ content: '❌ Sesi habis. Tekan Generate lagi.', embeds: [], components: [] });
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }
      await interaction.deferUpdate();
      const results = await executeGenerate(guild, structure, mode);
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;
      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDesc(results, 'Generate'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    if (action === 'generate_cancel') {
      delete session.wizardData.generateStructure;
      delete session.wizardData.generateConflictMode;
      const page = await plugin.buildPage(cfg);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CLONE
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'clone') {
      const embed = new EmbedBuilder().setColor(Colors.DARK)
        .setAuthor({ name: '📋  Clone Channel atau Kategori' })
        .setDescription(`Pilih channel atau kategori yang ingin di-clone.\n${DIVIDER}`);
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('setup1:channelmanager:clone_select')
              .setPlaceholder('Pilih channel atau kategori...')
              .setMinValues(1).setMaxValues(1)
          ),
          backRow(),
        ],
      });
    }

    if (action === 'clone_select') {
      const channelId = interaction.values[0];
      session.wizardData.cloneChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      const typeName   = { [ChannelType.GuildCategory]: 'Kategori', [ChannelType.GuildVoice]: 'Voice Channel', [ChannelType.GuildStageVoice]: 'Stage Channel' }[channel.type] ?? 'Text Channel';
      const childCount = channel.type === ChannelType.GuildCategory
        ? [...guild.channels.cache.values()].filter((c) => c.parentId === channel.id).length : 0;
      const embed = new EmbedBuilder().setColor(Colors.WARNING)
        .setAuthor({ name: '📋  Clone — Konfirmasi' })
        .setDescription(
          `**${typeName}:** \`${channel.name}\`\n**Nama salinan:** \`${channel.name}-copy\`\n` +
          (childCount > 0 ? `**Channel di dalamnya:** ${childCount}\n` : '') +
          `\n${DIVIDER}`
        );
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:clone_confirm')
              .setLabel('Clone').setEmoji('📋').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'clone_confirm') {
      const channelId = session.wizardData.cloneChannelId;
      if (!channelId) return interaction.update({ content: '❌ Tidak ada channel dipilih.', embeds: [], components: [] });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }
      await interaction.deferUpdate();
      try {
        const copyName = `${channel.name}-copy`;
        if (channel.type === ChannelType.GuildCategory) {
          const newCat   = await guild.channels.create({ name: copyName, type: ChannelType.GuildCategory });
          const children = [...guild.channels.cache.values()].filter((c) => c.parentId === channel.id).sort((a, b) => a.rawPosition - b.rawPosition);
          let cloned = 0;
          for (const child of children) {
            const opts = { name: child.name, parent: newCat.id, type: child.type };
            if (child.type === ChannelType.GuildText) { if (child.topic) opts.topic = child.topic; opts.rateLimitPerUser = child.rateLimitPerUser; opts.nsfw = child.nsfw; }
            else if (child.type === ChannelType.GuildVoice) { opts.bitrate = child.bitrate; opts.userLimit = child.userLimit; }
            await guild.channels.create(opts).catch(() => null); cloned++;
          }
          delete session.wizardData.cloneChannelId;
          const fresh = await loadGuildConfig(guild.id);
          const page  = await plugin.buildPage(fresh);
          page.embed.setDescription(`✅ **Kategori \`${channel.name}\` di-clone → \`${copyName}\`** (${cloned} channel)\n${DIVIDER}`);
          return interaction.editReply({ embeds: [page.embed], components: page.components });
        } else {
          const opts = { name: copyName, type: channel.type };
          if (channel.parentId) opts.parent = channel.parentId;
          if (channel.type === ChannelType.GuildText) { if (channel.topic) opts.topic = channel.topic; opts.rateLimitPerUser = channel.rateLimitPerUser; opts.nsfw = channel.nsfw; }
          else if (channel.type === ChannelType.GuildVoice) { opts.bitrate = channel.bitrate; opts.userLimit = channel.userLimit; }
          await guild.channels.create(opts);
          delete session.wizardData.cloneChannelId;
          const fresh = await loadGuildConfig(guild.id);
          const page  = await plugin.buildPage(fresh);
          page.embed.setDescription(`✅ **Channel \`${channel.name}\` di-clone → \`${copyName}\`**\n${DIVIDER}`);
          return interaction.editReply({ embeds: [page.embed], components: page.components });
        }
      } catch (err) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.ERROR).setTitle('❌  Clone Gagal').setDescription(err.message)], components: [buildNavRow()] });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENAME CHANNEL
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'rename') {
      const embed = new EmbedBuilder().setColor(Colors.DARK)
        .setAuthor({ name: '✏️  Rename Channel' })
        .setDescription(`Pilih channel yang ingin di-rename.\n${DIVIDER}`);
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('setup1:channelmanager:rename_select')
              .setPlaceholder('Pilih channel...')
              .setMinValues(1).setMaxValues(1)
          ),
          backRow(),
        ],
      });
    }

    if (action === 'rename_select') {
      const channelId = interaction.values[0];
      session.wizardData.renameChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:rename')
        .setTitle(`✏️ Rename — ${channel.name.slice(0, 40)}`);
      const input = new TextInputBuilder()
        .setCustomId('rename_input').setLabel('Nama baru').setStyle(TextInputStyle.Short)
        .setPlaceholder('Masukkan nama baru...').setValue(channel.name).setRequired(true).setMaxLength(100);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ════════════════════════════════════════════════════════════════════════
    // DELETE — expanded with bulk options
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'delete') {
      const embed = new EmbedBuilder().setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Delete — Pilih Aksi' })
        .setDescription(`Pilih tindakan penghapusan.\n${DIVIDER}\n⚠️ Aksi massal memerlukan konfirmasi dua kali.`);

      const select = new StringSelectMenuBuilder()
        .setCustomId('setup1:channelmanager:delete_mode')
        .setPlaceholder('Pilih tindakan...')
        .addOptions([
          { label: 'Delete Selected Channel',        value: 'channel',       description: 'Hapus satu channel tertentu',              emoji: '📝' },
          { label: 'Delete Selected Category',       value: 'category',      description: 'Hapus satu kategori tertentu',             emoji: '📂' },
          { label: 'Delete All Channels',            value: 'all_channels',  description: 'Hapus semua text/voice/stage channel',     emoji: '🗑️' },
          { label: 'Delete All Categories',          value: 'all_categories',description: 'Hapus semua kategori (channel tetap ada)', emoji: '🗂️' },
          { label: 'Delete Entire Server Structure', value: 'all_structure', description: 'Hapus semua channel dan kategori',          emoji: '💥' },
        ]);

      return interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    if (action === 'delete_mode') {
      const mode = interaction.values[0];
      session.wizardData.deleteBulkMode = mode;

      if (mode === 'channel') {
        const embed = new EmbedBuilder().setColor(Colors.ERROR)
          .setAuthor({ name: '🗑️  Delete — Pilih Channel' })
          .setDescription(`Pilih channel yang ingin dihapus.\n${DIVIDER}`);
        return interaction.update({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('setup1:channelmanager:delete_ch_select')
                .setPlaceholder('Pilih channel...')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                .setMinValues(1).setMaxValues(1)
            ),
            backRow(),
          ],
        });
      }

      if (mode === 'category') {
        const embed = new EmbedBuilder().setColor(Colors.ERROR)
          .setAuthor({ name: '🗑️  Delete — Pilih Kategori' })
          .setDescription(`Pilih kategori yang ingin dihapus.\n${DIVIDER}`);
        return interaction.update({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('setup1:channelmanager:delete_cat_select')
                .setPlaceholder('Pilih kategori...')
                .addChannelTypes(ChannelType.GuildCategory)
                .setMinValues(1).setMaxValues(1)
            ),
            backRow(),
          ],
        });
      }

      // Bulk modes — show preview
      const counts    = countGuildChannels(guild, mode);
      const modeLabel = { all_channels: 'Semua Channel', all_categories: 'Semua Kategori', all_structure: 'Seluruh Struktur Server' }[mode];

      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setAuthor({ name: '⚠️  PERINGATAN — Bulk Delete' })
        .setDescription(`**Anda akan menghapus: ${modeLabel}**\n${DIVIDER}`)
        .addFields(
          ...(counts.categories ? [{ name: '📂  Kategori',    value: `${counts.categories}`, inline: true }] : []),
          ...(counts.text       ? [{ name: '📝  Text Channel', value: `${counts.text}`,       inline: true }] : []),
          ...(counts.voice      ? [{ name: '🔊  Voice Channel', value: `${counts.voice}`,     inline: true }] : []),
          ...(counts.stage      ? [{ name: '🎭  Stage Channel', value: `${counts.stage}`,     inline: true }] : []),
        )
        .addFields({ name: '🔢  Total', value: `**${counts.total} channel**`, inline: false })
        .addFields({ name: '\u200b', value: '⚠️ **Langkah berikutnya:** Kamu akan diminta mengetik `DELETE` untuk konfirmasi akhir.' });

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_bulk_trigger')
              .setLabel('Lanjutkan').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            backBtn(),
          ),
        ],
      });
    }

    // Single channel delete
    if (action === 'delete_ch_select') {
      const channelId = interaction.values[0];
      session.wizardData.deleteChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      const embed = new EmbedBuilder().setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Delete — Konfirmasi' })
        .setDescription(`⚠️ Yakin hapus **Text/Voice Channel** \`${channel.name}\`?\n\n**Tidak dapat dibatalkan.**`);
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_ch_confirm')
              .setLabel('Hapus').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'delete_ch_confirm') {
      const channelId = session.wizardData.deleteChannelId;
      const channel   = channelId ? guild.channels.cache.get(channelId) : null;
      if (!channel) return interaction.update({ content: '❌ Channel tidak ditemukan.', embeds: [], components: [] });
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.update({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', embeds: [], components: [] });
      }
      await interaction.deferUpdate();
      try {
        const name = channel.name;
        await channel.delete('Channel Manager: delete');
        delete session.wizardData.deleteChannelId;
        const fresh = await loadGuildConfig(guild.id);
        const page  = await plugin.buildPage(fresh);
        page.embed.setDescription(`✅ **Channel \`${name}\` berhasil dihapus.**\n${DIVIDER}`);
        return interaction.editReply({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.ERROR).setTitle('❌  Delete Gagal').setDescription(err.message)], components: [buildNavRow()] });
      }
    }

    // Single category delete
    if (action === 'delete_cat_select') {
      const channelId = interaction.values[0];
      session.wizardData.deleteChannelId = channelId;
      const channel   = guild.channels.cache.get(channelId);
      if (!channel) return interaction.update({ content: '❌ Kategori tidak ditemukan.', embeds: [], components: [] });
      const childCount = [...guild.channels.cache.values()].filter((c) => c.parentId === channel.id).length;
      const embed = new EmbedBuilder().setColor(Colors.ERROR)
        .setAuthor({ name: '🗑️  Delete Kategori — Konfirmasi' })
        .setDescription(
          `⚠️ Yakin hapus kategori \`${channel.name}\`?\n\n` +
          (childCount > 0 ? `**${childCount} channel di dalamnya tidak ikut terhapus** (menjadi tanpa kategori).\n\n` : '') +
          `**Tidak dapat dibatalkan.**`
        );
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:delete_ch_confirm')
              .setLabel('Hapus Kategori').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('setup1:channelmanager:cm_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // Bulk delete step 2: show modal to type DELETE
    if (action === 'delete_bulk_trigger') {
      const mode = session.wizardData.deleteBulkMode;
      if (!mode) return interaction.update({ content: '❌ Sesi habis.', embeds: [], components: [] });
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:channelmanager:delete_bulk_verify')
        .setTitle('⚠️ Konfirmasi Penghapusan Massal');
      const input = new TextInputBuilder()
        .setCustomId('verify_input')
        .setLabel('Ketik DELETE untuk melanjutkan')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('DELETE')
        .setRequired(true)
        .setMaxLength(10);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PREVIEW STRUCTURE
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'preview') {
      const structureText = buildStructureText(guild);
      const MAX_CHUNK = 1800;
      const lines     = structureText.split('\n');
      const chunks    = [];
      let   current   = '';
      for (const line of lines) {
        const candidate = current ? current + '\n' + line : line;
        if (candidate.length > MAX_CHUNK) { if (current) chunks.push(current); current = line; }
        else current = candidate;
      }
      if (current) chunks.push(current);

      const embed = new EmbedBuilder().setColor(Colors.NEUTRAL)
        .setAuthor({ name: '👁️  Preview Structure Saat Ini' })
        .setDescription(`Struktur channel server:\n${DIVIDER}\n\`\`\`\n${chunks[0] ?? '_(Kosong)_'}\n\`\`\``);
      for (const chunk of chunks.slice(1, 3)) {
        embed.addFields({ name: '\u200b', value: `\`\`\`\n${chunk}\n\`\`\`` });
      }
      if (chunks.length > 4) embed.addFields({ name: '\u200b', value: '_...sebagian tidak ditampilkan_' });
      return interaction.update({ embeds: [embed], components: [backRow()] });
    }
  },

  // ── handleModal ──────────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {
    const guild = interaction.guild;

    // ── Create backup with custom name ───────────────────────────────────────
    if (field === 'backup_name') {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }

      const rawName = interaction.fields.getTextInputValue('backup_name_input').trim();
      const name    = rawName || defaultBackupName();

      await interaction.deferUpdate();
      const structure = snapshotStructure(guild);
      const id        = Date.now().toString();
      const date      = new Date().toISOString();
      const backups   = [...(cfg.channelManager.backups ?? [])];
      backups.unshift({ id, date, name, structure });
      if (backups.length > MAX_BACKUPS) backups.splice(MAX_BACKUPS);

      await updateSection(guild.id, 'channelManager', { backups });
      const fresh  = await loadGuildConfig(guild.id);
      const page   = await plugin.buildPage(fresh);
      const counts = countStructure(structure);

      page.embed.setDescription(
        `✅ **Backup berhasil dibuat!**\n\n` +
        `**Nama:** ${name}\n` +
        `📂 Kategori: **${counts.categories}** | 📝 Text: **${counts.text}** | 🔊 Voice: **${counts.voice}**\n` +
        `\nID: \`${id}\`\n${DIVIDER}`
      );
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }

    // ── Rename backup ────────────────────────────────────────────────────────
    if (field === 'rename_backup') {
      const newName  = interaction.fields.getTextInputValue('rename_backup_input').trim();
      const backupId = session.wizardData.selectedBackupId;
      if (!backupId) return interaction.reply({ content: '❌ Sesi habis. Pilih backup lagi.', ephemeral: true });
      if (!newName)  return interaction.reply({ content: '❌ Nama tidak boleh kosong.', ephemeral: true });

      const backups = cfg.channelManager.backups ?? [];
      const idx     = backups.findIndex((b) => b.id === backupId);
      if (idx === -1) return interaction.reply({ content: '❌ Backup tidak ditemukan.', ephemeral: true });

      const oldName = backups[idx].name ?? '—';
      backups[idx]  = { ...backups[idx], name: newName };
      await updateSection(guild.id, 'channelManager', { backups });

      const embed = new EmbedBuilder().setColor(Colors.SUCCESS)
        .setDescription(`✅ **Backup berhasil di-rename.**\n\n\`${oldName}\` → \`${newName}\`\n${DIVIDER}`);
      return interaction.update({
        embeds:     [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:backup_mgr')
              .setLabel('Kembali ke Kelola Backup').setEmoji('◀️').setStyle(ButtonStyle.Primary),
            backBtn(),
          ),
        ],
      });
    }

    // ── Generate structure modal ─────────────────────────────────────────────
    if (field === 'generate') {
      const text      = interaction.fields.getTextInputValue('structure_input');
      const structure = parseStructure(text);
      if (structure.length === 0) {
        return interaction.reply({ content: '❌ Tidak ada struktur yang bisa diparsing.', ephemeral: true });
      }
      const counts       = countStructure(structure);
      const total        = counts.categories + counts.text + counts.voice + counts.stage;
      const currentTotal = guild.channels.cache.size;
      if (currentTotal + total > MAX_DISCORD_CHANNELS) {
        return interaction.reply({ content: `❌ Akan melebihi batas Discord (500). Server sudah punya **${currentTotal}** channel, akan tambah **${total}**.`, ephemeral: true });
      }
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }
      session.wizardData.generateStructure    = structure;
      session.wizardData.generateConflictMode = 'skip';
      const conflicts = detectConflicts(structure, guild);
      const embed = new EmbedBuilder().setColor(Colors.WARNING)
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
        embed.addFields({ name: `⚠️  ${conflicts.length} Konflik`, value: `${shown}${conflicts.length > 10 ? ` _+${conflicts.length - 10} lainnya_` : ''}\n\nPilih cara penanganan:` });
        return interaction.update({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('setup1:channelmanager:generate_conflict_skip')
                .setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('setup1:channelmanager:generate_conflict_rename')
                .setLabel('Rename Otomatis').setEmoji('✏️').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('setup1:channelmanager:generate_conflict_replace')
                .setLabel('Replace').setEmoji('♻️').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('setup1:channelmanager:generate_cancel')
                .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
      }
      embed.addFields({ name: '✅  Siap', value: 'Tekan **Generate** untuk membuat channel.' });
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup1:channelmanager:generate_confirm')
              .setLabel('Generate').setEmoji('🏗️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('setup1:channelmanager:generate_cancel')
              .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // ── Rename channel modal ─────────────────────────────────────────────────
    if (field === 'rename') {
      const newName   = interaction.fields.getTextInputValue('rename_input').trim();
      const channelId = session.wizardData.renameChannelId;
      if (!channelId) return interaction.reply({ content: '❌ Sesi habis. Tekan Rename lagi.', ephemeral: true });
      if (!newName || newName.length > 100) return interaction.reply({ content: '❌ Nama tidak valid (1–100 karakter).', ephemeral: true });
      const channel = guild.channels.cache.get(channelId);
      if (!channel) { delete session.wizardData.renameChannelId; return interaction.reply({ content: '❌ Channel tidak ditemukan.', ephemeral: true }); }
      try {
        const oldName = channel.name;
        await channel.setName(newName, 'Channel Manager: rename');
        delete session.wizardData.renameChannelId;
        const fresh = await loadGuildConfig(guild.id);
        const page  = await plugin.buildPage(fresh);
        page.embed.setDescription(`✅ **Channel di-rename.**\n\`${oldName}\` → \`${newName}\`\n${DIVIDER}`);
        return interaction.update({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.reply({ content: `❌ Gagal rename: ${err.message}`, ephemeral: true });
      }
    }

    // ── Bulk delete verification ─────────────────────────────────────────────
    if (field === 'delete_bulk_verify') {
      const typed = interaction.fields.getTextInputValue('verify_input').trim();
      if (typed !== 'DELETE') {
        return interaction.reply({
          content: '❌ **Teks tidak cocok.** Ketik `DELETE` (huruf kapital semua) untuk melanjutkan.',
          ephemeral: true,
        });
      }

      const mode = session.wizardData.deleteBulkMode;
      if (!mode) return interaction.reply({ content: '❌ Sesi habis.', ephemeral: true });

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin **Manage Channels**.', ephemeral: true });
      }

      await interaction.deferUpdate();
      const results = await executeBulkDelete(guild, mode);
      delete session.wizardData.deleteBulkMode;

      const fresh = await loadGuildConfig(guild.id);
      const page  = await plugin.buildPage(fresh);
      page.embed.setDescription(buildResultDesc(results, 'Delete'));
      return interaction.editReply({ embeds: [page.embed], components: page.components });
    }
  },
};

export default plugin;
