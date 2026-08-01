/**
 * Boombox — Queue Manager
 *
 * Manages a FIFO job queue with a worker pool.
 * Each job is an independent Promise — a failed job never blocks others.
 */

import { EventEmitter } from 'events';
import { analyticsManager } from './analytics.js';
import { monitoringManager } from './monitoring.js';

export const QUEUE_EVENTS = Object.freeze({
  JOB_ADDED:     'jobAdded',
  JOB_STARTED:   'jobStarted',
  JOB_COMPLETED: 'jobCompleted',
  JOB_FAILED:    'jobFailed',
});

let _jobSeq = 0;

/**
 * @typedef {Object} BoomboxJob
 * @property {string}   id         — unique job ID
 * @property {string}   cacheKey   — platform:videoId
 * @property {string}   platform
 * @property {string}   videoId
 * @property {string}   originalUrl
 * @property {string}   userId
 * @property {string}   guildId
 * @property {number}   createdAt
 * @property {Function} resolve
 * @property {Function} reject
 */

class QueueManager extends EventEmitter {
  constructor() {
    super();
    /** @type {BoomboxJob[]} */
    this._pending    = [];
    /** @type {Set<string>} active job IDs */
    this._active     = new Set();
    this._maxWorkers = 3;
    this._processor  = null; // set by WorkerPool on init
  }

  /**
   * Register the async function that processes one job.
   * Called once by WorkerPool during startup.
   * @param {(job: BoomboxJob) => Promise<string>} fn
   */
  setProcessor(fn) {
    this._processor = fn;
  }

  /**
   * Add a job to the queue. Returns a Promise that resolves with the audio URL.
   * @param {{ cacheKey, platform, videoId, originalUrl, userId, guildId }} params
   * @returns {Promise<string>}
   */
  enqueue(params) {
    return new Promise((resolve, reject) => {
      const job = {
        id: `job_${++_jobSeq}`,
        ...params,
        createdAt: Date.now(),
        resolve,
        reject,
      };
      this._pending.push(job);
      analyticsManager.incrementQueue();
      monitoringManager.update('queue', 'ok', `Pending: ${this._pending.length}`);
      this.emit(QUEUE_EVENTS.JOB_ADDED, job);
      this._tick();
    });
  }

  /** Drain the queue up to maxWorkers. */
  _tick() {
    while (this._active.size < this._maxWorkers && this._pending.length > 0) {
      const job = this._pending.shift();
      this._run(job);
    }
    monitoringManager.update('queue', 'ok',
      `Active: ${this._active.size} | Pending: ${this._pending.length}`);
  }

  async _run(job) {
    this._active.add(job.id);
    this.emit(QUEUE_EVENTS.JOB_STARTED, job);
    monitoringManager.update('worker', 'ok', `Running job ${job.id}`);

    try {
      if (!this._processor) throw new Error('No processor registered.');
      const result = await this._processor(job);
      job.resolve(result);
      this.emit(QUEUE_EVENTS.JOB_COMPLETED, job, result);
    } catch (err) {
      job.reject(err);
      this.emit(QUEUE_EVENTS.JOB_FAILED, job, err);
    } finally {
      this._active.delete(job.id);
      this._tick(); // pick up next job
    }
  }

  getStats() {
    return {
      pending:    this._pending.length,
      active:     this._active.size,
      maxWorkers: this._maxWorkers,
    };
  }

  setMaxWorkers(n) {
    this._maxWorkers = Math.max(1, Math.min(n, 10));
  }
}

export const queueManager = new QueueManager();
