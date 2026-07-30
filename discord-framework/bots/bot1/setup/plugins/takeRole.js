/**
 * Plugin: 🎭 Take Role
 *
 * Full implementation of the Take Role feature within the Bot 1 Setup Wizard.
 *
 * ── Create Panel flow ──────────────────────────────────────────────────────
 *   new_panel → ch_select → mode_d/mode_b → role_select
 *             → set_info (modal) → preview → confirm_pub (validate+publish)
 *
 * ── Manage Panel flow ─────────────────────────────────────────────────────
 *   panel_{id}
 *     → ei_{id} (Edit Info modal)
 *     → eo_{id} (Edit Options modal)
 *     → emj_{id} (show role select for emoji) → emj_s_{id} (role selected → modal)
 *     → ar_{id}  (Add Roles — RoleSelectMenu) → ar_s_{id}
 *     → rr_{id}  (Remove Roles — StringSelectMenu) → rr_s_{id}
 *     → ord_{id} (Reorder modal)
 *     → mc_{id}  (mode choice) → mc_d_{id} / mc_b_{id}
 *     → cc_{id}  (Change Channel — ChannelSelectMenu) → cc_s_{id}
 *     → pub_{id}    (Publish to channel)
 *     → repub_{id}  (Re-publish after message was deleted)
 *     → upd_{id}    (Update already-published message)
 *     → del_{id}    (Delete confirm) → delok_{id}
 *
 * ── Modal fields (prefix: setup1:modal:takerole:{field}) ──────────────────
 *   create_info          — title/desc/color/thumbnail/footer for new panel
 *   ei_{panelId}         — edit info for existing panel
 *   eo_{panelId}         — edit options (placeholder/maxRoles/single/toggle)
 *   emj_{roleId}_{panelId} — set emoji for one role in existing panel
 *   ord_{panelId}        — reorder roles
 *   create_opts          — options for new panel (used in create flow preview)
 *
 * ── Permission ────────────────────────────────────────────────────────────
 *   Manage Roles OR Administrator
 *
 * ── Auto Recovery ─────────────────────────────────────────────────────────
 *   onRecover() verifies published messages still exist and logs panel status.
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildRoleSelectPage,
} from '../ui.js';
import { updateSection, loadGuildConfig, saveGuildConfig } from '../config.js';
import {
  validateRoles,
  validateTextChannel,
  buildValidationErrorEmbed,
} from '../../../../shared/setup/validation.js';
import {
  buildPanelEmbed,
  buildPanelComponents,
} from '../../features/takeRole/panelBuilder.js';
import { createLogger } from '../../../../shared/logger/index.js';

const logger = createLogger('BOT1');

// ---------------------------------------------------------------------------
// Draft helpers (wizard session state)
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'takeRoleDraft';
const getDraft  = (session) => session.wizardData[DRAFT_KEY] ?? {};
const setDraft  = (session, data) => {
  session.wizardData[DRAFT_KEY] = { ...getDraft(session), ...data };
};
const clearDraft = (session) => { session.wizardData[DRAFT_KEY] = {}; };

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = {
  id:                 'takerole',
  label:              'Take Role',
  emoji:              '🎭',
  description:        'Konfigurasi panel untuk user mengambil role sendiri.',
  order:              2,
  requiredPermission: PermissionFlagsBits.ManageRoles,

  // ── Status summary for main wizard page ──────────────────────────────────

  getStatus(cfg) {
    const count = cfg.takeRole.panels?.length ?? 0;
    return {
      enabled: cfg.takeRole.enabled,
      summary: `${count} panel dikonfigurasi`,
    };
  },

  // ── Main panel listing page ───────────────────────────────────────────────

  async buildPage(cfg, session) {
    const panels = cfg.takeRole.panels ?? [];

    const embed = new EmbedBuilder()
      .setColor(cfg.takeRole.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '🎭  Take Role' })
      .setDescription(`Konfigurasi panel Take Role untuk server ini.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status', value: statusDot(cfg.takeRole.enabled), inline: true },
        { name: '📋  Panel',  value: `${panels.length} panel`,         inline: true },
      )
      .setFooter({ text: 'Buat panel baru atau kelola panel yang sudah ada.' });

    if (panels.length > 0) {
      const list = panels.map((p, i) => {
        const pubStatus = p.messageId ? '✅ Dipublish' : '📝 Draft';
        return (
          `**${i + 1}.** ${channelLabel(p.channelId)} — ` +
          `Mode: \`${p.mode}\` — ${p.roles?.length ?? 0} role — ${pubStatus}`
        );
      }).join('\n');
      embed.addFields({ name: '🗂️  Daftar Panel', value: list.slice(0, 1024) });
    }

    // Row 1: enable/disable + new panel
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup1:takerole:enable')
        .setLabel('Enable').setEmoji('🟢').setStyle(ButtonStyle.Success)
        .setDisabled(cfg.takeRole.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:takerole:disable')
        .setLabel('Disable').setEmoji('🔴').setStyle(ButtonStyle.Danger)
        .setDisabled(!cfg.takeRole.enabled),
      new ButtonBuilder()
        .setCustomId('setup1:takerole:new_panel')
        .setLabel('Panel Baru').setEmoji('➕').setStyle(ButtonStyle.Primary),
    );

    const components = [row1];

    // Rows for per-panel manage buttons (up to 10 panels, 5 per row)
    if (panels.length > 0) {
      const slice1 = panels.slice(0, 5);
      const row2 = new ActionRowBuilder().addComponents(
        slice1.map((p, i) =>
          new ButtonBuilder()
            .setCustomId(`setup1:takerole:panel_${p.id}`)
            .setLabel(`Panel ${i + 1}`)
            .setEmoji('⚙️')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      components.push(row2);

      if (panels.length > 5) {
        const slice2 = panels.slice(5, 10);
        const row3 = new ActionRowBuilder().addComponents(
          slice2.map((p, i) =>
            new ButtonBuilder()
              .setCustomId(`setup1:takerole:panel_${p.id}`)
              .setLabel(`Panel ${i + 6}`)
              .setEmoji('⚙️')
              .setStyle(ButtonStyle.Secondary)
          )
        );
        components.push(row3);
      }
    }

    components.push(buildNavRow());
    return { embed, components };
  },

  // ── Interaction router ────────────────────────────────────────────────────

  async handleInteraction(interaction, session, cfg, action) {

    // ── Toggle enable/disable ─────────────────────────────────────────────
    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'takeRole', { enabled: action === 'enable' });
      logger.info(`[TakeRole] ${action === 'enable' ? 'Enabled' : 'Disabled'} in guild ${session.guildId}`);
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Panel management page ─────────────────────────────────────────────
    if (action.startsWith('panel_')) {
      const panelId = action.slice(6);
      const panel   = findPanel(cfg, panelId);
      if (!panel) {
        return interaction.update({
          embeds:     [errorEmbed('Panel tidak ditemukan.')],
          components: [buildNavRow()],
        });
      }
      return showPanelManagePage(interaction, session, panel, interaction.guild);
    }

    // ── Back to main listing ──────────────────────────────────────────────
    if (action === 'back_to_main') {
      clearDraft(session);
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ══════════════════════════════════════════════════════════════════════
    // CREATE PANEL WIZARD
    // ══════════════════════════════════════════════════════════════════════

    if (action === 'new_panel') {
      clearDraft(session);
      setDraft(session, { step: 'channel' });
      const page = buildChannelSelectPage(
        '🎭  Take Role — Langkah 1/5: Channel',
        'Pilih channel tempat panel Take Role akan dikirim.',
        'setup1:takerole:ch_select',
        'setup1:takerole:back_to_main',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_select') {
      setDraft(session, { channelId: interaction.values[0], step: 'mode' });
      return showCreateModeStep(interaction, session);
    }

    if (action === 'mode_d' || action === 'mode_b') {
      setDraft(session, { mode: action === 'mode_d' ? 'dropdown' : 'button', step: 'roles' });
      const page = buildRoleSelectPage(
        '🎭  Take Role — Langkah 3/5: Pilih Role',
        'Pilih role yang tersedia di panel ini (maks. 25).',
        'setup1:takerole:role_select',
        'setup1:takerole:back_to_mode',
        25,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'back_to_mode') {
      return showCreateModeStep(interaction, session);
    }

    if (action === 'role_select') {
      const roles = interaction.values.map((id) => ({
        roleId: id,
        name:   interaction.guild?.roles.cache.get(id)?.name ?? null,
        emoji:  null,
        description: null,
      }));
      setDraft(session, { roles, step: 'info' });
      return showCreateInfoModal(interaction, session);
    }

    if (action === 'set_info') {
      // Reopen info modal (user clicked "Atur Info Panel" button)
      return showCreateInfoModal(interaction, session);
    }

    if (action === 'set_opts') {
      // Open options modal in create flow
      return showCreateOptsModal(interaction, getDraft(session));
    }

    if (action === 'preview') {
      return showCreatePreview(interaction, session, interaction.guild);
    }

    if (action === 'back_to_roles') {
      const page = buildRoleSelectPage(
        '🎭  Take Role — Langkah 3/5: Pilih Role',
        'Pilih role yang tersedia di panel ini (maks. 25).',
        'setup1:takerole:role_select',
        'setup1:takerole:back_to_mode',
        25,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'confirm_pub') {
      return doPublishNew(interaction, session, cfg);
    }

    // ══════════════════════════════════════════════════════════════════════
    // MANAGE EXISTING PANEL
    // ══════════════════════════════════════════════════════════════════════

    // -- Edit Info modal --
    if (action.startsWith('ei_')) {
      const panelId = action.slice(3);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);
      return interaction.showModal(buildInfoModal(`ei_${panelId}`, panel));
    }

    // -- Edit Options modal --
    if (action.startsWith('eo_')) {
      const panelId = action.slice(3);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);
      return interaction.showModal(buildOptsModal(`eo_${panelId}`, panel));
    }

    // -- Edit emoji: show role select --
    if (action.startsWith('emj_') && !action.startsWith('emj_s_')) {
      const panelId = action.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel || !panel.roles?.length) return replyNotFound(interaction);

      const options = panel.roles.slice(0, 25).map((r) => ({
        label: (r.name || r.roleId).slice(0, 100),
        value: r.roleId,
        description: r.emoji ? `Emoji saat ini: ${r.emoji}` : 'Belum ada emoji',
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`setup1:takerole:emj_s_${panelId}`)
        .setPlaceholder('Pilih role untuk diatur emojinya...')
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setTitle('🎭  Edit Emoji — Pilih Role')
        .setDescription(`Pilih role yang ingin diatur emojinya.\n${DIVIDER}`);

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(select),
          buildManageNavRow(panelId),
        ],
      });
    }

    // -- Edit emoji: role selected → show modal --
    if (action.startsWith('emj_s_')) {
      const panelId = action.slice(6);
      const roleId  = interaction.values?.[0];
      const panel   = findPanel(cfg, panelId);
      const role    = panel?.roles?.find((r) => r.roleId === roleId);
      if (!role) return replyNotFound(interaction);

      const modal = new ModalBuilder()
        .setCustomId(`setup1:modal:takerole:emj_${roleId}_${panelId}`)
        .setTitle('Edit Emoji Role');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel(`Emoji untuk ${(role.name || roleId).slice(0, 30)}`)
            .setStyle(TextInputStyle.Short)
            .setValue(role.emoji ?? '')
            .setMaxLength(100)
            .setPlaceholder('Contoh: ⭐ atau :star:')
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Deskripsi (untuk dropdown mode)')
            .setStyle(TextInputStyle.Short)
            .setValue(role.description ?? '')
            .setMaxLength(100)
            .setPlaceholder('Opsional — deskripsi singkat role ini.')
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    // -- Add Roles --
    if (action.startsWith('ar_') && !action.startsWith('ar_s_')) {
      const panelId = action.slice(3);
      const page = buildRoleSelectPage(
        '🎭  Tambah Role ke Panel',
        'Pilih role tambahan untuk ditambahkan ke panel.',
        `setup1:takerole:ar_s_${panelId}`,
        `setup1:takerole:panel_${panelId}`,
        25,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // -- Add Roles selected --
    if (action.startsWith('ar_s_')) {
      const panelId  = action.slice(5);
      const panel    = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);

      const existing = new Set(panel.roles.map((r) => r.roleId));
      const newRoles = interaction.values
        .filter((id) => !existing.has(id))
        .map((id) => ({
          roleId: id,
          name:   interaction.guild?.roles.cache.get(id)?.name ?? null,
          emoji:  null,
          description: null,
        }));

      if (newRoles.length === 0) {
        return interaction.update({
          embeds:     [errorEmbed('Semua role yang dipilih sudah ada di panel.')],
          components: [buildManageNavRow(panelId)],
        });
      }

      const combined = [...panel.roles, ...newRoles].slice(0, 25);
      await updatePanelField(session.guildId, panelId, { roles: combined });
      logger.info(`[TakeRole] Added ${newRoles.length} role(s) to panel ${panelId} in guild ${session.guildId}`);

      const fresh = await loadGuildConfig(session.guildId);
      const updated = findPanel(fresh, panelId);
      return showPanelManagePage(interaction, session, updated, interaction.guild, `✅ ${newRoles.length} role berhasil ditambahkan.`);
    }

    // -- Remove Roles --
    if (action.startsWith('rr_') && !action.startsWith('rr_s_')) {
      const panelId = action.slice(3);
      const panel   = findPanel(cfg, panelId);
      if (!panel || !panel.roles?.length) return replyNotFound(interaction);

      const options = panel.roles.map((r) => ({
        label: (r.name || r.roleId).slice(0, 100),
        value: r.roleId,
        description: `ID: ${r.roleId}`,
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`setup1:takerole:rr_s_${panelId}`)
        .setPlaceholder('Pilih role yang ingin dihapus dari panel...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('🎭  Hapus Role dari Panel')
        .setDescription(`Pilih role yang ingin dihapus dari panel.\n${DIVIDER}\nRole yang dipilih akan dihapus dari konfigurasi panel.`);

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(select),
          buildManageNavRow(panelId),
        ],
      });
    }

    // -- Remove Roles selected --
    if (action.startsWith('rr_s_')) {
      const panelId = action.slice(5);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);

      const toRemove = new Set(interaction.values);
      const remaining = panel.roles.filter((r) => !toRemove.has(r.roleId));

      await updatePanelField(session.guildId, panelId, { roles: remaining });
      logger.info(`[TakeRole] Removed ${toRemove.size} role(s) from panel ${panelId} in guild ${session.guildId}`);

      const fresh   = await loadGuildConfig(session.guildId);
      const updated = findPanel(fresh, panelId);
      return showPanelManagePage(interaction, session, updated, interaction.guild, `✅ ${toRemove.size} role berhasil dihapus.`);
    }

    // -- Reorder Roles --
    if (action.startsWith('ord_')) {
      const panelId = action.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);

      const currentOrder = panel.roles
        .map((r, i) => `${i + 1}. ${r.name || r.roleId}`)
        .join('\n');

      const modal = new ModalBuilder()
        .setCustomId(`setup1:modal:takerole:ord_${panelId}`)
        .setTitle('Urutan Role');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('order')
            .setLabel('Urutan baru (nomor dipisah koma)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(panel.roles.map((_, i) => i + 1).join(', '))
            .setPlaceholder(`Urutan saat ini:\n${currentOrder}\n\nMasukkan urutan baru: misal 2,1,3`)
            .setRequired(true),
        ),
      );
      return interaction.showModal(modal);
    }

    // -- Change Mode --
    if (action.startsWith('mc_') && !action.startsWith('mc_d_') && !action.startsWith('mc_b_')) {
      const panelId = action.slice(3);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);

      const embed = new EmbedBuilder()
        .setColor(Colors.DARK)
        .setTitle('🎭  Ganti Mode Panel')
        .setDescription(`Mode saat ini: \`${panel.mode}\`\n${DIVIDER}\nPilih mode baru:`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`setup1:takerole:mc_d_${panelId}`)
          .setLabel('📋 Dropdown').setStyle(ButtonStyle.Primary)
          .setDisabled(panel.mode === 'dropdown'),
        new ButtonBuilder()
          .setCustomId(`setup1:takerole:mc_b_${panelId}`)
          .setLabel('🔘 Button').setStyle(ButtonStyle.Primary)
          .setDisabled(panel.mode === 'button'),
        new ButtonBuilder()
          .setCustomId(`setup1:takerole:panel_${panelId}`)
          .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    // -- Change Mode: dropdown --
    if (action.startsWith('mc_d_')) {
      const panelId = action.slice(5);
      await updatePanelField(session.guildId, panelId, { mode: 'dropdown' });
      logger.info(`[TakeRole] Changed mode to dropdown for panel ${panelId}`);
      const fresh   = await loadGuildConfig(session.guildId);
      const updated = findPanel(fresh, panelId);
      return showPanelManagePage(interaction, session, updated, interaction.guild, '✅ Mode diubah ke Dropdown.');
    }

    // -- Change Mode: button --
    if (action.startsWith('mc_b_')) {
      const panelId = action.slice(5);
      await updatePanelField(session.guildId, panelId, { mode: 'button' });
      logger.info(`[TakeRole] Changed mode to button for panel ${panelId}`);
      const fresh   = await loadGuildConfig(session.guildId);
      const updated = findPanel(fresh, panelId);
      return showPanelManagePage(interaction, session, updated, interaction.guild, '✅ Mode diubah ke Button.');
    }

    // -- Change Channel --
    if (action.startsWith('cc_') && !action.startsWith('cc_s_')) {
      const panelId = action.slice(3);
      const page = buildChannelSelectPage(
        '🎭  Ganti Channel Panel',
        'Pilih channel baru untuk panel ini.',
        `setup1:takerole:cc_s_${panelId}`,
        `setup1:takerole:panel_${panelId}`,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // -- Change Channel selected --
    if (action.startsWith('cc_s_')) {
      const panelId   = action.slice(5);
      const channelId = interaction.values[0];
      await updatePanelField(session.guildId, panelId, { channelId, messageId: null });
      logger.info(`[TakeRole] Changed channel to ${channelId} for panel ${panelId}`);
      const fresh   = await loadGuildConfig(session.guildId);
      const updated = findPanel(fresh, panelId);
      return showPanelManagePage(interaction, session, updated, interaction.guild, '✅ Channel diubah. Panel perlu dipublish ulang.');
    }

    // -- Publish --
    if (action.startsWith('pub_') && !action.startsWith('repub_')) {
      const panelId = action.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);
      return doPublishExisting(interaction, session, panel, false);
    }

    // -- Re-publish (message was deleted) --
    if (action.startsWith('repub_')) {
      const panelId = action.slice(6);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);
      return doPublishExisting(interaction, session, panel, false);
    }

    // -- Update published panel message --
    if (action.startsWith('upd_')) {
      const panelId = action.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);
      return doPublishExisting(interaction, session, panel, true);
    }

    // -- Delete panel (confirm prompt) --
    if (action.startsWith('del_') && !action.startsWith('delok_')) {
      const panelId = action.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel) return replyNotFound(interaction);

      const embed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('⚠️  Hapus Panel?')
        .setDescription(
          `Panel ${channelLabel(panel.channelId)} akan dihapus permanen.\n${DIVIDER}\n` +
          `${panel.messageId ? 'Pesan panel di channel juga akan dihapus.' : 'Panel belum dipublish.'}\n\n` +
          `**Tindakan ini tidak dapat dibatalkan.**`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`setup1:takerole:delok_${panelId}`)
          .setLabel('Ya, Hapus').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup1:takerole:panel_${panelId}`)
          .setLabel('Batal').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    // -- Delete panel confirmed --
    if (action.startsWith('delok_')) {
      const panelId = action.slice(6);
      return doDeletePanel(interaction, session, cfg, panelId);
    }
  },

  // ── Modal handler ─────────────────────────────────────────────────────────

  async handleModal(interaction, session, cfg, field) {

    // -- Create panel: info modal --
    if (field === 'create_info') {
      const title       = interaction.fields.getTextInputValue('title').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const color       = parseColor(interaction.fields.getTextInputValue('color').trim());
      const footer      = interaction.fields.getTextInputValue('footer').trim();
      const thumbnail   = interaction.fields.getTextInputValue('thumbnail').trim();

      setDraft(session, { title, description, color, footer, thumbnail: thumbnail || null, step: 'opts' });

      // Show the options + preview step
      return showCreateOptionsStep(interaction, session, interaction.guild);
    }

    // -- Create panel: options modal (from options step) --
    if (field === 'create_opts') {
      const placeholder = interaction.fields.getTextInputValue('placeholder').trim();
      const maxRolesRaw = parseInt(interaction.fields.getTextInputValue('maxRoles'), 10);
      const maxRoles    = isNaN(maxRolesRaw) ? 1 : Math.min(25, Math.max(1, maxRolesRaw));
      const single      = interaction.fields.getTextInputValue('single').toLowerCase().startsWith('y');
      const toggle      = interaction.fields.getTextInputValue('toggle').toLowerCase().startsWith('y');

      setDraft(session, { placeholder, maxRoles, single, toggle });

      // Reply ephemerally then re-show options step
      return interaction.reply({
        content: '✅ Opsi disimpan. Klik **Preview** untuk melanjutkan.',
        ephemeral: true,
      });
    }

    // -- Edit panel info --
    if (field.startsWith('ei_')) {
      const panelId   = field.slice(3);
      const panel     = findPanel(cfg, panelId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel tidak ditemukan.', ephemeral: true });
      }

      const title       = interaction.fields.getTextInputValue('title').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const color       = parseColor(interaction.fields.getTextInputValue('color').trim());
      const footer      = interaction.fields.getTextInputValue('footer').trim();
      const thumbnail   = interaction.fields.getTextInputValue('thumbnail').trim();

      await updatePanelField(session.guildId, panelId, {
        title, description, color, footer, thumbnail: thumbnail || null,
      });
      logger.info(`[TakeRole] Edited info for panel ${panelId} in guild ${session.guildId}`);

      return interaction.reply({
        content: '✅ Info panel diperbarui. Klik **Update Panel** di halaman manajemen untuk memperbarui pesan yang sudah dipublish.',
        ephemeral: true,
      });
    }

    // -- Edit panel options --
    if (field.startsWith('eo_')) {
      const panelId     = field.slice(3);
      const panel       = findPanel(cfg, panelId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel tidak ditemukan.', ephemeral: true });
      }

      const placeholder = interaction.fields.getTextInputValue('placeholder').trim();
      const maxRolesRaw = parseInt(interaction.fields.getTextInputValue('maxRoles'), 10);
      const maxRoles    = isNaN(maxRolesRaw) ? 1 : Math.min(25, Math.max(1, maxRolesRaw));
      const single      = interaction.fields.getTextInputValue('single').toLowerCase().startsWith('y');
      const toggle      = interaction.fields.getTextInputValue('toggle').toLowerCase().startsWith('y');

      await updatePanelField(session.guildId, panelId, { placeholder, maxRoles, single, toggle });
      logger.info(`[TakeRole] Edited options for panel ${panelId} in guild ${session.guildId}`);

      return interaction.reply({
        content: '✅ Opsi panel diperbarui. Klik **Update Panel** untuk memperbarui pesan yang sudah dipublish.',
        ephemeral: true,
      });
    }

    // -- Edit emoji for one role --
    if (field.startsWith('emj_')) {
      // field format: emj_{roleId}_{panelId}
      const rest    = field.slice(4);
      const sepIdx  = rest.lastIndexOf('_');
      if (sepIdx < 0) return;

      const roleId  = rest.slice(0, sepIdx);
      const panelId = rest.slice(sepIdx + 1);
      const panel   = findPanel(cfg, panelId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel tidak ditemukan.', ephemeral: true });
      }

      const emoji       = interaction.fields.getTextInputValue('emoji').trim() || null;
      const description = interaction.fields.getTextInputValue('description').trim() || null;

      const roles = panel.roles.map((r) =>
        r.roleId === roleId ? { ...r, emoji, description } : r
      );

      await updatePanelField(session.guildId, panelId, { roles });
      logger.info(`[TakeRole] Edited emoji for role ${roleId} in panel ${panelId}`);

      return interaction.reply({
        content: `✅ Emoji dan deskripsi untuk role berhasil diperbarui. Klik **Update Panel** untuk merefleksikan perubahan.`,
        ephemeral: true,
      });
    }

    // -- Reorder roles --
    if (field.startsWith('ord_')) {
      const panelId = field.slice(4);
      const panel   = findPanel(cfg, panelId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel tidak ditemukan.', ephemeral: true });
      }

      const input   = interaction.fields.getTextInputValue('order').trim();
      const indices = input.split(',').map((s) => parseInt(s.trim(), 10) - 1);
      const valid   = indices.filter((i) => i >= 0 && i < panel.roles.length);

      if (valid.length !== panel.roles.length || new Set(valid).size !== valid.length) {
        return interaction.reply({
          content: `❌ Urutan tidak valid. Masukkan semua nomor dari 1 sampai ${panel.roles.length} dipisah koma.`,
          ephemeral: true,
        });
      }

      const reordered = valid.map((i) => panel.roles[i]);
      await updatePanelField(session.guildId, panelId, { roles: reordered });
      logger.info(`[TakeRole] Reordered roles for panel ${panelId}`);

      return interaction.reply({
        content: '✅ Urutan role diperbarui. Klik **Update Panel** untuk merefleksikan perubahan.',
        ephemeral: true,
      });
    }
  },

  // ── Auto Recovery ─────────────────────────────────────────────────────────

  async onRecover(guild, cfg) {
    const panels = cfg.takeRole?.panels ?? [];
    if (panels.length === 0) return;

    logger.info(`[TakeRole:Recovery] Guild ${guild.id} has ${panels.length} panel(s). Verifying...`);

    for (const panel of panels) {
      if (!panel.messageId || !panel.channelId) {
        logger.info(`[TakeRole:Recovery] Panel ${panel.id} in guild ${guild.id} is a draft (not published).`);
        continue;
      }

      try {
        const channel = guild.channels.cache.get(panel.channelId)
          ?? await guild.channels.fetch(panel.channelId).catch(() => null);

        if (!channel?.isTextBased()) {
          logger.warn(`[TakeRole:Recovery] Panel ${panel.id}: channel ${panel.channelId} not found.`);
          continue;
        }

        const message = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (message) {
          logger.info(`[TakeRole:Recovery] Panel ${panel.id} in guild ${guild.id}: message OK, interactions active.`);
        } else {
          logger.warn(
            `[TakeRole:Recovery] Panel ${panel.id} in guild ${guild.id}: message ${panel.messageId} not found. ` +
            `Owner should republish via Setup Wizard.`
          );
        }
      } catch (err) {
        logger.warn(`[TakeRole:Recovery] Panel ${panel.id} recovery error: ${err.message}`);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Create-flow step helpers
// ---------------------------------------------------------------------------

async function showCreateModeStep(interaction, session) {
  const draft = getDraft(session);
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle('🎭  Take Role — Langkah 2/5: Mode')
    .setDescription(
      `Channel: ${channelLabel(draft.channelId)}\n\n${DIVIDER}\n` +
      `Pilih mode tampilan panel.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:takerole:mode_d')
      .setLabel('📋 Dropdown Mode').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:mode_b')
      .setLabel('🔘 Button Mode').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:new_panel')
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

function showCreateInfoModal(interaction, session) {
  const draft = getDraft(session);
  const modal = new ModalBuilder()
    .setCustomId('setup1:modal:takerole:create_info')
    .setTitle('Take Role — Langkah 4/5: Info Panel');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Judul Panel')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.title ?? '🎭 Ambil Role')
        .setMaxLength(256)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Deskripsi')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(draft.description ?? 'Pilih role yang ingin kamu ambil di bawah ini.')
        .setMaxLength(1000)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Warna Embed (hex, misal: #5865F2)')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.color ?? '#5865F2')
        .setMaxLength(7)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('footer')
        .setLabel('Footer (opsional)')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.footer ?? '')
        .setMaxLength(200)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel('URL Thumbnail (opsional)')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.thumbnail ?? '')
        .setMaxLength(500)
        .setPlaceholder('https://...')
        .setRequired(false),
    ),
  );

  return interaction.showModal(modal);
}

async function showCreateOptionsStep(interaction, session, guild) {
  const draft = getDraft(session);
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle('🎭  Take Role — Langkah 4/5: Opsi & Preview')
    .setDescription(
      `Channel: ${channelLabel(draft.channelId)}\n` +
      `Mode: \`${draft.mode}\`\n` +
      `Role: ${draft.roles?.length ?? 0} dipilih\n` +
      `Judul: **${draft.title ?? '🎭 Ambil Role'}**\n\n${DIVIDER}\n` +
      `Atur opsi tambahan lalu buka **Preview** untuk memeriksa tampilan panel sebelum dipublish.`
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:takerole:set_opts')
      .setLabel('Atur Opsi...').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:set_info')
      .setLabel('Edit Info...').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:preview')
      .setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:back_to_roles')
      .setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:takerole:confirm_pub')
      .setLabel('Publish Panel').setEmoji('🚀').setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:back_to_main')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
}

async function showCreatePreview(interaction, session, guild) {
  const draft = getDraft(session);

  // Build a mock panel object from draft
  const mockPanel = {
    id:          'preview',
    channelId:   draft.channelId,
    mode:        draft.mode,
    title:       draft.title       ?? '🎭 Ambil Role',
    description: draft.description ?? 'Pilih role yang ingin kamu ambil di bawah ini.',
    color:       draft.color       ?? '#5865F2',
    footer:      draft.footer      ?? null,
    thumbnail:   draft.thumbnail   ?? null,
    placeholder: draft.placeholder ?? 'Pilih role...',
    maxRoles:    draft.maxRoles    ?? 1,
    single:      draft.single      ?? true,
    toggle:      draft.toggle      ?? false,
    roles: (draft.roles ?? []).map((r) => ({
      ...r,
      name: r.name ?? guild?.roles.cache.get(r.roleId)?.name ?? r.roleId,
    })),
  };

  const panelEmbed = buildPanelEmbed(mockPanel);
  const panelRows  = buildPanelComponents(mockPanel);

  // Add nav row for going back
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:takerole:confirm_pub')
      .setLabel('Publish Sekarang').setEmoji('🚀').setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:set_info')
      .setLabel('Edit Info').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:back_to_main')
      .setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  // In preview, disable all panel components (can't truly make them non-functional in ephemeral, so just show them)
  const previewHeader = new EmbedBuilder()
    .setColor(Colors.WARNING)
    .setDescription('👁️ **Preview Panel** — Tampilan di bawah ini adalah representasi panel yang akan dikirim ke channel.');

  return interaction.update({
    embeds:     [previewHeader, panelEmbed],
    components: [...panelRows, navRow],
  });
}

async function doPublishNew(interaction, session, cfg) {
  const draft = getDraft(session);
  const guild = interaction.guild;

  // Build panel object
  const panelId = Date.now().toString(36);
  const panel   = {
    id:          panelId,
    channelId:   draft.channelId,
    messageId:   null,
    mode:        draft.mode         ?? 'dropdown',
    title:       draft.title        ?? '🎭 Ambil Role',
    description: draft.description  ?? 'Pilih role yang ingin kamu ambil di bawah ini.',
    color:       draft.color        ?? '#5865F2',
    footer:      draft.footer       ?? null,
    thumbnail:   draft.thumbnail    ?? null,
    placeholder: draft.placeholder  ?? 'Pilih role...',
    maxRoles:    draft.maxRoles     ?? 1,
    single:      draft.single       ?? true,
    toggle:      draft.toggle       ?? false,
    roles: (draft.roles ?? []).map((r) => ({
      roleId:      r.roleId,
      name:        guild?.roles.cache.get(r.roleId)?.name ?? r.name ?? null,
      emoji:       r.emoji       ?? null,
      description: r.description ?? null,
    })),
  };

  // Validate
  const errors = await validatePanel(guild, panel);
  if (errors.length > 0) {
    return interaction.update({
      embeds:     [buildValidationErrorEmbed(errors)],
      components: [buildNavRow()],
    });
  }

  // Publish
  try {
    const channel = guild.channels.cache.get(panel.channelId)
      ?? await guild.channels.fetch(panel.channelId);
    const embed   = buildPanelEmbed(panel);
    const rows    = buildPanelComponents(panel);
    const message = await channel.send({ embeds: [embed], components: rows });

    panel.messageId = message.id;

    // Save to config
    const panels = [...(cfg.takeRole.panels ?? []), panel];
    await updateSection(session.guildId, 'takeRole', { panels, enabled: true });
    clearDraft(session);

    logger.info(`[TakeRole] Published new panel ${panelId} to channel ${panel.channelId} in guild ${session.guildId}`);

    const fresh = await loadGuildConfig(session.guildId);
    const page  = await plugin.buildPage(fresh, session);
    page.embed.setDescription(`✅ Panel berhasil dipublish!\n\n${page.embed.data.description ?? ''}`);
    return interaction.update({ embeds: [page.embed], components: page.components });
  } catch (err) {
    logger.error(`[TakeRole] Failed to publish panel: ${err.message}`);
    return interaction.update({
      embeds: [errorEmbed(`Gagal mengirim pesan ke channel: ${err.message}`)],
      components: [buildNavRow()],
    });
  }
}

// ---------------------------------------------------------------------------
// Manage-panel helpers
// ---------------------------------------------------------------------------

async function showPanelManagePage(interaction, session, panel, guild, notice = null) {
  const pubStatus = panel.messageId ? '✅ Dipublish' : '📝 Draft (belum dipublish)';
  const roleList  = (panel.roles ?? [])
    .map((r, i) => `${i + 1}. ${r.emoji ? r.emoji + ' ' : ''}**${r.name || r.roleId}**`)
    .join('\n') || '`Belum ada role`';

  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle(`🎭  Manajemen Panel`)
    .setDescription(notice ? `${notice}\n\n${DIVIDER}` : `${DIVIDER}`)
    .addFields(
      { name: '📍 Channel',  value: channelLabel(panel.channelId), inline: true },
      { name: '🎛️ Mode',    value: `\`${panel.mode}\``,           inline: true },
      { name: '📊 Status',  value: pubStatus,                      inline: true },
      { name: '📌 Judul',   value: panel.title || '`Belum diatur`',  inline: false },
      { name: '👥 Role',    value: roleList.slice(0, 1024),         inline: false },
    )
    .setFooter({ text: `Panel ID: ${panel.id}` });

  // If message was lost
  if (panel.messageId) {
    try {
      const ch  = guild?.channels.cache.get(panel.channelId);
      const msg = ch ? await ch.messages.fetch(panel.messageId).catch(() => null) : null;
      if (!msg) {
        embed.addFields({
          name: '⚠️ Pesan Tidak Ditemukan',
          value: 'Pesan panel sudah dihapus. Gunakan **Publish Ulang** untuk mengirim ulang.',
        });
      }
    } catch { /* ignore fetch errors */ }
  }

  const id = panel.id;

  // Row 1: edit fields
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup1:takerole:ei_${id}`).setLabel('Edit Info').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`setup1:takerole:eo_${id}`).setLabel('Edit Opsi').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`setup1:takerole:emj_${id}`).setLabel('Edit Emoji').setEmoji('😀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`setup1:takerole:ord_${id}`).setLabel('Urutan Role').setEmoji('🔢').setStyle(ButtonStyle.Secondary),
  );

  // Row 2: role management + mode/channel
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup1:takerole:ar_${id}`).setLabel('Tambah Role').setEmoji('➕').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`setup1:takerole:rr_${id}`).setLabel('Hapus Role').setEmoji('➖').setStyle(ButtonStyle.Primary)
      .setDisabled(!panel.roles?.length),
    new ButtonBuilder().setCustomId(`setup1:takerole:mc_${id}`).setLabel('Ganti Mode').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`setup1:takerole:cc_${id}`).setLabel('Ganti Channel').setEmoji('📢').setStyle(ButtonStyle.Secondary),
  );

  // Row 3: publish/update/delete
  const hasMessage = !!panel.messageId;
  const row3 = new ActionRowBuilder().addComponents(
    hasMessage
      ? new ButtonBuilder().setCustomId(`setup1:takerole:upd_${id}`).setLabel('Update Panel').setEmoji('🔄').setStyle(ButtonStyle.Success)
      : new ButtonBuilder().setCustomId(`setup1:takerole:pub_${id}`).setLabel('Publish Panel').setEmoji('🚀').setStyle(ButtonStyle.Success),
    hasMessage
      ? new ButtonBuilder().setCustomId(`setup1:takerole:repub_${id}`).setLabel('Publish Ulang').setEmoji('📤').setStyle(ButtonStyle.Primary)
      : new ButtonBuilder().setCustomId(`setup1:takerole:pub_${id}`).setLabel('Publish').setEmoji('📤').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId(`setup1:takerole:del_${id}`).setLabel('Hapus Panel').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );

  // Row 4: nav
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup1:takerole:back_to_main')
      .setLabel('Kembali ke Daftar').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:nav:home')
      .setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
  );

  return interaction.update({
    embeds: [embed],
    components: [row1, row2, row3, navRow],
  });
}

