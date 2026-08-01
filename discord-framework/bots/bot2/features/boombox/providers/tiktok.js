/**
 * Boombox — TikTok Provider
 *
 * Extracts audio from a TikTok video URL.
 *
 * Phase 1: STUB — returns NotImplemented.
 * Phase 2: Implement using a TikTok scraper / no-watermark API.
 *          Must return { uploadUrl, title, duration } after upload via top4top.js.
 *
 * @typedef {{ uploadUrl: string, title: string, duration: number }} AudioResult
 */

import { top4topUploader } from '../uploaders/top4top.js';

export const tiktokProvider = Object.freeze({
  platform: 'tiktok',

  /**
   * Get a hosted audio URL from a TikTok video ID.
   * @param {string} videoId
   * @param {string} originalUrl
   * @returns {Promise<AudioResult>}
   */
  async getAudioURL(videoId, originalUrl) {
    // ── Phase 2 implementation outline ──────────────────────────────────────
    // 1. const data      = await fetchTikTokNoWatermark(originalUrl);
    // 2. const buffer    = await downloadBuffer(data.audioUrl);
    // 3. const uploadUrl = await top4topUploader.upload(buffer, `${videoId}.mp3`);
    // 4. return { uploadUrl, title: data.title ?? videoId, duration: data.duration ?? 0 };
    // ────────────────────────────────────────────────────────────────────────

    throw new Error('TikTok provider not yet implemented (Phase 2).');
  },
});
