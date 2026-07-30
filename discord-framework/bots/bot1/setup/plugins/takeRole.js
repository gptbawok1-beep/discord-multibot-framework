/**
 * Plugin: 🎭 Take Role
 *
 * Multi-step wizard for configuring role-assignment panels.
 * Supports Dropdown mode and Button mode.
 *
 * Step flow:
 *   main → step:channel → step:mode → step:roles → step:options → main
 *
 * NOTE: This wizard only configures panels and saves them to config.
 * Deploying the panel to a channel is a future implementation step.
 *
 * Required permission: Manage Roles
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
} from 'discord.js';
import {
  Colors, DIVIDER, statusDot, channelLabel,
  buildNavRow, buildChannelSelectPage, buildRoleSelectPage,
} from '../ui.js';
import { updateSection, loadGuildConfig } from '../config.js';
import { validateRoles, buildValidationErrorEmbed } from '../../../../shared/setup/validation.js';

// Draft helpers
const draftKey = 'takeRoleDraft';
const getDraft = (session) => session.wizardData[draftKey] ?? {};
const setDraft = (session, data) => {
  session.wizardData[draftKey] = { ...getDraft(session), ...data };
};

const plugin = {
  id:                 'takerole',
  label:              'Take Role',
  emoji:              '🎭',
  description:        'Konfigurasi panel untuk user mengambil role sendiri.',
  order:              2,
  requiredPermission: PermissionFlagsBits.ManageRoles,

  getStatus(cfg) {
    const count = cfg.takeRole.panels?.length ?? 0;
    return {
      enabled: cfg.takeRole.enabled,
      summary: `${count} panel dikonfigurasi`,
    };
  },

  async buildPage(cfg, session) {
    const panels = cfg.takeRole.panels ?? [];
    const embed  = new EmbedBuilder()
      .setColor(cfg.takeRole.enabled ? Colors.SUCCESS : Colors.NEUTRAL)
      .setAuthor({ name: '🎭  Take Role' })
      .setDescription(`Konfigurasi panel Take Role untuk server ini.\n${DIVIDER}`)
      .addFields(
        { name: '📊  Status', value: statusDot(cfg.takeRole.enabled), inline: true },
        { name: '📋  Panel',  value: `${panels.length} panel`,         inline: true },
      )
      .setFooter({ text: 'Buat panel baru atau kelola panel yang sudah ada.' });

    if (panels.length > 0) {
      const panelList = panels
        .map((p, i) => `**${i + 1}.** ${channelLabel(p.channelId)} — Mode: \`${p.mode}\` — ${p.roles?.length ?? 0} role`)
        .join('\n');
      embed.addFields({ name: '🗂️  Daftar Panel', value: panelList });
    }

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

    return { embed, components: [row1, buildNavRow()] };
  },

  async handleInteraction(interaction, session, cfg, action) {
    // ── Toggle ───────────────────────────────────────────────────────────
    if (action === 'enable' || action === 'disable') {
      await updateSection(session.guildId, 'takeRole', { enabled: action === 'enable' });
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Step 1: Choose channel ────────────────────────────────────────────
    if (action === 'new_panel') {
      setDraft(session, { step: 'channel', channelId: null, mode: null, roles: [] });
      const page = buildChannelSelectPage(
        '🎭  Take Role — Langkah 1/4: Channel',
        'Pilih channel tempat panel Take Role akan dikirim.',
        'setup1:takerole:ch_select',
        'setup1:takerole:back_to_main',
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'ch_select') {
      setDraft(session, { channelId: interaction.values[0], step: 'mode' });
      return showModeStep(interaction, session);
    }

    // ── Step 2: Choose mode ───────────────────────────────────────────────
    if (action === 'mode_dropdown' || action === 'mode_button') {
      setDraft(session, { mode: action === 'mode_dropdown' ? 'dropdown' : 'button', step: 'roles' });
      const page = buildRoleSelectPage(
        '🎭  Take Role — Langkah 3/4: Pilih Role',
        'Pilih role yang akan tersedia di panel (maks. 25).',
        'setup1:takerole:role_select',
        'setup1:takerole:back_to_mode',
        25,
      );
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'role_select') {
      setDraft(session, { roles: interaction.values.map((id) => ({ roleId: id })), step: 'options' });
      return showOptionsStep(interaction, session);
    }

    // ── Step 4: Options modal ─────────────────────────────────────────────
    if (action === 'set_options') {
      const draft = getDraft(session);
      const modal = new ModalBuilder()
        .setCustomId('setup1:modal:takerole:options')
        .setTitle('Take Role — Langkah 4/4: Opsi');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('placeholder').setLabel('Placeholder Dropdown (opsional)')
            .setStyle(TextInputStyle.Short).setValue(draft.placeholder ?? 'Pilih role...')
            .setMaxLength(100).setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('maxRoles').setLabel('Maks. Role per User (1-25)')
            .setStyle(TextInputStyle.Short).setValue(String(draft.maxRoles ?? 1))
            .setMaxLength(2).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('single').setLabel('Single Role? (ya/tidak)')
            .setStyle(TextInputStyle.Short).setValue(draft.single === false ? 'tidak' : 'ya')
            .setMaxLength(5).setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('toggle').setLabel('Toggle Mode — klik lagi hapus role? (ya/tidak)')
            .setStyle(TextInputStyle.Short).setValue(draft.toggle ? 'ya' : 'tidak')
            .setMaxLength(5).setRequired(true),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Confirm save ──────────────────────────────────────────────────────
    if (action === 'confirm_panel') {
      const draft   = getDraft(session);
      const roleIds = (draft.roles ?? []).map((r) => r.roleId).filter(Boolean);

      // Validate all roles before saving
      if (roleIds.length > 0 && interaction.guild) {
        const { ok, reasons } = await validateRoles(interaction.guild, roleIds);
        if (!ok) {
          return interaction.update({
            embeds:     [buildValidationErrorEmbed(reasons)],
            components: [buildNavRow()],
          });
        }
      }

      const panels = [...(cfg.takeRole.panels ?? [])];
      panels.push({
        id:          Date.now().toString(36),
        channelId:   draft.channelId,
        messageId:   null,
        mode:        draft.mode,
        placeholder: draft.placeholder ?? 'Pilih role...',
        maxRoles:    draft.maxRoles ?? 1,
        single:      draft.single ?? true,
        toggle:      draft.toggle ?? false,
        roles:       (draft.roles ?? []).map((r) => ({
          roleId:      r.roleId,
          name:        r.name ?? null,
          emoji:       r.emoji ?? null,
          description: r.description ?? null,
        })),
      });

      await updateSection(session.guildId, 'takeRole', { panels, enabled: true });
      session.wizardData = {};
      const fresh = await loadGuildConfig(session.guildId);
      const page  = await plugin.buildPage(fresh, session);
      page.embed.setDescription(`✅  Panel berhasil disimpan!\n\n${page.embed.data.description}`);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    // ── Back navigations ──────────────────────────────────────────────────
    if (action === 'back_to_main') {
      session.wizardData = {};
      const page = await plugin.buildPage(cfg, session);
      return interaction.update({ embeds: [page.embed], components: page.components });
    }

    if (action === 'back_to_mode') {
      return showModeStep(interaction, session);
    }
  },

  async handleModal(interaction, session, cfg, field) {
    if (field === 'options') {
      const placeholder  = interaction.fields.getTextInputValue('placeholder').trim();
      const maxRolesRaw  = parseInt(interaction.fields.getTextInputValue('maxRoles'), 10);
      const maxRoles     = isNaN(maxRolesRaw) ? 1 : Math.min(25, Math.max(1, maxRolesRaw));
      const single       = interaction.fields.getTextInputValue('single').toLowerCase().startsWith('y');
      const toggle       = interaction.fields.getTextInputValue('toggle').toLowerCase().startsWith('y');
      setDraft(session, { placeholder, maxRoles, single, toggle, step: 'confirm' });
      await interaction.reply({ content: `✅  Opsi disimpan. Kembali ke wizard dan klik **Simpan Panel**.`, ephemeral: true });
    }
  },
};

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

async function showModeStep(interaction, session) {
  const draft = getDraft(session);
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle('🎭  Take Role — Langkah 2/4: Mode')
    .setDescription(
      `Channel: ${channelLabel(draft.channelId)}\n\n${DIVIDER}\n` +
      `Pilih mode tampilan panel untuk user.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup1:takerole:mode_dropdown').setLabel('📋 Dropdown Mode').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup1:takerole:mode_button').setLabel('🔘 Button Mode').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup1:takerole:back_to_main').setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

async function showOptionsStep(interaction, session) {
  const draft = getDraft(session);
  const embed = new EmbedBuilder()
    .setColor(Colors.DARK)
    .setTitle('🎭  Take Role — Langkah 4/4: Opsi')
    .setDescription(
      `Channel: ${channelLabel(draft.channelId)}\n` +
      `Mode: \`${draft.mode}\`\n` +
      `Role dipilih: ${draft.roles?.length ?? 0}\n\n${DIVIDER}\n` +
      `Atur opsi tambahan lalu simpan panel.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup1:takerole:set_options').setLabel('Atur Opsi...').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup1:takerole:confirm_panel').setLabel('Simpan Panel').setEmoji('💾').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup1:takerole:back_to_main').setLabel('Batal').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

export default plugin;