async function doPublishExisting(interaction, session, panel, updateOnly) {
  const guild = interaction.guild;

  // Validate
  const errors = await validatePanel(guild, panel);
  if (errors.length > 0) {
    return interaction.update({
      embeds:     [buildValidationErrorEmbed(errors)],
      components: [buildManageNavRow(panel.id)],
    });
  }

  try {
    const channel = guild.channels.cache.get(panel.channelId)
      ?? await guild.channels.fetch(panel.channelId);
    const embed   = buildPanelEmbed(panel);
    const rows    = buildPanelComponents(panel);

    let message;

    if (updateOnly && panel.messageId) {
      // Try to edit existing message
      try {
        const existing = await channel.messages.fetch(panel.messageId);
        await existing.edit({ embeds: [embed], components: rows });
        message = existing;
        logger.info(`[TakeRole] Updated panel ${panel.id} message in guild ${session.guildId}`);
      } catch {
        // Message gone — send new
        message = await channel.send({ embeds: [embed], components: rows });
        logger.info(`[TakeRole] Republished panel ${panel.id} (old message gone) in guild ${session.guildId}`);
      }
    } else {
      // Delete old message if exists
      if (panel.messageId) {
        try {
          const old = await channel.messages.fetch(panel.messageId);
          await old.delete();
        } catch { /* already gone */ }
      }
      message = await channel.send({ embeds: [embed], components: rows });
      logger.info(`[TakeRole] Published panel ${panel.id} to channel ${panel.channelId} in guild ${session.guildId}`);
    }

    await updatePanelField(session.guildId, panel.id, { messageId: message.id });

    const fresh   = await loadGuildConfig(session.guildId);
    const updated = findPanel(fresh, panel.id);
    return showPanelManagePage(
      interaction, session, updated, guild,
      updateOnly ? '✅ Panel berhasil diperbarui!' : '✅ Panel berhasil dipublish!'
    );
  } catch (err) {
    logger.error(`[TakeRole] Publish error for panel ${panel.id}: ${err.message}`);
    return interaction.update({
      embeds:     [errorEmbed(`Gagal mengirim pesan: ${err.message}`)],
      components: [buildManageNavRow(panel.id)],
    });
  }
}

