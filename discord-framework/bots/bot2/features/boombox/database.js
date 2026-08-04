/**
 * database.js — Persistent JSON-based storage for BoomBox.
 * Survives restarts. All writes are synchronous for simplicity and safety.
 *
 * BoomBox V2: Added fields for channels, logChannel, maintenance, roleLimits.
 * All existing fields (settings.freeDailyLimit, dailyUsage, statistics,
 * history, logState, videoCache) are preserved as-is — no migration needed.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BOOMBOX_CONFIG } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, "../../data/boombox-db.json");

const DEFAULT_DASHBOARD = {
  enabled:       true,   // Tampilkan dashboard embed
  showStatus:    true,   // Tampilkan status proses selama pipeline
  showGif:       false,  // Tampilkan GIF di embed
  gifs: {
    loading:     "",
    success:     "",
    cache:       "",
    error:       "",
    maintenance: "",
    timeout:     "",
  },
  showThumbnail: true,   // Tampilkan thumbnail lagu
  showFooter:    true,   // Tampilkan footer embed
  showTimestamp: true,   // Tampilkan timestamp
  showMention:   true,   // Mention user di embed
  embedColor:    "#5865f2", // Warna embed (hex)
  showDuration:  false,  // Tampilkan durasi proses
  durationFormat: "auto", // "ms" | "s" | "minsec" | "auto"
};

const DEFAULT_DB = {
  // Provider monitoring stats — persisted between restarts.
  providerMonitor: {},
  settings: {
    freeDailyLimit: BOOMBOX_CONFIG.DEFAULT_FREE_DAILY_LIMIT,
    // V2: Per-platform channel IDs (null = belum di-setup)
    channels: {
      youtube: null,
      tiktok:  null,
      spotify: null,
    },
    // V2: Single log channel ID
    logChannel: null,
    // V3: Per-platform log channel IDs
    platformLogChannels: {
      youtube: null,
      tiktok:  null,
      spotify: null,
    },
    // V2: Maintenance per platform
    maintenance: {
      youtube: false,
      tiktok:  false,
      spotify: false,
    },
    // V2: Duration limit per role in MINUTES { "<roleId>": <minutes> }
    roleLimits: {},
    // Dashboard display settings
    dashboard: { ...DEFAULT_DASHBOARD },
  },
  // { "YYYY-MM-DD": { userId: count } }
  dailyUsage: {},
  // Aggregated counters
  statistics: {
    total: 0,
    byPlatform: {},
    byProvider: {},
    successCount: 0,
    failureCount: 0,
  },
  // Last 500 entries
  history: [],
  // Message tracking
  logState: {
    messageId:      null,
    entries:        [],
    migrationV2Done: false,
  },
  // Persistent video cache
  videoCache: {},
};

const MAX_HISTORY = 500;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export class BoomBoxDB {
  constructor() {
    this._ensureDir();
    this._data = this._load();
    /** @private — timer for debounced non-critical writes */
    this._saveTimer = null;
  }

  _ensureDir() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _load() {
    if (!fs.existsSync(DB_PATH)) return structuredClone(DEFAULT_DB);
    try {
      const raw    = fs.readFileSync(DB_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const def    = structuredClone(DEFAULT_DB);
      // Deep-merge defaults for any missing keys
      return {
        ...def,
        ...parsed,
        providerMonitor: { ...(def.providerMonitor ?? {}), ...(parsed.providerMonitor ?? {}) },
        settings: {
          ...def.settings,
          ...(parsed.settings ?? {}),
          channels: {
            ...def.settings.channels,
            ...(parsed.settings?.channels ?? {}),
          },
          platformLogChannels: {
            ...def.settings.platformLogChannels,
            ...(parsed.settings?.platformLogChannels ?? {}),
          },
          maintenance: {
            ...def.settings.maintenance,
            ...(parsed.settings?.maintenance ?? {}),
          },
          roleLimits: {
            ...def.settings.roleLimits,
            ...(parsed.settings?.roleLimits ?? {}),
          },
          dashboard: {
            ...def.settings.dashboard,
            ...(parsed.settings?.dashboard ?? {}),
            gifs: {
              ...def.settings.dashboard.gifs,
              ...(parsed.settings?.dashboard?.gifs ?? {}),
            },
          },
        },
        logState: {
          ...def.logState,
          ...(parsed.logState ?? {}),
          migrationV2Done: (parsed.logState?.migrationV2Done) ?? false,
        },
      };
    } catch {
      return structuredClone(DEFAULT_DB);
    }
  }

  _save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this._data, null, 2), "utf8");
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try { this._save(); } catch { /* non-fatal */ }
    }, 500);
    if (this._saveTimer.unref) this._saveTimer.unref();
  }

  flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      try { this._save(); } catch { /* non-fatal */ }
    }
  }

  // ── Daily usage ──────────────────────────────────────────────────────────

  getUsage(userId) {
    const day = todayKey();
    return this._data.dailyUsage?.[day]?.[userId] ?? 0;
  }

  incrementUsage(userId) {
    const day = todayKey();
    if (!this._data.dailyUsage[day]) this._data.dailyUsage[day] = {};
    this._data.dailyUsage[day][userId] =
      (this._data.dailyUsage[day][userId] ?? 0) + 1;

    // Prune old days (keep last 7)
    const days = Object.keys(this._data.dailyUsage).sort();
    while (days.length > 7) {
      delete this._data.dailyUsage[days.shift()];
    }

    this._save();
  }

  resetUsage(userId = null) {
    if (userId) {
      const day = todayKey();
      if (this._data.dailyUsage?.[day]) {
        delete this._data.dailyUsage[day][userId];
        this._save();
      }
    } else {
      this._data.dailyUsage = {};
      this._save();
    }
  }

  getFreeDailyLimit() {
    return this._data.settings?.freeDailyLimit ?? BOOMBOX_CONFIG.DEFAULT_FREE_DAILY_LIMIT;
  }

  setFreeDailyLimit(n) {
    if (!this._data.settings) this._data.settings = {};
    this._data.settings.freeDailyLimit = n;
    this._save();
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  incrementStats(platform, provider = null) {
    if (!this._data.statistics) {
      this._data.statistics = { total: 0, byPlatform: {}, byProvider: {}, successCount: 0, failureCount: 0 };
    }
    const s = this._data.statistics;
    s.total        = (s.total        ?? 0) + 1;
    s.successCount = (s.successCount ?? 0) + 1;
    s.byPlatform[platform] = (s.byPlatform[platform] ?? 0) + 1;
    if (provider) {
      if (!s.byProvider) s.byProvider = {};
      s.byProvider[provider] = (s.byProvider[provider] ?? 0) + 1;
    }
    this._save();
  }

  incrementFailureStats(platform) {
    if (!this._data.statistics) {
      this._data.statistics = { total: 0, byPlatform: {}, byProvider: {}, successCount: 0, failureCount: 0 };
    }
    this._data.statistics.failureCount = (this._data.statistics.failureCount ?? 0) + 1;
    this._save();
  }

  addHistoryAndStats(entry, platform, provider = null) {
    if (!Array.isArray(this._data.history)) this._data.history = [];
    this._data.history.push(entry);
    if (this._data.history.length > MAX_HISTORY) {
      this._data.history = this._data.history.slice(-MAX_HISTORY);
    }

    if (!this._data.statistics) {
      this._data.statistics = { total: 0, byPlatform: {}, byProvider: {}, successCount: 0, failureCount: 0 };
    }
    const s = this._data.statistics;
    s.total        = (s.total        ?? 0) + 1;
    s.successCount = (s.successCount ?? 0) + 1;
    s.byPlatform[platform] = (s.byPlatform[platform] ?? 0) + 1;
    if (provider) {
      if (!s.byProvider) s.byProvider = {};
      s.byProvider[provider] = (s.byProvider[provider] ?? 0) + 1;
    }

    this._save();
  }

  getStatistics() {
    const s = this._data.statistics ?? {};
    return {
      total:        s.total        ?? 0,
      byPlatform:   s.byPlatform   ?? {},
      byProvider:   s.byProvider   ?? {},
      successCount: s.successCount ?? s.total ?? 0,
      failureCount: s.failureCount ?? 0,
    };
  }

  // ── History ──────────────────────────────────────────────────────────────

  addHistory(entry) {
    if (!Array.isArray(this._data.history)) this._data.history = [];
    this._data.history.push(entry);
    if (this._data.history.length > MAX_HISTORY) {
      this._data.history = this._data.history.slice(-MAX_HISTORY);
    }
    this._save();
  }

  getHistory(limit = 20) {
    const h = this._data.history ?? [];
    return h.slice(-limit).reverse();
  }

  getHistoryByPlatform(platform = null) {
    const h = this._data.history ?? [];
    const filtered = platform
      ? h.filter(e => {
          if (platform === "YouTube" || platform === "youtube") {
            return !e.platform || e.platform === "YouTube" || e.platform === "youtube";
          }
          return e.platform?.toLowerCase() === platform.toLowerCase();
        })
      : h;
    return [...filtered].reverse();
  }

  // ── Log message state ────────────────────────────────────────────────────

  getLogState() {
    const state = this._data.logState ?? {};
    return {
      messageId: state.messageId ?? null,
      entries:   Array.isArray(state.entries) ? state.entries : [],
    };
  }

  setLogState(patch) {
    this._data.logState = { ...this._data.logState, ...patch };
    this._save();
  }

  resetLogState() {
    this._data.logState = { messageId: null, entries: [], migrationV2Done: this._data.logState?.migrationV2Done ?? false };
    this._save();
  }

  getMigrationV2Done() {
    return this._data.logState?.migrationV2Done === true;
  }

  setMigrationV2Done(value) {
    if (!this._data.logState) this._data.logState = { messageId: null, entries: [], migrationV2Done: false };
    this._data.logState.migrationV2Done = value;
    this._save();
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSetting(key) {
    return this._data.settings?.[key];
  }

  setSetting(key, value) {
    if (!this._data.settings) this._data.settings = {};
    this._data.settings[key] = value;
    this._save();
  }

  // ── V2: Channel config ───────────────────────────────────────────────────

  getChannels() {
    return {
      youtube: null,
      tiktok:  null,
      spotify: null,
      ...(this._data.settings?.channels ?? {}),
    };
  }

  setChannel(platform, channelId) {
    if (!this._data.settings.channels) this._data.settings.channels = {};
    this._data.settings.channels[platform] = channelId;
    this._save();
  }

  isConfigured() {
    const ch = this._data.settings?.channels ?? {};
    return !!(ch.youtube || ch.tiktok || ch.spotify);
  }

  // ── V2: Log channel ──────────────────────────────────────────────────────

  getLogChannel() {
    return this._data.settings?.logChannel ?? null;
  }

  setLogChannel(channelId) {
    if (!this._data.settings) this._data.settings = {};
    this._data.settings.logChannel = channelId;
    this._save();
  }

  // ── V3: Per-platform log channels ────────────────────────────────────────

  getPlatformLogChannels() {
    return {
      youtube: null,
      tiktok:  null,
      spotify: null,
      ...(this._data.settings?.platformLogChannels ?? {}),
    };
  }

  setPlatformLogChannel(platform, channelId) {
    if (!this._data.settings) this._data.settings = {};
    if (!this._data.settings.platformLogChannels) this._data.settings.platformLogChannels = {};
    this._data.settings.platformLogChannels[platform] = channelId ?? null;
    this._save();
  }

  // ── V2: Maintenance ──────────────────────────────────────────────────────

  getMaintenance() {
    return {
      youtube: false,
      tiktok:  false,
      spotify: false,
      ...(this._data.settings?.maintenance ?? {}),
    };
  }

  setMaintenance(platform, enabled) {
    if (!this._data.settings.maintenance) this._data.settings.maintenance = {};
    this._data.settings.maintenance[platform] = enabled;
    this._save();
  }

  toggleMaintenance(platform) {
    const current = this.getMaintenance()[platform] ?? false;
    this.setMaintenance(platform, !current);
    return !current;
  }

  // ── V2: Role duration limits ─────────────────────────────────────────────

  getRoleLimits() {
    return { ...(this._data.settings?.roleLimits ?? {}) };
  }

  setRoleLimit(roleId, minutes) {
    if (!this._data.settings.roleLimits) this._data.settings.roleLimits = {};
    this._data.settings.roleLimits[roleId] = minutes;
    this._save();
  }

  deleteRoleLimit(roleId) {
    if (this._data.settings?.roleLimits?.[roleId] !== undefined) {
      delete this._data.settings.roleLimits[roleId];
      this._save();
    }
  }

  getEffectiveDurationLimitSec(member, defaultSec = 25 * 60) {
    const limits = this._data.settings?.roleLimits ?? {};
    let maxMinutes = null;

    for (const [roleId, minutes] of Object.entries(limits)) {
      if (member.roles.cache.has(roleId)) {
        if (maxMinutes === null || minutes > maxMinutes) maxMinutes = minutes;
      }
    }

    return maxMinutes !== null ? maxMinutes * 60 : defaultSec;
  }

  // ── Video cache (persistent, survives restarts) ───────────────────────────

  getVideoCache(videoId) {
    return this._data.videoCache?.[videoId] ?? null;
  }

  setVideoCache(videoId, data) {
    if (!this._data.videoCache) this._data.videoCache = {};
    const existing = this._data.videoCache[videoId];
    this._data.videoCache[videoId] = {
      boomboxUrl: data.boomboxUrl,
      title:      data.title      ?? existing?.title      ?? null,
      duration:   data.duration   ?? existing?.duration   ?? null,
      thumbnail:  data.thumbnail  ?? existing?.thumbnail  ?? null,
      createdAt:  existing?.createdAt ?? Date.now(),
      lastUsed:   Date.now(),
      hitCount:   existing?.hitCount  ?? 0,
    };
    this._save();
  }

  updateVideoCacheHit(videoId) {
    const entry = this._data.videoCache?.[videoId];
    if (!entry) return;
    entry.hitCount = (entry.hitCount ?? 0) + 1;
    entry.lastUsed = Date.now();
    this._scheduleSave();
  }

  cleanVideoCache(maxAgeDays = 90) {
    if (!this._data.videoCache) return 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed  = 0;
    for (const [id, entry] of Object.entries(this._data.videoCache)) {
      const lastActive = entry.lastUsed ?? entry.createdAt ?? 0;
      if (lastActive < cutoff) {
        delete this._data.videoCache[id];
        removed++;
      }
    }
    if (removed > 0) this._save();
    return removed;
  }

  getVideoCacheList(limit = 100) {
    const entries = Object.entries(this._data.videoCache ?? {})
      .map(([id, v]) => ({ videoId: id, ...v }))
      .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));
    return entries.slice(0, limit);
  }

  // ── V3: Persistent worker config ─────────────────────────────────────────

  getWorkerConfig() {
    return { ...(this._data.settings?.workerConfig ?? {}) };
  }

  setWorkerConfig(config) {
    if (!this._data.settings) this._data.settings = {};
    this._data.settings.workerConfig = config;
    this._save();
  }

  // ── Dashboard display settings ────────────────────────────────────────────

  getDashboard() {
    const d = this._data.settings?.dashboard ?? {};
    return {
      enabled:        d.enabled        ?? true,
      showStatus:     d.showStatus     ?? true,
      showGif:        d.showGif        ?? false,
      gifs: {
        loading:      d.gifs?.loading      ?? "",
        success:      d.gifs?.success      ?? "",
        cache:        d.gifs?.cache        ?? "",
        error:        d.gifs?.error        ?? "",
        maintenance:  d.gifs?.maintenance  ?? "",
        timeout:      d.gifs?.timeout      ?? "",
      },
      showThumbnail:  d.showThumbnail  ?? true,
      showFooter:     d.showFooter     ?? true,
      showTimestamp:  d.showTimestamp  ?? true,
      showMention:    d.showMention    ?? true,
      embedColor:     d.embedColor     ?? "#5865f2",
      showDuration:   d.showDuration   ?? false,
      durationFormat: d.durationFormat ?? "auto",
    };
  }

  setDashboard(patch) {
    if (!this._data.settings) this._data.settings = {};
    const current = this._data.settings.dashboard ?? {};
    this._data.settings.dashboard = {
      ...current,
      ...patch,
      gifs: {
        ...(current.gifs ?? {}),
        ...(patch.gifs ?? {}),
      },
    };
    this._save();
  }

  toggleDashboard(key) {
    const current = this.getDashboard();
    const newVal  = !current[key];
    this.setDashboard({ [key]: newVal });
    return newVal;
  }

  setDashboardGif(type, url) {
    const current = this.getDashboard();
    this.setDashboard({ gifs: { ...current.gifs, [type]: url } });
  }

  resetDashboard() {
    if (!this._data.settings) this._data.settings = {};
    this._data.settings.dashboard = {
      enabled:        true,
      showStatus:     true,
      showGif:        false,
      gifs:           { loading: "", success: "", cache: "", error: "", maintenance: "", timeout: "" },
      showThumbnail:  true,
      showFooter:     true,
      showTimestamp:  true,
      showMention:    true,
      embedColor:     "#5865f2",
      showDuration:   false,
      durationFormat: "auto",
    };
    this._save();
  }

  // ── Provider Monitor ──────────────────────────────────────────────────────

  getProviderMonitor() {
    return { ...(this._data.providerMonitor ?? {}) };
  }

  setProviderMonitor(stats) {
    this._data.providerMonitor = stats;
    this._scheduleSave();
  }

  // Backward compatible stub API for simple Phase 1 placeholder compatibility
  get(key) {
    const cacheKey = key.split(':');
    const id = cacheKey[1] || key;
    const vc = this.getVideoCache(id);
    if (!vc) return null;
    return {
      videoId: id,
      platform: cacheKey[0] || 'youtube',
      title: vc.title,
      duration: vc.duration,
      uploadUrl: vc.boomboxUrl,
      uploadTime: vc.createdAt,
      status: 'ok',
      useCount: vc.hitCount,
      lastUsed: vc.lastUsed,
    };
  }

  setStatus(key, status) {
    // compatibility stub
  }

  delete(key) {
    const cacheKey = key.split(':');
    const id = cacheKey[1] || key;
    if (this._data.videoCache?.[id]) {
      delete this._data.videoCache[id];
      this._save();
    }
  }

  getStats() {
    const size = Object.keys(this._data.videoCache || {}).length;
    return {
      total: size,
      ok: size,
      error: 0,
      processing: 0,
    };
  }
}

export const db = new BoomBoxDB();
