/**
 * Bot 1 — Take Role: Panel Builder
 *
 * Builds the Discord embed and components sent to channels when a panel is published.
 * Used both for initial publish and for updates (edit panel).
 *
 * Custom ID scheme for panel runtime interactions:
 *   Button mode : tr1:{panelId}:btn:{roleId}
 *   Dropdown    : tr1:{panelId}:sel
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';

export const PANEL_PREFIX = 'tr1';

// ---------------------------------------------------------------------------
// Embed builder
// ---------------------------------------------------------------------------

/**
 * Build the embed for a Take Role panel.
 *
 * @param {object} panel   - Panel config object
 * @returns {EmbedBuilder}
 */
export function buildPanelEmbed(panel) {
  let color = 0x5865F2;
  if (panel.color) {
    const hex = parseInt(panel.color.replace('#', ''), 16);
    if (!isNaN(hex)) color = hex;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle((panel.title || '🎭 Ambil Role').slice(0, 256))
    .setDescription((panel.description || 'Pilih role yang ingin kamu ambil di bawah ini.').slice(0, 4096));

  if (panel.thumbnail) {
    try { embed.setThumbnail(panel.thumbnail); } catch { /* invalid URL — skip */ }
  }
  if (panel.footer) {
    embed.setFooter({ text: panel.footer.slice(0, 2048) });
  }

  return embed;
}

// ---------------------------------------------------------------------------
// Component builder
// ---------------------------------------------------------------------------

/**
 * Build action rows for a Take Role panel.
 *
 * Dropdown mode → one StringSelectMenu (single or multi)
 * Button mode   → buttons laid out in rows of 5 (max 25 buttons = 5 rows)
 *
 * @param {object}   panel   - Panel config object
 * @param {string[]} [userRoleIds] - Current roles of the viewing user (for button state, optional)
 * @returns {ActionRowBuilder[]}
 */
export function buildPanelComponents(panel, userRoleIds = []) {
  const rows = [];
  const roles = panel.roles ?? [];

  if (roles.length === 0) return rows;

  if (panel.mode === 'dropdown') {
    const options = roles.slice(0, 25).map((r) => {
      const opt = {
        label: (r.name || `Role`).slice(0, 100),
        value: r.roleId,
      };
      if (r.emoji) {
        try { opt.emoji = r.emoji; } catch { /* invalid emoji — skip */ }
      }
      if (r.description) {
        opt.description = r.description.slice(0, 100);
      }
      return opt;
    });

    const maxValues = panel.single
      ? 1
      : Math.min(panel.maxRoles ?? 1, options.length);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`${PANEL_PREFIX}:${panel.id}:sel`)
      .setPlaceholder((panel.placeholder || 'Pilih role...').slice(0, 150))
      .setMinValues(1)
      .setMaxValues(Math.max(1, maxValues))
      .addOptions(options);

    rows.push(new ActionRowBuilder().addComponents(select));

  } else {
    // Button mode: 5 buttons per row, up to 5 rows (25 buttons total)
    let currentRow = [];
    for (let i = 0; i < Math.min(roles.length, 25); i++) {
      const r = roles[i];
      const label = (r.name || `Role ${i + 1}`).slice(0, 80);
      const hasRole = userRoleIds.includes(r.roleId);

      const btn = new ButtonBuilder()
        .setCustomId(`${PANEL_PREFIX}:${panel.id}:btn:${r.roleId}`)
        .setLabel(label)
        .setStyle(hasRole ? ButtonStyle.Success : ButtonStyle.Primary);

      if (r.emoji) {
        try { btn.setEmoji(r.emoji); } catch { /* invalid emoji — skip */ }
      }

      currentRow.push(btn);
      if (currentRow.length === 5) {
        rows.push(new ActionRowBuilder().addComponents(...currentRow));
        currentRow = [];
      }
    }
    if (currentRow.length > 0) {
      rows.push(new ActionRowBuilder().addComponents(...currentRow));
    }
  }

  return rows;
}
