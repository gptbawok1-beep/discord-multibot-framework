/**
 * Boombox — Spotify Provider
 *
 * Resolves a Spotify track to an audio stream.
 *
 * Phase 1: STUB — returns NotImplemented.
 * Phase 2: Resolve Spotify track metadata, match on YouTube, download via
 *          YouTube provider, then upload via top4top.js.
 *
 * Note: Spotify does not provide direct audio downloads.
 *       The standard approach is: Spotify API (metadata) → YouTube search → yt-dlp.
 *
 * @typedef {{ uploadUrl: string, title: string, duration: number }} AudioResult
 */

import { top4topUploader } from '../uploaders/top4top.js';

export const spotifyProvider = Object.freeze({
  platform: 'spotify',

  /**
   * Get a hosted audio URL from a Spotify track ID.
   * @param {string} trackId
   * @param {string} originalUrl
   * @returns {Promise<AudioResult>}
   */
  async getAudioURL(trackId, originalUrl) {
    // ── Phase 2 implementation outline ──────────────────────────────────────
    // 1. const track     = await spotifyApi.getTrack(trackId); // requires Spotify API key
    // 2. const query     = `${track.name} ${track.artists[0].name} official audio`;
    // 3. const ytResult  = await searchYouTube(query);
    // 4. const buffer    = await youtubeProvider.downloadBuffer(ytResult.videoId);
    // 5. const uploadUrl = await top4topUploader.upload(buffer, `${trackId}.mp3`);
    // 6. return { uploadUrl, title: `${track.name} - ${track.artists[0].name}`, duration: Math.floor(track.duration_ms / 1000) };
    // ────────────────────────────────────────────────────────────────────────

    throw new Error('Spotify provider not yet implemented (Phase 2).');
  },
});