async function doDeletePanel(interaction, session, cfg, panelId) {
  const guild = interaction.guild;
  const panel = findPanel(cfg, panelId);

  // Try to delete the Discord message
  if (panel?.messageId && panel.channelId) {
    try {
      const ch  = guild?.channels.cache.get(panel.channelId)
        ?? await guild?.channels.fetch(panel.channelId).catch(() => null);
      if (ch) {
        const msg = await ch.messages.fetch(panel.messageId).catch(() => null);
        if (msg) await msg.delete();
      }
    } catch (err) {
      logger.warn(`[TakeRole] Could not delete message for panel ${panelId}: ${err.message}`);
    }
  }

  // Remove from config
  const panels = (cfg.takeRole.panels ?? []).filter((p) => p.id !== panelId);
  await updateSection(session.guildId, 'takeRole', { panels });
  logger.info(`[TakeRole] Deleted panel ${panelId} in guild ${session.guildId}`);

  const fresh = await loadGuildConfig(session.guildId);
  const page  = await plugin.buildPage(fresh, session);
  page.embed.setDescription(`✅ Panel berhasil dihapus.\n\n${page.embed.data.description ?? ''}`);
  return interaction.update({ embeds: [page.embed], components: page.components });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

async function validatePanel(guild, panel) {
  const errors = [];

  // Bot has Manage Roles
  const botMember = guild?.members.me;
  if (botMember && !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    errors.push('Bot tidak memiliki izin **Manage Roles**.');
  }

  // Channel
  if (panel.channelId) {
    const chResult = await validateTextChannel(guild, panel.channelId);
    if (!chResult.ok) errors.push(chResult.reason);
  } else {
    errors.push('Channel belum dipilih.');
  }

  // Roles
  const roleIds = (panel.roles ?? []).map((r) => r.roleId).filter(Boolean);
  if (roleIds.length === 0) {
    errors.push('Belum ada role yang dipilih.');
  } else {
    const { ok, reasons } = await validateRoles(guild, roleIds);
    if (!ok) errors.push(...reasons);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/** Find a panel in cfg by ID */
function findPanel(cfg, panelId) {
  return (cfg.takeRole?.panels ?? []).find((p) => p.id === panelId) ?? null;
}

/** Update a single field on a panel in persistent config */
async function updatePanelField(guildId, panelId, updates) {
  const cfg    = await loadGuildConfig(guildId);
  const panels = (cfg.takeRole?.panels ?? []).map((p) =>
    p.id === panelId ? { ...p, ...updates } : p
  );
  await updateSection(guildId, 'takeRole', { panels });
  return panels.find((p) => p.id === panelId);
}

/** Parse a hex color string, returning the original or default */
function parseColor(str) {
  if (!str) return '#5865F2';
  const clean = str.startsWith('#') ? str : `#${str}`;
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean : '#5865F2';
}

/** Simple error embed */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(Colors.ERROR)
    .setTitle('❌  Error')
    .setDescription(message);
}

/** Ephemeral reply when a panel is not found */
async function replyNotFound(interaction) {
  return interaction.update({
    embeds:     [errorEmbed('Panel tidak ditemukan. Mungkin sudah dihapus.')],
    components: [buildNavRow()],
  });
}

/** Nav row with back-to-panel button */
function buildManageNavRow(panelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup1:takerole:panel_${panelId}`)
      .setLabel('Kembali ke Panel').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup1:takerole:back_to_main')
      .setLabel('Daftar Panel').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
  );
}

/** Build info modal for creating or editing a panel */
function buildInfoModal(field, panel = {}) {
  const modal = new ModalBuilder()
    .setCustomId(`setup1:modal:takerole:${field}`)
    .setTitle('Edit Info Panel');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Judul Panel')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.title ?? '🎭 Ambil Role')
        .setMaxLength(256)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Deskripsi')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(panel.description ?? '')
        .setMaxLength(1000)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Warna Embed (hex, misal: #5865F2)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.color ?? '#5865F2')
        .setMaxLength(7)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('footer')
        .setLabel('Footer (opsional)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.footer ?? '')
        .setMaxLength(200)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel('URL Thumbnail (opsional)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.thumbnail ?? '')
        .setMaxLength(500)
        .setPlaceholder('https://...')
        .setRequired(false),
    ),
  );
  return modal;
}

/** Build options modal for creating or editing a panel */
function buildOptsModal(field, panel = {}) {
  const modal = new ModalBuilder()
    .setCustomId(`setup1:modal:takerole:${field}`)
    .setTitle('Edit Opsi Panel');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('placeholder')
        .setLabel('Placeholder Dropdown (opsional)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.placeholder ?? 'Pilih role...')
        .setMaxLength(150)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('maxRoles')
        .setLabel('Maks. Role per User (1-25)')
        .setStyle(TextInputStyle.Short)
        .setValue(String(panel.maxRoles ?? 1))
        .setMaxLength(2)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('single')
        .setLabel('Single Role? (ya/tidak)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.single === false ? 'tidak' : 'ya')
        .setMaxLength(5)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('toggle')
        .setLabel('Toggle ON/OFF? (ya/tidak)')
        .setStyle(TextInputStyle.Short)
        .setValue(panel.toggle ? 'ya' : 'tidak')
        .setMaxLength(5)
        .setRequired(true),
    ),
  );
  return modal;
}

function showCreateOptsModal(interaction, draft) {
  return interaction.showModal(buildOptsModal('create_opts', draft));
}

// ---------------------------------------------------------------------------

export default plugin;
