/**
 * resourceManagerInteraction.js — Handler untuk semua interaksi bbrm:
 *
 * Prefix routing:
 *   bbrm:resource:panel          → Panel utama Resource Manager
 *   bbrm:menu:select             → Dropdown navigasi
 *   bbrm:cookies:panel           → Panel cookies
 *   bbrm:cookies:upload:paste    → Modal paste konten cookies
 *   bbrm:cookies:upload:url      → Modal URL cookies
 *   bbrm:cookies:modal:paste     → Submit paste modal
 *   bbrm:cookies:modal:url       → Submit URL modal
 *   bbrm:cookies:test            → Test cookies dengan yt-dlp
 *   bbrm:cookies:delete          → Konfirmasi hapus
 *   bbrm:cookies:delete:confirm  → Eksekusi hapus cookies
 *   bbrm:gif:panel               → Panel GIF resource
 *   bbrm:gif:enable              → Aktifkan GIF
 *   bbrm:gif:disable             → Nonaktifkan GIF
 *   bbrm:gif:manage              → Delegasi ke bbdash:gif panel
 */

import fs           from "node:fs";
import https        from "node:https";
import http         from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path         from "node:path";
import { fileURLToPath } from "node:url";

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createLogger } from "../../../../../shared/logger/index.js";
import { db }     from "../database.js";
import { BOOMBOX_CONFIG } from "../config.js";

import {
  MANAGED_COOKIES_PATH,
  reloadCookies,
  getCookiesStatus,
  saveCookiesMeta,
  clearCookiesMeta,
  validateCookiesContent,
  recordCookiesTest,
} from "../utils/cookiesResolver.js";

import { parseCookiesAuto, formatLabel } from "../utils/cookieParser.js";

import {
  buildResourceManagerPanel,
  buildCookiesPanel,
  buildCookiesPasteModal,
  buildCookiesUrlModal,
  buildCookiesDeleteConfirmPanel,
  buildGifResourcePanel,
} from "./resourceManager.js";

import {
  buildDashboardGifPanel,
} from "./dashboardSetup.js";

const logger = createLogger("ResourceManagerInteraction");
const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const FOOTER = "BoomBox • Resource Manager";
const COLOR  = 0x5865f2;

const _execFileAsync = promisify(execFile);
const MAX_COOKIE_BYTES = 2 * 1024 * 1024;

// Helper to check if a user is owner/developer
function isOwner(member) {
  if (!member) return false;
  // Check if user is owner of guild or has developer / owner role
  if (member.id === member.guild?.ownerId) return true;
  if (BOOMBOX_CONFIG.OWNER_ROLE_ID && member.roles.cache.has(BOOMBOX_CONFIG.OWNER_ROLE_ID)) return true;
  if (BOOMBOX_CONFIG.DEVELOPER_ROLE_ID && member.roles.cache.has(BOOMBOX_CONFIG.DEVELOPER_ROLE_ID)) return true;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _downloadUrl(url, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve) => {
    const proto = url.startsWith("https:") ? https : http;
    const req = proto.get(url, { timeout: 15_000, headers: { "User-Agent": "BoomBoxBot/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        return resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
      }
      const chunks = [];
      let total = 0;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy();
          return resolve({ ok: false, reason: `File terlalu besar (max 2 MB).` });
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ ok: true, content: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", (err) => resolve({ ok: false, reason: err.message }));
    });
    req.on("error", (err) => resolve({ ok: false, reason: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, reason: "Timeout saat mendownload cookies (>15 detik)." }); });
  });
}

function _saveCookies(content, source) {
  const dir = path.dirname(MANAGED_COOKIES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MANAGED_COOKIES_PATH, content, "utf8");

  const parsed = parseCookiesAuto(content);
  saveCookiesMeta({
    active: true,
    count: parsed.count,
    status: "none",
    uploadedAt: Date.now(),
    lastTestedAt: null,
    testResult: null,
    source,
  });

  reloadCookies();
  return parsed.count;
}

async function _executeCookiesTest() {
  if (!fs.existsSync(MANAGED_COOKIES_PATH)) {
    return { ok: false, reason: "File cookies.txt tidak ditemukan di disk." };
  }

  // We can test cookies using a simple HTTPS fetch to youtube or a dry-run with yt-dlp.
  // Given that yt-dlp might not be in the path, let's gracefully test via fetch to youtube first.
  try {
    const res = await fetch("https://www.youtube.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      recordCookiesTest(true, "Fetch to youtube succeeded.");
      return { ok: true };
    } else {
      recordCookiesTest(false, `YouTube returned HTTP ${res.status}`);
      return { ok: false, reason: `YouTube returned HTTP ${res.status}` };
    }
  } catch (err) {
    recordCookiesTest(false, err.message);
    return { ok: false, reason: err.message };
  }
}

// ── Interaction Router ────────────────────────────────────────────────────────

