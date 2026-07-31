/**
 * Bot 1 — Slash Command: /help
 *
 * Help Center — konsisten dengan Setup System.
 * Satu Embed yang diedit (update) saat user memilih kategori.
 * Dropdown Category + tombol 🏠 Home dan ❌ Close.
 *
 * AUTO UPDATE: Tambahkan entri ke CATEGORIES untuk menampilkan fitur baru.
 * Jika suatu fitur belum diimplementasikan, cukup jangan tambahkan entry-nya.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { BaseCommand } from '../../../../shared/structures/index.js';

// ── Design tokens — sama dengan Setup System ──────────────────────────────────

const Colors = Object.freeze({
  PRIMARY: 0x5865F2,
  NEUTRAL: 0x4F545C,
  DARK:    0x2B2D31,
});
const DIVIDER = '━━━━━━━━━━━━━━━━━━';

// ── Category definitions ──────────────────────────────────────────────────────
// Tambah entry baru di sini untuk menampilkan fitur baru secara otomatis.
// Urutan array = urutan di dropdown.

const CATEGORIES = [
  {
    value:       'welcome',
    label:       'Welcome & Goodbye',
    emoji:       '🏠',
    description: 'Pesan sambutan dan perpisahan anggota baru.',
    guide: [
      '**🏠 Welcome & Goodbye**',
      'Kirim pesan selamat datang dan selamat tinggal secara otomatis.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **Welcome & Goodbye**',
      '',
      '**Yang bisa dikonfigurasi:**',
      '• Channel tujuan',
      '• Judul & deskripsi embed',
      '• Warna embed',
      '• Gambar / GIF',
      '',
      '**Placeholder:**',
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
    guide: [
      '**🎭 Take Role**',
      'Buat panel role assignment yang bisa digunakan member.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **Take Role** → Buat panel → Publish',
      '',
      '**Mode panel:**',
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
    guide: [
      '**🔗 Invite Tracker**',
      'Lacak siapa yang mengundang member baru ke server.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **Invite Tracker**',
      '',
      '**Info yang dicatat:**',
      '• Nama inviter & kode undangan',
      '• Total / fake / leave invite',
      '• Log channel & notifikasi join',
    ].join('\n'),
  },
  {
    value:       'channel',
    label:       'Channel Manager',
    emoji:       '🏗️',
    description: 'Backup, restore, dan kelola struktur channel.',
    guide: [
      '**🏗️ Channel Manager**',
      'Kelola struktur channel server secara visual.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **Channel Manager**',
      '',
      '**Fitur:**',
      '• 💾 **Backup** — Simpan snapshot struktur channel',
      '• ♻️ **Restore** — Recreate dari backup',
      '• 🏗️ **Generate** — Buat struktur dari teks',
      '• 📋 **Clone** — Duplikasi channel/kategori',
      '• ✏️ **Rename** — Ganti nama channel via modal',
      '• 🗑️ **Delete** — Hapus channel (single/bulk)',
      '• 👁️ **Preview** — Lihat struktur channel saat ini',
    ].join('\n'),
  },
  {
    value:       'moderation',
    label:       'Moderation',
    emoji:       '🛡️',
    description: 'Command moderasi untuk mengelola server.',
    guide: [
      '**🛡️ Moderation Commands**',
      DIVIDER,
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
      '💡 **Tips**',
      '• Reply Message didukung untuk ban, kick, mute, unmute.',
      '• `< >` = Wajib   |   `[ ]` = Opsional',
    ].join('\n'),
  },

  {
    value:       'giveaway',
    label:       'Giveaway',
    emoji:       '🎉',
    description: 'Buat dan kelola giveaway dengan panel interaktif.',
    guide: [
      '**🎉 Giveaway**',
      'Buat giveaway interaktif dengan panel Join, Participants, dan Info.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **🎉 Giveaway** → Atur Manager Role & Channel',
      '',
      '**Prefix Commands:**',
      '• `!gcreate <durasi> <pemenang> <hadiah>` — Buat giveaway',
      '  _Contoh: `!gcreate 1h 1 Nitro Classic`_',
      '• `!gend <id>` — Akhiri giveaway lebih awal',
      '• `!greroll <id>` — Pilih ulang pemenang',
      '• `!gcancel <id>` — Batalkan giveaway',
      '• `!glist` — Lihat giveaway yang aktif',
      '',
      '**Slash Commands:**',
      '• `/giveaway create` — Buat giveaway (dengan pilihan channel & role)',
      '• `/giveaway end` — Akhiri giveaway',
      '• `/giveaway reroll` — Pilih ulang pemenang',
      '• `/giveaway cancel` — Batalkan giveaway',
      '• `/giveaway list` — Lihat giveaway aktif',
      '',
      '**Durasi valid:** `10m` `30m` `1h` `2h` `6h` `12h` `1d` `2d` `7d`',
      DIVIDER,
      '💡 **Tips**',
      '• Semua giveaway bertahan setelah restart (Auto Recovery).',
      '• Peserta klik 🎉 untuk ikut, klik lagi untuk keluar.',
      '• Gunakan `required_role` untuk membatasi siapa yang bisa ikut.',
    ].join('\n'),
  },

  {
    value:       'systemmanager',
    label:       'System Manager',
    emoji:       '🚨',
    description: 'Error system, system logs, backup, status, audit, dan advanced.',
    guide: [
      '**🚨 System Manager**',
      'Core module untuk monitoring dan manajemen sistem bot.',
      DIVIDER,
      '**Cara Setup:**',
      '`/setup bot1` → **🚨 System Manager**',
      '',
      '**Sub-modul:**',
      '• 🚨 **Error System** — Kustomisasi pesan error pengguna, log error, auto-retry',
      '• 📜 **System Logs** — Satu log channel untuk semua event bot (start, backup, error, dll)',
      '• 💾 **Backup & Restore** — Backup dan restore seluruh konfigurasi bot',
      '• 📊 **Bot Status** — Uptime, ping, memori, CPU, jumlah server & user',
      '• 📋 **Audit Config** — Cek kelengkapan konfigurasi semua fitur sekaligus',
      '• ⚙️ **Advanced** — Debug mode, maintenance mode, retry limit, timeout',
      '',
      '**Placeholder Error Message:**',
      '• `{user}` — Nama pengguna',
      '• `{feature}` — Nama fitur yang error',
      '• `{error_code}` — Kode error unik',
      '• `{server}` — Nama server',
      '• `{time}` — Waktu kejadian',
      DIVIDER,
      '💡 **Tips**',
      '• Aktifkan **System Logs** agar semua event tercatat di satu channel.',
      '• Gunakan **Audit Config** untuk memastikan semua fitur sudah terkonfigurasi.',
      '• **Maintenance Mode** menghentikan semua perintah sementara.',
    ].join('\n'),
  },

  // ── Tambahkan fitur baru di sini ──────────────────────────────────────────
];

// ── Build helpers ─────────────────────────────────────────────────────────────

/** Build the main Help Center embed (home page). */
function buildHomeEmbed() {
  const lines = CATEGORIES.map((c) => `${c.emoji} **${c.label}**`).join('\n');

  return new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setAuthor({ name: '📚 Help Center' })
    .setDescription(
      `Pilih kategori yang ingin dipelajari.\n${DIVIDER}\n\n${lines}`
    )
    .setFooter({ text: 'Pilih kategori dari dropdown di bawah.' });
}

