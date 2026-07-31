/**
 * Plugin: 🚨 System Manager
 *
 * Core module for Bot 1. Adds a new menu to /setup bot1 with:
 *   🚨 Error System      — customise user-facing error messages, log channel, auto-retry
 *   📜 System Logs       — single log channel for all bot events
 *   💾 Backup & Restore  — full config backup / restore
 *   📊 Bot Status        — live uptime, ping, memory, CPU, server/user count
 *   📋 Audit Config      — health check for all configured features
 *   ⚙️  Advanced          — debug mode, maintenance mode, retry limit, timeout
 *
 * All sub-systems (recordError, sendSystemLog, buildUserErrorEmbed) are
 * implemented in the shared service and are available to any Bot 1 feature via:
 *   import { systemManager } from '../../services/index.js';
 *
 * Required permission: Administrator
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Colors, DIVIDER, buildNavRow, buildChannelSelectPage, buildChannelPreviewPage } from '../ui.js';
import { updateSection, loadGuildConfig, backupGuildConfig, listBackups, restoreBackup } from '../config.js';
import { systemManager as svc } from '../../services/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function backBtn(action = 'sm_main') {
  return new ButtonBuilder()
    .setCustomId(`setup1:systemmanager:${action}`)
    .setLabel('Kembali').setEmoji('◀️').setStyle(ButtonStyle.Secondary);
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

function fmtBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusDot(on) { return on ? '🟢 Aktif' : '🔴 Nonaktif'; }

function fmtDate(iso) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Build Pages ──────────────────────────────────────────────────────────────

function buildMainPage(cfg) {
  const sm     = cfg.systemManager;
  const errs   = sm.errorHistory?.length ?? 0;
  const logsOn = sm.systemLogs?.enabled ?? false;
  const maint  = sm.advanced?.maintenanceMode ?? false;

  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '🚨 System Manager' })
    .setDescription(`Kelola sistem inti bot: error, log, backup, status, dan konfigurasi lanjutan.\n${DIVIDER}`)
    .addFields(
      { name: '📜 System Logs', value: statusDot(logsOn),                                  inline: true },
      { name: '📚 Error History', value: `${errs} error tercatat`,                         inline: true },
      { name: '⚙️  Maintenance', value: maint ? '🔧 Aktif' : '✅ Normal',                  inline: true },
    )
    .setFooter({ text: 'Pilih sub-modul dari dropdown di bawah.' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup1:systemmanager:main_select')
    .setPlaceholder('Pilih sub-modul...')
    .addOptions([
      { label: 'Error System',     value: 'error_system',  emoji: '🚨', description: 'Kustomisasi pesan error dan log error.' },
      { label: 'System Logs',      value: 'system_logs',   emoji: '📜', description: 'Satu log channel untuk semua event bot.' },
      { label: 'Backup & Restore', value: 'backup',        emoji: '💾', description: 'Backup dan restore seluruh konfigurasi.' },
      { label: 'Bot Status',       value: 'bot_status',    emoji: '📊', description: 'Uptime, ping, memori, dan statistik server.' },
      { label: 'Audit Config',     value: 'audit_config',  emoji: '📋', description: 'Periksa kelengkapan semua konfigurasi fitur.' },
      { label: 'Advanced',         value: 'advanced',      emoji: '⚙️',  description: 'Debug mode, maintenance mode, retry limit.' },
    ]);

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(select),
      buildNavRow(),
    ],
  };
}

// ─── Error System ─────────────────────────────────────────────────────────────

function buildErrorSystemPage(cfg) {
  const es = cfg.systemManager.errorSystem;
  const um = es.userMessage ?? {};

  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '🚨 Error System' })
    .setDescription(`Konfigurasi pesan error yang dilihat pengguna dan pencatatan error.\n${DIVIDER}`)
    .addFields(
      { name: '📢 Error Log Channel', value: es.logChannelId ? `<#${es.logChannelId}>` : '❌ Belum diset', inline: true },
      { name: '🔄 Auto Retry',        value: statusDot(es.autoRetry),                                       inline: true },
      { name: '💡 Auto Rekomendasi',  value: statusDot(es.autoRecommendation),                              inline: true },
      { name: '📝 Judul Pesan Error', value: (um.title ?? '—').slice(0, 60),                                inline: false },
    )
    .setFooter({ text: 'Pilih opsi dari dropdown untuk dikonfigurasi.' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup1:systemmanager:err_select')
    .setPlaceholder('Pilih opsi Error System...')
    .addOptions([
      { label: 'User Error Message',   value: 'err_user_msg',    emoji: '📝', description: 'Edit judul, deskripsi, footer, warna, emoji.' },
      { label: 'Embed Style',          value: 'err_embed_style',  emoji: '🎨', description: 'Edit warna dan emoji error embed.' },
      { label: 'Banner / GIF',         value: 'err_banner_gif',   emoji: '🖼️',  description: 'Set GIF/banner pada pesan error.' },
      { label: 'Error Log Channel',    value: 'err_log_channel',  emoji: '📢', description: 'Channel untuk log detail error (owner only).' },
      { label: 'Auto Retry',           value: 'err_auto_retry',   emoji: '🔄', description: 'Toggle auto-retry saat terjadi error.' },
      { label: 'Error History',        value: 'err_history',      emoji: '📚', description: 'Lihat riwayat error terbaru.' },
      { label: 'Auto Recommendation',  value: 'err_auto_rec',     emoji: '💡', description: 'Toggle saran perbaikan otomatis.' },
    ]);

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(backBtn('sm_main')),
    ],
  };
}

function buildUserMsgPreviewPage(cfg) {
  const um = cfg.systemManager.errorSystem.userMessage ?? {};
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: '📝 User Error Message — Preview' })
    .setDescription(`Pesan error yang dilihat pengguna saat fitur gagal.\nGunakan placeholder: \`{user}\` \`{feature}\` \`{error_code}\` \`{server}\` \`{time}\`\n${DIVIDER}`)
    .addFields(
      { name: '📌 Judul',       value: um.title       ?? '—', inline: true },
      { name: '🎨 Warna',       value: um.color       ?? '—', inline: true },
      { name: '😊 Emoji',       value: um.emoji       ?? '—', inline: true },
      { name: '📄 Deskripsi',   value: (um.description ?? '—').slice(0, 300), inline: false },
      { name: '🦶 Footer',      value: (um.footer      ?? '—').slice(0, 200), inline: false },
      { name: '🖼️  GIF/Banner', value: um.gif          ?? '_(tidak ada)_',   inline: false },
    );

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:open_user_msg_modal')
          .setLabel('Edit Pesan').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        backBtn('sm_error_system'),
      ),
    ],
  };
}

function buildEmbedStylePage(cfg) {
  const um = cfg.systemManager.errorSystem.userMessage ?? {};
  const embed = new EmbedBuilder()
    .setColor(um.color ?? '#ED4245')
    .setAuthor({ name: '🎨 Embed Style' })
    .setDescription(`Kustomisasi tampilan embed error.\n${DIVIDER}`)
    .addFields(
      { name: '🎨 Warna (hex)', value: um.color ?? '#ED4245', inline: true },
      { name: '😊 Emoji',       value: um.emoji ?? '❌',       inline: true },
    );

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:open_style_modal')
          .setLabel('Edit Style').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        backBtn('sm_error_system'),
      ),
    ],
  };
}

function buildBannerGifPage(cfg) {
  const um  = cfg.systemManager.errorSystem.userMessage ?? {};
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: '🖼️ Banner / GIF' })
    .setDescription(`Set GIF atau banner URL untuk pesan error.\n${DIVIDER}`)
    .addFields({ name: '🖼️  URL Saat Ini', value: um.gif ?? '_(tidak ada)_', inline: false });
  if (um.gif) embed.setImage(um.gif);

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:open_gif_modal')
          .setLabel('Set GIF/Banner').setEmoji('🖼️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:clear_gif')
          .setLabel('Hapus GIF').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
          .setDisabled(!um.gif),
        backBtn('sm_error_system'),
      ),
    ],
  };
}

function buildErrorHistoryPage(cfg) {
  const history = cfg.systemManager.errorHistory ?? [];
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: '📚 Error History' })
    .setDescription(`Riwayat ${history.length} error terakhir.\n${DIVIDER}`);

  if (history.length === 0) {
    embed.addFields({ name: '📭 Tidak Ada Error', value: 'Belum ada error yang tercatat.' });
  } else {
    const latest = history.slice(0, 8);
    for (const e of latest) {
      embed.addFields({
        name:  `${e.emoji ?? '🚨'} \`${e.code}\` — ${e.feature}`,
        value: `**Waktu:** ${fmtDate(e.time)}\n**Alasan:** ${(e.reason ?? '—').slice(0, 80)}\n**Retry:** ${e.retryStatus ?? '—'}`,
        inline: false,
      });
    }
    if (history.length > 8) {
      embed.setFooter({ text: `...+${history.length - 8} error lainnya tersimpan.` });
    }
  }

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:clear_history')
          .setLabel('Hapus Semua History').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
          .setDisabled(history.length === 0),
        backBtn('sm_error_system'),
      ),
    ],
  };
}

// ─── System Logs ──────────────────────────────────────────────────────────────

function buildSystemLogsPage(cfg) {
  const sl = cfg.systemManager.systemLogs;
  const embed = new EmbedBuilder()
    .setColor(sl.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
    .setAuthor({ name: '📜 System Logs' })
    .setDescription(
      `Satu log channel untuk seluruh event sistem bot.\n` +
      `Termasuk: Bot Start/Restart, Backup, Config Update, API, Error, dsb.\n${DIVIDER}`
    )
    .addFields(
      { name: '📊 Status',      value: statusDot(sl.enabled),                                      inline: true },
      { name: '📢 Log Channel', value: sl.channelId ? `<#${sl.channelId}>` : '❌ Belum diset',     inline: true },
    )
    .setFooter({ text: 'Jangan buat log channel terpisah per fitur — gunakan satu channel ini.' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:systemmanager:logs_enable')
      .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
      .setDisabled(sl.enabled),
    new ButtonBuilder()
      .setCustomId('setup1:systemmanager:logs_disable')
      .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
      .setDisabled(!sl.enabled),
    new ButtonBuilder()
      .setCustomId('setup1:systemmanager:logs_set_channel')
      .setLabel('Set Channel').setEmoji('📢').setStyle(ButtonStyle.Primary),
    backBtn('sm_main'),
  );

  return { embed, components: [row1] };
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────

async function buildBackupPage(cfg, session) {
  const guildId = session?.guildId;
  const backups = guildId ? await listBackups(guildId) : [];

  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '💾 Backup & Restore' })
    .setDescription(`Backup dan restore seluruh konfigurasi bot untuk guild ini.\n${DIVIDER}`)
    .addFields({ name: '📦 Total Backup', value: `${backups.length}`, inline: true });

  if (backups.length > 0) {
    const list = backups.slice(0, 5)
      .map((b, i) => `**${i + 1}.** \`${b.id}\` — ${new Date(b.date).toLocaleString('id-ID')}`)
      .join('\n');
    embed.addFields({ name: '📋 Backup Terbaru', value: list });
  }

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:systemmanager:bk_create')
      .setLabel('Backup Sekarang').setEmoji('💾').setStyle(ButtonStyle.Primary),
    backBtn('sm_main'),
  );

  const rows = [row1];

  if (backups.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('setup1:systemmanager:bk_restore_select')
      .setPlaceholder('Pilih backup untuk di-restore...')
      .addOptions(
        backups.slice(0, 25).map((b) => ({
          label:       `Backup ${new Date(b.date).toLocaleString('id-ID')}`,
          value:       b.id,
          description: `ID: ${b.id}`,
          emoji:       '♻️',
        }))
      );
    rows.unshift(new ActionRowBuilder().addComponents(select));
  }

  return { embed, components: rows };
}

// ─── Bot Status ───────────────────────────────────────────────────────────────

async function buildStatusPage(client, cfg) {
  const todayErrors = svc.countTodayErrors(cfg);
  const mem         = process.memoryUsage();
  const cpuStart    = process.cpuUsage();
  await new Promise((r) => setTimeout(r, 100));
  const cpuEnd      = process.cpuUsage(cpuStart);
  const cpuPct      = ((cpuEnd.user + cpuEnd.system) / 1_000_000 / 0.1 * 100).toFixed(1);

  const totalUsers  = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);

  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setAuthor({ name: '📊 Bot Status' })
    .setDescription(`Status real-time Bot 1.\n${DIVIDER}`)
    .addFields(
      { name: '🤖 Bot Status',    value: '🟢 Online',                                    inline: true },
      { name: '⏱️  Uptime',        value: fmtUptime(client.uptime ?? 0),                 inline: true },
      { name: '📡 Ping',           value: `${client.ws.ping} ms`,                        inline: true },
      { name: '💾 Memory (Heap)', value: fmtBytes(mem.heapUsed),                         inline: true },
      { name: '⚡ CPU (100ms)',    value: `${cpuPct}%`,                                   inline: true },
      { name: '🏠 Servers',        value: `${client.guilds.cache.size}`,                  inline: true },
      { name: '👥 Total Users',   value: `${totalUsers.toLocaleString('id-ID')}`,        inline: true },
      { name: '🚨 Error Hari Ini', value: `${todayErrors}`,                              inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'Data diambil saat halaman dibuka.' });

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:status_refresh')
          .setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        backBtn('sm_main'),
      ),
    ],
  };
}

// ─── Audit Config ─────────────────────────────────────────────────────────────

function auditSection(label, check) {
  if (check === null) return `⬜ ${label}: _Modul tidak terpasang_`;
  if (check === true)  return `✅ ${label}: Ready`;
  return `${check}`; // custom string for warnings/missing
}

async function buildAuditPage(cfg, session) {
  const guildId = session?.guildId;
  const backups = guildId ? await listBackups(guildId) : [];

  const w = cfg.welcome;
  const m = cfg.moderation;
  const g = cfg.giveaway;
  const l = cfg.logs;
  const sm = cfg.systemManager;
  const tk = cfg.takeRole;
  const inv = cfg.invite;

  const lines = [
    w?.enabled && w?.channelId
      ? `✅ **Welcome:** Ready`
      : w?.channelId
        ? `⚠️ **Welcome:** Channel diset tapi disabled`
        : `❌ **Welcome:** Channel belum dikonfigurasi`,

    m?.enabled && m?.moderatorRoles?.length > 0
      ? `✅ **Moderation:** Ready`
      : m?.enabled
        ? `⚠️ **Moderation:** Aktif tapi belum ada Moderator Role`
        : `❌ **Moderation:** Belum dikonfigurasi`,

    g?.channelId
      ? `✅ **Giveaway:** Ready`
      : `❌ **Giveaway:** Channel belum dikonfigurasi`,

    tk?.enabled && tk?.panels?.length > 0
      ? `✅ **Take Role:** Ready (${tk.panels.length} panel)`
      : `⚠️ **Take Role:** Belum ada panel aktif`,

    inv?.enabled && inv?.logChannelId
      ? `✅ **Invite Tracker:** Ready`
      : `⚠️ **Invite Tracker:** Belum sepenuhnya dikonfigurasi`,

    Object.values(l?.channels ?? {}).some(Boolean)
      ? `✅ **Logs:** ${Object.values(l.channels).filter(Boolean).length} channel aktif`
      : `⚠️ **Logs:** Belum ada log channel`,

    sm?.systemLogs?.enabled && sm?.systemLogs?.channelId
      ? `✅ **System Manager:** Ready`
      : sm?.systemLogs?.channelId
        ? `⚠️ **System Manager:** Channel diset tapi disabled`
        : `❌ **System Manager:** System Logs belum dikonfigurasi`,

    backups.length > 0
      ? `✅ **Backup:** ${backups.length} backup tersedia`
      : `⚠️ **Backup:** Belum ada backup config`,

    `⬜ **Help Center:** _Modul belum terpasang_`,
    `⬜ **Link Bypass:** _Modul belum terpasang_`,
  ];

  const allOk = lines.filter((l) => l.startsWith('✅')).length;
  const warn  = lines.filter((l) => l.startsWith('⚠️')).length;
  const miss  = lines.filter((l) => l.startsWith('❌')).length;

  const embed = new EmbedBuilder()
    .setColor(miss > 0 ? Colors.ERROR : warn > 0 ? Colors.WARNING : Colors.SUCCESS)
    .setAuthor({ name: '📋 Audit Config' })
    .setDescription(
      `Periksa kelengkapan konfigurasi semua fitur.\n${DIVIDER}\n` +
      lines.join('\n') +
      `\n${DIVIDER}`
    )
    .addFields(
      { name: '✅ Ready',   value: `${allOk}`, inline: true },
      { name: '⚠️ Warning', value: `${warn}`,  inline: true },
      { name: '❌ Missing', value: `${miss}`,  inline: true },
    )
    .setTimestamp();

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup1:systemmanager:audit_refresh')
          .setLabel('Refresh Audit').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        backBtn('sm_main'),
      ),
    ],
  };
}

// ─── Advanced ─────────────────────────────────────────────────────────────────

function buildAdvancedPage(cfg) {
  const adv = cfg.systemManager.advanced;

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: '⚙️ Advanced' })
    .setDescription(`Pengaturan lanjutan sistem bot.\n${DIVIDER}`)
    .addFields(
      { name: '🐛 Debug Mode',       value: statusDot(adv.debugMode),                   inline: true },
      { name: '🔧 Maintenance Mode', value: adv.maintenanceMode ? '🔧 Aktif' : '✅ Normal', inline: true },
      { name: '🔄 Retry Limit',      value: `${adv.retryLimit} kali`,                    inline: true },
      { name: '⏳ Default Timeout',  value: `${adv.defaultTimeout} detik`,               inline: true },
    )
    .setFooter({ text: 'Maintenance Mode: bot menolak semua perintah kecuali owner.' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup1:systemmanager:adv_select')
    .setPlaceholder('Pilih pengaturan...')
    .addOptions([
      { label: 'Debug Mode',       value: 'debug',       emoji: '🐛', description: `Saat ini: ${adv.debugMode ? 'ON' : 'OFF'}` },
      { label: 'Retry Limit',      value: 'retry',       emoji: '🔄', description: `Saat ini: ${adv.retryLimit} kali` },
      { label: 'Default Timeout',  value: 'timeout',     emoji: '⏳', description: `Saat ini: ${adv.defaultTimeout} detik` },
      { label: 'Maintenance Mode', value: 'maintenance', emoji: '🔧', description: `Saat ini: ${adv.maintenanceMode ? 'ON' : 'OFF'}` },
    ]);

  return {
    embed,
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(backBtn('sm_main')),
    ],
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const plugin = {
  id:                 'systemmanager',
  label:              'System Manager',
  emoji:              '🚨',
  description:        'Error system, system logs, backup, status, audit, dan pengaturan lanjutan.',
  order:              99,
  requiredPermission: PermissionFlagsBits.Administrator,

  getStatus(cfg) {
    const sm    = cfg.systemManager;
    const logsOn = sm?.systemLogs?.enabled ?? false;
    const errs   = sm?.errorHistory?.length ?? 0;
    return {
      enabled: logsOn,
      summary: logsOn ? `Logs aktif · ${errs} error` : `${errs} error tercatat`,
    };
  },

  async buildPage(cfg, session) {
    return buildMainPage(cfg);
  },

  // ── handleInteraction ────────────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {
    const guildId = session.guildId;
    const reload  = () => loadGuildConfig(guildId);

    // ── Main dropdown ────────────────────────────────────────────────────────
    if (action === 'main_select') {
      const choice = interaction.values[0];
      if (choice === 'error_system') {
        const page = buildErrorSystemPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'system_logs') {
        const page = buildSystemLogsPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'backup') {
        const page = await buildBackupPage(cfg, session);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'bot_status') {
        const page = await buildStatusPage(interaction.client, cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'audit_config') {
        const page = await buildAuditPage(cfg, session);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'advanced') {
        const page = buildAdvancedPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      return;
    }

    // ── Back to main ─────────────────────────────────────────────────────────
    if (action === 'sm_main') {
      const fresh = await reload();
      const page  = buildMainPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Back to error system ─────────────────────────────────────────────────
    if (action === 'sm_error_system') {
      const fresh = await reload();
      const page  = buildErrorSystemPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ERROR SYSTEM
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'err_select') {
      const choice = interaction.values[0];

      if (choice === 'err_user_msg') {
        const page = buildUserMsgPreviewPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_embed_style') {
        const page = buildEmbedStylePage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_banner_gif') {
        const page = buildBannerGifPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_log_channel') {
        const page = buildChannelSelectPage(
          '📢 Error Log Channel',
          'Pilih channel untuk menerima laporan error detail (hanya terlihat oleh owner).',
          'setup1:systemmanager:err_log_ch_select',
          'setup1:systemmanager:sm_error_system',
        );
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_auto_retry') {
        const es      = cfg.systemManager.errorSystem;
        const newVal  = !es.autoRetry;
        await updateSection(guildId, 'systemManager', {
          errorSystem: { ...es, autoRetry: newVal },
        });
        const fresh = await reload();
        const page  = buildErrorSystemPage(fresh);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_history') {
        const page = buildErrorHistoryPage(cfg);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      if (choice === 'err_auto_rec') {
        const es     = cfg.systemManager.errorSystem;
        const newVal = !es.autoRecommendation;
        await updateSection(guildId, 'systemManager', {
          errorSystem: { ...es, autoRecommendation: newVal },
        });
        const fresh = await reload();
        const page  = buildErrorSystemPage(fresh);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }
      return;
    }

    // ── User message modal trigger ───────────────────────────────────────────
    if (action === 'open_user_msg_modal') {
      const um = cfg.systemManager.errorSystem.userMessage ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:systemmanager:user_msg')
        .setTitle('📝 Edit User Error Message');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title')
            .setLabel('Judul (gunakan {user}, {feature}, {error_code}, {server}, {time})')
            .setStyle(TextInputStyle.Short).setValue(um.title ?? '').setMaxLength(100).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description')
            .setLabel('Deskripsi').setStyle(TextInputStyle.Paragraph)
            .setValue(um.description ?? '').setMaxLength(1000).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('footer')
            .setLabel('Footer').setStyle(TextInputStyle.Short)
            .setValue(um.footer ?? '').setMaxLength(100).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color')
            .setLabel('Warna (#hex, contoh: #ED4245)')
            .setStyle(TextInputStyle.Short).setValue(um.color ?? '#ED4245')
            .setMaxLength(7).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('emoji')
            .setLabel('Emoji').setStyle(TextInputStyle.Short)
            .setValue(um.emoji ?? '❌').setMaxLength(10).setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Embed style modal trigger ────────────────────────────────────────────
    if (action === 'open_style_modal') {
      const um = cfg.systemManager.errorSystem.userMessage ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:systemmanager:embed_style')
        .setTitle('🎨 Edit Embed Style');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color')
            .setLabel('Warna (#hex)').setStyle(TextInputStyle.Short)
            .setValue(um.color ?? '#ED4245').setMaxLength(7).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('emoji')
            .setLabel('Emoji').setStyle(TextInputStyle.Short)
            .setValue(um.emoji ?? '❌').setMaxLength(10).setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Banner/GIF modal trigger ─────────────────────────────────────────────
    if (action === 'open_gif_modal') {
      const um = cfg.systemManager.errorSystem.userMessage ?? {};
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:systemmanager:banner_gif')
        .setTitle('🖼️ Set Banner / GIF');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('gif')
            .setLabel('URL GIF / Banner (biarkan kosong untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setValue(um.gif ?? '').setMaxLength(300).setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Clear GIF ────────────────────────────────────────────────────────────
    if (action === 'clear_gif') {
      const es = cfg.systemManager.errorSystem;
      await updateSection(guildId, 'systemManager', {
        errorSystem: { ...es, userMessage: { ...es.userMessage, gif: null } },
      });
      const fresh = await reload();
      const page  = buildBannerGifPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Error log channel select ─────────────────────────────────────────────
    if (action === 'err_log_ch_select') {
      session.wizardData.smPendingChannel  = interaction.values[0];
      session.wizardData.smChannelTarget   = 'errorLogChannel';
      const page = buildChannelPreviewPage(
        '📢 Error Log Channel — Preview',
        'Channel ini akan menerima laporan detail error (hanya terlihat owner).',
        interaction.values[0],
        'setup1:systemmanager:err_log_ch_confirm',
        'setup1:systemmanager:err_log_ch_retry',
        'setup1:systemmanager:sm_error_system',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'err_log_ch_confirm') {
      const channelId = session.wizardData.smPendingChannel;
      if (channelId) {
        const es = cfg.systemManager.errorSystem;
        await updateSection(guildId, 'systemManager', {
          errorSystem: { ...es, logChannelId: channelId },
        });
      }
      session.wizardData.smPendingChannel = null;
      const fresh = await reload();
      const page  = buildErrorSystemPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'err_log_ch_retry') {
      session.wizardData.smPendingChannel = null;
      const page = buildChannelSelectPage(
        '📢 Error Log Channel',
        'Pilih ulang channel untuk laporan error.',
        'setup1:systemmanager:err_log_ch_select',
        'setup1:systemmanager:sm_error_system',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Clear error history ──────────────────────────────────────────────────
    if (action === 'clear_history') {
      await updateSection(guildId, 'systemManager', { errorHistory: [] });
      const fresh = await reload();
      const page  = buildErrorHistoryPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SYSTEM LOGS
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'logs_enable' || action === 'logs_disable') {
      const sl = cfg.systemManager.systemLogs;
      await updateSection(guildId, 'systemManager', {
        systemLogs: { ...sl, enabled: action === 'logs_enable' },
      });
      const fresh = await reload();
      const page  = buildSystemLogsPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'logs_set_channel') {
      const page = buildChannelSelectPage(
        '📜 System Logs — Set Channel',
        'Pilih satu channel untuk semua event log sistem bot.',
        'setup1:systemmanager:logs_ch_select',
        'setup1:systemmanager:sm_logs',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'sm_logs') {
      const fresh = await reload();
      const page  = buildSystemLogsPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'logs_ch_select') {
      session.wizardData.smPendingChannel = interaction.values[0];
      const page = buildChannelPreviewPage(
        '📜 System Logs — Preview Channel',
        'Channel ini akan menerima semua event log sistem bot.',
        interaction.values[0],
        'setup1:systemmanager:logs_ch_confirm',
        'setup1:systemmanager:logs_ch_retry',
        'setup1:systemmanager:sm_logs',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'logs_ch_confirm') {
      const channelId = session.wizardData.smPendingChannel;
      if (channelId) {
        const sl = cfg.systemManager.systemLogs;
        await updateSection(guildId, 'systemManager', {
          systemLogs: { ...sl, channelId },
        });
      }
      session.wizardData.smPendingChannel = null;
      const fresh = await reload();
      const page  = buildSystemLogsPage(fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'logs_ch_retry') {
      session.wizardData.smPendingChannel = null;
      const page = buildChannelSelectPage(
        '📜 System Logs — Set Channel',
        'Pilih ulang channel untuk log sistem.',
        'setup1:systemmanager:logs_ch_select',
        'setup1:systemmanager:sm_logs',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BACKUP & RESTORE
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'bk_create') {
      const backupId = await backupGuildConfig(guildId);
      const fresh    = await reload();

      if (backupId) {
        // Send system log if configured
        await svc.sendSystemLog(interaction.client, guildId, 'Backup Created', {
          'Backup ID': backupId,
          'Dibuat oleh': interaction.user.tag,
        });
      }

      const page = await buildBackupPage(fresh, session);
      page.embed.setDescription(
        (backupId
          ? `✅ **Backup berhasil dibuat.** ID: \`${backupId}\`\n\n`
          : `⚠️ Tidak ada konfigurasi yang perlu di-backup.\n\n`) +
        (page.embed.data.description ?? '')
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'bk_restore_select') {
      const backupId = interaction.values[0];
      session.wizardData.smPendingRestoreId = backupId;

      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('♻️ Restore Config — Konfirmasi')
        .setDescription(
          `Restore backup \`${backupId}\`?\n\n${DIVIDER}\n` +
          `**Konfigurasi saat ini akan ditimpa.**\n` +
          `_(Backup otomatis dibuat sebelum restore.)_`
        );

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('setup1:systemmanager:bk_restore_confirm')
              .setLabel('Ya, Restore').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('setup1:systemmanager:bk_back')
              .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (action === 'bk_restore_confirm') {
      const backupId = session.wizardData.smPendingRestoreId;
      if (!backupId) {
        return interaction.update({ content: '⚠️ Tidak ada backup yang dipilih.', embeds: [], components: [] });
      }
      try {
        await backupGuildConfig(guildId);
        await restoreBackup(guildId, backupId);
        delete session.wizardData.smPendingRestoreId;

        await svc.sendSystemLog(interaction.client, guildId, 'Backup Restored', {
          'Backup ID':   backupId,
          'Dipulihkan oleh': interaction.user.tag,
        });

        const fresh = await reload();
        const page  = await buildBackupPage(fresh, session);
        page.embed.setDescription(`✅ **Config berhasil di-restore dari \`${backupId}\`.**\n\n` + (page.embed.data.description ?? ''));
        return interaction.update({ embeds: [page.embed], components: page.components });
      } catch (err) {
        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.ERROR)
              .setTitle('❌ Restore Gagal')
              .setDescription(`Tidak dapat me-restore backup: ${err.message}`)
          ],
          components: [new ActionRowBuilder().addComponents(backBtn('sm_main'))],
        });
      }
    }

    if (action === 'bk_back') {
      delete session.wizardData.smPendingRestoreId;
      const fresh = await reload();
      const page  = await buildBackupPage(fresh, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BOT STATUS
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'status_refresh') {
      const fresh = await reload();
      const page  = await buildStatusPage(interaction.client, fresh);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // AUDIT CONFIG
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'audit_refresh') {
      const fresh = await reload();
      const page  = await buildAuditPage(fresh, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ADVANCED
    // ════════════════════════════════════════════════════════════════════════

    if (action === 'adv_select') {
      const choice = interaction.values[0];
      const adv    = cfg.systemManager.advanced;

      if (choice === 'debug') {
        const newVal = !adv.debugMode;
        await updateSection(guildId, 'systemManager', { advanced: { ...adv, debugMode: newVal } });
        const fresh = await reload();
        const page  = buildAdvancedPage(fresh);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }

      if (choice === 'maintenance') {
        const newVal = !adv.maintenanceMode;
        await updateSection(guildId, 'systemManager', { advanced: { ...adv, maintenanceMode: newVal } });
        await svc.sendSystemLog(interaction.client, guildId, newVal ? 'Bot Restart' : 'Bot Start', {
          Detail: newVal ? 'Maintenance Mode diaktifkan' : 'Maintenance Mode dinonaktifkan',
          Oleh:   interaction.user.tag,
        });
        const fresh = await reload();
        const page  = buildAdvancedPage(fresh);
        return interaction.update({ embeds: [page.embed], components: page.components });
      }

      if (choice === 'retry') {
        const modal = new ModalBuilder()
          .setCustomId('setup1:modal:systemmanager:adv_retry')
          .setTitle('🔄 Retry Limit');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('value')
              .setLabel('Jumlah retry (1–10)').setStyle(TextInputStyle.Short)
              .setValue(String(adv.retryLimit)).setMaxLength(2).setRequired(true),
          ),
        );
        return interaction.showModal(modal);
      }

      if (choice === 'timeout') {
        const modal = new ModalBuilder()
          .setCustomId('setup1:modal:systemmanager:adv_timeout')
          .setTitle('⏳ Default Timeout');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('value')
              .setLabel('Timeout dalam detik (5–300)').setStyle(TextInputStyle.Short)
              .setValue(String(adv.defaultTimeout)).setMaxLength(3).setRequired(true),
          ),
        );
        return interaction.showModal(modal);
      }
    }
  },

  // ── handleModal ──────────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {
    const guildId = session.guildId;
    const reload  = () => loadGuildConfig(guildId);

    // ── User Error Message ───────────────────────────────────────────────────
    if (field === 'user_msg') {
      const title       = interaction.fields.getTextInputValue('title').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const footer      = interaction.fields.getTextInputValue('footer').trim();
      const color       = interaction.fields.getTextInputValue('color').trim() || '#ED4245';
      const emoji       = interaction.fields.getTextInputValue('emoji').trim() || '❌';

      const hexOk = /^#[0-9A-Fa-f]{6}$/.test(color);
      const es    = cfg.systemManager.errorSystem;
      await updateSection(guildId, 'systemManager', {
        errorSystem: {
          ...es,
          userMessage: {
            ...es.userMessage,
            title,
            description,
            footer,
            color: hexOk ? color : (es.userMessage?.color ?? '#ED4245'),
            emoji,
          },
        },
      });

      await svc.sendSystemLog(interaction.client, guildId, 'Configuration Updated', {
        Fitur: 'System Manager → User Error Message',
        Oleh:  interaction.user.tag,
      });

      await interaction.reply({ content: `✅ Pesan error berhasil diperbarui.${!hexOk ? '\n⚠️ Format warna tidak valid, warna sebelumnya dipertahankan.' : ''}`, ephemeral: true });
    }

    // ── Embed Style ──────────────────────────────────────────────────────────
    if (field === 'embed_style') {
      const color  = interaction.fields.getTextInputValue('color').trim();
      const emoji  = interaction.fields.getTextInputValue('emoji').trim() || '❌';
      const hexOk  = /^#[0-9A-Fa-f]{6}$/.test(color);
      const es     = cfg.systemManager.errorSystem;
      await updateSection(guildId, 'systemManager', {
        errorSystem: {
          ...es,
          userMessage: {
            ...es.userMessage,
            color: hexOk ? color : (es.userMessage?.color ?? '#ED4245'),
            emoji,
          },
        },
      });
      await interaction.reply({ content: `✅ Embed style diperbarui.${!hexOk ? '\n⚠️ Format warna tidak valid.' : ''}`, ephemeral: true });
    }

    // ── Banner / GIF ─────────────────────────────────────────────────────────
    if (field === 'banner_gif') {
      const gif = interaction.fields.getTextInputValue('gif').trim() || null;
      const es  = cfg.systemManager.errorSystem;
      await updateSection(guildId, 'systemManager', {
        errorSystem: {
          ...es,
          userMessage: { ...es.userMessage, gif },
        },
      });
      await interaction.reply({ content: gif ? `✅ GIF/Banner diset.` : `✅ GIF/Banner dihapus.`, ephemeral: true });
    }

    // ── Advanced: Retry Limit ────────────────────────────────────────────────
    if (field === 'adv_retry') {
      const raw   = parseInt(interaction.fields.getTextInputValue('value'), 10);
      const value = isNaN(raw) ? 3 : Math.min(10, Math.max(1, raw));
      const adv   = cfg.systemManager.advanced;
      await updateSection(guildId, 'systemManager', { advanced: { ...adv, retryLimit: value } });
      await interaction.reply({ content: `✅ Retry limit diset ke **${value}** kali.`, ephemeral: true });
    }

    // ── Advanced: Default Timeout ────────────────────────────────────────────
    if (field === 'adv_timeout') {
      const raw   = parseInt(interaction.fields.getTextInputValue('value'), 10);
      const value = isNaN(raw) ? 30 : Math.min(300, Math.max(5, raw));
      const adv   = cfg.systemManager.advanced;
      await updateSection(guildId, 'systemManager', { advanced: { ...adv, defaultTimeout: value } });
      await interaction.reply({ content: `✅ Default timeout diset ke **${value}** detik.`, ephemeral: true });
    }
  },
};

export default plugin;
