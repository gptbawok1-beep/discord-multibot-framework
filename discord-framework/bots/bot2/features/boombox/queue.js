/**
 * queue.js — Multi-platform BoomBox queue (V3).
 *
 * Each platform (YouTube, TikTok, Spotify) gets its own independent
 * PlatformWorker so they never block each other.
 */

import { createLogger } from "../../../../shared/logger/index.js";
import { enqueue, getAllSnapshots } from "./queue/workerManager.js";
import { PRIORITY } from "./queue/workerConfig.js";

const logger = createLogger("BoomboxQueue");

// Map platform name → worker name
const PLATFORM_WORKER_MAP = {
  YouTube: "youtube",
  youtube: "youtube",
  TikTok:  "tiktok",
  tiktok:  "tiktok",
  Spotify: "spotify",
  spotify: "spotify",
};

/**
 * Enqueue a BoomBox job on the correct platform worker.
 *
 * @param {"YouTube"|"TikTok"|"Spotify"} platform
 * @param {number} priority  Use PRIORITY.* constants (0=highest, 3=lowest)
 * @param {() => Promise<any>} run
 * @param {{
 *   onQueued?: (pos:number, total:number, etaSec:number) => any,
 *   onStart?:  () => any,
 *   jobId?:    string,
 * }} [callbacks]
 * @returns {Promise<any>}
 */
export function enqueueForPlatform(platform, priority, run, callbacks = {}) {
  const workerName = PLATFORM_WORKER_MAP[platform] ?? "youtube";
  logger.info(`[BoomBox Queue] Enqueue | platform=${platform} | worker=${workerName} | priority=${priority}`);
  return enqueue(workerName, run, { priority, ...callbacks });
}

/**
 * Backward-compatible shim — routes to a generic "youtube" worker.
 *
 * @param {() => Promise<any>} run
 * @param {{ onQueued?: Function, onStart?: Function }} [callbacks]
 * @returns {Promise<any>}
 */
export function enqueueBoomBoxJob(run, callbacks = {}) {
  return enqueue("youtube", run, { priority: PRIORITY.FREE, ...callbacks });
}

/**
 * Aggregated queue snapshot across all BoomBox platform workers.
 *
 * @returns {{ active:number, queued:number, maxConcurrent:number, workers: object[] }}
 */
export function getQueueSnapshot() {
  const all = getAllSnapshots().filter(s =>
    ["youtube", "tiktok", "spotify"].includes(s.name)
  );
  return {
    active:        all.reduce((s, w) => s + w.active,        0),
    queued:        all.reduce((s, w) => s + w.queued,        0),
    maxConcurrent: all.reduce((s, w) => s + w.maxConcurrent, 0),
    workers:       all,
  };
}

// Phase 1 / backward compatible fallback queueManager instance
class QueueManagerShim {
  enqueue(params) {
    // Phase 1 used params: { cacheKey, platform, videoId, originalUrl, userId, guildId }
    // We map it to enqueueForPlatform
    return enqueueForPlatform(params.platform, PRIORITY.FREE, async () => {
      if (this._processor) {
        return this._processor(params);
      }
      throw new Error("No processor registered.");
    }, {
      jobId: params.cacheKey,
    });
  }

  setProcessor(fn) {
    this._processor = fn;
  }

  getStats() {
    const snapshot = getQueueSnapshot();
    return {
      pending: snapshot.queued,
      active: snapshot.active,
      maxWorkers: snapshot.maxConcurrent,
    };
  }

  async setMaxWorkers(n) {
    // Set max workers for all platform queues
    const { workerManager } = await import("./queue/workerManager.js");
    workerManager.updateWorkerConfig("youtube", { maxConcurrent: n });
    workerManager.updateWorkerConfig("tiktok", { maxConcurrent: n });
    workerManager.updateWorkerConfig("spotify", { maxConcurrent: n });
  }
}

export const queueManager = new QueueManagerShim();
export { PRIORITY };
export default queueManager;
