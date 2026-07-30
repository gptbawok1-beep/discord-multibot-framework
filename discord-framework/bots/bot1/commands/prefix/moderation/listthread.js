/**
 * Bot 1 — Prefix Command: !listthread
 *
 * Menampilkan daftar channel yang sedang menggunakan Auto Thread.
 */

import { BaseCommand } from '../../../../../shared/structures/index.js';
import { loadGuildConfig } from '../../../setup/config.js';
import { errorEmbed, infoEmbed } from '../../../../../shared/utils/embed.js';

export default class ListthreadCommand extends BaseCommand {
  constructor() {
    super({
      name:      'listthread',
      description: 'Tampilkan daftar channel dengan Auto Thread aktif.',
      type:      'prefix',
      cooldown:  5,
      guildOnly: true,
    });
  }

  async execute(client, message, args) {
    let cfg;
    try {
      cfg = await loadGuildConfig(message.guild.id);
    } catch {
      return message.reply({ embeds: [errorEmbed('Error', '❌ Tidak bisa memuat konfigurasi server.')] });
    }

    const channels = cfg.autothread?.channels ?? [];

    if (channels.length === 0) {
      return message.reply({
        embeds: [infoEmbed('Auto Thread', '📋 Belum ada Auto Thread yang aktif di server ini.')],
      });
    }

    const list = channels.map((id, i) => `${i + 1}. <#${id}>`).join('\n');

    return message.reply({
      embeds: [infoEmbed('📋 Daftar Auto Thread', `Channel berikut memiliki Auto Thread aktif:\n\n${list}`)],
    });
  }
}
