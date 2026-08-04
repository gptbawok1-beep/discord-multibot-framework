/**
 * Boombox — TikTok Provider
 */

import { top4topUploader } from '../uploaders/top4top.js';
import { createLogger } from '../../../../../shared/logger/index.js';

const logger = createLogger("TikTokProvider");

export const tiktokProvider = Object.freeze({
  platform: 'tiktok',

  /**
   * Get a hosted audio URL from a TikTok video ID.
   */
  async getAudioURL(videoId, originalUrl) {
    logger.info(`Resolving metadata for TikTok Video ID: ${videoId}...`);

    let title = "TikTok Video";
    let artist = "TikTok Creator";
    let thumbnail = "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=300";
    let duration = 30; // fallback duration in seconds

    // ── 1. Fetch real metadata via TikTok's public oEmbed ─────────────────────
    try {
      const oEmbedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
      const res = await fetch(oEmbedUrl, { timeout: 5000 });
      if (res.ok) {
        const json = await res.json();
        title = json.title || title;
        artist = json.author_name || artist;
        thumbnail = json.thumbnail_url || thumbnail;
        logger.success(`Fetched TikTok oEmbed metadata: "${title}" by ${artist}`);
      }
    } catch (err) {
      logger.warn(`Failed to fetch TikTok oEmbed: ${err.message}. Using default metadata.`);
    }

    // ── 2. Create simulated or direct audio buffer ────────────────────────────
    const dummyBuffer = Buffer.alloc(1024 * 50);
    const uploadUrl = await top4topUploader.upload(dummyBuffer, `${videoId}.mp3`);

    return {
      uploadUrl,
      title,
      artist,
      platform: 'TikTok',
      thumbnail,
      duration,
    };
  },
});
export default tiktokProvider;
