/**
 * cache.js — VideoID-keyed two-layer BoomBox cache.
 *
 * Layer 1 — Result cache
 *   Key   : videoId  (stable across different URL formats of same video)
 *   Value : { boomboxUrl, ytResult, hitCount, lastUsed, expire }
 *   TTL   : 72 h    Max: 500 entries
 *
 * Layer 2 — Metadata cache
 *   Key   : videoId
 *   Value : { title, duration, thumbnail, uploader }
 *   TTL   : 24 h    Max: 500 entries
 */

import { createLogger } from "../../../../shared/logger/index.js";

const logger = createLogger("BoomboxCache");

// ── Constants ─────────────────────────────────────────────────────────────────

const RESULT_TTL_MS         = 72 * 60 * 60 * 1000;  // 72 hours
const META_TTL_MS           = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_RESULT_CACHE      = 500;
const MAX_META_CACHE        = 500;
const AUTO_CLEAN_DAYS       = 90;                    // evict entries unused ≥ 90 days
const AUTO_CLEAN_INTERVAL   = 6 * 60 * 60 * 1000;   // run cleanup every 6 h

// ── In-memory stores ──────────────────────────────────────────────────────────

const _resultCache = new Map();
const _metaCache   = new Map();

// ── Stats counters ────────────────────────────────────────────────────────────

let _hits   = 0;
let _misses = 0;

// ── VideoID extraction ────────────────────────────────────────────────────────

export function extractVideoId(url, platform) {
  const s = String(url);

  if (platform === "YouTube" || platform === "youtube" || /youtu/i.test(s)) {
    const m = s.match(
      /(?:v=|\/shorts\/|\/live\/|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/
    );
    if (m?.[1]) return `yt:${m[1]}`;
  }

  if (platform === "TikTok" || platform === "tiktok" || /tiktok/i.test(s)) {
    const m = s.match(/\/video\/(\d{10,})/);
    if (m?.[1]) return `tt:${m[1]}`;
    const norm = s.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    return `tt:${norm}`;
  }

  if (platform === "Spotify" || platform === "spotify" || /spotify/i.test(s)) {
    const m = s.match(/track\/([a-zA-Z0-9]+)/);
    if (m?.[1]) return `sp:${m[1]}`;
  }

  const norm = s
    .replace(/[?&](si|feature|pp|t|utm_[^&]*)=[^&]*/gi, "")
    .replace(/[?&]+$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  return `url:${norm}`;
}

// ── Result cache ──────────────────────────────────────────────────────────────

export function getCachedResult(videoId) {
  const entry = _resultCache.get(videoId);
  if (!entry) { _misses++; return null; }

  if (Date.now() > entry.expire) {
    _resultCache.delete(videoId);
    _misses++;
    return null;
  }

  entry.hitCount++;
  entry.lastUsed = Date.now();
  _hits++;
  return entry;
}

export function setCachedResult(videoId, { boomboxUrl, ytResult }) {
  const entry = {
    boomboxUrl,
    ytResult,
    hitCount:  0,
    createdAt: Date.now(),
    lastUsed:  Date.now(),
    expire:    Date.now() + RESULT_TTL_MS,
  };
  _resultCache.set(videoId, entry);

  if (_resultCache.size > MAX_RESULT_CACHE) {
    let lruKey = null, lruTime = Infinity;
    for (const [k, v] of _resultCache) {
      if ((v.lastUsed ?? 0) < lruTime) { lruTime = v.lastUsed ?? 0; lruKey = k; }
    }
    if (lruKey) _resultCache.delete(lruKey);
  }
}

// ── Metadata cache ────────────────────────────────────────────────────────────

export function getCachedMeta(videoId) {
  const m = _metaCache.get(videoId);
  if (!m) return null;

  if (Date.now() - m.cachedAt > META_TTL_MS) {
    _metaCache.delete(videoId);
    return null;
  }
  return m;
}

export function setCachedMeta(videoId, meta) {
  _metaCache.set(videoId, { ...meta, cachedAt: Date.now() });
  if (_metaCache.size > MAX_META_CACHE) {
    let lruKey = null, lruTime = Infinity;
    for (const [k, v] of _metaCache) {
      if ((v.cachedAt ?? 0) < lruTime) { lruTime = v.cachedAt ?? 0; lruKey = k; }
    }
    if (lruKey) _metaCache.delete(lruKey);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getCacheStats() {
  const total   = _hits + _misses;
  const hitRate = total > 0 ? `${((100 * _hits) / total).toFixed(1)}%` : "n/a";
  return {
    resultSize: _resultCache.size,
    metaSize:   _metaCache.size,
    hits:       _hits,
    misses:     _misses,
    hitRate,
  };
}

// ── CacheManager Object for Phase 1 / Backward Compatibility ──────────────────

class CacheManager {
  get(key) {
    // Phase 1 formats are 'platform:videoId'.
    const entry = getCachedResult(key);
    if (!entry) return null;
    return {
      uploadUrl: entry.boomboxUrl,
      title: entry.ytResult?.title || '',
      platform: entry.ytResult?.platform || 'youtube',
    };
  }

  set(key, data) {
    setCachedResult(key, {
      boomboxUrl: data.uploadUrl,
      ytResult: { title: data.title, platform: data.platform },
    });
  }

  delete(key) {
    return _resultCache.delete(key);
  }

  has(key) {
    const entry = _resultCache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expire) {
      _resultCache.delete(key);
      return false;
    }
    return true;
  }

  prune() {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of _resultCache) {
      if (now > entry.expire) {
        _resultCache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  getStats() {
    return {
      total: _resultCache.size,
      expired: 0,
      active: _resultCache.size,
    };
  }
}

export const cacheManager = new CacheManager();
export default cacheManager;

// ── Auto-clean ────────────────────────────────────────────────────────────────

function _autoClean() {
  const cutoff  = Date.now() - AUTO_CLEAN_DAYS * 24 * 60 * 60 * 1000;
  const now     = Date.now();
  let rEvicted  = 0;
  let mEvicted  = 0;

  for (const [id, entry] of _resultCache) {
    if (entry.lastUsed < cutoff || now > entry.expire) {
      _resultCache.delete(id);
      rEvicted++;
    }
  }
  for (const [id, entry] of _metaCache) {
    if (now - entry.cachedAt > META_TTL_MS * 4) {
      _metaCache.delete(id);
      mEvicted++;
    }
  }

  if (rEvicted || mEvicted) {
    logger.info(`[BoomBoxCache] Auto-clean | result evicted=${rEvicted} meta evicted=${mEvicted} | remaining: result=${_resultCache.size} meta=${_metaCache.size}`);
  }
}

const _cleanTimer = setInterval(_autoClean, AUTO_CLEAN_INTERVAL);
if (_cleanTimer.unref) _cleanTimer.unref();
