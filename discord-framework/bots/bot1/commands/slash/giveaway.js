/**
 * Bot 1 — Slash Command: /giveaway
 *
 * Subcommands:
 *   /giveaway create  — Buat giveaway baru
 *   /giveaway end     — Akhiri giveaway lebih awal
 *   /giveaway reroll  — Pilih ulang pemenang
 *   /giveaway cancel  — Batalkan giveaway
 *   /giveaway list    — Lihat giveaway aktif
 *
 * Permission: Owner Server ATAU Giveaway Manager Role (diatur via /setup bot1)
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';
import { errorEmbed, successEmbed } from '../../../../shared/utils/embed.js';
import { loadGuildConfig } from '../../setup/config.js';
import { canManageGiveaway, permissionDeniedMessage } from '../../features/giveaway/perm.js';
import {
  parseDuration,
  formatDuration,
  createGiveaway,
  endGiveaway,
  cancelGiveaway,
  rerollGiveaway,
  VALID_DURATIONS,
} from '../../features/giveaway/manager.js';
import { getGiveaway, listGiveaways } from '../../features/giveaway/store.js';
import { validateTextChannel } from '../../../../shared/setup/validation.js';

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

export default class GiveawayCommand extends BaseCommand {
  constructor() {
    super({
      name:        'giveaway',
      description: 'Kelola giveaway server.',
      type:        'slash',
      cooldown:    3,
      data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Kelola giveaway server.')
        // ── /giveaway create ─────────────────────────────────────────────
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Buat giveaway baru.')
            .addStringOption((opt) =>
              opt
                .setName('hadiah')
                .setDescription('Hadiah yang akan diberikan.')
                .setRequired(true)
                .setMaxLength(200)
            )
            .addStringOption((opt) =>
              opt
                .setName('durasi')
                .setDescription('Durasi giveaway (contoh: 1h, 30m, 2d).')
                .setRequired(true)
                .addChoices(
                  { name: '10 Menit',  value: '10m' },
                  { name: '30 Menit',  value: '30m' },
                  { name: '1 Jam',     value: '1h'  },
                  { name: '2 Jam',     value: '2h'  },
                  { name: '6 Jam',     value: '6h'  },
                  { name: '12 Jam',    value: '12h' },
                  { name: '1 Hari',    value: '1d'  },
                  { name: '2 Hari',    value: '2d'  },
                  { name: '7 Hari',    value: '7d'  },
                )
            )
            .addIntegerOption((opt) =>
              opt
                .setName('pemenang')
                .setDescription('Jumlah pemenang (default: 1).')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
            )
            .addChannelOption((opt) =>
              opt
                .setName('channel')
                .setDescription('Channel tujuan (default: channel yang dikonfigurasi di /setup bot1).')
                .setRequired(false)
            )
            .addRoleOption((opt) =>
              opt
                .setName('required_role')
                .setDescription('Role yang wajib dimiliki peserta (opsional).')
                .setRequired(false)
            )
            .addRoleOption((opt) =>
              opt
                .setName('mention_role')
                .setDescription('Role yang di-mention saat giveaway dimulai (opsional).')
                .setRequired(false)
            )
        )
        // ── /giveaway end ────────────────────────────────────────────────
        .addSubcommand((sub) =>
          sub
            .setName('end')
            .setDescription('Akhiri giveaway lebih awal dan pilih pemenang.')
            .addStringOption((opt) =>
              opt
                .setName('id')
                .setDescription('Message ID giveaway (dari !glist atau panel giveaway).')
                .setRequired(true)
            )
        )
        // ── /giveaway reroll ─────────────────────────────────────────────
        .addSubcommand((sub) =>
          sub
            .setName('reroll')
            .setDescription('Pilih ulang pemenang dari giveaway yang sudah selesai.')
            .addStringOption((opt) =>
              opt
                .setName('id')
                .setDescription('Message ID giveaway.')
                .setRequired(true)
            )
        )
        // ── /giveaway cancel ─────────────────────────────────────────────
        .addSubcommand((sub) =>
          sub
            .setName('cancel')
            .setDescription('Batalkan giveaway yang sedang berjalan tanpa memilih pemenang.')
            .addStringOption((opt) =>
              opt
                .setName('id')
                .setDescription('Message ID giveaway.')
                .setRequired(true)
            )
        )
        // ── /giveaway list ───────────────────────────────────────────────
        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('Lihat semua giveaway yang sedang aktif di server ini.')
        ),
    });
  }

  async execute(client, interaction) {
    const sub = interaction.options.getSubcommand();

    // ── Permission check (all subcommands except list require manager) ───────
    const cfg = await loadGuildConfig(interaction.guildId).catch(() => null);

    if (!canManageGiveaway(interaction.member, cfg, interaction.guild.ownerId)) {
      return interaction.reply({
        embeds:    [errorEmbed('Akses Ditolak', permissionDeniedMessage())],
        ephemeral: true,
      });
    }

    // ── Route to subcommand ──────────────────────────────────────────────────
    try {
      switch (sub) {
        case 'create':  return await this._create(client, interaction, cfg);
        case 'end':     return await this._end(client, interaction);
        case 'reroll':  return await this._reroll(client, interaction);
        case 'cancel':  return await this._cancel(client, interaction);
        case 'list':    return await this._list(interaction);
        default:
          return interaction.reply({ content: '❌ Subcommand tidak dikenali.', ephemeral: true });
      }
    } catch (err) {
      const reply = { embeds: [errorEmbed('Terjadi Kesalahan', `❌ ${err.message}`)], ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp(reply);
      }
      return interaction.reply(reply);
    }
  }

  // ── /giveaway create ──────────────────────────────────────────────────────

  async _create(client, interaction, cfg) {
    const prize          = interaction.options.getString('hadiah');
    const durationStr    = interaction.options.getString('durasi');
    const winnerCount    = interaction.options.getInteger('pemenang') ?? 1;
    const channelOption  = interaction.options.getChannel('channel');
    const requiredRole   = interaction.options.getRole('required_role');
    const mentionRole    = interaction.options.getRole('mention_role');

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        embeds: [errorEmbed(
          'Durasi Tidak Valid',
          `Durasi \`${durationStr}\` tidak dikenali.\n\n**Durasi valid:** ${VALID_DURATIONS.join(', ')}`
        )],
        ephemeral: true,
      });
    }

    // Determine channel
    let targetChannelId = channelOption?.id ?? cfg?.giveaway?.channelId ?? interaction.channelId;

    // Validate channel
    const validation = await validateTextChannel(interaction.guild, targetChannelId);
    if (!validation.ok) {
      // If user explicitly specified a bad channel, error out
      if (channelOption) {
        return interaction.reply({
          embeds:    [errorEmbed('Channel Tidak Valid', validation.reason)],
          ephemeral: true,
        });
      }
      // Fall back to current channel
      targetChannelId = interaction.channelId;
    }

    // Effective mention role: use option if provided, else fall back to config
    const effectiveMentionRoleId = mentionRole?.id ?? cfg?.giveaway?.mentionRoleId ?? null;

    await interaction.deferReply({ ephemeral: true });

    const giveaway = await createGiveaway(client, {
      guildId:        interaction.guildId,
      channelId:      targetChannelId,
      hostId:         interaction.user.id,
      prize,
      durationMs,
      winnerCount,
      requiredRoleId: requiredRole?.id ?? null,
      mentionRoleId:  effectiveMentionRoleId,
    });

    return interaction.editReply({
      embeds: [successEmbed(
        'Giveaway Dibuat!',
        `🎉 Giveaway **${prize}** berhasil dibuat di <#${targetChannelId}>!\n\n` +
        `**Durasi:** ${formatDuration(durationMs)}\n` +
        `**Pemenang:** ${winnerCount} orang\n` +
        (requiredRole ? `**Role Wajib:** <@&${requiredRole.id}>\n` : '') +
        `**ID:** \`${giveaway.id}\``
      )],
    });
  }

  // ── /giveaway end ─────────────────────────────────────────────────────────

  async _end(client, interaction) {
    const messageId = interaction.options.getString('id').trim();

    if (!/^\d{17,20}$/.test(messageId)) {
      return interaction.reply({
        embeds:    [errorEmbed('ID Tidak Valid', 'Message ID harus berupa angka 17–20 digit.')],
        ephemeral: true,
      });
    }

    const giveaway = getGiveaway(interaction.guildId, messageId);
    if (!giveaway) {
      return interaction.reply({
        embeds:    [errorEmbed('Tidak Ditemukan', `Giveaway \`${messageId}\` tidak ditemukan.\n\n> Gunakan \`/giveaway list\` untuk melihat giveaway aktif.`)],
        ephemeral: true,
      });
    }
    if (giveaway.status !== 'active') {
      return interaction.reply({
        embeds:    [errorEmbed('Tidak Bisa Diakhiri', `Giveaway **${giveaway.prize}** sudah ${giveaway.status === 'ended' ? 'selesai' : 'dibatalkan'}.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const updated    = await endGiveaway(client, interaction.guildId, messageId);
    const winnerText = updated.winners.length
      ? updated.winners.map((id) => `<@${id}>`).join(', ')
      : 'Tidak ada pemenang';

    return interaction.editReply({
      embeds: [successEmbed(
        'Giveaway Diakhiri',
        `✅ Giveaway **${giveaway.prize}** telah diakhiri.\n\n🏆 **Pemenang:** ${winnerText}`
      )],
    });
  }

  // ── /giveaway reroll ──────────────────────────────────────────────────────

  async _reroll(client, interaction) {
    const messageId = interaction.options.getString('id').trim();

    if (!/^\d{17,20}$/.test(messageId)) {
      return interaction.reply({
        embeds:    [errorEmbed('ID Tidak Valid', 'Message ID harus berupa angka 17–20 digit.')],
        ephemeral: true,
      });
    }

    const giveaway = getGiveaway(interaction.guildId, messageId);
    if (!giveaway) {
      return interaction.reply({
        embeds:    [errorEmbed('Tidak Ditemukan', `Giveaway \`${messageId}\` tidak ditemukan.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const updated    = await rerollGiveaway(client, interaction.guildId, messageId);
    const winnerText = updated.winners.length
      ? updated.winners.map((id) => `<@${id}>`).join(', ')
      : 'Tidak ada pemenang';

    return interaction.editReply({
      embeds: [successEmbed(
        'Reroll Berhasil',
        `🔄 Giveaway **${giveaway.prize}** telah di-reroll.\n\n🏆 **Pemenang Baru:** ${winnerText}`
      )],
    });
  }

  // ── /giveaway cancel ──────────────────────────────────────────────────────

  async _cancel(client, interaction) {
    const messageId = interaction.options.getString('id').trim();

    if (!/^\d{17,20}$/.test(messageId)) {
      return interaction.reply({
        embeds:    [errorEmbed('ID Tidak Valid', 'Message ID harus berupa angka 17–20 digit.')],
        ephemeral: true,
      });
    }

    const giveaway = getGiveaway(interaction.guildId, messageId);
    if (!giveaway) {
      return interaction.reply({
        embeds:    [errorEmbed('Tidak Ditemukan', `Giveaway \`${messageId}\` tidak ditemukan.`)],
        ephemeral: true,
      });
    }
    if (giveaway.status !== 'active') {
      return interaction.reply({
        embeds:    [errorEmbed('Tidak Bisa Dibatalkan', `Giveaway **${giveaway.prize}** sudah ${giveaway.status === 'ended' ? 'selesai' : 'dibatalkan'}.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await cancelGiveaway(client, interaction.guildId, messageId);

    return interaction.editReply({
      embeds: [successEmbed(
        'Giveaway Dibatalkan',
        `❌ Giveaway **${giveaway.prize}** telah dibatalkan.\n\nTidak ada pemenang yang dipilih.`
      )],
    });
  }

  // ── /giveaway list ────────────────────────────────────────────────────────

  async _list(interaction) {
    const all    = listGiveaways(interaction.guildId);
    const active = all.filter((g) => g.status === 'active');
    active.sort((a, b) => a.endsAt - b.endsAt);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎉  Giveaway Aktif')
      .setFooter({ text: `${active.length} giveaway aktif` })
      .setTimestamp();

    if (active.length === 0) {
      embed.setDescription('Tidak ada giveaway yang sedang berjalan saat ini.');
    } else {
      const lines = active.slice(0, 10).map((g) => {
        const endsAtSec = Math.floor(g.endsAt / 1000);
        return [
          `**${g.prize}**`,
          `• Channel: <#${g.channelId}>`,
          `• Peserta: **${g.participants.length}** orang`,
          `• Berakhir: <t:${endsAtSec}:R>`,
          `• ID: \`${g.id}\``,
        ].join('\n');
      });

      const extra = active.length > 10
        ? `\n\n... dan **${active.length - 10}** giveaway lainnya.`
        : '';
      embed.setDescription(lines.join('\n\n') + extra);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
