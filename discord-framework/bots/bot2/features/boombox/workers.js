/**
 * Boombox — Worker
 *
 * Registers the job processor with the QueueManager.
 * Phase 1: stub — throws NotImplemented so the queue wiring is fully testable.
 * Phase 2: call router → provider → uploader, then save to DB + cache.
 */

import { queueManager } from './queue.js';
import { cacheManager } from './cache.js';
import { db } from './database.js';
import { router } from './router.js';
import { boomboxLogger } from './logger.js';
import { analyticsManager } from './analytics.js';
import { monitoringManager } from './monitoring.js';
import { buildCacheKey } from './validator.js';

/**
 * Process a single Boombox job.
 * Returns the audio URL string on success.
 *
 * @param {import('./queue.js').BoomboxJob} job
 * @returns {Promise<string>} audio URL
 */
async function processJob(job) {
  const { cacheKey, platform, videoId, originalUrl } = job;

  boomboxLogger.processing(cacheKey, job.userId);
  monitoringManager.update('worker', 'ok', `Processing ${cacheKey}`);

  // ── 1. Cache check (double-check — manager may have already checked) ───────
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    db.touch(cacheKey);
    analyticsManager.incrementCacheHit();
    boomboxLogger.completed(cacheKey, cached.uploadUrl, true);
    return cached.uploadUrl;
  }

  analyticsManager.incrementCacheMiss();
  analyticsManager.incrementPlatform(platform);

  // ── 2. Provider → get audio stream/URL ────────────────────────────────────
  // Phase 2: const audioBuffer = await router.getAudio(platform, videoId);
  const provider = router.getProvider(platform);
  if (!provider) throw new Error(`No provider for platform: ${platform}`);

  const audioData = await provider.getAudioURL(videoId, originalUrl);

  // ── 3. Uploader → host audio ───────────────────────────────────────────────
  // Phase 2: const uploadUrl = await uploader.upload(audioBuffer, `${videoId}.mp3`);
  const { uploadUrl, title, duration } = audioData;

  // ── 4. Persist ─────────────────────────────────────────────────────────────
  db.set(cacheKey, {
    videoId, platform, title, duration,
    uploadUrl, uploadTime: Date.now(),
    status: 'ok', useCount: 1, lastUsed: Date.now(),
  });

  cacheManager.set(cacheKey, { uploadUrl, title, platform });

  analyticsManager.incrementDownloads();
  boomboxLogger.completed(cacheKey, uploadUrl, false);
  monitoringManager.update('worker', 'ok', `Completed ${cacheKey}`);

  return uploadUrl;
}

/**
 * Boot the worker pool — registers the processor with the queue.
 * Call once at bot startup.
 */
export function startWorkers() {
  queueManager.setProcessor(processJob);
  monitoringManager.update('worker', 'ok', 'Workers ready');
  boomboxLogger.info('Worker pool started.');
}