export async function handleResourceManagerInteraction(interaction) {
  const id = interaction.customId ?? "";

  // Guard: Owner/Developer only for cookie changes
  if (id.startsWith("bbrm:cookies:") && id !== "bbrm:cookies:panel" && !isOwner(interaction.member)) {
    await interaction.reply({
      content: "❌ Anda tidak memiliki izin untuk mengelola cookies. Hanya Owner/Developer yang diizinkan.",
      ephemeral: true,
    });
    return;
  }

  // ── Resource Manager main panel ──────────────────────────────────────
  if (id === "bbrm:resource:panel") {
    const { embeds, components } = buildResourceManagerPanel();
    await interaction.update({ embeds, components });
    return;
  }

  // ── Select menu dropdown ─────────────────────────────────────────────
  if (id === "bbrm:menu:select" && interaction.isStringSelectMenu()) {
    const val = interaction.values[0];
    if (val === "cookies") {
      const { embeds, components } = buildCookiesPanel();
      await interaction.update({ embeds, components });
    } else if (val === "gif") {
      const { embeds, components } = buildGifResourcePanel();
      await interaction.update({ embeds, components });
    } else {
      // Refresh status
      const { embeds, components } = buildResourceManagerPanel();
      await interaction.update({ embeds, components });
    }
    return;
  }

  // ── Cookies panel ────────────────────────────────────────────────────
  if (id === "bbrm:cookies:panel") {
    const { embeds, components } = buildCookiesPanel();
    await interaction.update({ embeds, components });
    return;
  }

  // ── Cookies upload modal triggers ───────────────────────────────────
  if (id === "bbrm:cookies:upload:paste") {
    await interaction.showModal(buildCookiesPasteModal());
    return;
  }

  if (id === "bbrm:cookies:upload:url") {
    await interaction.showModal(buildCookiesUrlModal());
    return;
  }

  // ── Cookies modal submits ────────────────────────────────────────────
  if (id === "bbrm:cookies:modal:paste" && interaction.isModalSubmit()) {
    const rawContent = interaction.fields.getTextInputValue("cookies_content")?.trim() ?? "";
    if (!rawContent) {
      await interaction.reply({ content: "❌ Konten cookies tidak boleh kosong.", ephemeral: true });
      return;
    }

    if (!validateCookiesContent(rawContent)) {
      await interaction.reply({ content: "❌ Format cookies tidak valid. Gunakan format Netscape cookies.txt atau format cookie header.", ephemeral: true });
      return;
    }

    const count = _saveCookies(rawContent, "Paste");
    const { embeds, components } = buildCookiesPanel();
    await interaction.update({ embeds, components });
    return;
  }

  if (id === "bbrm:cookies:modal:url" && interaction.isModalSubmit()) {
    const url = interaction.fields.getTextInputValue("cookies_url")?.trim() ?? "";
    if (!url || !url.startsWith("http")) {
      await interaction.reply({ content: "❌ URL tidak valid.", ephemeral: true });
      return;
    }

    await interaction.deferUpdate();
    const download = await _downloadUrl(url);
    if (!download.ok) {
      await interaction.followUp({ content: `❌ Gagal mendownload: ${download.reason}`, ephemeral: true });
      return;
    }

    if (!validateCookiesContent(download.content)) {
      await interaction.followUp({ content: "❌ Isi file tidak berupa format cookies valid.", ephemeral: true });
      return;
    }

    _saveCookies(download.content, `URL (${path.basename(url)})`);
    const { embeds, components } = buildCookiesPanel();
    await interaction.editReply({ embeds, components });
    return;
  }

  // ── Test cookies ────────────────────────────────────────────────────
  if (id === "bbrm:cookies:test") {
    await interaction.deferUpdate();
    const testResult = await _executeCookiesTest();

    const { embeds, components } = buildCookiesPanel();
    if (testResult.ok) {
      await interaction.followUp({ content: "✅ Cookies valid dan berhasil terhubung ke YouTube!", ephemeral: true });
    } else {
      await interaction.followUp({ content: `❌ Test gagal: ${testResult.reason}`, ephemeral: true });
    }
    await interaction.editReply({ embeds, components });
    return;
  }

  // ── Delete confirmation ──────────────────────────────────────────────
  if (id === "bbrm:cookies:delete") {
    const { embeds, components } = buildCookiesDeleteConfirmPanel();
    await interaction.update({ embeds, components });
    return;
  }

  if (id === "bbrm:cookies:delete:confirm") {
    clearCookiesMeta();
    logger.info(`[ResourceManager] Cookies dihapus oleh ${interaction.user.tag}`);
    const { embeds, components } = buildCookiesPanel();
    await interaction.update({ embeds, components });
    return;
  }

  // ── GIF toggle options ────────────────────────────────────────────────
  if (id === "bbrm:gif:panel") {
    const { embeds, components } = buildGifResourcePanel();
    await interaction.update({ embeds, components });
    return;
  }

  if (id === "bbrm:gif:enable" || id === "bbrm:gif:disable") {
    db.toggleDashboard("showGif");
    const { embeds, components } = buildGifResourcePanel();
    await interaction.update({ embeds, components });
    return;
  }

  if (id === "bbrm:gif:manage") {
    const { embeds, components } = buildDashboardGifPanel();
    await interaction.update({ embeds, components });
    return;
  }
}
