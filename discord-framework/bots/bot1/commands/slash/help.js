/**
 * Bot 1 — Slash Command: /help
 *
 * Help Center untuk Bot 1.
 * Menampilkan daftar fitur dengan dropdown navigasi.
 * Memilih kategori mengedit embed yang sama dengan dokumentasi singkat.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';

// ── Colors (mirroring setup UI) ───────────────────────────────────────────────
const COLOR_PRIMARY = 0x5865F2;
const COLOR_NEUTRAL = 0x4F545C;
const DIVIDER       = '━━━━━━━━━━━━━━━━━━';

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  {
    value:       'welcome',
    label:       'Welcome & Goodbye',
    emoji:       '🏠',
    description: 'Pesan sambutan dan perpisahan anggota baru.',
    content: [
      '**🏠 Welcome & Goodbye**',
      'Kirim pesan selamat datang/tinggal secara otomatis.',
      '',
      '**Cara Setup:**',
      '• Gunakan `/setup bot1` → **Welcome & Goodbye**',
      '• Atur channel, embed, warna, dan media.',
      '',
      '**Placeholder yang didukung:**',
      '• `{user}` — Nama member',
      '• `{mention}` — Mention member',
      '• `{server}` — Nama server',
    ].join('\n'),
  },
  {
    value:       'takerole',
    label:       'Take Role',
    emoji:       '🎭',
    description: 'Panel self-assign role untuk member.',
    content: [
      '**🎭 Take Role**',
      'Buat panel role assignment yang bisa digunakan member.',
      '',
      '**Cara Setup:**',
      '• Gunakan `/setup bot1` → **Take Role**',
      '• Buat panel, tambahkan role, lalu publish ke channel.',
      '',
      '**Mode:**',
      '• Dropdown atau Tombol',
      '• Single atau Multi-role',
      '• Toggle role ON/OFF',
    ].join('\n'),
  },
  {
    value:       'invite',
    label:       'Invite Tracker',
    emoji:       '🔗',
    description: 'Lacak undangan dan statistik member.',
    content: [
      '**🔗 Invite Tracker**',
      'Lacak siapa yang mengundang member baru.',
      '',
      '**Cara Setup:**',
      '• Gunakan `/setup bot1` → **Invite Tracker**',
      '• Atur log channel dan embed notifikasi.',
      '',
      '**Info yang ditampilkan:**',
      '• Nama inviter',
      '• Kode undangan',
      '• Total / fake / leave invite',
    ].join('\n'),
  },
  {
    value:       'channel',
    label:       'Channel Manager',
    emoji:       '🏗️',
    description: 'Backup, restore, dan kelola struktur channel.',
    content: [
      '**🏗️ Channel Manager**',
      'Kelola struktur channel server secara visual.',
      '',
      '**Fitur:**',
      '• 💾 Backup — Simpan struktur channel',
      '• ♻️ Restore — Recreate dari backup',
      '• 🏗️ Generate — Buat struktur dari teks',
      '• 📋 Clone — Duplikasi channel/kategori',
      '• ✏️ Rename — Ganti nama channel',
      '• 🗑️ Delete — Hapus channel (single/bulk)',
      '• 👁️ Preview — Lihat struktur saat ini',
    ].join('\n'),
  },
  {
    value:       'moderation',
    label:       'Moderation',
    emoji:       '🛡️',
    description: 'Command moderasi untuk mengelola server.',
    content: [
      '**🛡️ Moderation Commands**',
      '',
      '**🧹 `!cc <jumlah>`**',
      'Menghapus pesan.',
      '',
      '**🔨 `!ban <user> [reason]`**',
      'Ban member.',
      '',
      '**👢 `!kick <user> [reason]`**',
      'Kick member.',
      '',
      '**🔇 `!mute <user> <durasi> [reason]`**',
      'Timeout member.',
      '',
      '**🔊 `!unmute <user>`**',
      'Menghapus timeout.',
      '',
      '**🔓 `!unban <userID> [reason]`**',
      'Membuka ban.',
      '',
      '**💤 `!afk [alasan]`**',
      'Mengaktifkan status AFK.',
      '',
      '**🧵 `!autothread <#channel> <on/off>`**',
      'Mengaktifkan atau menonaktifkan Auto Thread.',
      '',
      '**📋 `!listthread`**',
      'Melihat daftar Auto Thread.',
      DIVIDER,
      '💡 Reply Message didukung untuk ban, kick, mute, unmute.',
      '`< >` = Wajib   |   `[ ]` = Opsional',
    ].join('\n'),
  },
];

// ── Build helpers ─────────────────────────────────────────────────────────────

function buildHomeEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_PRIMARY)
    .setAuthor({ name: '📚 Bot 1 Help Center' })
    .setDescription(
      [
        '🏠 **Welcome & Goodbye**',
        '🎭 **Take Role**',
        '🔗 **Invite Tracker**',
        '🏗️ **Channel Manager**',
        '🛡️ **Moderation**',
        DIVIDER,
        'Pilih kategori di bawah untuk melihat',
        'panduan penggunaan.',
      ].join('\n')
    )
    .setFooter({ text: 'Bot 1 Help Center' });
}

function buildCategoryEmbed(cat) {
  return new EmbedBuilder()
    .setColor(COLOR_NEUTRAL)
    .setAuthor({ name: '📚 Bot 1 Help Center' })
    .setDescription(cat.content)
    .setFooter({ text: 'Gunakan dropdown untuk berpindah kategori.' });
}

function buildSelectRow(selected = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('bot1help:category')
    .setPlaceholder('📋  Pilih kategori...')
    .addOptions(
      CATEGORIES.map((c) => ({
        label:       c.label,
        value:       c.value,
        description: c.description,
        emoji:       c.emoji,
        default:     c.value === selected,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

// ── Export category map for interactionCreate ─────────────────────────────────

export const HELP_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

// ── Command ───────────────────────────────────────────────────────────────────

export default class HelpCommand extends BaseCommand {
  constructor() {
    super({
      name:        'help',
      description: 'Tampilkan panduan penggunaan Bot 1.',
      type:        'slash',
      guildOnly:   true,
      data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Tampilkan panduan penggunaan Bot 1.'),
    });
  }

  async execute(client, interaction) {
    await interaction.reply({
      embeds:     [buildHomeEmbed()],
      components: [buildSelectRow()],
    });
  }
}

// ── Interaction handler (used by interactionCreate.js) ────────────────────────

export async function handleHelpInteraction(interaction) {
  if (!interaction.customId?.startsWith('bot1help:')) return false;
  if (!interaction.isStringSelectMenu()) return false;

  const value = interaction.values[0];
  const cat   = HELP_CATEGORIES[value];
  if (!cat) return false;

  const embed = buildCategoryEmbed(cat);
  await interaction.update({
    embeds:     [embed],
    components: [buildSelectRow(value)],
  });
  return true;
}
