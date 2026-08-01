/**
 * Boombox — YouTube Provider
 *
 * Extracts an audio stream from a YouTube video ID.
 *
 * Phase 1: STUB — returns NotImplemented.
 * Phase 2: Implement using yt-dlp, ytdl-core, or a third-party API.
 *          Must return { uploadUrl, title, duration } after upload via top4top.js.
 *
 * @typedef {{ uploadUrl: string, title: string, duration: number }} AudioResult
 */

import { top4topUploader } from '../uploaders/top4top.js';

export const youtubeProvider = Object.freeze({
  platform: 'youtube',

  /**
   * Get a hosted audio URL from a YouTube video ID.
   * @param {string} videoId
   * @param {string} originalUrl
   * @returns {Promise<AudioResult>}
   */
  async getAudioURL(videoId, originalUrl) {
    // ── Phase 2 implementation outline ──────────────────────────────────────
    // 1. const info     = await ytdl.getInfo(originalUrl);
    // 2. const format   = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    // 3. const buffer   = await streamToBuffer(ytdl(originalUrl, { format }));
    // 4. const uploadUrl = await top4topUploader.upload(buffer, `${videoId}.mp3`);
    // 5. return { uploadUrl, title: info.videoDetails.title, duration: +info.videoDetails.lengthSeconds };
    // ────────────────────────────────────────────────────────────────────────

    throw new Error('YouTube provider not yet implemented (Phase 2).');
  },
});