/** Build a category guide embed. */
function buildGuideEmbed(cat) {
  return new EmbedBuilder()
    .setColor(Colors.DARK)
    .setAuthor({ name: '📚 Help Center' })
    .setDescription(cat.guide)
    .setFooter({ text: `Help Center • ${cat.label}` });
}

/** Build the category dropdown select menu. */
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

/** Build the Home + Close button row. */
function buildButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bot1help:home')
      .setLabel('Home')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bot1help:close')
      .setLabel('Close')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );
}

/** Build a disabled version of all components (used for Close). */
function buildDisabledComponents(selected = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('bot1help:category')
    .setPlaceholder('📋  Pilih kategori...')
    .setDisabled(true)
    .addOptions(
      CATEGORIES.map((c) => ({
        label:   c.label,
        value:   c.value,
        emoji:   c.emoji,
        default: c.value === selected,
      }))
    );
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bot1help:home')
      .setLabel('Home').setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('bot1help:close')
      .setLabel('Close').setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );
  return [new ActionRowBuilder().addComponents(menu), buttonRow];
}

// ── Export category map for handleHelpInteraction ─────────────────────────────

export const HELP_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

// ── Slash Command ─────────────────────────────────────────────────────────────

export default class HelpCommand extends BaseCommand {
  constructor() {
    super({
      name:      'help',
      description: 'Tampilkan panduan penggunaan Bot 1.',
      type:      'slash',
      guildOnly: true,
      data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Tampilkan panduan penggunaan Bot 1.'),
    });
  }

  async execute(client, interaction) {
    await interaction.reply({
      embeds:     [buildHomeEmbed()],
      components: [buildSelectRow(), buildButtonRow()],
    });
  }
}

// ── Interaction handler (called from interactionCreate.js) ────────────────────

/**
 * Handle bot1help:* component interactions.
 * Returns true if the interaction was handled.
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>}
 */
export async function handleHelpInteraction(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('bot1help:')) return false;

  const action = customId.slice('bot1help:'.length);

  // ── Home button ────────────────────────────────────────────────────────────
  if (action === 'home' && interaction.isButton()) {
    await interaction.update({
      embeds:     [buildHomeEmbed()],
      components: [buildSelectRow(), buildButtonRow()],
    });
    return true;
  }

  // ── Close button ───────────────────────────────────────────────────────────
  if (action === 'close' && interaction.isButton()) {
    // Try to delete; fall back to disabling all components
    try {
      await interaction.message.delete();
      await interaction.deferUpdate().catch(() => null);
    } catch {
      await interaction.update({
        components: buildDisabledComponents(),
      });
    }
    return true;
  }

  // ── Category dropdown ──────────────────────────────────────────────────────
  if (action === 'category' && interaction.isStringSelectMenu()) {
    const value = interaction.values[0];
    const cat   = HELP_CATEGORIES[value];
    if (!cat) return false;

    await interaction.update({
      embeds:     [buildGuideEmbed(cat)],
      components: [buildSelectRow(value), buildButtonRow()],
    });
    return true;
  }

  return false;
}
